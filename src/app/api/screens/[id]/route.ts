import { NextResponse } from "next/server";
import { getScreen } from "@/lib/db/screens";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const screen = getScreen(id);
  if (!screen) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(screen);
}
