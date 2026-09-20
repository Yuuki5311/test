"use client";

import type { StockExplanation } from "@/lib/explain/builder";

export function StockExplainCard({ explanation }: { explanation: StockExplanation | null }) {
  if (!explanation) {
    return (
      <div data-testid="explain-card" className="rounded-md border border-dashed border-[var(--line)] p-4 text-sm text-[var(--muted)]">
        选择一只股票查看入选/排除依据
      </div>
    );
  }
  return (
    <div data-testid="explain-card" className="space-y-3 rounded-md border border-[var(--line)] bg-[var(--panel)] p-4 text-sm">
      <h3 className="font-semibold text-[var(--ink)]">
        {explanation.symbol} · {explanation.verdict === "included" ? "入选" : "排除"}
      </h3>
      <section>
        <h4 className="text-xs uppercase tracking-wide text-[var(--muted)]">事实</h4>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {explanation.facts.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      <section>
        <h4 className="text-xs uppercase tracking-wide text-[var(--muted)]">推断</h4>
        <ul className="mt-1 list-disc space-y-1 pl-4">
          {explanation.inferences.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </section>
      {explanation.uncertainties.length > 0 && (
        <section>
          <h4 className="text-xs uppercase tracking-wide text-[var(--warn)]">不确定 / 缺失</h4>
          <ul className="mt-1 list-disc space-y-1 pl-4">
            {explanation.uncertainties.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </section>
      )}
      <p className="text-xs text-[var(--muted)]">{explanation.disclaimer}</p>
    </div>
  );
}
