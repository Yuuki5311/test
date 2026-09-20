import type { ScreenSpec } from "@/lib/schema/screen-spec";

export interface Conflict {
  type: "impossible_range" | "contradiction";
  conditionIds: string[];
  message: string;
}

export function detectConflicts(spec: ScreenSpec): Conflict[] {
  if (spec.logic !== "and") return [];
  const byField = new Map<string, typeof spec.conditions>();
  for (const c of spec.conditions) {
    if (c.soft) continue;
    const list = byField.get(c.field) ?? [];
    list.push(c);
    byField.set(c.field, list);
  }
  const out: Conflict[] = [];
  for (const [field, conds] of byField) {
    let minLower = -Infinity;
    let maxUpper = Infinity;
    const ids: string[] = [];
    for (const c of conds) {
      ids.push(c.id);
      const v = Number(c.value);
      if (c.op === "gt" || c.op === "gte") minLower = Math.max(minLower, c.op === "gt" ? v + 1e-12 : v);
      if (c.op === "lt" || c.op === "lte") maxUpper = Math.min(maxUpper, c.op === "lt" ? v - 1e-12 : v);
      if (c.op === "between" && Array.isArray(c.value)) {
        minLower = Math.max(minLower, Number(c.value[0]));
        maxUpper = Math.min(maxUpper, Number(c.value[1]));
      }
    }
    if (minLower > maxUpper) {
      out.push({
        type: "impossible_range",
        conditionIds: ids,
        message: `字段 ${field} 的硬条件在 AND 下无解（下界 ${minLower} > 上界 ${maxUpper}）`,
      });
    }
  }
  return out;
}
