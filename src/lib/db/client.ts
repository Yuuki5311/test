import fs from "fs";
import path from "path";
import type { ScreenSpec } from "@/lib/schema/screen-spec";

export type ScreenRow = {
  id: string;
  name: string;
  spec_json: string;
  created_at: string;
};

export type MonitorRow = {
  id: string;
  name: string;
  spec_json: string;
  status: string;
  created_at: string;
  last_run_at?: string | null;
  included_count?: number | null;
  excluded_count?: number | null;
  result_json?: string | null;
  run_error?: string | null;
};

type Store = {
  screens: ScreenRow[];
  monitors: MonitorRow[];
};

function storePath() {
  // Vercel / serverless: writable /tmp; local: project data/
  const base =
    process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
      ? "/tmp"
      : path.join(process.cwd(), "data");
  try {
    fs.mkdirSync(base, { recursive: true });
  } catch {
    // ignore
  }
  return path.join(base, "app-store.json");
}

function readStore(): Store {
  const p = storePath();
  try {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf8")) as Store;
    }
  } catch {
    // fall through
  }
  return { screens: [], monitors: [] };
}

function writeStore(store: Store) {
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf8");
}

export function listScreenRows(): ScreenRow[] {
  return readStore().screens.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getScreenRow(id: string): ScreenRow | undefined {
  return readStore().screens.find((s) => s.id === id);
}

export function insertScreenRow(row: ScreenRow) {
  const store = readStore();
  store.screens.push(row);
  writeStore(store);
}

export function deleteScreenRows(ids: string[]): number {
  const drop = new Set(ids);
  const store = readStore();
  const before = store.screens.length;
  store.screens = store.screens.filter((row) => !drop.has(row.id));
  writeStore(store);
  return before - store.screens.length;
}

export function listMonitorRows(): MonitorRow[] {
  return readStore().monitors.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getMonitorRow(id: string): MonitorRow | undefined {
  return readStore().monitors.find((row) => row.id === id);
}

export function insertMonitorRow(row: MonitorRow) {
  const store = readStore();
  store.monitors.push(row);
  writeStore(store);
}

export function deleteMonitorRows(ids: string[]): number {
  const drop = new Set(ids);
  const store = readStore();
  const before = store.monitors.length;
  store.monitors = store.monitors.filter((row) => !drop.has(row.id));
  writeStore(store);
  return before - store.monitors.length;
}

export function updateMonitorResult(
  id: string,
  patch: Pick<MonitorRow, "last_run_at" | "included_count" | "excluded_count" | "result_json" | "run_error">,
) {
  const store = readStore();
  const row = store.monitors.find((item) => item.id === id);
  if (!row) return false;
  Object.assign(row, patch);
  writeStore(store);
  return true;
}

export function parseSpec(json: string): ScreenSpec {
  return JSON.parse(json) as ScreenSpec;
}
