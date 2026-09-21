import OpenAI from "openai";
import { parseScreenSpec, type ScreenSpec } from "@/lib/schema/screen-spec";
import { sanitizeAiOutput } from "@/lib/compliance/guard";

const SYSTEM = `你是选股条件结构化助手。只输出一个 JSON 对象，不要推荐买卖或预测涨跌。
必须符合：
{"version":1,"universe":{"market":"A","excludeST":true},"logic":"and","conditions":[{"id":"c1","field":"pe_ttm","op":"between","value":[8,25],"label":"PE(TTM) 8-25","soft":false}],"clarifications":[],"assumptions":["推断说明"]}
field 仅限 pe_ttm, roe_ttm, volatility_20d, revenue_yoy。
op 仅限 eq,neq,gt,gte,lt,lte,between,in,not_in,is_null,not_null。
roe_ttm、revenue_yoy、volatility_20d 的 value 用比率（8% 写成 0.08），pe_ttm 用倍数。
assumptions 必须是字符串数组。`;

export async function parseIntent(text: string, answers: Record<string, string> = {}): Promise<ScreenSpec> {
  if (!process.env.OPENAI_API_KEY) {
    return heuristicParse(text, answers);
  }
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
  const completion = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: JSON.stringify({ text, answers }) },
    ],
  });
  const content = sanitizeAiOutput(completion.choices[0]?.message?.content ?? "{}");
  const jsonStart = content.indexOf("{");
  try {
    const json = JSON.parse(content.slice(Math.max(0, jsonStart)));
    return parseScreenSpec(normalizeLlmSpec(json));
  } catch {
    const fallback = heuristicParse(text, answers);
    return {
      ...fallback,
      assumptions: [
        "大模型输出未能通过条件校验，已回退启发式模板（推断，可在编辑器中修改）",
        ...fallback.assumptions.filter((item) => !item.startsWith("无 LLM Key")),
      ],
    };
  }
}

