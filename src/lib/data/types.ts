import type { FieldProvenance } from "@/lib/schema/provenance";

export interface StockSnapshot {
  symbol: string;
  name: string;
  fields: Record<string, FieldProvenance>;
}
