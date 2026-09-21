"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { IntentInput } from "@/components/IntentInput";
import { ClarifyPanel } from "@/components/ClarifyPanel";
import { ConditionEditor } from "@/components/ConditionEditor";
import { ConflictBanner } from "@/components/ConflictBanner";
import { ResultsTable } from "@/components/ResultsTable";
import { StockExplainCard } from "@/components/StockExplainCard";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { CompareView } from "@/components/CompareView";
import { SavedStrategyList, type SavedStrategy } from "@/components/SavedStrategyList";
import { BacktestPanel, type BacktestPayload } from "@/components/BacktestPanel";
import { MonitorTaskList, type MonitorSummary } from "@/components/MonitorTaskList";
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

function autoAnswersFromQuestions(questions: ClarifyQuestion[]): Record<string, string> {
  const answers: Record<string, string> = {};
  for (const q of questions) {
    if (q.options?.[0]) answers[q.id] = q.options[0];
  }
  return answers;
}

function tightenSpecForImpact(spec: ScreenSpec): ScreenSpec {
  return {
    ...spec,
    conditions: spec.conditions.map((c) => {
      if (c.field === "pe_ttm" && typeof c.value === "number") {
        return {
          ...c,
          value: Number((Number(c.value) * 0.8).toFixed(2)),
          label: `${c.label ?? c.id}（收紧演示）`,
        };
      }
      if (c.field === "pe_ttm" && Array.isArray(c.value)) {
        return {
          ...c,
          value: [c.value[0], Number((Number(c.value[1]) * 0.8).toFixed(2))],
          label: `${c.label ?? c.id}（收紧演示）`,
        };
      }
      return c;
    }),
  };
}

