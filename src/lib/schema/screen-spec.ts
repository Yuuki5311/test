import { z } from "zod";

export const ConditionOpSchema = z.enum([
  "eq", "neq", "gt", "gte", "lt", "lte", "between", "in", "not_in", "is_null", "not_null",
]);

export const ConditionSchema = z.object({
  id: z.string().min(1),
  field: z.string().min(1),
  op: ConditionOpSchema,
  value: z.unknown().optional(),
  label: z.string().optional(),
  soft: z.boolean().default(false),
});

export const ClarifyQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).optional(),
  answer: z.string().optional(),
});

export const ScreenSpecSchema = z.object({
  version: z.literal(1),
  universe: z.object({
    market: z.enum(["A"]).default("A"),
    excludeST: z.boolean().default(true),
    boards: z.array(z.string()).optional(),
  }),
  logic: z.enum(["and", "or"]).default("and"),
  conditions: z.array(ConditionSchema).min(1),
  clarifications: z.array(ClarifyQuestionSchema).default([]),
  assumptions: z.array(z.string()).default([]),
});

export type Condition = z.infer<typeof ConditionSchema>;
export type ScreenSpec = z.infer<typeof ScreenSpecSchema>;
export type ClarifyQuestion = z.infer<typeof ClarifyQuestionSchema>;

export function parseScreenSpec(input: unknown): ScreenSpec {
  return ScreenSpecSchema.parse(input);
}
