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
