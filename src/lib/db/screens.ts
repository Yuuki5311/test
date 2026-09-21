import { randomUUID } from "crypto";
import type { ScreenSpec } from "@/lib/schema/screen-spec";
import {
  getMonitorRow,
  getScreenRow,
  insertMonitorRow,
  insertScreenRow,
  deleteMonitorRows,
  deleteScreenRows,
  listMonitorRows,
  listScreenRows,
  parseSpec,
  updateMonitorResult,
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

export function deleteScreens(ids: string[]) {
  return { deleted: deleteScreenRows(ids) };
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
    note: "已加入监控。每天 9:00（北京时间）自动执行，只保留最近一次结果。",
  };
}

export function deleteMonitors(ids: string[]) {
  return { deleted: deleteMonitorRows(ids) };
}

export function listMonitors() {
  return listMonitorRows().map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastRunAt: row.last_run_at ?? null,
    includedCount: row.included_count ?? null,
    excludedCount: row.excluded_count ?? null,
    runError: row.run_error ?? null,
  }));
}

export function getMonitor(id: string) {
  const row = getMonitorRow(id);
  if (!row) return null;
  let result: unknown = null;
  if (row.result_json) {
    try {
      result = JSON.parse(row.result_json);
    } catch {
      result = null;
    }
  }
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastRunAt: row.last_run_at ?? null,
    includedCount: row.included_count ?? null,
    excludedCount: row.excluded_count ?? null,
    runError: row.run_error ?? null,
    spec: parseSpec(row.spec_json),
    result,
  };
}

export function saveMonitorRun(
  id: string,
  payload: { result: { included: unknown[]; excluded: unknown[] } } | null,
  error: string | null,
) {
  return updateMonitorResult(id, {
    last_run_at: new Date().toISOString(),
    included_count: payload ? payload.result.included.length : null,
    excluded_count: payload ? payload.result.excluded.length : null,
    result_json: payload ? JSON.stringify(payload) : null,
    run_error: error,
  });
}
