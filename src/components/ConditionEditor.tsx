"use client";

import type { Condition, ScreenSpec } from "@/lib/schema/screen-spec";

type Props = {
  spec: ScreenSpec;
  onChange: (spec: ScreenSpec) => void;
};

const OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "between"] as const;
const FIELDS = ["pe_ttm", "roe_ttm", "volatility_20d", "revenue_yoy"];

export function ConditionEditor({ spec, onChange }: Props) {
  const updateCond = (id: string, patch: Partial<Condition>) => {
    onChange({
      ...spec,
      conditions: spec.conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const addCond = () => {
    const id = `c_${Date.now()}`;
    onChange({
      ...spec,
      conditions: [
        ...spec.conditions,
        { id, field: "pe_ttm", op: "lte", value: 20, label: "新条件", soft: false },
      ],
    });
  };

  const removeCond = (id: string) => {
    if (spec.conditions.length <= 1) return;
    onChange({ ...spec, conditions: spec.conditions.filter((c) => c.id !== id) });
  };

  return (
    <div data-testid="condition-editor" className="space-y-3 rounded-md border border-[var(--line)] bg-white/90 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--ink)]">可执行条件（可修改）</h3>
        <button type="button" className="text-sm text-[var(--accent)]" onClick={addCond}>
          + 添加条件
        </button>
      </div>
      {spec.assumptions.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-[var(--muted)]">
          {spec.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      {spec.conditions.map((c) => (
        <div key={c.id} className="grid grid-cols-1 gap-2 md:grid-cols-5">
          <select
            className="rounded border border-[var(--line)] px-2 py-1 text-sm"
            value={c.field}
            onChange={(e) => updateCond(c.id, { field: e.target.value })}
          >
            {FIELDS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            className="rounded border border-[var(--line)] px-2 py-1 text-sm"
            value={c.op}
            onChange={(e) => updateCond(c.id, { op: e.target.value as Condition["op"] })}
          >
            {OPS.map((op) => (
              <option key={op} value={op}>
                {op}
              </option>
            ))}
          </select>
          <input
            className="rounded border border-[var(--line)] px-2 py-1 text-sm md:col-span-2"
            value={Array.isArray(c.value) ? c.value.join(",") : String(c.value ?? "")}
            onChange={(e) => {
              const raw = e.target.value;
              if (c.op === "between") {
                const parts = raw.split(",").map((x) => Number(x.trim()));
                updateCond(c.id, { value: parts });
              } else {
                const n = Number(raw);
                updateCond(c.id, { value: Number.isFinite(n) ? n : raw });
              }
            }}
          />
          <button type="button" className="text-sm text-[var(--accent-2)]" onClick={() => removeCond(c.id)}>
            删除
          </button>
        </div>
      ))}
    </div>
  );
}
