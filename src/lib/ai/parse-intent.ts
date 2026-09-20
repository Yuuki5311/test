import OpenAI from "openai";
import { parseScreenSpec, type ScreenSpec } from "@/lib/schema/screen-spec";
import { sanitizeAiOutput } from "@/lib/compliance/guard";

const SYSTEM = `你是选股条件结构化助手。只输出 JSON ScreenSpec，不要推荐买卖或预测涨跌。
字段仅限: pe_ttm, roe_ttm, volatility_20d, revenue_yoy。
模糊词映射必须写入 assumptions，并标明属于推断。`;

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
  const json = JSON.parse(content.slice(jsonStart));
  return parseScreenSpec(json);
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
