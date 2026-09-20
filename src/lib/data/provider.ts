import type { ScreenSpec } from "@/lib/schema/screen-spec";
import { createFuyaoFetch, type FuyaoFetch } from "./fuyao-client";
import { createIfindClient } from "./ifind-client";
import { loadFixtureSnapshots, loadFixtureUniverse } from "./fixture-provider";
import { emptySnapshot, mapFuyaoRowToFields } from "./field-map";
import type { StockSnapshot } from "./types";

export interface ProviderOptions {
  mode?: "auto" | "fuyao" | "fixture";
  fuyaoFetch?: FuyaoFetch;
  ifindEnabled?: "auto" | "on" | "off";
  ifindToken?: string;
}

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
          const set = new Set([...cand.symbols, ...symbols]);
          symbols = [...set];
          candidateSource = "mixed";
          warnings.push(`iFinD search_stocks 返回 ${cand.symbols.length} 只候选，已与基础股票池合并（须经引擎确认）`);
        }
      }

      void spec;
      return { symbols, warnings, candidateSource };
    },

    async loadSnapshots(symbols: string[]) {
      const warnings: string[] = [];
      const hasFuyaoKey = Boolean(process.env.FUYAO_API_KEY) || Boolean(opts.fuyaoFetch);

      if (mode === "fixture" || (mode === "auto" && !hasFuyaoKey)) {
        if (mode === "auto" && !hasFuyaoKey) {
          warnings.push("未配置 FUYAO_API_KEY，DATA_MODE=auto 使用 fixture（非实时行情）");
        }
        const { stocks } = loadFixtureSnapshots(symbols);
        return { stocks, dataMode: "fixture" as const, warnings };
      }

      const fetchFn =
        opts.fuyaoFetch ??
        createFuyaoFetch(
          process.env.FUYAO_BASE_URL ?? "https://fuyao.aicubes.cn",
          process.env.FUYAO_API_KEY ?? "",
        );

      try {
        // Injected fuyaoFetch in tests may throw before returning rows.
        const data = await fetchFn(
          `/api/a-share/prices/snapshot?thscodes=${encodeURIComponent(symbols.join(","))}`,
        );
        const items = extractItems(data);
        const stocks: StockSnapshot[] = symbols.map((symbol) => {
          const row = items.find((it) => String(it.thscode ?? it.symbol) === symbol);
          if (!row) {
            return emptySnapshot(symbol, "扶摇快照未返回该标的");
          }
          const asOf = typeof row.as_of === "string" ? row.as_of : new Date().toISOString().slice(0, 10);
          return {
            symbol,
            name: String(row.name ?? symbol),
            fields: mapFuyaoRowToFields(row, asOf),
          };
        });
        return { stocks, dataMode: "fuyao" as const, warnings };
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
