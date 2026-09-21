"use client";

import Link from "next/link";

export type MonitorSummary = {
  id: string;
  name: string;
  createdAt: string;
  lastRunAt: string | null;
  includedCount: number | null;
  excludedCount: number | null;
  runError: string | null;
};

export function MonitorTaskList({
  monitors,
  selectedIds,
  onToggle,
  onDelete,
  busy,
}: {
  monitors: MonitorSummary[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <section data-testid="monitor-list" className="space-y-3 rounded-md border border-[var(--line)] bg-white/80 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-medium text-[var(--ink)]">监控任务</h2>
          <p className="text-xs text-[var(--muted)]">点「转监控」才会保存当前筛选条件。每天 9:00（北京时间）自动执行，只保留最近一次结果</p>
        </div>
        <button
          type="button"
          data-testid="btn-delete-monitors"
          disabled={busy || selectedIds.length < 1}
          className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm text-red-800 disabled:opacity-40"
          onClick={onDelete}
        >
          删除所选
        </button>
      </div>
      {monitors.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">还没有监控任务。筛选完成后点「转监控」，这一轮条件才会出现在这里。</p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {monitors.map((item) => (
            <li key={item.id} className="flex items-center gap-3 py-2">
              <input
                type="checkbox"
                aria-label={`选择 ${item.name}`}
                className="h-4 w-4 shrink-0"
                checked={selectedIds.includes(item.id)}
                onChange={() => onToggle(item.id)}
              />
              <Link href={`/monitors/${item.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3 text-sm hover:text-[var(--accent)]">
                <span className="font-medium text-[var(--ink)]">{item.name}</span>
                <span className="text-xs text-[var(--muted)]">{describeRun(item)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function describeRun(item: MonitorSummary) {
  if (!item.lastRunAt) return "尚未执行";
  const when = new Date(item.lastRunAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false });
  if (item.runError) return `${when} 执行失败`;
  return `${when} · 入选 ${item.includedCount ?? 0}`;
}
