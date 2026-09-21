import { NextResponse } from "next/server";
import { deleteMonitors, listMonitors } from "@/lib/db/screens";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ monitors: listMonitors() });
}

export async function DELETE(req: Request) {
  const body = (await req.json()) as { ids?: string[] };
  const ids = (body.ids ?? []).filter((id) => typeof id === "string" && id);
  if (!ids.length) return NextResponse.json({ error: "请选择要删除的监控任务" }, { status: 400 });
  return NextResponse.json(deleteMonitors(ids));
}
