import { listMonitorRows, parseSpec } from "@/lib/db/client";
import { saveMonitorRun } from "@/lib/db/screens";
import { executeScreen } from "@/lib/screen/execute";

/** Run every saved monitor and keep only the latest result. */
export async function runAllMonitors() {
  const rows = listMonitorRows();
  const done: string[] = [];
  for (const row of rows) {
    try {
      const spec = parseSpec(row.spec_json);
      const payload = await executeScreen(spec, row.name);
      saveMonitorRun(row.id, payload, null);
      done.push(row.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      saveMonitorRun(row.id, null, message);
    }
  }
  return { ran: rows.length, ok: done.length };
}
