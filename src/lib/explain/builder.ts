import type { StockEval } from "@/lib/engine/evaluate";
import type { ScreenSpec } from "@/lib/schema/screen-spec";

export interface StockExplanation {
  symbol: string;
  verdict: "included" | "excluded";
  facts: string[];
  inferences: string[];
  uncertainties: string[];
  disclaimer: string;
  context?: string[];
}

export function buildExplanation(ev: StockEval, spec: Pick<ScreenSpec, "assumptions">): StockExplanation {
  const facts: string[] = [];
  const uncertainties: string[] = [];
  for (const r of ev.conditionResults) {
    const p = r.provenance;
    if (!p) {
      uncertainties.push(r.message);
      continue;
    }
    if (r.status === "ok") {
      facts.push(
        `${p.definition}=${String(p.rawValue)}${p.unit ? p.unit : ""}（来源:${p.source}，时点:${p.asOf}，口径:${p.definition}）→ ${r.passed ? "入选贡献" : "排除原因"}：${r.message}`,
      );
    } else {
      uncertainties.push(`${p.field} 状态=${p.status}：${r.message}`);
    }
  }
  return {
    symbol: ev.symbol,
    verdict: ev.passed ? "included" : "excluded",
    facts,
    inferences: [...spec.assumptions],
    uncertainties,
    disclaimer: "以上为基于公开/样本数据的条件匹配结果，不构成投资建议或买卖建议，亦不对未来收益作任何承诺。",
  };
}
