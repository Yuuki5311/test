import { NextResponse } from "next/server";
import { barsFromHistorical, summarizeLastTradingDays } from "@/lib/backtest/recent-days";
import { loadRecentHistory } from "@/lib/data/provider";

export const runtime = "nodejs";

/** Last five trading days for one selected stock. Facts only, not a return promise. */
export async function POST(req: Request) {
  const body = (await req.json()) as { symbol?: string; name?: string };
  const symbol = body.symbol?.trim();
  if (!symbol) {
    return NextResponse.json({ error: "请先在入选列表勾选一只股票" }, { status: 400 });
  }

  try {
    const loaded = await loadRecentHistory(symbol);
    const bars = barsFromHistorical(loaded.data);
    const view = summarizeLastTradingDays(bars, 5);
    if (!view.days.length) {
      return NextResponse.json({ error: `${symbol} 没有可用的日K数据` }, { status: 502 });
    }
    return NextResponse.json({
      symbol,
      name: body.name?.trim() || symbol,
      source: loaded.source,
      ...view,
      disclaimer: "近五个交易日行情事实，非收益回测承诺；不构成投资建议。",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
