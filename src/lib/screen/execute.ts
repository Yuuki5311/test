import { parseScreenSpec, type ScreenSpec } from "@/lib/schema/screen-spec";
import { detectConflicts } from "@/lib/engine/conflicts";
import { evaluateScreen } from "@/lib/engine/evaluate";
import { createProvider } from "@/lib/data/provider";
import { buildExplanation } from "@/lib/explain/builder";
import { assertCompliantText } from "@/lib/compliance/guard";

export async function executeScreen(specInput: unknown, intentText?: string) {
  const spec: ScreenSpec = parseScreenSpec(specInput);
  const conflicts = detectConflicts(spec);
  const provider = createProvider();
  const universe = await provider.resolveUniverse(spec, intentText);
  const loaded = await provider.loadSnapshots(universe.symbols);
  const result = evaluateScreen(spec, loaded.stocks);
  result.dataMode = loaded.dataMode === "fixture" ? "fixture" : loaded.dataMode;

  const explanations = [...result.included, ...result.excluded].map((ev) => {
    const explanation = buildExplanation(ev, spec);
    for (const part of [...explanation.facts, ...explanation.inferences, explanation.disclaimer]) {
      const check = assertCompliantText(part);
      if (!check.ok) {
        explanation.uncertainties.push(`合规标记: ${check.violations.join(",")}`);
      }
    }
    return explanation;
  });

  return {
    result,
    explanations,
    conflicts,
    warnings: [...universe.warnings, ...loaded.warnings],
    dataMode: loaded.dataMode,
    candidateSource: universe.candidateSource,
  };
}
