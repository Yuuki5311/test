import { formatFetchError } from "./fetch-error";

export type FuyaoFetch = (path: string, init?: RequestInit) => Promise<unknown>;

export function createFuyaoFetch(
  baseUrl: string,
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): FuyaoFetch {
  return async (apiPath, init) => {
    let res: Response;
    try {
      res = await fetchImpl(`${baseUrl}${apiPath}`, {
        ...init,
        headers: {
          "X-api-key": apiKey,
          "Content-Type": "application/json",
          ...(init?.headers as Record<string, string> | undefined),
        },
      });
    } catch (e) {
      throw new Error(`fetch failed (${formatFetchError(e)})`);
    }
    if (res.status === 429) throw new Error("fuyao rate limited (429)");
    const body = await res.json();
    return parseFuyaoEnvelope(body);
  };
}

export function parseFuyaoEnvelope(body: unknown) {
  const b = body as { code?: number; message?: string; data?: unknown };
  if (b.code !== 0 && b.code !== undefined && b.code !== 200) {
    // 扶摇业务错误经 code 表达；0/200 以文档实测为准，实现时对照 llms-full.txt
    throw new Error(`fuyao business code=${b.code}: ${b.message ?? ""}`);
  }
  return b.data;
}

/** 批量快照：GET /api/a-share/prices/snapshot?thscodes=600519.SH,000001.SZ */
export async function fetchSnapshots(fetchFn: FuyaoFetch, thscodes: string[]) {
  const q = encodeURIComponent(thscodes.join(","));
  return fetchFn(`/api/a-share/prices/snapshot?thscodes=${q}`);
}

/** 单票历史 K：GET /api/a-share/prices/historical?thscode=&interval=1d&start=&end=&adjust=forward */
export async function fetchHistorical(
  fetchFn: FuyaoFetch,
  thscode: string,
  startMs: number,
  endMs: number,
) {
  const q = new URLSearchParams({
    thscode,
    interval: "1d",
    start: String(startMs),
    end: String(endMs),
    adjust: "forward",
  });
  return fetchFn(`/api/a-share/prices/historical?${q}`);
}

/** 财务：GET /api/a-share/financials/income-statements?thscode=&period=quarterly&limit=4 */
export async function fetchIncomeStatements(fetchFn: FuyaoFetch, thscode: string) {
  const q = new URLSearchParams({ thscode, period: "quarterly", limit: "4" });
  return fetchFn(`/api/a-share/financials/income-statements?${q}`);
}
