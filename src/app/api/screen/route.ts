import { NextResponse } from "next/server";
import { executeScreen } from "@/lib/screen/execute";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { spec?: unknown; intentText?: string };
  const payload = await executeScreen(body.spec, body.intentText);
  return NextResponse.json(payload);
}
