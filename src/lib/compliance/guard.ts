const BANNED = [
  /必将上涨|稳赚|保底收益|一定涨|推荐买入|建议买入|建议卖出|立刻买入/g,
];

export function assertCompliantText(text: string) {
  const violations: string[] = [];
  for (const re of BANNED) {
    const m = text.match(re);
    if (m) violations.push(...m);
  }
  return { ok: violations.length === 0, violations };
}

export function sanitizeAiOutput(text: string): string {
  const { ok, violations } = assertCompliantText(text);
  if (ok) return text;
  return `${text}\n\n[合规提示] 已检测到不当表述（${violations.join(",")}），系统不提供买卖建议或收益承诺。`;
}
