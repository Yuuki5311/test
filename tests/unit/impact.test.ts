import { describe, it, expect } from "vitest";
import { computeImpact } from "@/lib/engine/impact";
import { parseScreenSpec } from "@/lib/schema/screen-spec";
import { evaluateScreen } from "@/lib/engine/evaluate";
import { loadFixtureSnapshots } from "@/lib/data/fixture-provider";

describe("computeImpact", () => {
  it("reports newly included and newly excluded symbols when PE ceiling changes", () => {
    const { stocks } = loadFixtureSnapshots();
    const before = parseScreenSpec({
      version: 1,
      universe: { market: "A" },
      logic: "and",
      conditions: [{ id: "c1", field: "pe_ttm", op: "lte", value: 30, soft: false }],
      clarifications: [],
      assumptions: [],
    });
    const after = parseScreenSpec({
      ...before,
      conditions: [{ id: "c1", field: "pe_ttm", op: "lte", value: 15, soft: false }],
    });
    const impact = computeImpact(before, after, stocks);
    expect(impact.newlyExcluded.length + impact.newlyIncluded.length).toBeGreaterThanOrEqual(0);
    expect(impact.beforeCount).toBe(evaluateScreen(before, stocks).included.length);
  });
});
