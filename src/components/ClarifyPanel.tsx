"use client";

import type { ClarifyQuestion } from "@/lib/schema/screen-spec";

type Props = {
  questions: ClarifyQuestion[];
  answers: Record<string, string>;
  onAnswer: (id: string, value: string) => void;
};

export function ClarifyPanel({ questions, answers, onAnswer }: Props) {
  return (
    <div data-testid="clarify-panel" className="space-y-4 rounded-md border border-[var(--line)] bg-[var(--panel)] p-4">
      <h3 className="text-sm font-semibold text-[var(--ink)]">意图澄清</h3>
      {questions.map((q) => (
        <div key={q.id} className="space-y-2">
          <p className="text-sm">{q.question}</p>
          <div className="flex flex-wrap gap-2">
            {(q.options ?? []).map((opt) => (
              <button
                key={opt}
                type="button"
                className={`rounded border px-3 py-1 text-sm ${
                  answers[q.id] === opt
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--line)] bg-white"
                }`}
                onClick={() => onAnswer(q.id, opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
