"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
};

export function IntentInput({ value, onChange }: Props) {
  return (
    <textarea
      data-testid="intent-input"
      className="w-full min-h-28 rounded-md border border-[var(--line)] bg-white/80 p-4 text-base outline-none focus:border-[var(--accent)]"
      placeholder="例如：经营改善、估值合理、走势相对稳定"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
