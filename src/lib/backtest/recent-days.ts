export type DailyBar = {
  dateMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number | null;
  turnover: number | null;
};

export type RecentDay = DailyBar & {
  date: string;
  changePct: number | null;
};

export function barsFromHistorical(data: unknown): DailyBar[] {
  return extractItems(data)
    .map((row) => {
      const close = Number(row.close_price);
      const open = Number(row.open_price);
      const high = Number(row.high_price);
      const low = Number(row.low_price);
      const dateMs = Number(row.date_ms);
      if (![close, open, high, low, dateMs].every((n) => Number.isFinite(n)) || close <= 0) return null;
      return {
        dateMs,
        open,
        high,
        low,
        close,
        volume: finiteOrNull(row.volume),
        turnover: finiteOrNull(row.turnover),
      };
    })
    .filter((row): row is DailyBar => row != null)
    .sort((a, b) => a.dateMs - b.dateMs);
}

export function summarizeLastTradingDays(bars: DailyBar[], count = 5) {
  const window = bars.slice(-count);
  const startIndex = bars.length - window.length;
  const days: RecentDay[] = window.map((bar, index) => {
    const prev = bars[startIndex + index - 1];
    const changePct = prev && prev.close > 0 ? ((bar.close - prev.close) / prev.close) * 100 : null;
    return { ...bar, date: formatShanghaiDate(bar.dateMs), changePct };
  });

  return {
    days,
    summary: buildSummary(days),
  };
}

function buildSummary(days: RecentDay[]): string {
  if (!days.length) return "没有读到交易日行情。";
  const first = days[0];
  const last = days[days.length - 1];
  const span = ((last.close - first.close) / first.close) * 100;
  const up = days.filter((day) => day.changePct != null && day.changePct > 0).length;
  const down = days.filter((day) => day.changePct != null && day.changePct < 0).length;
  const flat = days.filter((day) => day.changePct === 0).length;
  const high = Math.max(...days.map((day) => day.high));
  const low = Math.min(...days.map((day) => day.low));
  const turnover = days.reduce((sum, day) => sum + (day.turnover ?? 0), 0);
  const hasTurnover = days.some((day) => day.turnover != null);
  const short =
    days.length < 5 ? `只读到 ${days.length} 个交易日，不足五个。` : `近 ${days.length} 个交易日。`;
  const parts = [
    `${short}${first.date} 收盘 ${fmt(first.close)}，${last.date} 收盘 ${fmt(last.close)}，区间收盘变动 ${fmtPct(span)}。`,
    `相对前一交易日收盘：上涨 ${up} 天，下跌 ${down} 天${flat ? `，平盘 ${flat} 天` : ""}。`,
    `区间最高 ${fmt(high)}，最低 ${fmt(low)}。`,
  ];
  if (hasTurnover) parts.push(`五日成交额合计 ${fmt(turnover)} 元。`);
  return parts.join("");
}

function extractItems(data: unknown): Array<Record<string, unknown>> {
  if (!data) return [];
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>;
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.item)) return obj.item as Array<Record<string, unknown>>;
    if (Array.isArray(obj.items)) return obj.items as Array<Record<string, unknown>>;
  }
  return [];
}

function finiteOrNull(value: unknown): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function formatShanghaiDate(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

function fmt(n: number): string {
  return n.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function fmtPct(n: number): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}
