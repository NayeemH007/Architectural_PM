import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, FolderSearch } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { Donut, BarSeries, CHART } from "@/components/charts";
import { DataCompleteness, ConfidenceBadge } from "@/components/trust";
import { DeliverableBadge } from "@/components/status";
import { SourceChip, StatusDot } from "@/components/data-source";
import { EmptyState } from "@/components/states";
import { shortDate, daysFromNow, num, pct } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useDeliverables, useProjects } from "@/lib/api";
import { projectById } from "@/lib/mock/data";
import type { Deliverable, DeliverableStatus, Metric } from "@/lib/types";

const DISCIPLINES = ["Architecture", "Structure", "MEP", "Interior", "Landscape"] as const;

const STATUS_LABELS: Record<DeliverableStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  internal_review: "Internal review",
  issued: "Issued",
  approved: "Approved",
  revise: "Revise",
};

const STATUS_COLOR: Record<DeliverableStatus, string> = {
  not_started: CHART.taupe,
  in_progress: CHART.blue,
  internal_review: CHART.ochre,
  issued: CHART.sage,
  approved: CHART.sage,
  revise: CHART.sienna,
};

const isClosed = (s: DeliverableStatus) => s === "issued" || s === "approved";

/** Overdue = due date in the past and not yet issued/approved. */
function isOverdue(d: Deliverable): boolean {
  if (isClosed(d.status)) return false;
  const days = daysFromNow(d.dueDate);
  return days !== null && days < 0;
}

