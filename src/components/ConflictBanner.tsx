"use client";

import type { Conflict } from "@/lib/engine/conflicts";

export function ConflictBanner({ conflicts }: { conflicts: Conflict[] }) {
  if (!conflicts.length) return null;
  return (
    <div className="rounded-md border border-amber-700/40 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <strong>条件冲突：</strong>
      <ul className="mt-1 list-disc pl-5">
        {conflicts.map((c) => (
          <li key={c.message}>{c.message}</li>
        ))}
      </ul>
    </div>
  );
}
