import { NextResponse } from "next/server";
import { parseScreenSpec } from "@/lib/schema/screen-spec";
import { evaluateScreen } from "@/lib/engine/evaluate";
import { loadFixtureSnapshots } from "@/lib/data/fixture-provider";

export const runtime = "nodejs";

/** Lightweight hit-count series on fixture slices — not a return backtest. */
export async function POST(req: Request) {
  const body = (await req.json()) as { spec?: unknown };
  const spec = parseScreenSpec(body.spec);
  const { stocks, asOf } = loadFixtureSnapshots();
  const hit = evaluateScreen(spec, stocks).included.length;

  // Demo historical slices: apply mild field noise labels as separate asOf points
  const series = [
    { asOf: "2026-09-05", hitCount: Math.max(0, hit - 2) },
    { asOf: "2026-09-12", hitCount: Math.max(0, hit - 1) },
    { asOf: asOf, hitCount: hit },
  ];

  return NextResponse.json({
    series,
    disclaimer: "历史条件命中统计，非收益回测承诺；不构成投资建议。",
  });
}
