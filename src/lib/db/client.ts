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

export function insertMonitorRow(row: MonitorRow) {
  const store = readStore();
  store.monitors.push(row);
  writeStore(store);
}

export function parseSpec(json: string): ScreenSpec {
  return JSON.parse(json) as ScreenSpec;
}
