# 测试说明

## 1. 主链路

| 项 | 内容 |
|----|------|
| 步骤 | 输入「经营改善、估值合理、走势相对稳定」→ 澄清 → 生成条件 → 运行筛选 → 点选股票查看解释 |
| 自动化 | `tests/e2e/main-flow.spec.ts`；单元测试覆盖 schema/引擎/解释/合规/数据失败 |
| 期望 | 入选/排除可解释；解释含来源、时点、口径；Disclaimer 可见 |

## 2. 数据 / 接口失败

| 项 | 内容 |
|----|------|
| 步骤 | `DATA_MODE=fuyao` + mock 扶摇抛 `upstream 503`；iFinD mock `405` |
| 自动化 | `tests/unit/provider-failure.test.ts`、`tests/unit/ifind-client.test.ts` |
| 期望 | warnings 可见；字段 `status=error`；候选为空；**无**虚构正常值 |

## 3. 极端 / 合规边界

| 项 | 内容 |
|----|------|
| 步骤 | 文本含「必将上涨 / 建议买入 / 稳赚」 |
| 自动化 | `tests/unit/compliance.test.ts` |
| 期望 | `assertCompliantText` 失败；`sanitizeAiOutput` 追加合规提示；产品不输出买卖建议 |

## 命令

```bash
npx vitest run
npx playwright test
```
