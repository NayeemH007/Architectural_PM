import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarClock, Landmark } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BarSeries, Donut, CHART } from "@/components/charts";
import { SourceChip } from "@/components/data-source";
import { EmptyState } from "@/components/states";
import {
  ApprovalBadge,
  DeliverableBadge,
  MilestoneBadge,
  STAGE_LABELS,
  STAGE_ORDER,
} from "@/components/status";
import { num, pct, shortDate, daysFromNow } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useApprovals, useDeliverables, useMilestones, useProjects } from "@/lib/api";
import { projectById } from "@/lib/mock/data";
import type { Approval, Deliverable, Metric, Milestone, Project } from "@/lib/types";

// A deliverable is "at risk" if returned for revision, or past its due date and not yet issued.
function deliverableAtRisk(d: Deliverable): boolean {
  if (d.status === "revise") return true;
  if (d.issuedDate) return false;
  const days = daysFromNow(d.dueDate);
  return days !== null && days < 0;
}

// An approval is "stuck" if it has a statutory window, has blown past it, and isn't approved.
function approvalStuck(a: Approval): boolean {
  return a.statutoryDays !== null && a.daysInStage > a.statutoryDays && a.status !== "approved";
}

function approvalNeedsAction(a: Approval): boolean {
  const inFlight = a.status === "submitted" || a.status === "in_review" || a.status === "query_raised";
  return inFlight || approvalStuck(a);
}

const DELIVERABLE_STATUS_META: { key: Deliverable["status"]; label: string; color: string }[] = [
  { key: "in_progress", label: "In progress", color: CHART.blue },
  { key: "internal_review", label: "Internal review", color: CHART.ochre },
  { key: "issued", label: "Issued", color: CHART.sage },
  { key: "approved", label: "Approved", color: CHART.sage },
  { key: "revise", label: "Revise", color: CHART.sienna },
  { key: "not_started", label: "Not started", color: CHART.taupe },
];

const APPROVAL_STATUS_META: { key: Approval["status"]; label: string; color: string }[] = [
  { key: "submitted", label: "Submitted", color: CHART.blue },
  { key: "in_review", label: "In review", color: CHART.ochre },
  { key: "query_raised", label: "Query raised", color: CHART.sienna },
  { key: "approved", label: "Approved", color: CHART.sage },
  { key: "preparing", label: "Preparing", color: CHART.slate },
];

