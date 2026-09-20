"use client";

export function CompareView({
  payload,
}: {
  payload: {
    a: { id: string; name: string; count: number };
    b: { id: string; name: string; count: number };
    impact: { newlyIncluded: string[]; newlyExcluded: string[]; beforeCount: number; afterCount: number };
  } | null;
}) {
  if (!payload) return null;
  return (
    <div className="rounded-md border border-[var(--line)] bg-white/90 p-4 text-sm">
      <h3 className="font-semibold text-[var(--ink)]">策略比较</h3>
      <p className="mt-2">
        {payload.a.name}: {payload.a.count} 只 · {payload.b.name}: {payload.b.count} 只
      </p>
      <p className="mt-1 text-[var(--muted)]">
        新增入选 {payload.impact.newlyIncluded.length} · 新排除 {payload.impact.newlyExcluded.length}
      </p>
    </div>
  );
}
