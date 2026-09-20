# 数据源契约摘要

本题可用数据以官方文档为准：

- 扶摇：https://fuyao.aicubes.cn/docs/ · https://fuyao.aicubes.cn/docs/llms-full.txt
- iFinD MCP：https://mcp.51ifind.com/?syncCookieTimes=1

## 职责分工

| 来源 | 角色 |
|------|------|
| 扶摇 REST | 确定性引擎主数据源（字段可追溯） |
| iFinD MCP | NL 候选（`search_stocks`）与公告/宏观上下文；不替代引擎 |
| fixture | 无 Key / 调用失败时的显式样本，不得伪装成实时行情 |

## 扶摇

- Base：`https://fuyao.aicubes.cn`
- 鉴权：`X-api-key`
- 信封：`{ code, message, request_id, data }`
- 标的：完整 `thscode`（如 `600519.SH`）

优先接口：

- `GET /api/meta/tickers/search|list`
- `GET /api/a-share/prices/snapshot`
- `GET /api/a-share/prices/historical`
- `GET /api/a-share/financials/income-statements`
- `GET /api/a-share/calendar/trading-days`

## iFinD MCP

- Base：`https://api-mcp.51ifind.com:8643/ds-mcp-servers`
- 鉴权：`Authorization: Bearer <token>`
- 传输：StreamableHTTP + JSON-RPC（先 `initialize` 再 `tools/call`）
- 股票：`/hexin-ifind-ds-stock-mcp` · `search_stocks`
- 资讯：`/hexin-ifind-ds-news-mcp` · `search_notice` 等
- 宏观：`/hexin-ifind-ds-edb-mcp`

## 字段映射（ScreenSpec）

| ScreenSpec 字段 | 来源 | 说明 |
|-----------------|------|------|
| `pe_ttm` | 扶摇快照估值字段；缺失则 `missing` | 禁止用 0 填空 |
| `roe_ttm` | 扶摇财务 / 推导 | null=未披露 → `missing` |
| `revenue_yoy` | 利润表营收同比推导 | |
| `volatility_20d` | historical 日收益标准差（年化近似） | |

iFinD 交叉核对字段必须 `source=ifind`，且默认不作硬筛选唯一依据。