export default function Home() {
  const [intent, setIntent] = useState("经营改善、估值合理、走势相对稳定");
  const [lastRunIntent, setLastRunIntent] = useState("");
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [spec, setSpec] = useState<ScreenSpec | null>(null);
  const [conditionsDirty, setConditionsDirty] = useState(false);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [screen, setScreen] = useState<ScreenPayload | null>(null);
  const [tab, setTab] = useState<"included" | "excluded">("included");
  const [selected, setSelected] = useState<string>();
  const [impactNote, setImpactNote] = useState("");
  const [pipelineStatus, setPipelineStatus] = useState("");
  const [savedScreens, setSavedScreens] = useState<SavedStrategy[]>([]);
  const [selectedStrategyIds, setSelectedStrategyIds] = useState<string[]>([]);
  const [compare, setCompare] = useState<Parameters<typeof CompareView>[0]["payload"]>(null);
  const [backtest, setBacktest] = useState<BacktestPayload | null>(null);
  const [backtestSymbol, setBacktestSymbol] = useState("");
  const [backtestBusy, setBacktestBusy] = useState(false);
  const backtestRef = useRef<HTMLDivElement>(null);
  const [monitorNote, setMonitorNote] = useState("");
  const [monitors, setMonitors] = useState<MonitorSummary[]>([]);
  const [selectedMonitorIds, setSelectedMonitorIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const explanation = useMemo(() => {
    if (!screen || !selected) return null;
    return screen.explanations.find((e) => e.symbol === selected) ?? null;
  }, [screen, selected]);

  const loadSaved = async () => {
    const res = await fetch("/api/screens");
    const json = (await res.json()) as { screens?: SavedStrategy[] };
    setSavedScreens(json.screens ?? []);
  };

  const loadMonitors = async () => {
    const res = await fetch("/api/monitors");
    const json = (await res.json()) as { monitors?: MonitorSummary[] };
    setMonitors(json.monitors ?? []);
  };

  useEffect(() => {
    void loadSaved();
    void loadMonitors();
  }, []);

  useEffect(() => {
    if (backtest) backtestRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [backtest]);

  const post = async (url: string, body: unknown, method: "POST" | "DELETE" = "POST") => {
    const res = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const raw = await res.text();
    let json: Record<string, any> = {};
    try {
      json = raw ? JSON.parse(raw) : {};
    } catch {
      throw new Error(raw.slice(0, 180) || `接口返回了空响应（${res.status}）`);
    }
    if (!res.ok) throw new Error(json.error ?? res.statusText);
    return json;
  };

  const runScreenWithSpec = async (nextSpec: ScreenSpec, intentText: string) => {
    setPipelineStatus("正在基于真实/样本数据筛选候选股票…");
    const json = (await post("/api/screen", {
      spec: nextSpec,
      intentText,
    })) as ScreenPayload;
    setScreen(json);
    setConflicts(json.conflicts ?? []);
    setTab("included");
    setSelected(json.result.included[0]?.symbol ?? json.result.excluded[0]?.symbol);

    setPipelineStatus("正在分析条件变化影响…");
    const after = tightenSpecForImpact(nextSpec);
    const impact = await post("/api/impact", { before: nextSpec, after });
    setImpactNote(
      `若将估值条件收紧约 20%：入选 ${impact.impact.beforeCount} → ${impact.impact.afterCount}；` +
        `新排除 ${impact.impact.newlyExcluded.slice(0, 8).join(", ") || "无"}` +
        (impact.impact.newlyExcluded.length > 8 ? "…" : "") +
        "。你可在上方直接改条件后再次点击「运行筛选」。",
    );
  };

  /** 唯一主按钮：自然语言 → 自动澄清/结构化 → 筛选 → 解释与影响 */
  const onRunScreen = async () => {
    const text = intent.trim();
    if (!text) {
      setError("请先输入自然语言选股意图");
      return;
    }

    setBusy(true);
    setError("");
    setPipelineStatus("");
    try {
      const intentChanged = text !== lastRunIntent;
      const reuseEditedSpec = Boolean(spec && conditionsDirty && !intentChanged);

      let workingSpec = spec;

      if (!reuseEditedSpec) {
        setPipelineStatus("正在理解自然语言意图…");
        const clarify = await post("/api/clarify", { text });
        const qs = (clarify.questions ?? []) as ClarifyQuestion[];
        const auto = autoAnswersFromQuestions(qs);
        // 保留用户已选澄清答案，缺省项用推荐默认值
        const mergedAnswers = { ...auto, ...answers };
        setQuestions(qs);
        setAnswers(mergedAnswers);

        setPipelineStatus("正在转化为可检查、可修改的数据条件…");
        const parsed = await post("/api/parse", { text, answers: mergedAnswers });
        workingSpec = parsed.spec as ScreenSpec;
        setSpec(workingSpec);
        setConflicts(parsed.conflicts ?? []);
        setConditionsDirty(false);
        setLastRunIntent(text);
      } else {
        setPipelineStatus("正在按你修改后的条件重新筛选…");
      }

      if (!workingSpec) throw new Error("未能生成筛选条件");
      await runScreenWithSpec(workingSpec, text);
      setConditionsDirty(false);
      setPipelineStatus("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPipelineStatus("");
    } finally {
      setBusy(false);
    }
  };

  const onSave = async () => {
    if (!spec) return;
    const saved = await post("/api/screens", { name: `策略-${intent.slice(0, 12)}`, spec });
    setSelectedStrategyIds((ids) => [...ids, saved.id]);
    await loadSaved();
  };

  const onCompare = async () => {
    if (selectedStrategyIds.length < 2) {
      setError("请在已保存策略中至少勾选两个再比较");
      return;
    }
    setError("");
    const json = await post("/api/compare", { ids: selectedStrategyIds });
    setCompare(json);
  };

  const onDeleteStrategies = async () => {
    if (!selectedStrategyIds.length) {
      setError("请先勾选要删除的策略");
      return;
    }
    setError("");
    try {
      await post("/api/screens", { ids: selectedStrategyIds }, "DELETE");
      const removed = new Set(selectedStrategyIds);
      setSelectedStrategyIds([]);
      setCompare((current) => (current?.items.some((item) => removed.has(item.id)) ? null : current));
      await loadSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onBacktest = async () => {
    const row = screen?.result.included.find((item) => item.symbol === backtestSymbol);
    if (!row) {
      setError("请先在入选列表勾选一只股票");
      setTab("included");
      return;
    }
    setError("");
    setBacktestBusy(true);
    try {
      const json = (await post("/api/backtest", { symbol: row.symbol, name: row.name })) as BacktestPayload;
      setBacktest(json);
    } catch (e) {
      setBacktest(null);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBacktestBusy(false);
    }
  };

  const onMonitor = async () => {
    if (!spec) return;
    const json = await post("/api/monitor", { name: `监控-${intent.slice(0, 8)}`, spec });
    setMonitorNote(json.note);
    await loadMonitors();
  };

  const onDeleteMonitors = async () => {
    if (!selectedMonitorIds.length) {
      setError("请先勾选要删除的监控任务");
      return;
    }
    setError("");
    try {
      await post("/api/monitors", { ids: selectedMonitorIds }, "DELETE");
      setSelectedMonitorIds([]);
      await loadMonitors();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-8 px-4 py-10 md:px-8">
      <header className="space-y-3">
        <p className="brand-display text-5xl leading-none text-[var(--ink)] md:text-6xl">语意筛</p>
        <p className="text-lg text-[var(--muted)]">
          输入自然语言，一点筛选：自动生成可检查条件 → 真实数据候选 → 入选/排除解释
        </p>
        <Disclaimer />
      </header>

      <MonitorTaskList
        monitors={monitors}
        selectedIds={selectedMonitorIds}
        busy={busy}
        onToggle={(id) =>
          setSelectedMonitorIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))
        }
        onDelete={onDeleteMonitors}
      />

      <section className="space-y-3">
        <IntentInput
          value={intent}
          onChange={(v) => {
            setIntent(v);
          }}
        />
        <div className="flex flex-wrap items-center gap-3">
          <button
            data-testid="btn-screen"
            type="button"
            disabled={busy || !intent.trim()}
            className="rounded bg-[var(--ink)] px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
            onClick={onRunScreen}
          >
            {busy ? "筛选中…" : "运行筛选"}
          </button>
          {pipelineStatus && (
            <span data-testid="pipeline-status" className="text-sm text-[var(--accent)]">
              {pipelineStatus}
            </span>
          )}
        </div>
        {error && <p className="text-sm text-red-700">{error}</p>}
      </section>

      {questions.length > 0 && (
        <ClarifyPanel
          questions={questions}
          answers={answers}
          onAnswer={(id, value) => {
            setAnswers((a) => ({ ...a, [id]: value }));
            // 用户改澄清答案后，下次运行按新意图链路重跑
            setLastRunIntent("");
            setConditionsDirty(false);
          }}
        />
      )}

      {spec && (
        <>
          <ConflictBanner conflicts={conflicts} />
          <ConditionEditor
            spec={spec}
            onChange={(next) => {
              setSpec(next);
              setConditionsDirty(true);
            }}
          />
          {conditionsDirty && (
            <p className="text-xs text-[var(--warn)]">
              条件已修改。再次点击「运行筛选」将按当前条件重新筛选（不会覆盖你的手工修改）。
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm" onClick={onSave}>
              保存策略
            </button>
            <button
              type="button"
              data-testid="btn-backtest"
              className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm disabled:opacity-40"
              disabled={backtestBusy}
              onClick={onBacktest}
            >
              {backtestBusy ? "回测中…" : "轻量回测"}
            </button>
            <button type="button" className="rounded border border-[var(--line)] bg-white px-3 py-1.5 text-sm" onClick={onMonitor}>
              转监控
            </button>
          </div>
          {impactNote && (
            <p data-testid="impact-note" className="rounded-md border border-[var(--line)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--ink)]">
              {impactNote}
            </p>
          )}
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
              checkedSymbol={backtestSymbol}
              onCheck={(symbol) => {
                setBacktestSymbol((current) => (current === symbol ? "" : symbol));
                setTab("included");
              }}
            />
          </div>
          <StockExplainCard explanation={explanation} />
        </section>
      )}

      {backtest && (
        <div ref={backtestRef}>
          <BacktestPanel payload={backtest} />
        </div>
      )}

      <SavedStrategyList
        screens={savedScreens}
        selectedIds={selectedStrategyIds}
        busy={busy}
        onToggle={(id) =>
          setSelectedStrategyIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]))
        }
        onCompare={onCompare}
        onDelete={onDeleteStrategies}
      />

      <CompareView payload={compare} />
    </main>
  );
}
