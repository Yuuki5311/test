import { NextResponse } from "next/server";
import { buildClarifyQuestions } from "@/lib/ai/clarify";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { text?: string };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const questions = buildClarifyQuestions(text);
  return NextResponse.json({ text, questions });
}
