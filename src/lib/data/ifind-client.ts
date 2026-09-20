import { formatFetchError } from "./fetch-error";

type PostJson = (
  url: string,
  headers: Record<string, string>,
  body: unknown,
) => Promise<unknown>;

const STOCK = "hexin-ifind-ds-stock-mcp";
const NEWS = "hexin-ifind-ds-news-mcp";
const EDB = "hexin-ifind-ds-edb-mcp";

export function createIfindClient(opts: {
  token: string;
  base?: string;
  postJson?: PostJson;
}) {
  const base = opts.base ?? process.env.IFIND_MCP_BASE ?? "https://api-mcp.51ifind.com:8643/ds-mcp-servers";
  const post: PostJson =
    opts.postJson ??
    (async (url, headers, body) => {
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
          body: JSON.stringify(body),
        });
      } catch (e) {
        throw new Error(`fetch failed (${formatFetchError(e)})`);
      }
      if (!res.ok) throw new Error(`ifind HTTP ${res.status}`);
      return res.json();
    });

  let id = 1;
  async function mcpCall(server: string, toolName: string, args: Record<string, unknown>) {
    const url = `${base}/${server}`;
    const headers = { Authorization: `Bearer ${opts.token}` };
    await post(url, headers, {
      jsonrpc: "2.0",
      id: id++,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "nl-stock-screener", version: "0.1.0" },
      },
    });
    return post(url, headers, {
      jsonrpc: "2.0",
      id: id++,
      method: "tools/call",
      params: { name: toolName, arguments: args },
    });
  }

  return {
    async searchStocks(query: string) {
      try {
        const raw = await mcpCall(STOCK, "search_stocks", { query });
        const symbols = extractSymbols(raw);
        return { symbols, raw, warning: undefined as string | undefined };
      } catch (e) {
        return {
          symbols: [] as string[],
          raw: null,
          warning: `iFinD search_stocks 失败：${e instanceof Error ? e.message : String(e)}`,
        };
      }
    },
    async searchNotice(query: string, size = 3) {
      try {
        const raw = await mcpCall(NEWS, "search_notice", { query, size });
        return { raw, warning: undefined as string | undefined };
      } catch (e) {
        return { raw: null, warning: `iFinD search_notice 失败：${e instanceof Error ? e.message : String(e)}` };
      }
    },
    async searchEdb(query: string) {
      try {
        const raw = await mcpCall(EDB, "search_edb", { query });
        return { raw, warning: undefined as string | undefined };
      } catch (e) {
        return { raw: null, warning: `iFinD search_edb 失败：${e instanceof Error ? e.message : String(e)}` };
      }
    },
  };
}

function extractSymbols(raw: unknown): string[] {
  const out = new Set<string>();
  const re = /\b\d{6}\.(?:SH|SZ|BJ)\b/g;

  const visit = (node: unknown) => {
    if (node == null) return;
    if (typeof node === "string") {
      try {
        if (node.trim().startsWith("{") || node.trim().startsWith("[")) {
          visit(JSON.parse(node));
          return;
        }
      } catch {
        // plain text
      }
      for (const m of node.matchAll(re)) out.add(m[0]);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      if (Array.isArray(obj.symbols)) {
        for (const s of obj.symbols) if (typeof s === "string") out.add(s);
      }
      if (typeof obj.thscode === "string") out.add(obj.thscode);
      if (typeof obj.symbol === "string") out.add(obj.symbol);
      if (obj.result) visit(obj.result);
      if (obj.content) visit(obj.content);
      if (typeof obj.text === "string") visit(obj.text);
      for (const v of Object.values(obj)) {
        if (v && typeof v === "object") visit(v);
      }
    }
  };

  visit(raw);
  return [...out];
}
