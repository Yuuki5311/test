import type { ScreenSpec } from "@/lib/schema/screen-spec";
import type { StockSnapshot } from "@/lib/data/types";
import { evaluateScreen } from "./evaluate";

export interface ImpactReport {
  beforeCount: number;
  afterCount: number;
  newlyIncluded: string[];
  newlyExcluded: string[];
  unchanged: string[];
}

export function computeImpact(before: ScreenSpec, after: ScreenSpec, stocks: StockSnapshot[]): ImpactReport {
  const b = new Set(evaluateScreen(before, stocks).included.map((x) => x.symbol));
  const a = new Set(evaluateScreen(after, stocks).included.map((x) => x.symbol));
  const newlyIncluded = [...a].filter((s) => !b.has(s));
  const newlyExcluded = [...b].filter((s) => !a.has(s));
  const unchanged = [...a].filter((s) => b.has(s));
  return {
    beforeCount: b.size,
    afterCount: a.size,
    newlyIncluded,
    newlyExcluded,
    unchanged,
  };
}
