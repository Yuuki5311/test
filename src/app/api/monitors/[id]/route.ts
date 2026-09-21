import { NextResponse } from "next/server";
import { getMonitor } from "@/lib/db/screens";

export const runtime = "nodejs";

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const monitor = getMonitor(id);
  if (!monitor) return NextResponse.json({ error: "找不到这个监控任务" }, { status: 404 });
  return NextResponse.json(monitor);
}
