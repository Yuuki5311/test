import type { ScreenSpec } from "@/lib/schema/screen-spec";
import {
  createFuyaoFetch,
  fetchAshareTickers,
  fetchFinancialIndicators,
  fetchValuationSnapshot,
  type FuyaoFetch,
} from "./fuyao-client";
import { createIfindClient } from "./ifind-client";
import { loadFixtureSnapshots, loadFixtureUniverse } from "./fixture-provider";
import {
  emptySnapshot,
  isAshareThscode,
  makeField,
  percentToRatio,
  readIndicator,
  stockFromValuation,
} from "./field-map";
import type { StockSnapshot } from "./types";

export interface ProviderOptions {
  mode?: "auto" | "fuyao" | "fixture";
  fuyaoFetch?: FuyaoFetch;
  ifindEnabled?: "auto" | "on" | "off";
  ifindToken?: string;
}

/** 估值接口单次上限，也是本次真实股票池上限。 */
export const FUYAO_UNIVERSE_CAP = 100;
/** 财务指标是单票接口，只给前 N 只补 ROE / 营收同比，避免触发限流。 */
const INDICATOR_ENRICH_CAP = 24;
const INDICATOR_REPORTS = ["2025-4", "2025-2", "2024-4"];

function resolveMode(opts: ProviderOptions): "auto" | "fuyao" | "fixture" {
  return opts.mode ?? (process.env.DATA_MODE as ProviderOptions["mode"]) ?? "auto";
}

function resolveIfindEnabled(opts: ProviderOptions): boolean {
  const flag = opts.ifindEnabled ?? (process.env.IFIND_ENABLED as ProviderOptions["ifindEnabled"]) ?? "auto";
  const token = opts.ifindToken ?? process.env.IFIND_MCP_TOKEN ?? "";
  if (flag === "off") return false;
  if (flag === "on") return Boolean(token);
  return Boolean(token);
}

function fuyaoFetchFor(opts: ProviderOptions): FuyaoFetch | null {
  if (opts.fuyaoFetch) return opts.fuyaoFetch;
  if (!process.env.FUYAO_API_KEY) return null;
  return createFuyaoFetch(
    process.env.FUYAO_BASE_URL ?? "https://fuyao.aicubes.cn",
    process.env.FUYAO_API_KEY,
  );
}

