"use client";

type Item = { id: string; name: string; count: number };
type Pair = {
  baseName: string;
  otherName: string;
  newlyIncluded: string[];
  newlyExcluded: string[];
};

export function CompareView({
  payload,
}: {
  payload: {
    items: Item[];
    pairs: Pair[];
    note?: string;
  } | null;
}) {
  if (!payload) return null;
  return (
    <div data-testid="compare-view" className="rounded-md border border-[var(--line)] bg-white/90 p-4 text-sm">
      <h3 className="font-semibold text-[var(--ink)]">策略比较</h3>
      <ul className="mt-2 space-y-1">
        {payload.items.map((item) => (
          <li key={item.id}>
            {item.name}：入选 {item.count} 只
          </li>
        ))}
      </ul>
      <div className="mt-3 space-y-2">
        {payload.pairs.map((pair) => (
          <p key={`${pair.baseName}-${pair.otherName}`} className="text-[var(--muted)]">
            相对「{pair.baseName}」，「{pair.otherName}」新增入选 {pair.newlyIncluded.length} 只，新排除{" "}
            {pair.newlyExcluded.length} 只
            {pair.newlyIncluded.length > 0 ? `（新增 ${pair.newlyIncluded.slice(0, 6).join("、")}）` : ""}
          </p>
        ))}
      </div>
      {payload.note && <p className="mt-2 text-xs text-[var(--muted)]">{payload.note}</p>}
    </div>
  );
}
