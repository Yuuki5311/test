"use client";

import { useMemo, useState } from "react";
import { IntentInput } from "@/components/IntentInput";
import { ClarifyPanel } from "@/components/ClarifyPanel";
import { ConditionEditor } from "@/components/ConditionEditor";
import { ConflictBanner } from "@/components/ConflictBanner";
import { ResultsTable } from "@/components/ResultsTable";
import { StockExplainCard } from "@/components/StockExplainCard";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { CompareView } from "@/components/CompareView";
import { Disclaimer } from "@/components/Disclaimer";
import type { ClarifyQuestion, ScreenSpec } from "@/lib/schema/screen-spec";
import type { Conflict } from "@/lib/engine/conflicts";
import type { StockEval } from "@/lib/engine/evaluate";
import type { StockExplanation } from "@/lib/explain/builder";

type ScreenPayload = {
  result: { included: StockEval[]; excluded: StockEval[]; dataMode: string };
  explanations: StockExplanation[];
  conflicts: Conflict[];
  warnings: string[];
  dataMode: string;
  candidateSource: string;
};

export default function Home() {
  const [intent, setIntent] = useState("经营改善、估值合理、走势相对稳定");
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [spec, setSpec] = useState<ScreenSpec | null>(null);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [screen, setScreen] = useState<ScreenPayload | null>(null);
  const [tab, setTab] = useState<"included" | "excluded">("included");
  const [selected, setSelected] = useState<string>();
  const [impactNote, setImpactNote] = useState<string>("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [compare, setCompare] = useState<Parameters<typeof CompareView>[0]["payload"]>(null);
  const [backtest, setBacktest] = useState<string>("");
  const [monitorNote, setMonitorNote] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>("");

  const explanation = useMemo(() => {
    if (!screen || !selected) return null;
    return screen.explanations.find((e) => e.symbol === selected) ?? null;
  }, [screen, selected]);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    return json;
  };

  const onClarify = async () => {
    setBusy(true);
    setError("");
    try {
      const json = await post("/api/clarify", { text: intent });
      setQuestions(json.questions);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onParse = async () => {
    setBusy(true);
    setError("");
    try {
      const json = await post("/api/parse", { text: intent, answers });
      setSpec(json.spec);
      setConflicts(json.conflicts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onScreen = async () => {
    if (!spec) return;
    setBusy(true);
    setError("");
    try {
      const json = (await post("/api/screen", { spec, intentText: intent })) as ScreenPayload;
      setScreen(json);
      setConflicts(json.conflicts ?? []);
      setTab("included");
      setSelected(json.result.included[0]?.symbol ?? json.result.excluded[0]?.symbol);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onImpact = async () => {
    if (!spec || !screen) return;
    const before = {
      ...spec,
      conditions: spec.conditions.map((c) =>
        c.field === "pe_ttm" && c.op === "lte" ? c : c,
      ),
    };
    // Compare current vs PE tightened by 20% for demo impact
    const after = {
      ...spec,
      conditions: spec.conditions.map((c) => {
        if (c.field === "pe_ttm" && typeof c.value === "number") {
          return { ...c, value: Number((Number(c.value) * 0.8).toFixed(2)), label: `${c.label ?? c.id} (收紧)` };
        }
        if (c.field === "pe_ttm" && Array.isArray(c.value)) {
          return { ...c, value: [c.value[0], Number((Number(c.value[1]) * 0.8).toFixed(2))] };
        }
        return c;
      }),
    };
    const json = await post("/api/impact", { before, after });
    setImpactNote(
      `收紧 PE 条件后：入选 ${json.impact.beforeCount} → ${json.impact.afterCount}；新排除 ${json.impact.newlyExcluded.join(", ") || "无"}`,
    );
    void before;
  };

  const onSave = async () => {
    if (!spec) return;
    const saved = await post("/api/screens", { name: `策略-${intent.slice(0, 12)}`, spec });
    setSavedIds((ids) => [...ids, saved.id].slice(-5));
  };

  const onCompare = async () => {
    if (savedIds.length < 2) {
      setError("请先保存至少两个策略再比较");
      return;
    }
    const json = await post("/api/compare", { idA: savedIds[savedIds.length - 2], idB: savedIds[savedIds.length - 1] });
    setCompare(json);
  };

  const onBacktest = async () => {
    if (!spec) return;
    const json = await post("/api/backtest", { spec });
    setBacktest(
      `${json.disclaimer} · ` +
        json.series.map((s: { asOf: string; hitCount: number }) => `${s.asOf}:${s.hitCount}`).join(" / "),
    );
  };

  const onMonitor = async () => {
    if (!spec) return;
    const json = await post("/api/monitor", { name: `监控-${intent.slice(0, 8)}`, spec });
    setMonitorNote(`${json.note} · id=${json.id}`);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="space-y-3">
        <p className="brand-display text-5xl leading-none text-[var(--ink)] md:text-6xl">语意筛</p>
        <p className="text-lg text-[var(--muted)]">IntentScreen · 自然语言 → 可检查条件 → 可解释筛选</p>
        <Disclaimer />
      </header>

      <section className="space-y-3">
        <IntentInput value={intent} onChange={setIntent} />
        <div className="flex flex-wrap gap-2">
          <button
            data-testid="btn-clarify"
            type="button"
            disabled={busy}
            className="rounded bg-[var(--ink)] px-4 py-2 text-sm text-white"
            onClick={onClarify}
          >
            澄清意图
          </button>
          <button
            data-testid="btn-parse"
            type="button"
            disabled={busy}
            className="rounded bg-[var(--accent)] px-4 py-2 text-sm text-white"
            onClick={onParse}
          >
            生成条件
          </button>
          <button
            data-testid="btn-screen"
            type="button"
            disabled={busy || !spec}
            className="rounded bg-[var(--accent-2)] px-4 py-2 text-sm text-white disabled:opacity-40"
            onClick={onScreen}
          >
            运行筛选
          </button>
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </section>

      {questions.length > 0 && (
        <ClarifyPanel
          questions={questions}
          answers={answers}
          onAnswer={(id, value) => setAnswers((a) => ({ ...a, [id]: value }))}
        />
      )}

      {spec && (
        <>
          <ConflictBanner conflicts={conflicts} />
          <ConditionEditor
            spec={spec}
            onChange={(next) => {
              setSpec(next);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm" onClick={onImpact}>
              查看条件影响
            </button>
            <button type="button" className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm" onClick={onSave}>
              保存策略
            </button>
            <button type="button" className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm" onClick={onCompare}>
              比较已存策略
            </button>
            <button type="button" className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm" onClick={onBacktest}>
              轻量回测
            </button>
            <button type="button" className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm" onClick={onMonitor}>
              转监控
            </button>
          </div>
          {impactNote && <p className="text-sm text-[var(--ink)]">{impactNote}</p>}
          {backtest && <p className="text-sm text-[var(--muted)]">{backtest}</p>}
          {monitorNote && <p className="text-sm text-[var(--accent)]">{monitorNote}</p>}
        </>
      )}

      {screen && (
        <section className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <DataSourceBadge
              dataMode={screen.dataMode}
              candidateSource={screen.candidateSource}
              warnings={screen.warnings}
            />
            <ResultsTable
              included={screen.result.included}
              excluded={screen.result.excluded}
              tab={tab}
              onTab={setTab}
              onSelect={setSelected}
              selected={selected}
            />
          </div>
          <StockExplainCard explanation={explanation} />
        </section>
      )}

      <CompareView payload={compare} />
    </main>
  );
}
