import { randomUUID } from "crypto";
import type { ScreenSpec } from "@/lib/schema/screen-spec";
import { getDb } from "./client";

export function saveScreen(name: string, spec: ScreenSpec) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  getDb()
    .prepare("INSERT INTO screens (id, name, spec_json, created_at) VALUES (?, ?, ?, ?)")
    .run(id, name, JSON.stringify(spec), createdAt);
  return { id, name, createdAt, spec };
}

export function listScreens() {
  return getDb()
    .prepare("SELECT id, name, spec_json, created_at FROM screens ORDER BY created_at DESC")
    .all()
    .map((row) => {
      const r = row as { id: string; name: string; spec_json: string; created_at: string };
      return { id: r.id, name: r.name, createdAt: r.created_at, spec: JSON.parse(r.spec_json) as ScreenSpec };
    });
}

export function getScreen(id: string) {
  const row = getDb()
    .prepare("SELECT id, name, spec_json, created_at FROM screens WHERE id = ?")
    .get(id) as { id: string; name: string; spec_json: string; created_at: string } | undefined;
  if (!row) return null;
  return { id: row.id, name: row.name, createdAt: row.created_at, spec: JSON.parse(row.spec_json) as ScreenSpec };
}

export function saveMonitor(name: string, spec: ScreenSpec) {
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  getDb()
    .prepare("INSERT INTO monitors (id, name, spec_json, status, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(id, name, JSON.stringify(spec), "active", createdAt);
  return { id, name, status: "active" as const, createdAt, spec, note: "已转为监控任务（演示：不推送实盘）" };
}
