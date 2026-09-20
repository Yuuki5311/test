import { describe, it, expect } from "vitest";
import { createProvider } from "@/lib/data/provider";

describe("DataProvider failures", () => {
  it("marks fields as error when fuyao throws, does not invent values", async () => {
    const provider = createProvider({
      mode: "fuyao",
      fuyaoFetch: async () => {
        throw new Error("upstream 503");
      },
    });
    const { stocks, warnings } = await provider.loadSnapshots(["600519.SH"]);
    expect(warnings.some((w) => /503|失败|error/i.test(w))).toBe(true);
    const pe = stocks[0]?.fields.pe_ttm;
    expect(pe?.status).toBe("error");
    expect(pe?.rawValue).toBeNull();
  });

  it("fixture mode returns provenance source=fixture", async () => {
    const provider = createProvider({ mode: "fixture" });
    const { stocks, dataMode } = await provider.loadSnapshots(["600519.SH"]);
    expect(dataMode).toBe("fixture");
    expect(stocks[0].fields.pe_ttm.source).toBe("fixture");
    expect(stocks[0].fields.pe_ttm.asOf).toBeTruthy();
  });
});
