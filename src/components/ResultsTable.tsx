"use client";

import type { StockEval } from "@/lib/engine/evaluate";

type Props = {
  included: StockEval[];
  excluded: StockEval[];
  tab: "included" | "excluded";
  onTab: (t: "included" | "excluded") => void;
  onSelect: (symbol: string) => void;
  selected?: string;
};

export function ResultsTable({ included, excluded, tab, onTab, onSelect, selected }: Props) {
  const rows = tab === "included" ? included : excluded;
  return (
    <div data-testid="results-table" className="overflow-hidden rounded-md border border-[var(--line)] bg-white/90">
      <div className="flex border-b border-[var(--line)]">
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-sm ${tab === "included" ? "bg-[var(--ink)] text-white" : ""}`}
          onClick={() => onTab("included")}
        >
          入选 ({included.length})
        </button>
        <button
          type="button"
          className={`flex-1 px-3 py-2 text-sm ${tab === "excluded" ? "bg-[var(--ink)] text-white" : ""}`}
          onClick={() => onTab("excluded")}
        >
          排除 ({excluded.length})
        </button>
      </div>
      <ul className="max-h-80 divide-y divide-[var(--line)] overflow-auto">
        {rows.map((r) => (
          <li key={r.symbol}>
            <button
              type="button"
              data-testid="result-row"
              className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-[var(--background)] ${
                selected === r.symbol ? "bg-[var(--background)]" : ""
              }`}
              onClick={() => onSelect(r.symbol)}
            >
              <span>
                {r.name} <span className="text-[var(--muted)]">{r.symbol}</span>
              </span>
              <span className="text-xs text-[var(--muted)]">{r.failedConditionIds.join(", ") || "OK"}</span>
            </button>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-sm text-[var(--muted)]">暂无结果</li>}
      </ul>
    </div>
  );
}
