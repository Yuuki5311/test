import fs from "fs";
import path from "path";
import type { StockSnapshot } from "./types";
import { FIELD_DEFS, makeField } from "./field-map";

export function loadFixtureSnapshots(symbols?: string[]): {
  stocks: StockSnapshot[];
  asOf: string;
} {
  const p = path.join(process.cwd(), "data/fixtures/quotes_fundamentals.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as {
    asOf: string;
    stocks: Array<Record<string, unknown>>;
  };
  let rows = raw.stocks;
  if (symbols?.length) rows = rows.filter((r) => symbols.includes(String(r.symbol)));
  const stocks: StockSnapshot[] = rows.map((r) => {
    const fields: StockSnapshot["fields"] = {};
    for (const key of Object.keys(FIELD_DEFS)) {
      const v = r[key];
      fields[key] = makeField(key, v ?? null, {
        source: "fixture",
        asOf: raw.asOf,
        message: v == null ? "fixture 中该字段为空" : undefined,
      });
    }
    return { symbol: String(r.symbol), name: String(r.name), fields };
  });
  return { stocks, asOf: raw.asOf };
}

export function loadFixtureUniverse(): string[] {
  const p = path.join(process.cwd(), "data/fixtures/universe.json");
  const raw = JSON.parse(fs.readFileSync(p, "utf8")) as { symbols: string[] };
  return raw.symbols;
}
