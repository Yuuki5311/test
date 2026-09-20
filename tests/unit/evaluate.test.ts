import { describe, it, expect } from "vitest";
import { evaluateScreen } from "@/lib/engine/evaluate";
import type { StockSnapshot } from "@/lib/data/types";
import { parseScreenSpec } from "@/lib/schema/screen-spec";

function stock(symbol: string, values: Record<string, number | null>): StockSnapshot {
  const fields: StockSnapshot["fields"] = {};
  for (const [k, v] of Object.entries(values)) {
    fields[k] = {
      field: k,
      source: "fixture",
      asOf: "2026-09-19",
      unit: null,
      definition: k,
      status: v === null ? "missing" : "ok",
      rawValue: v,
    };
  }
  return { symbol, name: symbol, fields };
}

describe("evaluateScreen", () => {
  const spec = parseScreenSpec({
    version: 1,
    universe: { market: "A", excludeST: true },
    logic: "and",
    conditions: [
      { id: "c1", field: "pe_ttm", op: "lte", value: 20, soft: false },
      { id: "c2", field: "roe_ttm", op: "gte", value: 0.1, soft: false },
    ],
    clarifications: [],
    assumptions: [],
  });

  it("includes stocks meeting all hard conditions", () => {
    const result = evaluateScreen(spec, [
      stock("000001.SZ", { pe_ttm: 12, roe_ttm: 0.15 }),
      stock("000002.SZ", { pe_ttm: 30, roe_ttm: 0.15 }),
    ]);
    expect(result.included.map((x) => x.symbol)).toEqual(["000001.SZ"]);
    expect(result.excluded[0].failedConditionIds).toContain("c1");
  });

  it("marks missing fields as excluded with missing status, not silent pass", () => {
    const result = evaluateScreen(spec, [stock("600000.SH", { pe_ttm: null, roe_ttm: 0.2 })]);
    expect(result.included).toHaveLength(0);
    expect(result.excluded[0].reasons[0]).toMatch(/missing|缺失/i);
  });
});
