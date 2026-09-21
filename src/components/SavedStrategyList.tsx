"use client";

export type SavedStrategy = {
  id: string;
  name: string;
  createdAt: string;
};

export function SavedStrategyList({
  screens,
  selectedIds,
  onToggle,
  onCompare,
  onDelete,
  busy,
}: {
  screens: SavedStrategy[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onCompare: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <section data-testid="saved-strategies" className="space-y-3 rounded-md border border-[var(--line)] bg-white/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-[var(--ink)]">已保存策略</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            data-testid="btn-compare"
            disabled={busy || selectedIds.length < 2}
            className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm disabled:opacity-40"
            onClick={onCompare}
          >
            比较所选（{selectedIds.length}）
          </button>
          <button
            type="button"
            data-testid="btn-delete-strategies"
            disabled={busy || selectedIds.length < 1}
            className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm text-red-800 disabled:opacity-40"
            onClick={onDelete}
          >
            删除所选
          </button>
        </div>
      </div>
      {screens.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">还没有保存的策略。运行筛选后点「保存策略」，会出现在这里。</p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {screens.map((screen) => {
            const checked = selectedIds.includes(screen.id);
            return (
              <li key={screen.id} className="flex items-start gap-3 py-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={checked}
                  aria-label={`选择 ${screen.name}`}
                  onChange={() => onToggle(screen.id)}
                />
                <div>
                  <p className="text-[var(--ink)]">{screen.name}</p>
                  <p className="text-xs text-[var(--muted)]">{new Date(screen.createdAt).toLocaleString("zh-CN")}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-[var(--muted)]">勾选两个或以上策略后再比较。比较使用内置样本股票，便于看条件差异。</p>
    </section>
  );
}
