import type { Condition, ScreenSpec } from "@/lib/schema/screen-spec";
import type { StockSnapshot } from "@/lib/data/types";

export interface ConditionResult {
  conditionId: string;
  passed: boolean;
  soft: boolean;
  status: "ok" | "missing" | "error" | "conflict";
  actual: unknown;
  message: string;
  provenance?: import("@/lib/schema/provenance").FieldProvenance;
}

export interface StockEval {
  symbol: string;
  name: string;
  passed: boolean;
  conditionResults: ConditionResult[];
  failedConditionIds: string[];
  reasons: string[];
}

export interface ScreenResult {
  asOf: string;
  included: StockEval[];
  excluded: StockEval[];
  dataMode: "fuyao" | "fixture" | "mixed"; // mixed=扶摇字段 + iFinD 候选/上下文
}

function cmp(op: Condition["op"], actual: unknown, expected: unknown): boolean {
  if (op === "is_null") return actual == null;
  if (op === "not_null") return actual != null;
  if (actual == null) return false;
  const a = Number(actual);
  switch (op) {
    case "eq": return actual === expected;
    case "neq": return actual !== expected;
    case "gt": return a > Number(expected);
    case "gte": return a >= Number(expected);
    case "lt": return a < Number(expected);
    case "lte": return a <= Number(expected);
    case "between": {
      const [lo, hi] = expected as [number, number];
      return a >= lo && a <= hi;
    }
    case "in": return (expected as unknown[]).includes(actual);
    case "not_in": return !(expected as unknown[]).includes(actual);
    default: return false;
  }
}

export function evaluateCondition(cond: Condition, stock: StockSnapshot): ConditionResult {
  const prov = stock.fields[cond.field];
  if (!prov || prov.status === "missing" || prov.rawValue == null) {
    return {
      conditionId: cond.id,
      passed: false,
      soft: cond.soft,
      status: "missing",
      actual: null,
      message: `字段 ${cond.field} 缺失，无法判定「${cond.label ?? cond.id}」`,
      provenance: prov,
    };
  }
  if (prov.status === "error" || prov.status === "conflict") {
    return {
      conditionId: cond.id,
      passed: false,
      soft: cond.soft,
      status: prov.status,
      actual: prov.rawValue,
      message: prov.message ?? `字段 ${cond.field} 状态为 ${prov.status}`,
      provenance: prov,
    };
  }
  const passed = cmp(cond.op, prov.rawValue, cond.value);
  return {
    conditionId: cond.id,
    passed,
    soft: cond.soft,
    status: "ok",
    actual: prov.rawValue,
    message: passed
      ? `满足 ${cond.label ?? cond.id}（实际值 ${String(prov.rawValue)}，asOf=${prov.asOf}）`
      : `不满足 ${cond.label ?? cond.id}（实际值 ${String(prov.rawValue)}，要求 ${cond.op} ${JSON.stringify(cond.value)}）`,
    provenance: prov,
  };
}

export function evaluateScreen(spec: ScreenSpec, stocks: StockSnapshot[]): ScreenResult {
  const evals = stocks.map((s) => {
    const conditionResults = spec.conditions.map((c) => evaluateCondition(c, s));
    const hard = conditionResults.filter((r) => !r.soft);
    const hardPass =
      spec.logic === "and"
        ? hard.every((r) => r.passed)
        : hard.some((r) => r.passed);
    const failed = conditionResults.filter((r) => !r.passed);
    return {
      symbol: s.symbol,
      name: s.name,
      passed: hardPass,
      conditionResults,
      failedConditionIds: failed.map((r) => r.conditionId),
      reasons: failed.map((r) => r.message),
    } satisfies StockEval;
  });
  return {
    asOf: new Date().toISOString().slice(0, 10),
    included: evals.filter((e) => e.passed),
    excluded: evals.filter((e) => !e.passed),
    dataMode: "fixture",
  };
}
