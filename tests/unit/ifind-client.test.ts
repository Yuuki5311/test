import { describe, it, expect } from "vitest";
import { createIfindClient } from "@/lib/data/ifind-client";

describe("ifind MCP client", () => {
  it("POSTs initialize then tools/call with Bearer token", async () => {
    const calls: Array<{ url: string; auth?: string; body: unknown }> = [];
    const client = createIfindClient({
      token: "tok",
      base: "https://api-mcp.51ifind.com:8643/ds-mcp-servers",
      postJson: async (url, headers, body) => {
        calls.push({ url, auth: headers.Authorization, body });
        if ((body as { method: string }).method === "initialize") {
          return { jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } };
        }
        return {
          jsonrpc: "2.0",
          id: 2,
          result: { content: [{ type: "text", text: JSON.stringify({ symbols: ["600519.SH"] }) }] },
        };
      },
    });
    const r = await client.searchStocks("市值大于500亿的半导体");
    expect(calls[0].auth).toBe("Bearer tok");
    expect(calls[0].url).toContain("hexin-ifind-ds-stock-mcp");
    expect((calls[0].body as { method: string }).method).toBe("initialize");
    expect((calls[1].body as { method: string }).method).toBe("tools/call");
    expect(r.symbols).toContain("600519.SH");
  });

  it("on upstream failure returns error status, empty candidates", async () => {
    const client = createIfindClient({
      token: "tok",
      postJson: async () => {
        throw new Error("405 Not Allowed");
      },
    });
    const r = await client.searchStocks("经营改善");
    expect(r.symbols).toEqual([]);
    expect(r.warning).toMatch(/405|失败/);
  });
});