const OPS = new Set(["eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "not_in", "is_null", "not_null"]);
const FIELDS: Record<string, string> = {
  pe: "pe_ttm",
  pe_ttm: "pe_ttm",
  pettm: "pe_ttm",
  roe: "roe_ttm",
  roe_ttm: "roe_ttm",
  volatility: "volatility_20d",
  volatility_20d: "volatility_20d",
  vol: "volatility_20d",
  revenue: "revenue_yoy",
  revenue_yoy: "revenue_yoy",
  yoy: "revenue_yoy",
};

export function normalizeLlmSpec(input: unknown): unknown {
  const root = unwrapSpec(input);
  const conditions = Array.isArray(root.conditions) ? root.conditions : [];
  return {
    version: 1,
    universe: {
      market: "A",
      excludeST: root.universe?.excludeST !== false,
      boards: root.universe?.boards,
    },
    logic: root.logic === "or" ? "or" : "and",
    conditions: conditions.map((raw, index) => normalizeCondition(raw, index)).filter(Boolean),
    clarifications: [],
    assumptions: normalizeAssumptions(root.assumptions),
  };
}

function unwrapSpec(input: unknown): {
  logic?: unknown;
  conditions?: unknown;
  assumptions?: unknown;
  universe?: { excludeST?: boolean; boards?: string[] };
} {
  if (!input || typeof input !== "object") return {};
  const obj = input as Record<string, unknown>;
  for (const key of ["screenSpec", "spec", "screen_spec", "data"]) {
    const nested = obj[key];
    if (nested && typeof nested === "object" && !Array.isArray(nested)) {
      return nested as ReturnType<typeof unwrapSpec>;
    }
  }
  return obj as ReturnType<typeof unwrapSpec>;
}

function normalizeCondition(raw: unknown, index: number) {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const field = FIELDS[String(row.field ?? row.metric ?? row.indicator ?? "").toLowerCase()];
  const op = normalizeOp(row.op ?? row.operator ?? row.cmp);
  if (!field || !op) return null;
  return {
    id: typeof row.id === "string" && row.id ? row.id : `c${index + 1}`,
    field,
    op,
    value: normalizeValue(field, op, row.value ?? row.threshold),
    label: typeof row.label === "string" ? row.label : undefined,
    soft: row.soft === true || field === "volatility_20d",
  };
}

function normalizeOp(raw: unknown): string | null {
  const text = String(raw ?? "").trim().toLowerCase();
  const mapped: Record<string, string> = {
    "<=": "lte",
    "≤": "lte",
    "lte": "lte",
    "le": "lte",
    ">=": "gte",
    "≥": "gte",
    "gte": "gte",
    "ge": "gte",
    "<": "lt",
    "lt": "lt",
    ">": "gt",
    "gt": "gt",
    "=": "eq",
    "==": "eq",
    "eq": "eq",
    between: "between",
    range: "between",
  };
  const op = mapped[text] ?? text;
  return OPS.has(op) ? op : null;
}

function normalizeValue(field: string, op: string, raw: unknown): unknown {
  if (op === "between" && typeof raw === "string") {
    const parts = raw.split(/[-~～到至]/).map((part) => Number(part.replace("%", "").trim()));
    if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
      return parts.map((n) => scaleRatio(field, n));
    }
  }
  if (Array.isArray(raw)) return raw.map((item) => scaleRatio(field, item));
  if (typeof raw === "string") {
    const n = Number(raw.replace("%", "").trim());
    return Number.isFinite(n) ? scaleRatio(field, n) : raw;
  }
  return scaleRatio(field, raw);
}

function scaleRatio(field: string, raw: unknown): unknown {
  if (field === "pe_ttm" || typeof raw !== "number" || !Number.isFinite(raw)) return raw;
  return Math.abs(raw) > 2 ? raw / 100 : raw;
}

function normalizeAssumptions(raw: unknown): string[] {
  if (!Array.isArray(raw)) return ["大模型生成的条件已整理为可执行字段（推断，可修改）"];
  const lines = raw.map((item) => {
    if (typeof item === "string") return item;
    if (item && typeof item === "object") {
      const row = item as Record<string, unknown>;
      const text = row.text ?? row.note ?? row.assumption ?? row.content;
      return typeof text === "string" ? text : JSON.stringify(item);
    }
    return String(item);
  });
  return lines.length ? lines : ["大模型生成的条件已整理为可执行字段（推断，可修改）"];
}

function heuristicParse(text: string, answers: Record<string, string>): ScreenSpec {
  const conditions: Array<{
    id: string;
    field: string;
    op: "between" | "gte" | "lte";
    value: number | number[];
    label: string;
    soft: boolean;
  }> = [];

  const peAnswer = answers.q_pe ?? "";
  if (peAnswer.includes("≤15") || peAnswer.includes("<=15")) {
    conditions.push({ id: "c_pe", field: "pe_ttm", op: "lte", value: 15, label: "PE(TTM)≤15", soft: false });
  } else if (/估值合理|便宜|低估/.test(text) || peAnswer.includes("8–25") || peAnswer.includes("8-25")) {
    conditions.push({ id: "c_pe", field: "pe_ttm", op: "between", value: [8, 25], label: "PE(TTM) 8–25", soft: false });
  }

  const opAnswer = answers.q_op ?? "";
  if (opAnswer.includes("营收") || opAnswer.includes("两者")) {
    conditions.push({ id: "c_rev", field: "revenue_yoy", op: "gte", value: 0.1, label: "营收同比≥10%", soft: false });
  }
  if (/经营改善|盈利|ROE/.test(text) || opAnswer.includes("ROE") || opAnswer.includes("两者")) {
    conditions.push({ id: "c_roe", field: "roe_ttm", op: "gte", value: 0.08, label: "ROE(TTM)≥8%", soft: false });
  }

  if (/稳定|波动小|走势稳/.test(text) || answers.q_goal === "波动稳定") {
    conditions.push({ id: "c_vol", field: "volatility_20d", op: "lte", value: 0.35, label: "20日波动率≤35%", soft: true });
  }

  if (conditions.length === 0) {
    conditions.push({ id: "c_pe", field: "pe_ttm", op: "lte", value: 30, label: "PE(TTM)≤30", soft: false });
  }

  return parseScreenSpec({
    version: 1,
    universe: { market: "A", excludeST: true },
    logic: "and",
    conditions,
    clarifications: [],
    assumptions: [
      "无 LLM Key：使用启发式模板映射自然语言→字段（推断，可在编辑器中修改）",
      "「经营改善」默认映射为 ROE_TTM（推断代理，非原文事实）",
    ],
  });
}
