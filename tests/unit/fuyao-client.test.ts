import { describe, it, expect } from "vitest";
import { createFuyaoFetch, parseFuyaoEnvelope } from "@/lib/data/fuyao-client";

describe("fuyao auth and envelope", () => {
  it("sends X-api-key header not Bearer", async () => {
    const seen: Record<string, string> = {};
    const fetchFn = createFuyaoFetch("https://example.test", "k-test", async (_url, init) => {
      Object.assign(seen, init?.headers ?? {});
      return {
        ok: true,
        status: 200,
        json: async () => ({ code: 0, message: "ok", request_id: "r1", data: { item: [] } }),
      } as Response;
    });
    await fetchFn("/api/a-share/prices/snapshot?thscodes=600519.SH");
    expect(seen["X-api-key"] ?? seen["x-api-key"]).toBe("k-test");
    expect(JSON.stringify(seen)).not.toMatch(/Bearer/);
  });

  it("surfaces business code errors without inventing data", () => {
    expect(() => parseFuyaoEnvelope({ code: 2001, message: "invalid key", data: null })).toThrow(/2001/);
  });
});
