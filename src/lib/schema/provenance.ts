export type ProvenanceStatus = "ok" | "missing" | "stale" | "error" | "conflict";

export interface FieldProvenance {
  field: string;
  source: "fuyao" | "ifind" | "fixture" | "user";
  asOf: string | null; // ISO date or null if missing
  unit: string | null;
  definition: string;
  status: ProvenanceStatus;
  rawValue: unknown;
  message?: string;
}
