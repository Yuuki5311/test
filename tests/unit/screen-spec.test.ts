import { describe, it, expect } from "vitest";
import { ScreenSpecSchema, parseScreenSpec } from "@/lib/schema/screen-spec";

describe("ScreenSpecSchema", () => {
  it("accepts a valid operating-improvement + valuation screen", () => {
    const raw = {
      version: 1,
      universe: { market: "A", excludeST: true },
      logic: "and",
      conditions: [
        {
          id: "c1",
          field: "roe_ttm",
          op: "gte",
          value: 0.08,
          label: "ROE(TTM) ≥ 8%",
          soft: false,
        },
        {
          id: "c2",
          field: "pe_ttm",
          op: "between",
          value: [8, 25],
          label: "PE(TTM) 在 8–25",
          soft: false,
        },
        {
          id: "c3",
          field: "volatility_20d",
          op: "lte",
          value: 0.35,
          label: "20日波动率 ≤ 35%",
          soft: true,
        },
      ],
      clarifications: [],
      assumptions: ["经营改善暂用 ROE_TTM 代理，属推断映射"],
    };
    const parsed = parseScreenSpec(raw);
    expect(parsed.conditions).toHaveLength(3);
    expect(parsed.logic).toBe("and");
  });

  it("rejects unknown operators", () => {
    expect(() =>
      parseScreenSpec({
        version: 1,
        universe: { market: "A" },
        logic: "and",
        conditions: [{ id: "x", field: "pe_ttm", op: "maybe", value: 1 }],
        clarifications: [],
        assumptions: [],
      }),
    ).toThrow();
  });
});
