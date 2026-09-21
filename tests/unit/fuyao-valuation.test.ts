import { describe, expect, it } from "vitest";
import { percentToRatio, stockFromValuation } from "@/lib/data/field-map";
import { createProvider, mergeUniverse } from "@/lib/data/provider";

describe("fuyao valuation mapping", () => {
  it("keeps the Chinese name and PE from the valuation snapshot", () => {
    const stock = stockFromValuation(
      { thscode: "600519.SH", name: "贵州茅台", pe_ttm: 19.23 },
      "2026-09-21",
    );
    expect(stock.name).toBe("贵州茅台");
    expect(stock.fields.pe_ttm.rawValue).toBe(19.23);
    expect(stock.fields.pe_ttm.status).toBe("ok");
  });

  it("converts indicator percents to ratios", () => {
    expect(percentToRatio("36.0200")).toBeCloseTo(0.3602);
  });

  it("keeps the fixture names and fills up to the cap from the ticker list", () => {
    const merged = mergeUniverse(
      ["600519.SH"],
      ["600000.SH", "not-a-code", "600004.SH"],
      2,
    );
    expect(merged).toEqual(["600519.SH", "600000.SH"]);
  });

  it("loads names from valuations and ROE from financial indicators", async () => {
    const provider = createProvider({
      mode: "fuyao",
      ifindEnabled: "off",
      fuyaoFetch: async (path) => {
        if (path.includes("/meta/tickers/list")) {
          return { item: [{ thscode: "600000.SH", name: "浦发银行" }] };
        }
        if (path.includes("/valuations/snapshot")) {
          return {
            item: [
              { thscode: "600519.SH", name: "贵州茅台", pe_ttm: 19.2 },
              { thscode: "600000.SH", name: "浦发银行", pe_ttm: 6.1 },
            ],
          };
        }
        if (path.includes("/financials/indicators")) {
          return {
            abilities: [
              {
                ability: "growth",
                indicators: [{ index_id: "operating_income_yoy_growth_ratio", value: "15.5" }],
              },
              {
                ability: "profitability",
                indicators: [{ index_id: "index_weighted_avg_roe", value: "36.02" }],
              },
            ],
          };
        }
        throw new Error(`unexpected ${path}`);
      },
    });
    const universe = await provider.resolveUniverse(
      { universe: { market: "A", excludeST: true } } as never,
      undefined,
    );
    expect(universe.symbols[0]).toBe("600519.SH");
    expect(universe.symbols).toContain("600000.SH");
    const { stocks, dataMode } = await provider.loadSnapshots(["600519.SH"]);
    expect(dataMode).toBe("fuyao");
    expect(stocks[0].name).toBe("贵州茅台");
    expect(stocks[0].fields.roe_ttm.status).toBe("ok");
    expect(Number(stocks[0].fields.roe_ttm.rawValue)).toBeCloseTo(0.3602);
    expect(Number(stocks[0].fields.revenue_yoy.rawValue)).toBeCloseTo(0.155);
  });
});
