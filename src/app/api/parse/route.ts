import { NextResponse } from "next/server";
import { parseIntent } from "@/lib/ai/parse-intent";
import { detectConflicts } from "@/lib/engine/conflicts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string; answers?: Record<string, string> };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  try {
    const spec = await parseIntent(text, body.answers ?? {});
    const conflicts = detectConflicts(spec);
    return NextResponse.json({ spec, conflicts });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `条件解析失败：${message}` }, { status: 500 });
  }
}
