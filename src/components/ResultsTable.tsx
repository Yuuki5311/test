"use client";

import type { StockEval } from "@/lib/engine/evaluate";

type Props = {
  included: StockEval[];
  excluded: StockEval[];
  tab: "included" | "excluded";
  onTab: (t: "included" | "excluded") => void;
  onSelect: (symbol: string) => void;
  selected?: string;
  checkedSymbol?: string;
  onCheck?: (symbol: string) => void;
};

export function ResultsTable({
  included,
  excluded,
  tab,
  onTab,
  onSelect,
  selected,
  checkedSymbol,
  onCheck,
}: Props) {
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
        {tab === "included" && rows.length > 0 && (
          <li className="px-4 py-2 text-xs text-[var(--muted)]">勾选一只股票，再点「轻量回测」查看近五个交易日。</li>
        )}
        {rows.map((r) => (
          <li key={r.symbol}>
            <div
              className={`flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-[var(--background)] ${
                selected === r.symbol ? "bg-[var(--background)]" : ""
              }`}
            >
              {tab === "included" && (
                <input
                  type="checkbox"
                  data-testid="backtest-check"
                  aria-label={`回测 ${r.name}`}
                  className="h-4 w-4 shrink-0"
                  checked={checkedSymbol === r.symbol}
                  onChange={() => onCheck?.(r.symbol)}
                />
              )}
              <button
                type="button"
                data-testid="result-row"
                className="flex min-w-0 flex-1 items-center justify-between text-left"
                onClick={() => onSelect(r.symbol)}
              >
                <span>
                  {r.name} <span className="text-[var(--muted)]">{r.symbol}</span>
                </span>
                <span className="text-xs text-[var(--muted)]">{r.failedConditionIds.join(", ") || "OK"}</span>
              </button>
            </div>
          </li>
        ))}
        {rows.length === 0 && <li className="px-4 py-6 text-sm text-[var(--muted)]">暂无结果</li>}
      </ul>
    </div>
  );
}