export function mergeUniverse(base: string[], extra: string[], cap = FUYAO_UNIVERSE_CAP): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of [...base, ...extra]) {
    const symbol = raw.trim().toUpperCase();
    if (!isAshareThscode(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    out.push(symbol);
    if (out.length >= cap) break;
  }
  return out;
}

export function createProvider(opts: ProviderOptions = {}) {
  const mode = resolveMode(opts);

  return {
    async resolveUniverse(spec: ScreenSpec, intentText?: string) {
      const warnings: string[] = [];
      let symbols = loadFixtureUniverse();
      let candidateSource: "fixture" | "ifind" | "mixed" = "fixture";

      if (resolveIfindEnabled(opts) && intentText) {
        const client = createIfindClient({
          token: opts.ifindToken ?? process.env.IFIND_MCP_TOKEN ?? "",
        });
        const cand = await client.searchStocks(intentText);
        if (cand.warning) warnings.push(cand.warning);
        if (cand.symbols.length) {
          symbols = mergeUniverse(symbols, cand.symbols, Number.MAX_SAFE_INTEGER);
          candidateSource = "mixed";
          warnings.push(`iFinD search_stocks 返回 ${cand.symbols.length} 只候选，已与基础股票池合并（须经引擎确认）`);
        }
      }

      const fetchFn = mode === "fixture" ? null : fuyaoFetchFor(opts);
      if (fetchFn) {
        try {
          const listed = await fetchAshareTickers(fetchFn, FUYAO_UNIVERSE_CAP, 0);
          const extra = extractItems(listed)
            .map((row) => String(row.thscode ?? ""))
            .filter(Boolean);
          const before = symbols.length;
          symbols = mergeUniverse(symbols, extra);
          warnings.push(
            `扶摇代码表补充 A 股 ${Math.max(0, symbols.length - before)} 只，本次股票池 ${symbols.length} 只（上限 ${FUYAO_UNIVERSE_CAP}，不是全市场）`,
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          warnings.push(`扶摇代码表获取失败：${msg}；继续使用已有股票池`);
        }
      }

      void spec;
      return { symbols, warnings, candidateSource };
    },

    async loadSnapshots(symbols: string[]) {
      const warnings: string[] = [];
      const fetchFn = fuyaoFetchFor(opts);
      const hasFuyaoKey = Boolean(fetchFn);

      if (mode === "fixture" || (mode === "auto" && !hasFuyaoKey)) {
        if (mode === "auto" && !hasFuyaoKey) {
          warnings.push("未配置 FUYAO_API_KEY，DATA_MODE=auto 使用 fixture（非实时行情）");
        }
        const { stocks } = loadFixtureSnapshots(symbols);
        return { stocks, dataMode: "fixture" as const, warnings };
      }

      try {
        const items = extractItems(await fetchValuationSnapshot(fetchFn!, symbols.slice(0, FUYAO_UNIVERSE_CAP)));
        const asOf = new Date().toISOString().slice(0, 10);
        const byCode = new Map(items.map((row) => [String(row.thscode ?? "").toUpperCase(), row]));
        const stocks: StockSnapshot[] = symbols.slice(0, FUYAO_UNIVERSE_CAP).map((symbol) => {
          const row = byCode.get(symbol.toUpperCase());
          if (!row) return emptySnapshot(symbol, "扶摇估值快照未返回该标的");
          return stockFromValuation(row, asOf);
        });
        const enriched = await enrichIndicators(fetchFn!, stocks.slice(0, INDICATOR_ENRICH_CAP), warnings);
        const rest = stocks.slice(INDICATOR_ENRICH_CAP);
        if (rest.length) {
          warnings.push(
            `仅前 ${INDICATOR_ENRICH_CAP} 只请求了财务指标（ROE、营收同比）；其余标的这两项为 missing`,
          );
        }
        return { stocks: [...enriched, ...rest], dataMode: "fuyao" as const, warnings };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        warnings.push(`扶摇调用失败：${msg}；已返回 error 状态字段，未使用虚构正常值`);
        if (mode === "auto") {
          warnings.push("DATA_MODE=auto，降级到 fixture，请注意口径不是实时行情");
          const { stocks } = loadFixtureSnapshots(symbols);
          return { stocks, dataMode: "fixture" as const, warnings };
        }
        return {
          stocks: symbols.map((s) => emptySnapshot(s, msg)),
          dataMode: "fuyao" as const,
          warnings,
        };
      }
    },
  };
}

async function enrichIndicators(fetchFn: FuyaoFetch, stocks: StockSnapshot[], warnings: string[]) {
  if (!stocks.length) return stocks;
  const picked = await pickIndicatorReport(fetchFn, stocks[0].symbol);
  if (!picked) {
    warnings.push("财务指标接口无可用报告期，ROE 与营收同比保持 missing");
    return stocks;
  }
  const { report, data: firstData } = picked;
  warnings.push(`财务指标报告期 ${report}（百分比已换算为比率）`);
  const out: StockSnapshot[] = [applyIndicators(stocks[0], firstData, report)];
  for (const stock of stocks.slice(1)) {
    try {
      const data = await fetchFinancialIndicators(fetchFn, stock.symbol, report);
      out.push(applyIndicators(stock, data, report));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`${stock.symbol} 财务指标失败：${msg}`);
      out.push(stock);
      if (/429|限流|rate/i.test(msg)) {
        warnings.push("财务指标触发限流，后续标的不再请求");
        out.push(...stocks.slice(out.length));
        break;
      }
    }
  }
  return out;
}

async function pickIndicatorReport(
  fetchFn: FuyaoFetch,
  symbol: string,
): Promise<{ report: string; data: unknown } | null> {
  for (const report of INDICATOR_REPORTS) {
    try {
      const data = await fetchFinancialIndicators(fetchFn, symbol, report);
      return { report, data };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/429|限流|rate/i.test(msg)) throw e;
    }
  }
  return null;
}

function applyIndicators(stock: StockSnapshot, data: unknown, report: string): StockSnapshot {
  const roe = percentToRatio(readIndicator(data, "index_weighted_avg_roe"));
  const yoy = percentToRatio(readIndicator(data, "operating_income_yoy_growth_ratio"));
  return {
    ...stock,
    fields: {
      ...stock.fields,
      roe_ttm: makeField("roe_ttm", roe, {
        source: "fuyao",
        asOf: report,
        status: roe == null ? "missing" : "ok",
        message:
          roe == null
            ? `财务指标 ${report} 未提供净资产收益率`
            : `财务指标 ${report} 加权净资产收益率，百分数已除以 100`,
      }),
      revenue_yoy: makeField("revenue_yoy", yoy, {
        source: "fuyao",
        asOf: report,
        status: yoy == null ? "missing" : "ok",
        message:
          yoy == null
            ? `财务指标 ${report} 未提供营业收入同比增长率`
            : `财务指标 ${report} 营业收入同比增长率，百分数已除以 100`,
      }),
    },
  };
}

function extractItems(data: unknown): Array<Record<string, unknown>> {
  if (!data) return [];
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.item)) return obj.item as Array<Record<string, unknown>>;
    if (Array.isArray(obj.items)) return obj.items as Array<Record<string, unknown>>;
  }
  return [];
}
