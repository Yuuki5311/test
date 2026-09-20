import { NextResponse } from "next/server";
import { parseScreenSpec } from "@/lib/schema/screen-spec";
import { computeImpact } from "@/lib/engine/impact";
import { createProvider } from "@/lib/data/provider";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { before?: unknown; after?: unknown };
  const before = parseScreenSpec(body.before);
  const after = parseScreenSpec(body.after);
  const provider = createProvider({ mode: "fixture" });
  const { stocks } = await provider.loadSnapshots(
    (await provider.resolveUniverse(after)).symbols,
  );
  const impact = computeImpact(before, after, stocks);
  return NextResponse.json({
    impact,
    note: "条件变更对入选集合的影响（基于当前数据快照），不构成收益预测。",
  });
}
