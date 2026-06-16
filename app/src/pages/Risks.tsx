import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert, Sparkles } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AlertRow } from "@/components/alert-row";
import { EmptyState } from "@/components/states";
import { CHART } from "@/components/charts";
import { shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useRisks, useAlerts, useProjects } from "@/lib/api";
import { projectById } from "@/lib/mock/data";
import type { Risk, Metric } from "@/lib/types";

type Likelihood = Risk["likelihood"];
type Impact = Risk["impact"];
type Category = Risk["category"];
type Status = Risk["status"];

const SCORE: Record<Likelihood, number> = { low: 1, medium: 2, high: 3 };
const exposure = (r: Risk) => SCORE[r.likelihood] * SCORE[r.impact];

const CAT_TONE: Record<Category, "blue" | "sage" | "ochre" | "sienna" | "rust" | "neutral"> = {
  schedule: "blue",
  financial: "rust",
  approval: "sienna",
  scope: "ochre",
  resource: "sage",
  client: "neutral",
};
const CAT_LABEL: Record<Category, string> = {
  schedule: "Schedule",
  financial: "Financial",
  approval: "Approval",
  scope: "Scope",
  resource: "Resource",
  client: "Client",
};
const STATUS_TONE: Record<Status, "ochre" | "blue" | "sage"> = { open: "ochre", mitigating: "blue", closed: "sage" };
const STATUS_LABEL: Record<Status, string> = { open: "Open", mitigating: "Mitigating", closed: "Closed" };

const CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  ...(Object.keys(CAT_LABEL) as Category[]).map((c) => ({ value: c, label: CAT_LABEL[c] })),
];
const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...(Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ value: s, label: STATUS_LABEL[s] })),
];

// matrix tint by combined exposure (warmer = more severe)
function cellTone(score: number) {
  if (score >= 9) return { bg: "bg-rust-tint", ring: "border-rust/30", text: "text-rust" };
  if (score >= 6) return { bg: "bg-sienna-tint", ring: "border-sienna/30", text: "text-sienna" };
  if (score >= 3) return { bg: "bg-ochre-tint", ring: "border-ochre/25", text: "text-ochre" };
  return { bg: "bg-sage-tint", ring: "border-sage/20", text: "text-sage" };
}
// likelihood rows high→low (top→bottom), impact cols low→high (left→right)
const ROWS: Likelihood[] = ["high", "medium", "low"];
const COLS: Impact[] = ["low", "medium", "high"];

const src = (ref: string) => [
  { sourceId: "ds_manual", sourceName: "Risk register", recordRef: ref, observedAt: "2026-06-15" },
];

