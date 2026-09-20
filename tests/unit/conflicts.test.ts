import { describe, it, expect } from "vitest";
import { detectConflicts } from "@/lib/engine/conflicts";
import { parseScreenSpec } from "@/lib/schema/screen-spec";

describe("detectConflicts", () => {
  it("detects impossible numeric range on same field", () => {
    const spec = parseScreenSpec({
      version: 1,
      universe: { market: "A" },
      logic: "and",
      conditions: [
        { id: "a", field: "pe_ttm", op: "lt", value: 10, soft: false },
        { id: "b", field: "pe_ttm", op: "gt", value: 20, soft: false },
      ],
      clarifications: [],
      assumptions: [],
    });
    const conflicts = detectConflicts(spec);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts[0].conditionIds).toEqual(expect.arrayContaining(["a", "b"]));
  });
});
