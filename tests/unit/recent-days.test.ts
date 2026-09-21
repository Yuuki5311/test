import { describe, expect, it } from "vitest";
import { barsFromHistorical, summarizeLastTradingDays } from "@/lib/backtest/recent-days";

function bar(day: number, close: number) {
  return {
    date_ms: Date.UTC(2026, 8, day) - 8 * 60 * 60 * 1000,
    open_price: close - 1,
    high_price: close + 1,
    low_price: close - 2,
    close_price: close,
    volume: 1000,
    turnover: close * 1000,
  };
}

describe("summarizeLastTradingDays", () => {
  it("keeps the last five trading days and describes the window", () => {
    const bars = barsFromHistorical({ item: [1, 2, 3, 4, 5, 6, 7].map((day) => bar(day, 100 + day)) });
    const view = summarizeLastTradingDays(bars, 5);
    expect(view.days.map((day) => day.date)).toEqual([
      "2026-09-03",
      "2026-09-04",
      "2026-09-05",
      "2026-09-06",
      "2026-09-07",
    ]);
    expect(view.days[0].changePct).toBeCloseTo((103 - 102) / 102 * 100);
    expect(view.summary).toContain("近 5 个交易日");
    expect(view.summary).toContain("上涨 5 天");
  });
});