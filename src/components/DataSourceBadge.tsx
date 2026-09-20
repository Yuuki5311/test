"use client";

type Props = {
  dataMode?: string;
  candidateSource?: string;
  warnings?: string[];
};

export function DataSourceBadge({ dataMode, candidateSource, warnings = [] }: Props) {
  return (
    <div className="space-y-2 rounded-md border border-[var(--line)] bg-white/70 px-3 py-2 text-xs">
      <div className="flex flex-wrap gap-2">
        <span className="rounded bg-[var(--ink)] px-2 py-0.5 text-white">dataMode: {dataMode ?? "—"}</span>
        <span className="rounded bg-[var(--accent)] px-2 py-0.5 text-white">
          candidate: {candidateSource ?? "—"}
        </span>
      </div>
      {warnings.map((w) => (
        <p key={w} className="text-[var(--warn)]">
          {w}
        </p>
      ))}
    </div>
  );
}
