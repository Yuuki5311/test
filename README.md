# 语意筛 IntentScreen

自然语言智能选股与策略解释器：把模糊选股意图变成**可检查、可修改、可执行**的数据条件，基于真实/样本字段做确定性筛选，并解释入选/排除依据。

## 公网访问

**提交用地址：** https://mathematics-mil-giants-summer.trycloudflare.com

这条链接通过 Cloudflare Tunnel 转到本机 `http://127.0.0.1:3000`。本机能访问扶摇和 iFinD，所以公网筛选可以使用真实数据。电脑需保持开机，且本地开发服务和 `cloudflared` 隧道不能关；隧道重启后地址会变。

Vercel 地址 https://nl-stock-screener-rho.vercel.app 仍在，但从香港节点连不上扶摇 / iFinD，会超时并降级为样本数据。

本地预览：

```bash
npm run build && npm run start -- -H 127.0.0.1 -p 3000
# 打开 http://127.0.0.1:3000
```

## 启动

```bash
cp .env.example .env
npm install
npm run dev
```

打开 http://127.0.0.1:3000

## 环境变量

见 `.env.example`：

- `FUYAO_API_KEY` / `FUYAO_BASE_URL` — 扶摇确定性字段
- `IFIND_MCP_TOKEN` / `IFIND_MCP_BASE` — iFinD NL 候选与资讯增强
- `DATA_MODE=auto|fuyao|fixture`
- `IFIND_ENABLED=auto|on|off`
- `OPENAI_*` — 可选；无 Key 时启发式解析

**勿将 API Key 提交到公开仓库。**

## 产品选择（24h）

- 主链路：澄清 → ScreenSpec 编辑 → 筛选 → 解释 → 影响 / 保存 / 比较 / 轻量回测 / 监控
- 未做：实盘推送、收益承诺式回测、完整用户画像、iFinD 基金/债券/港美股全量

## 职责边界

| 角色 | 职责 |
|------|------|
| AI | 澄清问题 + 产出 `ScreenSpec`；**不**直接给出股票结论 |
| 确定性引擎 | 对字段条件求值，决定入选/排除 |
| 扶摇 | 字段级行情/财务主数据源（`X-api-key`） |
| iFinD MCP | `search_stocks` 候选 + 公告/宏观上下文（Bearer）；须再经引擎确认 |
| fixture | 无 Key / 失败兜底，UI 标明非实时 |

数据契约详见 `docs/DATA_SOURCES.md`。

## 测试

```bash
npx vitest run
# 可选：npx playwright install && npx playwright test
```

说明：`docs/TEST_REPORT.md` · AI 记录：`docs/AI_USAGE.md`

## 已知边界

- 无扶摇 Key 时默认 fixture；字段缺失为 `missing`/`error`，不静默填 0。
- 产品禁止涨跌预测、收益承诺、直接买卖建议。
- 公网提交地址走本机隧道：https://mathematics-mil-giants-summer.trycloudflare.com 。本机需保持运行；Vercel 香港节点访问扶摇 / iFinD 会超时。
