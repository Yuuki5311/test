import { NextResponse } from "next/server";
import { getScreen } from "@/lib/db/screens";
import { evaluateScreen } from "@/lib/engine/evaluate";
import { createProvider } from "@/lib/data/provider";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = (await req.json()) as { ids?: string[]; idA?: string; idB?: string };
  const ids = (body.ids?.length ? body.ids : [body.idA, body.idB]).filter((id): id is string => Boolean(id));
  const screens = ids.map((id) => getScreen(id)).filter((screen) => screen != null);
  if (screens.length < 2) {
    return NextResponse.json({ error: "请至少选择两个已保存策略" }, { status: 400 });
  }

  const provider = createProvider({ mode: "fixture" });
  const { stocks } = await provider.loadSnapshots((await provider.resolveUniverse(screens[0].spec)).symbols);
  const items = screens.map((screen) => {
    const included = evaluateScreen(screen.spec, stocks).included.map((row) => row.symbol);
    return { id: screen.id, name: screen.name, count: included.length, symbols: included };
  });
  const base = items[0];
  const baseSet = new Set(base.symbols);
  const pairs = items.slice(1).map((other) => {
    const otherSet = new Set(other.symbols);
    return {
      baseName: base.name,
      otherName: other.name,
      newlyIncluded: [...otherSet].filter((symbol) => !baseSet.has(symbol)),
      newlyExcluded: [...baseSet].filter((symbol) => !otherSet.has(symbol)),
    };
  });

  return NextResponse.json({
    items: items.map(({ id, name, count }) => ({ id, name, count })),
    pairs,
    note: "比较基于内置样本股票上的条件命中差异，不是收益对比，也不使用刚才的实时筛选结果。",
  });
}