export default function Deliverables() {
  const { data: rows = [], isLoading } = useDeliverables();
  const { data: projects = [] } = useProjects();

  const [discipline, setDiscipline] = useState("all");
  const [status, setStatus] = useState("all");
  const [project, setProject] = useState("all");
  const [q, setQ] = useState("");

  const projectOptions = useMemo(
    () => [
      { value: "all", label: "All projects" },
      ...projects.map((p) => ({ value: p.id, label: p.name })),
    ],
    [projects],
  );

  const filtered = useMemo(
    () =>
      rows.filter((d) => {
        if (discipline !== "all" && d.discipline !== discipline) return false;
        if (status !== "all" && d.status !== status) return false;
        if (project !== "all" && d.projectId !== project) return false;
        if (q && !`${d.name} ${d.revision} ${d.source}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        return true;
      }),
    [rows, discipline, status, project, q],
  );

  // ---- KPI metrics (built inline) ----
  const total = rows.length;
  const closed = rows.filter((d) => isClosed(d.status)).length;
  const inRevision = rows.filter((d) => d.status === "revise").length;
  const totalRevs = rows.reduce((s, d) => s + d.revisionCount, 0);
  const avgRevRate = total ? totalRevs / total : 0;
  const completeness = total
    ? Math.round((rows.filter((d) => d.fileRef).length / total) * 100)
    : 0;

  const kTotal: Metric = {
    value: total,
    unit: "count",
    label: "Total deliverables",
    confidence: "high",
    completeness,
    asOf: "2026-06-17",
    sources: [],
    note: "File-presence signals harvested from Google Drive.",
  };
  const kIssued: Metric = {
    value: total ? Math.round((closed / total) * 100) : 0,
    unit: "pct",
    label: "Issued / approved",
    confidence: "high",
    completeness,
    asOf: "2026-06-17",
    sources: [],
  };
  const kRevision: Metric = {
    value: inRevision,
    unit: "count",
    label: "In revision",
    confidence: "high",
    completeness,
    asOf: "2026-06-17",
    sources: [],
    note: "Returned for revise — active rework.",
  };
  const kRevRate: Metric = {
    value: Number(avgRevRate.toFixed(2)),
    unit: "ratio",
    label: "Drawing revision rate",
    confidence: "medium",
    completeness,
    asOf: "2026-06-17",
    sources: [],
    note: "Revisions per deliverable. High values signal churn.",
  };

  // ---- watchlist + chart ----
  const watchlist = useMemo(
    () => rows.filter((d) => d.revisionCount >= 3).sort((a, b) => b.revisionCount - a.revisionCount),
    [rows],
  );

  const byStatus = useMemo(() => {
    const order: DeliverableStatus[] = [
      "in_progress",
      "internal_review",
      "issued",
      "approved",
      "revise",
      "not_started",
    ];
    return order
      .map((s) => ({
        name: STATUS_LABELS[s],
        value: rows.filter((d) => d.status === s).length,
        color: STATUS_COLOR[s],
      }))
      .filter((d) => d.value > 0);
  }, [rows]);

  // ---- discipline distribution (Document control overview) ----
  const byDiscipline = useMemo(
    () =>
      DISCIPLINES.map((disc) => ({
        discipline: disc,
        count: rows.filter((d) => d.discipline === disc).length,
      })).filter((d) => d.count > 0),
    [rows],
  );

  // ---- revision load: revisions per deliverable, high churn highlighted (>3) ----
  const revisionLoad = useMemo(
    () =>
      [...rows]
        .sort((a, b) => b.revisionCount - a.revisionCount)
        .slice(0, 12)
        .map((d) => {
          const high = d.revisionCount > 3;
          // Short label: leading sheet ref (e.g. "A-201"), else id.
          const label = d.name.split(/\s+/)[0] || d.id;
          return {
            label,
            normal: high ? 0 : d.revisionCount,
            churn: high ? d.revisionCount : 0,
          };
        }),
    [rows],
  );

  const missingFiles = rows.filter((d) => !d.fileRef).length;

  return (
    <Page>
      <PageHeader
        kicker="Projects"
        title="Document control"
        description="Drawing register matched across projects. CAD files (AutoCAD, SketchUp, D5) expose no data API — these are file-presence signals harvested from Google Drive, not read from the CAD apps themselves."
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard kicker="Total deliverables" metric={kTotal} value={num(total)} />
        <KpiCard kicker="Issued / approved" metric={kIssued} deltaGoodWhenUp />
        <KpiCard
          kicker="In revision"
          metric={kRevision}
          value={num(inRevision)}
          footnote={
            <span className="text-xs text-ink-ghost">{missingFiles} awaiting a file</span>
          }
        />
        <KpiCard
          kicker="Drawing revision rate"
          metric={kRevRate}
          value={`${avgRevRate.toFixed(2)}×`}
          deltaGoodWhenUp={false}
        />
      </div>

      {/* Document control charts overview */}
      <PageSection title="Document control" className="mt-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Status mix */}
          <Card>
            <CardHeader>
              <div>
                <CardKicker>Distribution</CardKicker>
                <CardTitle>By status</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {byStatus.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-faint">No deliverables.</p>
              ) : (
                <>
                  <Donut data={byStatus} centerValue={num(total)} centerLabel="drawings" />
                  <ul className="mt-4 space-y-1.5">
                    {byStatus.map((s) => (
                      <li
                        key={s.name}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="flex items-center gap-2 text-ink-soft">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: s.color }}
                          />
                          {s.name}
                        </span>
                        <span className="tnum text-ink">{s.value}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </CardContent>
          </Card>

          {/* Discipline mix */}
          <Card>
            <CardHeader>
              <div>
                <CardKicker>Distribution</CardKicker>
                <CardTitle>By discipline</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {byDiscipline.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-faint">No deliverables.</p>
              ) : (
                <BarSeries
                  data={byDiscipline}
                  xKey="discipline"
                  bars={[{ key: "count", color: CHART.blue, label: "Deliverables" }]}
                />
              )}
            </CardContent>
          </Card>

          {/* Revision load */}
          <Card>
            <CardHeader>
              <div>
                <CardKicker>Rework risk</CardKicker>
                <CardTitle>Revision load</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {revisionLoad.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-faint">No deliverables.</p>
              ) : (
                <>
                  <BarSeries
                    data={revisionLoad}
                    xKey="label"
                    stacked
                    bars={[
                      { key: "normal", color: CHART.taupe, label: "Revisions" },
                      { key: "churn", color: CHART.sienna, label: "High churn (>3)" },
                    ]}
                  />
                  <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-ghost">
                    <span className="h-2 w-2 rounded-full" style={{ background: CHART.sienna }} />
                    Highlighted bars exceed 3 revisions — rework risk.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </PageSection>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search drawings, sheet refs, source…"
          className="sm:max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="sm"
            value={discipline}
            onValueChange={setDiscipline}
            options={[
              { value: "all", label: "All disciplines" },
              ...DISCIPLINES.map((d) => ({ value: d, label: d })),
            ]}
          />
          <Select
            size="sm"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "all", label: "All statuses" },
              ...(Object.keys(STATUS_LABELS) as DeliverableStatus[]).map((s) => ({
                value: s,
                label: STATUS_LABELS[s],
              })),
            ]}
          />
          <Select size="sm" value={project} onValueChange={setProject} options={projectOptions} />
        </div>
      </div>

      {/* Main grid: register + sidebar */}
      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Register table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>Document register</CardKicker>
              <CardTitle>{filtered.length} of {total} deliverables</CardTitle>
            </div>
          </CardHeader>
          {isLoading ? (
            <CardContent className="space-y-2 pt-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </CardContent>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FolderSearch}
              title="No deliverables match"
              description="Try clearing a discipline, status or project filter."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Deliverable</TH>
                  <TH>Project</TH>
                  <TH>Discipline</TH>
                  <TH className="text-right">Rev</TH>
                  <TH>Status</TH>
                  <TH>Due</TH>
                  <TH>Source</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((d) => {
                  const proj = projectById(d.projectId);
                  const overdue = isOverdue(d);
                  const churn = d.revisionCount > 3;
                  return (
                    <TR key={d.id}>
                      <TD className="font-medium text-ink">{d.name}</TD>
                      <TD>
                        {proj ? (
                          <Link
                            to={`/projects/${proj.id}`}
                            className="text-blue hover:underline"
                          >
                            {proj.code}
                          </Link>
                        ) : (
                          <span className="text-ink-ghost">—</span>
                        )}
                      </TD>
                      <TD className="text-ink-soft">{d.discipline}</TD>
                      <TD className="text-right tnum">
                        <span className="inline-flex items-center justify-end gap-1">
                          {d.revisionCount}
                          {churn && (
                            <Tooltip
                              content={`${d.revisionCount} revisions — high churn / rework risk`}
                            >
                              <span className="cursor-help text-sienna">⚠</span>
                            </Tooltip>
                          )}
                        </span>
                      </TD>
                      <TD>
                        <DeliverableBadge status={d.status} />
                      </TD>
                      <TD className={cn("tnum", overdue ? "font-medium text-rust" : "text-ink-soft")}>
                        {shortDate(d.dueDate)}
                        {overdue && <span className="ml-1 text-[11px]">overdue</span>}
                      </TD>
                      <TD>
                        <SourceChip
                          name={d.source}
                          status={d.fileRef ? "connected" : "manual"}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
          <CardFooter>
            <DataCompleteness value={completeness} />
            <span className="text-[11px] text-ink-ghost">
              {missingFiles} drawing{missingFiles === 1 ? "" : "s"} with no file detected on Drive
            </span>
          </CardFooter>
        </Card>

        {/* Sidebar: high-churn watchlist */}
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <div>
                <CardKicker>Rework risk</CardKicker>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-sienna" />
                  High-churn watchlist
                </CardTitle>
              </div>
              <ConfidenceBadge level="medium" />
            </CardHeader>
            <div className="divide-y divide-line border-t border-line">
              {watchlist.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-faint">No high-revision deliverables.</p>
              ) : (
                watchlist.map((d) => {
                  const proj = projectById(d.projectId);
                  return (
                    <div key={d.id} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-ink">{d.name}</div>
                          <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
                            {proj && (
                              <Link
                                to={`/projects/${proj.id}`}
                                className="hover:text-blue"
                              >
                                {proj.code}
                              </Link>
                            )}
                            <span>· {d.discipline}</span>
                          </div>
                        </div>
                        <span className="shrink-0 font-display text-lg text-sienna tnum">
                          {d.revisionCount}
                          <span className="ml-0.5 text-[11px] text-ink-ghost">rev</span>
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <DeliverableBadge status={d.status} />
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                          <StatusDot status={d.fileRef ? "connected" : "manual"} />
                          {d.fileRef ? "On Drive" : "No file"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <CardFooter>
              <span className="text-[11px] text-ink-ghost">
                {watchlist.length} at {pct(total ? Math.round((watchlist.length / total) * 100) : 0)} of register
              </span>
              <Button variant="ghost" size="sm">
                Open review
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>

      <PageSection className="mt-6">
        <p className="text-xs text-ink-ghost">
          Source of truth for files is Google Drive presence. A "manual" chip means no file detected
          yet for that sheet — it needs attention or upload.
        </p>
      </PageSection>
    </Page>
  );
}
