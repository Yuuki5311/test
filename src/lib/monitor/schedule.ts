import fs from "fs";
import path from "path";

const TZ = "Asia/Shanghai";

export function shanghaiParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    hour: Number(get("hour")),
    minute: Number(get("minute")),
  };
}

export function isShanghaiNine(date: Date) {
  const parts = shanghaiParts(date);
  return parts.hour === 9 && parts.minute === 0;
}

function lockPath() {
  const base =
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? "/tmp"
      : path.join(process.cwd(), "data");
  fs.mkdirSync(base, { recursive: true });
  return path.join(base, "monitor-day-lock.json");
}

/** One successful claim per Shanghai calendar day, shared by every local server. */
export function claimMonitorDay(date: string) {
  const file = lockPath();
  try {
    const current = JSON.parse(fs.readFileSync(file, "utf8")) as { date?: string };
    if (current.date === date) return false;
  } catch {
    // missing or unreadable lock can be claimed
  }
  fs.writeFileSync(file, JSON.stringify({ date, claimedAt: new Date().toISOString() }));
  return true;
}

let running = false;

async function maybeRunMonitors() {
  if (running) return;
  const now = new Date();
  if (!isShanghaiNine(now)) return;
  const day = shanghaiParts(now).date;
  if (!claimMonitorDay(day)) return;
  running = true;
  try {
    const { runAllMonitors } = await import("./run-monitors");
    await runAllMonitors();
  } catch (e) {
    console.error("monitor run failed", e);
  } finally {
    running = false;
  }
}

export function startMonitorScheduler() {
  const g = globalThis as { __monitorScheduler?: boolean };
  if (g.__monitorScheduler) return;
  g.__monitorScheduler = true;
  setInterval(() => {
    void maybeRunMonitors();
  }, 20_000);
}