export default function Delivery() {
  const { data: projects = [], isLoading: pLoading } = useProjects();
  const { data: milestones = [], isLoading: mLoading } = useMilestones();
  const { data: approvals = [], isLoading: aLoading } = useApprovals();
  const { data: deliverables = [], isLoading: dLoading } = useDeliverables();

  const loading = pLoading || mLoading || aLoading || dLoading;

  // ---- KPI derivations ----------------------------------------------------
  const active = useMemo(() => projects.filter((p) => p.stage !== "closed"), [projects]);
  const onTimeShare = useMemo(() => {
    if (active.length === 0) return null;
    const onTime = active.filter((p) => p.scheduleVarianceDays >= 0).length;
    return (onTime / active.length) * 100;
  }, [active]);
  const overdueMilestones = useMemo(
    () => milestones.filter((m) => m.status === "overdue"),
    [milestones],
  );
  const stuckApprovals = useMemo(() => approvals.filter(approvalStuck), [approvals]);
  const atRiskDeliverables = useMemo(() => deliverables.filter(deliverableAtRisk), [deliverables]);

  const src = (id: string, name: string, ref: string): Metric["sources"][number] => ({
    sourceId: id,
    sourceName: name,
    recordRef: ref,
    observedAt: "2026-06-12",
  });

  const kOnTime: Metric = {
    value: onTimeShare,
    unit: "pct",
    label: "On-time projects",
    confidence: "medium",
    completeness: 78,
    asOf: "2026-06-17",
    deltaPct: -6,
    trend: [75, 70, 63, 60, 55, onTimeShare ?? 50],
    formula: "Share of active projects with schedule variance ≥ 0 days",
    sources: [src("ds_manual", "Manual capture", "phase schedule"), src("ds_drive", "Google Drive", "programme")],
  };
  const kOverdue: Metric = {
    value: overdueMilestones.length,
    unit: "count",
    label: "Overdue milestones",
    confidence: "high",
    completeness: 90,
    asOf: "2026-06-17",
    deltaPct: 50,
    formula: "Milestones with status = overdue across the portfolio",
    sources: [src("ds_drive", "Google Drive", "programme"), src("ds_manual", "Manual capture", "milestone log")],
  };
  const kStuck: Metric = {
    value: stuckApprovals.length,
    unit: "count",
    label: "Approvals stuck",
    confidence: "high",
    completeness: 86,
    asOf: "2026-06-17",
    deltaPct: 100,
    formula: "Days-in-stage > statutory window and not yet approved",
    note: "RAJUK / FSCD blocking permits past the legal window.",
    sources: [src("ds_ecps", "RAJUK ECPS", "ECPS-2024-88213"), src("ds_manual", "Manual capture", "approval log")],
  };
  const kAtRisk: Metric = {
    value: atRiskDeliverables.length,
    unit: "count",
    label: "Deliverables at risk",
    confidence: "medium",
    completeness: 74,
    asOf: "2026-06-17",
    deltaPct: 33,
    formula: "Status = revise, or past due date and not issued",
    sources: [src("ds_drive", "Google Drive", "issue register")],
  };

  // ---- Chart data ---------------------------------------------------------
  const varianceData = useMemo(
    () =>
      [...active]
        .sort((a, b) => a.scheduleVarianceDays - b.scheduleVarianceDays)
        .map((p) => ({ code: p.code, variance: p.scheduleVarianceDays })),
    [active],
  );

  const approvalMix = useMemo(
    () =>
      APPROVAL_STATUS_META.map((s) => ({
        label: s.label,
        count: approvals.filter((a) => a.status === s.key).length,
        color: s.color,
      })).filter((s) => s.count > 0),
    [approvals],
  );

  const deliverableMix = useMemo(
    () =>
      DELIVERABLE_STATUS_META.map((s) => ({
        name: s.label,
        value: deliverables.filter((d) => d.status === s.key).length,
        color: s.color,
      })).filter((s) => s.value > 0),
    [deliverables],
  );

  // ---- Milestone list: next ~14 days + all overdue, sorted by date --------
  const milestoneFeed = useMemo(() => {
    return milestones
      .filter((m) => {
        if (m.status === "done") return false;
        if (m.status === "overdue") return true;
        const days = daysFromNow(m.dueDate);
        return days !== null && days <= 14;
      })
      .sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  }, [milestones]);

  // ---- Approvals needing action, worst (most overrun) first ---------------
  const approvalFeed = useMemo(() => {
    return approvals
      .filter(approvalNeedsAction)
      .sort((a, b) => {
        const over = (x: Approval) => (x.statutoryDays !== null ? x.daysInStage - x.statutoryDays : -9999);
        return over(b) - over(a);
      });
  }, [approvals]);

  // ---- Scorecard rollups --------------------------------------------------
  const openApprovalsByProject = (pid: string) =>
    approvals.filter((a) => a.projectId === pid && a.status !== "approved" && a.status !== "rejected").length;

  const scorecard = useMemo(
    () =>
      [...active].sort(
        (a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.scheduleVarianceDays - b.scheduleVarianceDays,
      ),
    [active],
  );

  return (
    <Page>
      <PageHeader
        kicker="Projects"
        title="Delivery & Operations"
        description="One command screen for schedule slippage, authority approvals and deliverable health across the whole portfolio — so the bottleneck is obvious before the deadline is."
        actions={<Badge tone="neutral" dot>{num(active.length)} active</Badge>}
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)
        ) : (
          <>
            <KpiCard kicker="On-time projects" metric={kOnTime} sparkColor={CHART.sage} />
            <KpiCard kicker="Overdue milestones" metric={kOverdue} sparkColor={CHART.sienna} deltaGoodWhenUp={false} />
            <KpiCard kicker="Approvals stuck" metric={kStuck} sparkColor={CHART.sienna} deltaGoodWhenUp={false} />
            <KpiCard kicker="Deliverables at risk" metric={kAtRisk} sparkColor={CHART.ochre} deltaGoodWhenUp={false} />
          </>
        )}
      </div>

      {/* Charts row */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>Programme · days vs. plan</CardKicker>
              <CardTitle>Schedule variance by project</CardTitle>
            </div>
            <Badge tone="sienna" dot>behind</Badge>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[240px]" />
            ) : (
              <>
                <BarSeries
                  data={varianceData}
                  xKey="code"
                  height={240}
                  bars={[{ key: "variance", color: CHART.sienna, label: "Variance (days)" }]}
                />
                <p className="mt-2 text-xs text-ink-faint">
                  Negative = behind plan. Bashati (authority-blocked) is the deepest slip at{" "}
                  {num(Math.min(...varianceData.map((v) => v.variance)))}d.
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardKicker>Deliverables</CardKicker>
              <CardTitle>By status</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <>
                <Donut
                  data={deliverableMix}
                  centerValue={String(deliverables.length)}
                  centerLabel="documents"
                />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {deliverableMix.map((d) => (
                    <div key={d.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />
                      <span className="truncate text-ink-soft">{d.name}</span>
                      <span className="ml-auto font-medium text-ink tnum">{d.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Approval-status mix */}
      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardKicker>Authority approvals · Dhaka</CardKicker>
            <CardTitle>Status mix</CardTitle>
          </div>
          <SourceChip name="RAJUK ECPS · 12 Jun" status="stale" />
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[210px]" />
          ) : (
            <BarSeries
              data={approvalMix}
              xKey="label"
              height={210}
              bars={[{ key: "count", color: CHART.blue, label: "Approvals" }]}
            />
          )}
        </CardContent>
      </Card>

      {/* Milestones + Approvals action lists */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardKicker>Next 14 days + overdue</CardKicker>
              <CardTitle>Milestones — due & overdue</CardTitle>
            </div>
            <CalendarClock className="h-4 w-4 text-ink-faint" />
          </CardHeader>
          <div className="divide-y divide-line border-t border-line">
            {loading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : milestoneFeed.length === 0 ? (
              <EmptyState title="Nothing due" description="No milestones overdue or falling within the next two weeks." />
            ) : (
              milestoneFeed.map((m: Milestone) => {
                const proj = projectById(m.projectId);
                const days = daysFromNow(m.dueDate);
                const overdue = m.status === "overdue" || (days !== null && days < 0);
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">{m.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                        <Link to={`/projects/${m.projectId}`} className="truncate hover:text-blue">
                          {proj?.name ?? m.projectId}
                        </Link>
                        <span className="text-ink-ghost">·</span>
                        <span>{shortDate(m.dueDate)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {days !== null && (
                        <span className={cn("text-xs font-medium tnum", overdue ? "text-rust" : "text-ink-soft")}>
                          {days < 0 ? `${Math.abs(days)}d late` : days === 0 ? "today" : `in ${days}d`}
                        </span>
                      )}
                      <MilestoneBadge status={m.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardKicker>Owner action required</CardKicker>
              <CardTitle>Approvals needing action</CardTitle>
            </div>
            <Landmark className="h-4 w-4 text-ink-faint" />
          </CardHeader>
          <div className="divide-y divide-line border-t border-line">
            {loading ? (
              <div className="space-y-2 p-4">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : approvalFeed.length === 0 ? (
              <EmptyState title="Nothing in flight" description="No submissions in review or past their statutory window." />
            ) : (
              approvalFeed.map((a: Approval) => {
                const proj = projectById(a.projectId);
                const overdue = approvalStuck(a);
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">
                        {a.authority} · {a.title}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-soft">
                        <Link to={`/projects/${a.projectId}`} className="truncate hover:text-blue">
                          {proj?.name ?? a.projectId}
                        </Link>
                        <span className="text-ink-ghost">·</span>
                        <SourceChip name={a.source.sourceName} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {a.statutoryDays !== null && (
                        <span className={cn("text-xs font-medium tnum", overdue ? "text-rust" : "text-ink-soft")}>
                          {a.daysInStage}d / {a.statutoryDays}d
                        </span>
                      )}
                      <ApprovalBadge status={a.status} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      {/* Delivery scorecard */}
      <PageSection
        className="mt-8"
        title="Delivery scorecard"
        description="Every active project, ordered by stage then schedule slip. Links open the project file."
        actions={
          <Link to="/portfolio" className="text-sm font-medium text-blue hover:underline">
            All projects →
          </Link>
        }
      >
        <Card>
          {loading ? (
            <div className="space-y-2 p-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Project</TH>
                  <TH>Stage</TH>
                  <TH className="text-right">Schedule var</TH>
                  <TH className="text-right">Open approvals</TH>
                  <TH className="text-right">Open risks</TH>
                  <TH className="w-40">% complete</TH>
                </TR>
              </THead>
              <TBody>
                {scorecard.map((p: Project) => {
                  const open = openApprovalsByProject(p.id);
                  const behind = p.scheduleVarianceDays < 0;
                  return (
                    <TR key={p.id} interactive>
                      <TD>
                        <Link to={`/projects/${p.id}`} className="font-medium text-ink hover:text-blue">
                          {p.name}
                        </Link>
                        <div className="font-mono text-[11px] text-ink-faint">{p.code}</div>
                      </TD>
                      <TD className="text-ink-soft">{STAGE_LABELS[p.stage]}</TD>
                      <TD className={cn("text-right tnum", behind ? "text-sienna" : "text-ink-soft")}>
                        {p.scheduleVarianceDays > 0 ? "+" : ""}
                        {p.scheduleVarianceDays}d
                      </TD>
                      <TD className="text-right tnum text-ink-soft">{open}</TD>
                      <TD className="text-right tnum">
                        <span className={cn(p.openRisks >= 4 ? "font-medium text-rust" : "text-ink-soft")}>
                          {p.openRisks}
                        </span>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={p.pctComplete}
                            tone={p.pctComplete >= 75 ? "sage" : p.pctComplete >= 40 ? "blue" : "ochre"}
                          />
                          <span className="w-9 shrink-0 text-right text-xs font-medium text-ink tnum">
                            {pct(p.pctComplete)}
                          </span>
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
      </PageSection>

      <p className="mt-8 text-center text-xs text-ink-ghost">
        Schedule and deliverable signals are partly manual — completeness varies by project. Every figure links to its
        source record.
      </p>
    </Page>
  );
}
