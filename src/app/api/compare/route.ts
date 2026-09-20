import { NextResponse } from "next/server";
import { getScreen } from "@/lib/db/screens";
import { computeImpact } from "@/lib/engine/impact";
import { evaluateScreen } from "@/lib/engine/evaluate";
import { createProvider } from "@/lib/data/provider";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { idA?: string; idB?: string };
  const a = body.idA ? getScreen(body.idA) : null;
  const b = body.idB ? getScreen(body.idB) : null;
  if (!a || !b) return NextResponse.json({ error: "idA and idB required" }, { status: 400 });

  const provider = createProvider({ mode: "fixture" });
  const { stocks } = await provider.loadSnapshots((await provider.resolveUniverse(a.spec)).symbols);
  const evalA = evaluateScreen(a.spec, stocks);
  const evalB = evaluateScreen(b.spec, stocks);
  const impact = computeImpact(a.spec, b.spec, stocks);

  return NextResponse.json({
    a: { id: a.id, name: a.name, count: evalA.included.length },
    b: { id: b.id, name: b.name, count: evalB.included.length },
    impact,
  });
}
