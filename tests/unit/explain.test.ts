import { describe, it, expect } from "vitest";
import { buildExplanation } from "@/lib/explain/builder";

describe("buildExplanation", () => {
  it("separates fact vs assumption and cites provenance", () => {
    const text = buildExplanation(
      {
        symbol: "600519.SH",
        name: "贵州茅台",
        passed: true,
        conditionResults: [
          {
            conditionId: "c1",
            passed: true,
            soft: false,
            status: "ok",
            actual: 22.5,
            message: "ok",
            provenance: {
              field: "pe_ttm",
              source: "fixture",
              asOf: "2026-09-19",
              unit: "倍",
              definition: "PE(TTM)",
              status: "ok",
              rawValue: 22.5,
            },
          },
        ],
        failedConditionIds: [],
        reasons: [],
      },
      { assumptions: ["经营改善用 ROE 代理（推断）"] } as never,
    );
    expect(text.facts.join(" ")).toMatch(/PE\(TTM\)|pe_ttm/i);
    expect(text.facts.join(" ")).toMatch(/2026-09-19/);
    expect(text.inferences.some((x) => /推断|代理/.test(x))).toBe(true);
    expect(text.disclaimer).toMatch(/不构成|投资建议|买卖/i);
  });
});