export default function Risks() {
  const { data: risks, isLoading } = useRisks();
  const { data: alerts = [] } = useAlerts();
  const { data: projects = [] } = useProjects();

  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [activeCell, setActiveCell] = useState<string | null>(null);

  const all = risks ?? [];
  const open = all.filter((r) => r.status !== "closed");
  const highHigh = all.filter((r) => r.likelihood === "high" && r.impact === "high").length;
  const criticalAlerts = alerts.filter((a) => a.severity === "critical").length;

  const categoryTally = useMemo(() => {
    const m = new Map<Category, number>();
    for (const r of open) m.set(r.category, (m.get(r.category) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [open]);
  const topCat = categoryTally[0];

  const kOpen: Metric = {
    value: open.length, unit: "count", label: "Open risks", confidence: "high", completeness: 100,
    asOf: "2026-06-17", note: "Logged across active projects; excludes closed.", sources: src("Manual capture"),
  };
  const kHighHigh: Metric = {
    value: highHigh, unit: "count", label: "High / high", confidence: "high", completeness: 100,
    asOf: "2026-06-17", note: "Top-right of the matrix — escalate first.", sources: src("Likelihood×Impact"),
  };
  const kCritical: Metric = {
    value: criticalAlerts, unit: "count", label: "Critical alerts", confidence: "high", completeness: 92,
    asOf: "2026-06-17", note: "AI-detected anomalies at critical severity.",
    sources: [{ sourceId: "ds_insights", sourceName: "Space Esse AI", recordRef: "Anomaly stream", observedAt: "2026-06-17" }],
  };
  const kTopCat: Metric = {
    value: topCat?.[1] ?? 0, unit: "count", label: "Top category", confidence: "medium", completeness: 100,
    asOf: "2026-06-17", note: topCat ? `${CAT_LABEL[topCat[0]]} carries the most open risks.` : undefined,
    sources: src("By category"),
  };

  const matrix = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of open) c[`${r.likelihood}:${r.impact}`] = (c[`${r.likelihood}:${r.impact}`] ?? 0) + 1;
    return c;
  }, [open]);

  const visible = useMemo(
    () =>
      all
        .filter((r) => category === "all" || r.category === category)
        .filter((r) => status === "all" || r.status === status)
        .filter((r) => !activeCell || `${r.likelihood}:${r.impact}` === activeCell)
        .sort((a, b) => exposure(b) - exposure(a) || a.title.localeCompare(b.title)),
    [all, category, status, activeCell],
  );

  const anomalies = alerts.filter((a) => ["critical", "warning", "info"].includes(a.severity));
  const projName = (pid: string | null) => (pid ? projectById(pid)?.name : undefined) ?? "Portfolio";

  return (
    <Page>
      <PageHeader
        kicker="Projects"
        title="Risks & issues"
        description="Logged project risks alongside AI-detected anomalies — each carries its source and a confidence read, so you act on signal, not noise."
        actions={<Badge tone="rust" dot size="md">{highHigh} at high / high</Badge>}
      />

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)
        ) : (
          <>
            <KpiCard kicker="Open risks" metric={kOpen} />
            <KpiCard
              kicker="High / high"
              metric={kHighHigh}
              sparkColor={CHART.sienna}
              footnote={<span className={cn("text-xs font-medium", highHigh > 0 ? "text-rust" : "text-ink-ghost")}>{highHigh > 0 ? "Escalate" : "Clear"}</span>}
            />
            <KpiCard kicker="Critical alerts" metric={kCritical} sparkColor={CHART.sienna} />
            <KpiCard
              kicker="Top category"
              metric={kTopCat}
              value={topCat ? CAT_LABEL[topCat[0]] : "—"}
              footnote={topCat && <span className="text-xs text-ink-ghost tnum">{topCat[1]} open</span>}
            />
          </>
        )}
      </div>

      {/* matrix + category mix */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>Likelihood × impact</CardKicker>
              <CardTitle>Risk exposure matrix</CardTitle>
            </div>
            {activeCell && (
              <button onClick={() => setActiveCell(null)} className="text-xs font-medium text-blue hover:underline">
                Clear cell filter
              </button>
            )}
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="flex w-5 items-center justify-center">
                <span className="label-draft -rotate-90 whitespace-nowrap">Likelihood →</span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1.5">
                  {ROWS.flatMap((lk) => [
                    <div key={`r-${lk}`} className="flex items-center justify-end pr-1.5 text-[11px] font-medium capitalize text-ink-soft">
                      {lk}
                    </div>,
                    ...COLS.map((im) => {
                      const key = `${lk}:${im}`;
                      const score = SCORE[lk] * SCORE[im];
                      const count = matrix[key] ?? 0;
                      const tone = cellTone(score);
                      const isActive = activeCell === key;
                      return (
                        <button
                          key={key}
                          onClick={() => setActiveCell(isActive ? null : key)}
                          title={`${lk} likelihood · ${im} impact — ${count} risk(s)`}
                          className={cn(
                            "flex aspect-[3/2] items-center justify-center rounded-md border transition-all",
                            tone.bg, tone.ring,
                            count === 0 && "opacity-55",
                            isActive ? "ring-2 ring-blue ring-offset-1 ring-offset-paper" : "hover:shadow-lift",
                          )}
                        >
                          <span className={cn("font-display text-xl tnum", count > 0 ? tone.text : "text-ink-ghost")}>{count}</span>
                        </button>
                      );
                    }),
                  ])}
                  <div />
                  {COLS.map((im) => (
                    <div key={`c-${im}`} className="pt-1 text-center text-[11px] font-medium capitalize text-ink-soft">{im}</div>
                  ))}
                </div>
                <div className="mt-2 text-center"><span className="label-draft">← Impact →</span></div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3 text-[11px] text-ink-soft">
              {[["bg-sage", "Low"], ["bg-ochre", "Moderate"], ["bg-sienna", "High"], ["bg-rust", "Severe"]].map(([c, l]) => (
                <span key={l} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", c)} />{l}
                </span>
              ))}
              <span className="ml-auto text-ink-ghost">Click a cell to filter the table</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardKicker>Open risks</CardKicker>
              <CardTitle>By category</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {categoryTally.length === 0 && <p className="text-sm text-ink-faint">No open risks.</p>}
            {categoryTally.map(([cat, n]) => (
              <button key={cat} onClick={() => setCategory(category === cat ? "all" : cat)} className="block w-full text-left">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <Badge tone={CAT_TONE[cat]} size="sm">{CAT_LABEL[cat]}</Badge>
                  <span className="text-xs font-medium text-ink tnum">{n}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-bone-2">
                  <div
                    className={cn("h-full rounded-full", cat === "financial" ? "bg-rust" : cat === "approval" ? "bg-sienna" : "bg-blue")}
                    style={{ width: `${(n / (categoryTally[0][1] || 1)) * 100}%` }}
                  />
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* register */}
      <PageSection
        className="mt-8"
        title="Risk register"
        description="Sorted by exposure — high likelihood × high impact first."
        actions={
          <div className="flex items-center gap-2">
            <Select value={category} onValueChange={setCategory} options={CATEGORY_OPTIONS} size="sm" />
            <Select value={status} onValueChange={setStatus} options={STATUS_OPTIONS} size="sm" />
          </div>
        }
      >
        <Card>
          {isLoading ? (
            <div className="space-y-2 p-5">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : visible.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title="No matching risks"
              description="Nothing matches the current filters. Clear the category, status, or matrix-cell selection."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Risk</TH>
                  <TH>Project</TH>
                  <TH>Category</TH>
                  <TH>Likelihood / impact</TH>
                  <TH>Owner</TH>
                  <TH>Status</TH>
                  <TH className="text-right">Raised</TH>
                </TR>
              </THead>
              <TBody>
                {visible.map((r) => {
                  const sev =
                    r.likelihood === "high" && r.impact === "high" ? "rust"
                    : r.impact === "high" || r.likelihood === "high" ? "sienna"
                    : exposure(r) >= 4 ? "ochre" : "sage";
                  return (
                    <TR key={r.id}>
                      <TD className="max-w-[360px] font-medium text-ink">{r.title}</TD>
                      <TD>
                        <Link to={`/projects/${r.projectId}`} className="text-blue hover:underline">{projName(r.projectId)}</Link>
                      </TD>
                      <TD><Badge tone={CAT_TONE[r.category]} size="sm">{CAT_LABEL[r.category]}</Badge></TD>
                      <TD><Badge tone={sev} size="sm">{r.likelihood}/{r.impact}</Badge></TD>
                      <TD className="whitespace-nowrap text-ink-soft">{r.owner}</TD>
                      <TD>
                        <Badge tone={STATUS_TONE[r.status]} size="sm" dot={r.status === "mitigating"}>{STATUS_LABEL[r.status]}</Badge>
                      </TD>
                      <TD className="whitespace-nowrap text-right text-ink-soft tnum">{shortDate(r.raisedDate)}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
      </PageSection>

      {/* AI-detected anomalies */}
      <PageSection
        className="mt-8"
        title="AI-detected anomalies"
        description="Signals surfaced from connected sources — review before they harden into risks."
        actions={
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue">
            <Sparkles className="h-3.5 w-3.5" /> Space Esse AI
          </span>
        }
      >
        <Card>
          {anomalies.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="No anomalies right now"
              description="Connected sources are within expected ranges. New signals appear here as they are detected."
            />
          ) : (
            <div className="divide-y divide-line">
              {anomalies.map((a) => <AlertRow key={a.id} alert={a} />)}
            </div>
          )}
        </Card>
      </PageSection>

      <p className="mt-8 text-center text-xs text-ink-ghost">
        {open.length} open risk(s) across {projects.length} projects · anomalies refreshed {shortDate("2026-06-17")}.
      </p>
    </Page>
  );
}
