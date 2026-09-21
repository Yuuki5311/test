export type BacktestDay = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  changePct: number | null;
  volume: number | null;
  turnover: number | null;
};

export type BacktestPayload = {
  symbol: string;
  name: string;
  source: "fuyao" | "cache";
  days: BacktestDay[];
  summary: string;
  disclaimer: string;
};

export function BacktestPanel({ payload }: { payload: BacktestPayload }) {
  return (
    <section
      data-testid="backtest-panel"
      className="space-y-3 rounded-md border border-[var(--line)] bg-white px-4 py-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-medium text-[var(--ink)]">
          {payload.name} 近五个交易日
        </h2>
        <p className="text-xs text-[var(--muted)]">
          {payload.symbol} · {payload.source === "fuyao" ? "扶摇日K" : "本地行情缓存"}
        </p>
      </div>
      <p className="text-sm leading-6 text-[var(--ink)]">{payload.summary}</p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[36rem] text-left text-sm">
          <thead className="text-xs text-[var(--muted)]">
            <tr>
              <th className="py-1 pr-3 font-normal">日期</th>
              <th className="py-1 pr-3 font-normal">开盘</th>
              <th className="py-1 pr-3 font-normal">最高</th>
              <th className="py-1 pr-3 font-normal">最低</th>
              <th className="py-1 pr-3 font-normal">收盘</th>
              <th className="py-1 pr-3 font-normal">涨跌</th>
              <th className="py-1 font-normal">成交额</th>
            </tr>
          </thead>
          <tbody>
            {payload.days.map((day) => (
              <tr key={day.date} className="border-t border-[var(--line)]">
                <td className="py-1.5 pr-3">{day.date}</td>
                <td className="py-1.5 pr-3">{fmt(day.open)}</td>
                <td className="py-1.5 pr-3">{fmt(day.high)}</td>
                <td className="py-1.5 pr-3">{fmt(day.low)}</td>
                <td className="py-1.5 pr-3">{fmt(day.close)}</td>
                <td className="py-1.5 pr-3">{day.changePct == null ? "—" : fmtPct(day.changePct)}</td>
                <td className="py-1.5">{day.turnover == null ? "—" : fmt(day.turnover)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-[var(--muted)]">{payload.disclaimer}</p>
    </section>
  );
}

function fmt(n: number): string {
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
