import type { ClarifyQuestion } from "@/lib/schema/screen-spec";

export function buildClarifyQuestions(text: string): ClarifyQuestion[] {
  const qs: ClarifyQuestion[] = [];
  if (/估值|合理|便宜/.test(text)) {
    qs.push({
      id: "q_pe",
      question: "「估值合理」你更倾向哪种口径？",
      options: ["PE(TTM) 8–25", "PE(TTM) ≤15", "先不确定，稍后手改"],
    });
  }
  if (/经营|改善|业绩/.test(text)) {
    qs.push({
      id: "q_op",
      question: "「经营改善」用哪个可执行代理指标？",
      options: ["ROE(TTM) ≥ 8%", "营收同比 ≥ 10%", "两者都要"],
    });
  }
  if (qs.length === 0) {
    qs.push({
      id: "q_goal",
      question: "请确认本次筛选更侧重哪类？",
      options: ["估值", "盈利质量", "波动稳定", "综合"],
    });
  }
  return qs;
}
