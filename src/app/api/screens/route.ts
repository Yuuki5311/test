import { NextResponse } from "next/server";
import { parseScreenSpec } from "@/lib/schema/screen-spec";
import { listScreens, saveScreen } from "@/lib/db/screens";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ screens: listScreens() });
}

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; spec?: unknown };
  const name = body.name?.trim() || `策略 ${new Date().toLocaleString("zh-CN")}`;
  const spec = parseScreenSpec(body.spec);
  const saved = saveScreen(name, spec);
  return NextResponse.json(saved);
}
