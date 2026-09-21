import { describe, expect, it } from "vitest";
import { normalizeLlmSpec } from "@/lib/ai/parse-intent";
import { parseScreenSpec } from "@/lib/schema/screen-spec";

describe("normalizeLlmSpec", () => {
  it("repairs a DeepSeek payload that omitted ids, ops, and string assumptions", () => {
    const spec = parseScreenSpec(
      normalizeLlmSpec({
        version: "v1",
        conditions: [
          { field: "PE", operator: "<=", value: 25, label: "估值合理" },
          { metric: "roe", op: "≥", value: 8 },
          { field: "volatility_20d", operator: "lte", value: "35%" },
        ],
        assumptions: [{ text: "经营改善映射为 ROE，属于推断" }],
      }),
    );
    expect(spec.version).toBe(1);
    expect(spec.universe.market).toBe("A");
    expect(spec.conditions.map((c) => [c.field, c.op, c.value])).toEqual([
      ["pe_ttm", "lte", 25],
      ["roe_ttm", "gte", 0.08],
      ["volatility_20d", "lte", 0.35],
    ]);
    expect(spec.assumptions[0]).toMatch(/推断/);
  });
});
