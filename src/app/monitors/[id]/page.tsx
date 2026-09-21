"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { DataSourceBadge } from "@/components/DataSourceBadge";
import { ResultsTable } from "@/components/ResultsTable";
import { StockExplainCard } from "@/components/StockExplainCard";
import type { StockEval } from "@/lib/engine/evaluate";
import type { StockExplanation } from "@/lib/explain/builder";

type ScreenPayload = {
  result: { included: StockEval[]; excluded: StockEval[]; dataMode: string };
  explanations: StockExplanation[];
  warnings: string[];
  dataMode: string;
  candidateSource: string;
};

type MonitorDetail = {
  id: string;
  name: string;
  lastRunAt: string | null;
  runError: string | null;
  result: ScreenPayload | null;
};

export default function MonitorResultPage() {
  const params = useParams<{ id: string }>();
  const [detail, setDetail] = useState<MonitorDetail | null>(null);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"included" | "excluded">("included");
  const [selected, setSelected] = useState<string>();

  useEffect(() => {
    const id = params.id;
    if (!id) return;
    void (async () => {
      const res = await fetch(`/api/monitors/${id}`);
      const json = (await res.json()) as MonitorDetail & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "加载失败");
        return;
      }
      setDetail(json);
      setSelected(json.result?.result.included[0]?.symbol ?? json.result?.result.excluded[0]?.symbol);
    })();
  }, [params.id]);

  const explanation = useMemo(() => {
    if (!detail?.result || !selected) return null;
    return detail.result.explanations.find((item) => item.symbol === selected) ?? null;
  }, [detail, selected]);

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-10 md:px-8">
      <Link href="/" className="text-sm text-[var(--muted)]">
        返回
      </Link>
      {!detail && !error && <p className="text-sm text-[var(--muted)]">正在加载监控结果…</p>}
      {error && <p className="text-sm text-red-700">{error}</p>}
      {detail && (
        <>
          <header className="space-y-1">
            <h1 className="text-2xl font-medium text-[var(--ink)]">{detail.name}</h1>
            <p className="text-sm text-[var(--muted)]">
              {detail.lastRunAt
                ? `最近一次执行：${new Date(detail.lastRunAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}`
                : "尚未执行。本机服务开着时，每天 9:00（北京时间）会自动跑一遍。"}
            </p>
          </header>
          {detail.runError && <p className="text-sm text-red-700">{detail.runError}</p>}
          {!detail.result && !detail.runError && (
            <p className="text-sm text-[var(--muted)]">还没有筛选结果。下一次 9:00 执行后，会显示在这里，并覆盖更早的结果。</p>
          )}
          {detail.result && (
            <section className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <DataSourceBadge
                  dataMode={detail.result.dataMode}
                  candidateSource={detail.result.candidateSource}
                  warnings={detail.result.warnings}
                />
                <ResultsTable
                  included={detail.result.result.included}
                  excluded={detail.result.result.excluded}
                  tab={tab}
                  onTab={setTab}
                  onSelect={setSelected}
                  selected={selected}
                />
              </div>
              <StockExplainCard explanation={explanation} />
            </section>
          )}
        </>
      )}
    </main>
  );
}
