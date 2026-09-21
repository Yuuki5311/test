import type { ScreenSpec } from "@/lib/schema/screen-spec";
import fs from "fs";
import path from "path";
import {
  createFuyaoFetch,
  fetchAshareTickers,
  fetchFinancialIndicators,
  fetchHistorical,
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
const INDICATOR_REPORTS = ["2025-4", "2025-2", "2024-4"];
const INDICATOR_GAP_MS = 300;

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
        const enriched = await enrichIndicators(fetchFn!, stocks, warnings, !opts.fuyaoFetch);
        const withVol = await enrichVolatility(fetchFn!, enriched, warnings, !opts.fuyaoFetch);
        const missing = withVol.filter((s) => s.fields.roe_ttm?.status !== "ok").length;
        if (missing) {
          warnings.push(`财务指标未补齐 ${missing} 只（接口失败或未披露），这些标的的 ROE、营收同比为 missing`);
        }
        return { stocks: withVol, dataMode: "fuyao" as const, warnings };
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

async function enrichIndicators(
  fetchFn: FuyaoFetch,
  stocks: StockSnapshot[],
  warnings: string[],
  useCache: boolean,
) {
  if (!stocks.length) return stocks;
  const picked = await pickIndicatorReport(fetchFn, stocks[0].symbol, useCache);
  if (!picked) {
    warnings.push("财务指标接口无可用报告期，ROE 与营收同比保持 missing");
    return stocks;
  }
  const { report, data: firstData } = picked;
  warnings.push(`财务指标报告期 ${report}，逐只补齐本次 ${stocks.length} 只（百分数已换算为比率）`);
  const out: StockSnapshot[] = [applyIndicators(stocks[0], firstData, report)];
  for (const stock of stocks.slice(1)) {
    await sleep(INDICATOR_GAP_MS);
    try {
      const data = await fetchIndicatorCached(fetchFn, stock.symbol, report, useCache);
      out.push(applyIndicators(stock, data, report));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`${stock.symbol} 财务指标失败：${msg}`);
      out.push(stock);
    }
  }
  return out;
}

async function fetchIndicatorCached(fetchFn: FuyaoFetch, symbol: string, report: string, useCache: boolean) {
  if (useCache) {
    const cached = readIndicatorCache(symbol, report);
    if (cached) return cached;
  }
  const data = await fetchIndicatorWithRetry(fetchFn, symbol, report);
  if (useCache) writeIndicatorCache(symbol, report, data);
  return data;
}

async function fetchIndicatorWithRetry(fetchFn: FuyaoFetch, symbol: string, report: string) {
  let waitMs = 1000;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await fetchFinancialIndicators(fetchFn, symbol, report);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!/429|限流|rate/i.test(msg) || attempt === 3) throw e;
      await sleep(waitMs);
      waitMs *= 2;
    }
  }
  throw new Error("财务指标重试后仍失败");
}

function indicatorCachePath() {
  return path.join(process.cwd(), "data", "fuyao-indicator-cache.json");
}

function readIndicatorCache(symbol: string, report: string): unknown | null {
  try {
    const raw = JSON.parse(fs.readFileSync(indicatorCachePath(), "utf8")) as Record<string, unknown>;
    return raw[`${symbol}|${report}`] ?? null;
  } catch {
    return null;
  }
}

function writeIndicatorCache(symbol: string, report: string, data: unknown) {
  const file = indicatorCachePath();
  let store: Record<string, unknown> = {};
  try {
    store = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    store = {};
  }
  store[`${symbol}|${report}`] = data;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store));
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function firstIndicator(data: unknown, ids: string[]): unknown {
  for (const id of ids) {
    const value = readIndicator(data, id);
    if (value != null && value !== "") return value;
  }
  return null;
}

