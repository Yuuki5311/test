import { describe, it, expect } from "vitest";
import { assertCompliantText, sanitizeAiOutput } from "@/lib/compliance/guard";

describe("compliance", () => {
  it("flags guaranteed return and trade advice", () => {
    const r = assertCompliantText("该股必将上涨，建议立即买入，稳赚不赔");
    expect(r.ok).toBe(false);
    expect(r.violations.length).toBeGreaterThan(0);
  });

  it("allows factual screening language", () => {
    const r = assertCompliantText("PE(TTM)=12.3（时点2026-09-19）满足 ≤20 条件");
    expect(r.ok).toBe(true);
  });

  it("sanitizeAiOutput appends compliance notice", () => {
    const out = sanitizeAiOutput("建议买入该股");
    expect(out).toMatch(/合规提示/);
  });
});
