import { NextResponse } from "next/server";
import { parseScreenSpec } from "@/lib/schema/screen-spec";
import { saveMonitor } from "@/lib/db/screens";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { name?: string; spec?: unknown };
  const name = body.name?.trim() || `监控 ${new Date().toLocaleString("zh-CN")}`;
  const spec = parseScreenSpec(body.spec);
  const monitor = saveMonitor(name, spec);
  return NextResponse.json(monitor);
}
