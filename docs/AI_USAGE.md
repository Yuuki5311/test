# AI 使用与验证记录

## 使用的 AI 工具

- Cursor Agent（Composer）：根据题目与计划文档实现脚手架、引擎、双数据源、API、UI、测试与文档。
- 可选 OpenAI 兼容 API（`OPENAI_*`）：自然语言 → `ScreenSpec`；无 Key 时使用启发式模板。

## AI 参与环节

1. 从竞赛题与扶摇 / iFinD 文档提炼实现计划。
2. 生成 ScreenSpec、确定性引擎、解释与合规护栏代码。
3. 按官方契约实现扶摇 `X-api-key` REST 与 iFinD Bearer MCP 客户端。
4. 组装 Web 主链路与 API。

## 人工 / 验证修正

1. **Vitest 与 PostCSS**：Next 的 `postcss.config.mjs` 字符串插件导致 Vitest 崩溃 → 在 `vitest.config.ts` 中清空 postcss plugins。
2. **Vitest 版本**：vitest@5 与 `@types/node@20` peer 冲突 → 固定 vitest@2.1.9。
3. **鉴权纠正**：扶摇使用 `X-api-key`（非 Bearer）；iFinD 使用 `Authorization: Bearer`。
4. **职责边界**：iFinD `search_stocks` 仅作候选，入选结论必须经确定性引擎；失败不得静默填正常值。
5. **关键数字可追溯**：解释文案绑定 `FieldProvenance`（来源/时点/口径/状态）。
