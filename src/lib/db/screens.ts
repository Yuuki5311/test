import { randomUUID } from "crypto";
import type { ScreenSpec } from "@/lib/schema/screen-spec";
import {
  getScreenRow,
  insertMonitorRow,
  insertScreenRow,
  listScreenRows,
  parseSpec,
} from "./client";

export function saveScreen(name: string, spec: ScreenSpec) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  insertScreenRow({
    id,
    name,
    spec_json: JSON.stringify(spec),
    created_at: createdAt,
  });
  return { id, name, createdAt, spec };
}

export function listScreens() {
  return listScreenRows().map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    spec: parseSpec(r.spec_json),
  }));
}

export function getScreen(id: string) {
  const row = getScreenRow(id);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    spec: parseSpec(row.spec_json),
  };
}

export function saveMonitor(name: string, spec: ScreenSpec) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  insertMonitorRow({
    id,
    name,
    spec_json: JSON.stringify(spec),
    status: "active",
    created_at: createdAt,
  });
  return {
    id,
    name,
    status: "active" as const,
    createdAt,
    spec,
    note: "已转为监控任务（演示：不推送实盘）",
  };
}
