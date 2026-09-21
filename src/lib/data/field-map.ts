import type { FieldProvenance } from "@/lib/schema/provenance";
import type { StockSnapshot } from "./types";

export const FIELD_DEFS: Record<string, { unit: string; definition: string }> = {
  pe_ttm: { unit: "倍", definition: "滚动市盈率 PE(TTM)" },
  roe_ttm: { unit: "比率", definition: "净资产收益率 ROE(TTM)" },
  volatility_20d: { unit: "比率", definition: "近20日收益波动率（年化近似）" },
  revenue_yoy: { unit: "比率", definition: "营业收入同比增速" },
};

export function makeField(
  field: string,
  rawValue: unknown,
  opts: {
    source: FieldProvenance["source"];
    asOf: string | null;
    status?: FieldProvenance["status"];
    message?: string;
  },
): FieldProvenance {
  const meta = FIELD_DEFS[field] ?? { unit: "", definition: field };
  const missing = rawValue == null;
  return {
    field,
    source: opts.source,
    asOf: opts.asOf,
    unit: meta.unit || null,
    definition: meta.definition,
    status: opts.status ?? (missing ? "missing" : "ok"),
    rawValue: missing ? null : rawValue,
    message: opts.message ?? (missing ? `${field} 缺失或未披露` : undefined),
  };
}

/** Map fuyao snapshot/financial payload into ScreenSpec fields when present. */
export function mapFuyaoRowToFields(
  row: Record<string, unknown>,
  asOf: string | null,
): Record<string, FieldProvenance> {
  const pe = row.pe_ttm ?? row.peTtm ?? row.pe;
  const roe = row.roe_ttm ?? row.roeTtm ?? row.roe;
  const vol = row.volatility_20d ?? row.volatility20d;
  const yoy = row.revenue_yoy ?? row.revenueYoy ?? row.operating_revenue_yoy;
  return {
    pe_ttm: makeField("pe_ttm", pe ?? null, {
      source: "fuyao",
      asOf,
      message: pe == null ? "扶摇响应未提供 pe_ttm（或映射字段），标为 missing" : undefined,
    }),
    roe_ttm: makeField("roe_ttm", roe ?? null, { source: "fuyao", asOf }),
    volatility_20d: makeField("volatility_20d", vol ?? null, { source: "fuyao", asOf }),
    revenue_yoy: makeField("revenue_yoy", yoy ?? null, { source: "fuyao", asOf }),
  };
}

export function errorFields(message: string, source: FieldProvenance["source"] = "fuyao"): Record<string, FieldProvenance> {
  const fields: Record<string, FieldProvenance> = {};
  for (const key of Object.keys(FIELD_DEFS)) {
    fields[key] = makeField(key, null, { source, asOf: null, status: "error", message });
  }
  return fields;
}

export function emptySnapshot(symbol: string, message: string): StockSnapshot {
  return { symbol, name: symbol, fields: errorFields(message) };
}

const A_SHARE = /^\d{6}\.(?:SH|SZ|BJ)$/i;

export function isAshareThscode(symbol: string): boolean {
  return A_SHARE.test(symbol.trim());
}

/** 财务指标接口的百分比数值（如 36.02 表示 36.02%）转为比率。 */
export function percentToRatio(raw: unknown): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return n / 100;
}

export function stockFromValuation(row: Record<string, unknown>, asOf: string | null): StockSnapshot {
  const symbol = String(row.thscode ?? row.symbol ?? "");
  const rawName = row.name;
  const name = typeof rawName === "string" && rawName.trim() ? rawName.trim() : symbol;
  const pe = row.pe_ttm ?? null;
  return {
    symbol,
    name,
    fields: {
      pe_ttm: makeField("pe_ttm", pe, {
        source: "fuyao",
        asOf,
        message: pe == null ? "估值快照未提供 pe_ttm" : "扶摇估值快照 pe_ttm",
      }),
      roe_ttm: makeField("roe_ttm", null, {
        source: "fuyao",
        asOf,
        status: "missing",
        message: "估值快照不含 ROE，需财务指标接口",
      }),
      revenue_yoy: makeField("revenue_yoy", null, {
        source: "fuyao",
        asOf,
        status: "missing",
        message: "估值快照不含营收同比，需财务指标接口",
      }),
      volatility_20d: makeField("volatility_20d", null, {
        source: "fuyao",
        asOf,
        status: "missing",
        message: "估值快照不含波动率；本次未用历史 K 线计算",
      }),
    },
  };
}

export function readIndicator(data: unknown, indexId: string): unknown {
  if (!data || typeof data !== "object") return null;
  const abilities = (data as { abilities?: unknown }).abilities;
  if (!Array.isArray(abilities)) return null;
  for (const ability of abilities) {
    if (!ability || typeof ability !== "object") continue;
    const indicators = (ability as { indicators?: unknown }).indicators;
    if (!Array.isArray(indicators)) continue;
    for (const indicator of indicators) {
      if (!indicator || typeof indicator !== "object") continue;
      const row = indicator as { index_id?: unknown; value?: unknown };
      if (row.index_id === indexId) return row.value ?? null;
    }
  }
  return null;
}
