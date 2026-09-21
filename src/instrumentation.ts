/**
 * Prefer IPv4 for outbound fetch. Fuyao publishes AAAA records that often
 * fail from Vercel (and similar) serverless networks → TypeError: fetch failed.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const dns = await import("node:dns");
    dns.setDefaultResultOrder("ipv4first");
    const { startMonitorScheduler } = await import("./lib/monitor/schedule");
    startMonitorScheduler();
  }
}
