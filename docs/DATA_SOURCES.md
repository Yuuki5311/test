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
| `pe_ttm` | `GET /api/a-share/valuations/snapshot` 的 `pe_ttm` | 行情快照不含估值 |
| `name` | 同一估值快照的 `name` | 行情快照不含中文名 |
| `roe_ttm` | `GET /api/a-share/financials/indicators` 的 `index_weighted_avg_roe` | 百分数÷100；逐只请求并在本地缓存 |
| `revenue_yoy` | 同一财务指标的 `operating_income_yoy_growth_ratio` | 百分数÷100；逐只请求并在本地缓存 |
| `volatility_20d` | 扶摇 `historical` 近20个交易日收盘价对数收益标准差×√252 | 逐只请求并缓存 |

iFinD 交叉核对字段必须 `source=ifind`，且默认不作硬筛选唯一依据。