/** 近 20 个交易日对数收益的年化标准差。 */
export function volatilityFromCloses(closes: number[]): number | null {
  const rets: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const prev = closes[i - 1];
    const cur = closes[i];
    if (prev > 0 && cur > 0) rets.push(Math.log(cur / prev));
  }
  const window = rets.slice(-20);
  if (window.length < 10) return null;
  const mean = window.reduce((sum, value) => sum + value, 0) / window.length;
  const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (window.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

async function enrichVolatility(
  fetchFn: FuyaoFetch,
  stocks: StockSnapshot[],
  warnings: string[],
  useCache: boolean,
) {
  const end = Date.now();
  const start = end - 50 * 24 * 60 * 60 * 1000;
  const out: StockSnapshot[] = [];
  for (const [index, stock] of stocks.entries()) {
    if (index > 0) await sleep(INDICATOR_GAP_MS);
    try {
      const data = await fetchHistoricalCached(fetchFn, stock.symbol, start, end, useCache);
      const closes = extractItems(data)
        .map((row) => Number(row.close_price))
        .filter((price) => Number.isFinite(price) && price > 0);
      const vol = volatilityFromCloses(closes);
      out.push({
        ...stock,
        fields: {
          ...stock.fields,
          volatility_20d: makeField("volatility_20d", vol == null ? null : Number(vol.toFixed(4)), {
            source: "fuyao",
            asOf: new Date().toISOString().slice(0, 10),
            status: vol == null ? "missing" : "ok",
            message:
              vol == null
                ? `历史K线不足以计算20日波动率（收盘价 ${closes.length} 个）`
                : "由扶摇历史日K收盘价的近20日对数收益标准差年化",
          }),
        },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`${stock.symbol} 波动率计算失败：${msg}`);
      out.push(stock);
    }
  }
  return out;
}

/** 单只股票近月日K。优先实时请求，失败时用本地缓存。 */
export async function loadRecentHistory(symbol: string): Promise<{ data: unknown; source: "fuyao" | "cache" }> {
  const key = `${symbol}|1d`;
  const fetchFn = fuyaoFetchFor({});
  const end = Date.now();
  const start = end - 30 * 24 * 60 * 60 * 1000;
  if (fetchFn) {
    try {
      const data = await fetchHistorical(fetchFn, symbol, start, end);
      return { data, source: "fuyao" };
    } catch (e) {
      const cached = readNamedCache("fuyao-price-cache.json", key);
      if (cached) return { data: cached, source: "cache" };
      throw e;
    }
  }
  const cached = readNamedCache("fuyao-price-cache.json", key);
  if (cached) return { data: cached, source: "cache" };
  throw new Error("未配置扶摇密钥，且没有该股票的历史行情缓存");
}

async function fetchHistoricalCached(
  fetchFn: FuyaoFetch,
  symbol: string,
  start: number,
  end: number,
  useCache: boolean,
) {
  const key = `${symbol}|1d`;
  if (useCache) {
    const cached = readNamedCache("fuyao-price-cache.json", key);
    if (cached) return cached;
  }
  const data = await fetchHistorical(fetchFn, symbol, start, end);
  if (useCache) writeNamedCache("fuyao-price-cache.json", key, data);
  return data;
}

function readNamedCache(fileName: string, key: string): unknown | null {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", fileName), "utf8")) as Record<string, unknown>;
    return raw[key] ?? null;
  } catch {
    return null;
  }
}

function writeNamedCache(fileName: string, key: string, data: unknown) {
  const file = path.join(process.cwd(), "data", fileName);
  let store: Record<string, unknown> = {};
  try {
    store = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
  } catch {
    store = {};
  }
  store[key] = data;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store));
}

async function pickIndicatorReport(
  fetchFn: FuyaoFetch,
  symbol: string,
  useCache: boolean,
): Promise<{ report: string; data: unknown } | null> {
  for (const report of INDICATOR_REPORTS) {
    try {
      const data = await fetchIndicatorCached(fetchFn, symbol, report, useCache);
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
  const yoy = percentToRatio(
    firstIndicator(data, [
      "calculate_operating_income_yoy_growth_ratio",
      "operating_income_yoy_growth_ratio",
    ]),
  );
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
