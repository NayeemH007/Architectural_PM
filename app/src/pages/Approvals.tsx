import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertOctagon,
  ArrowRight,
  CalendarClock,
  Clock,
  Landmark,
  ShieldQuestion,
  UserRound,
} from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CHART } from "@/components/charts";
import { ConfidenceBadge } from "@/components/trust";
import { ApprovalBadge } from "@/components/status";
import { SourceChip } from "@/components/data-source";
import { EmptyState } from "@/components/states";
import { daysFromNow, relative, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useApprovals, useProjects } from "@/lib/api";
import { projectById } from "@/lib/mock/data";
import type { Approval, ApprovalAuthority, ApprovalStatus, Metric } from "@/lib/types";

const TODAY = "2026-06-17";

// Statuses that mean "still moving through the system" (not terminal).
const IN_FLIGHT: ApprovalStatus[] = [
  "not_started",
  "preparing",
  "submitted",
  "in_review",
  "query_raised",
];

const STATUS_LABEL: Record<ApprovalStatus, string> = {
  not_started: "Not started",
  preparing: "Preparing",
  submitted: "Submitted",
  in_review: "In review",
  query_raised: "Query raised",
  approved: "Approved",
  rejected: "Rejected",
};

// Group ordering — terminal/idle states sink to the bottom.
const STATUS_ORDER: ApprovalStatus[] = [
  "query_raised",
  "in_review",
  "submitted",
  "preparing",
  "not_started",
  "approved",
  "rejected",
];

// Which authorities have a true API vs. manual ECPS / capture entry.
const NO_API: ApprovalAuthority[] = ["RAJUK", "FSCD", "CAAB", "DoE", "City Corporation"];

function isOverdue(a: Approval): boolean {
  return (
    a.statutoryDays !== null &&
    a.daysInStage > a.statutoryDays &&
    a.status !== "approved" &&
    a.status !== "rejected"
  );
}

function isInFlight(a: Approval): boolean {
  return IN_FLIGHT.includes(a.status);
}

function daysBetween(from: string, to: string): number {
  return Math.round((+new Date(to) - +new Date(from)) / 86_400_000);
}

export default function Approvals() {
  const { data: approvals = [], isLoading } = useApprovals();
  const { isLoading: projectsLoading } = useProjects();
  const [groupBy, setGroupBy] = useState<"authority" | "status">("authority");

  const loading = isLoading || projectsLoading;

  const stats = useMemo(() => {
    const inFlight = approvals.filter(isInFlight);
    const overdue = approvals.filter(isOverdue);
    const approved = approvals.filter((a) => a.status === "approved" && a.approvedDate);
    const approvedLast12mo = approved.filter(
      (a) => a.approvedDate && daysBetween(a.approvedDate, TODAY) <= 365,
    );
    // Cycle time = submitted → approved across every completed approval on record.
    const cycles = approved
      .filter((a) => a.submittedDate && a.approvedDate)
      .map((a) => daysBetween(a.submittedDate!, a.approvedDate!));
    const avgCycle = cycles.length
      ? Math.round(cycles.reduce((x, y) => x + y, 0) / cycles.length)
      : null;
    return { inFlight, overdue, approved, approvedLast12mo, avgCycle, cycleCount: cycles.length };
  }, [approvals]);

  // The single biggest delivery problem — surfaced as a banner.
  const critical = useMemo(
    () =>
      approvals.find(
        (a) =>
          a.authority === "RAJUK" &&
          a.title.includes("301") &&
          isOverdue(a) &&
          a.blocking,
      ) ?? stats.overdue.find((a) => a.blocking) ?? null,
    [approvals, stats.overdue],
  );

  // Upcoming expected dates (next decisions due), in-flight only.
  const upcoming = useMemo(
    () =>
      approvals
        .filter((a) => isInFlight(a) && a.expectedDate)
        .sort((x, y) => +new Date(x.expectedDate!) - +new Date(y.expectedDate!))
        .slice(0, 5),
    [approvals],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Approval[]>();
    for (const a of approvals) {
      const key = groupBy === "authority" ? a.authority : a.status;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    const sortRows = (rows: Approval[]) =>
      [...rows].sort((x, y) => {
        if (x.blocking !== y.blocking) return x.blocking ? -1 : 1;
        if (isOverdue(x) !== isOverdue(y)) return isOverdue(x) ? -1 : 1;
        return y.daysInStage - x.daysInStage;
      });
    const entries = [...map.entries()].map(([key, rows]) => ({ key, rows: sortRows(rows) }));
    if (groupBy === "status") {
      entries.sort((a, b) => STATUS_ORDER.indexOf(a.key as ApprovalStatus) - STATUS_ORDER.indexOf(b.key as ApprovalStatus));
    } else {
      // Authority: groups with an overdue/blocking item float up.
      entries.sort((a, b) => {
        const score = (g: { rows: Approval[] }) =>
          g.rows.some(isOverdue) ? 0 : g.rows.some((r) => r.blocking) ? 1 : g.rows.some(isInFlight) ? 2 : 3;
        return score(a) - score(b) || b.rows.length - a.rows.length;
      });
    }
    return entries;
  }, [approvals, groupBy]);

  // ---- KPI metrics (built inline; provenance reflects manual ECPS capture) ----
  const ecpsSrc = (ref: string) => ({
    sourceId: "ds_ecps",
    sourceName: "RAJUK ECPS + capture",
    recordRef: ref,
    observedAt: "2026-06-12",
  });

  const mInFlight: Metric = {
    value: stats.inFlight.length,
    unit: "count",
    label: "Approvals in flight",
    confidence: "high",
    completeness: 90,
    asOf: TODAY,
    formula: "Count of approvals not in a terminal state (approved / rejected).",
    note: `${stats.overdue.length} past the statutory window.`,
    sources: [ecpsSrc("8 tracked approvals · 6 projects")],
  };
  const mOverdue: Metric = {
    value: stats.overdue.length,
    unit: "count",
    label: "Overdue vs. statutory",
    confidence: "high",
    completeness: 88,
    asOf: TODAY,
    formula: "daysInStage > statutoryDays, excluding approved/rejected.",
    note: "Each is past the legally-stated decision window for its form.",
    sources: [ecpsSrc("RAJUK 30-day windows, Form 101/301")],
  };
  const mApproved: Metric = {
    value: stats.approvedLast12mo.length,
    unit: "count",
    label: "Cleared (last 12 months)",
    confidence: "medium",
    completeness: 70,
    asOf: TODAY,
    formula: "Approvals with an approvedDate within 365 days of today.",
    note:
      stats.approvedLast12mo.length === 0
        ? "Both clearances on record predate the trailing year."
        : undefined,
    sources: [ecpsSrc("Approval log + ECPS history")],
  };
  const mCycle: Metric = {
    value: stats.avgCycle,
    unit: "days",
    label: "Avg cycle time",
    confidence: "medium",
    completeness: 55,
    asOf: TODAY,
    formula: "Mean of (approvedDate − submittedDate) over completed approvals.",
    note: `Only ${stats.cycleCount} completed cycles on record — directional, not statistical.`,
    sources: [ecpsSrc("Land Use & OLS clearances")],
  };

  if (loading) {
    return (
      <Page>
        <Skeleton className="h-9 w-72" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <Skeleton className="mt-6 h-28" />
        <div className="mt-6 grid gap-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        kicker="Projects"
        title="Authority approvals"
        description="External, opaque schedule drivers — RAJUK, FSCD, CAAB, DoE and the utilities. None expose an API, so status is tracked manually from the RAJUK ECPS portal and liaison capture. Overdue is measured against each form's statutory decision window."
        actions={
          <>
            <Button variant="outline" size="md">
              <Landmark className="h-4 w-4" /> Open ECPS
            </Button>
            <Button variant="primary" size="md">
              <UserRound className="h-4 w-4" /> Ask liaison
            </Button>
          </>
        }
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard kicker="In flight" metric={mInFlight} sparkColor={CHART.blue} />
        <KpiCard
          kicker="Overdue vs. statutory"
          metric={mOverdue}
          sparkColor={CHART.sienna}
          deltaGoodWhenUp={false}
        />
        <KpiCard kicker="Cleared · last 12mo" metric={mApproved} sparkColor={CHART.sage} />
        <KpiCard kicker="Avg cycle time" metric={mCycle} sparkColor={CHART.ochre} />
      </div>

      {/* CRITICAL banner — the headline problem */}
      {critical && (
        <CriticalBanner approval={critical} />
      )}

      {/* main grid: groups + side rail */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* grouped list */}
        <div className="lg:col-span-2">
          <PageSection
            title="Tracker"
            description={`${approvals.length} approvals across ${new Set(approvals.map((a) => a.projectId)).size} projects.`}
            actions={
              <div className="flex items-center gap-2">
                <span className="label-draft hidden sm:inline">Group by</span>
                <Select
                  value={groupBy}
                  onValueChange={(v) => setGroupBy(v as "authority" | "status")}
                  size="sm"
                  options={[
                    { value: "authority", label: "Authority" },
                    { value: "status", label: "Status" },
                  ]}
                />
              </div>
            }
          >
            {groups.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Landmark}
                  title="No approvals tracked"
                  description="Nothing has been logged from ECPS or capture yet."
                />
              </Card>
            ) : (
              <div className="space-y-5">
                {groups.map((g) => (
                  <ApprovalGroup
                    key={g.key}
                    label={
                      groupBy === "status" ? STATUS_LABEL[g.key as ApprovalStatus] : g.key
                    }
                    groupBy={groupBy}
                    rows={g.rows}
                  />
                ))}
              </div>
            )}
          </PageSection>
        </div>

        {/* side rail */}
        <div className="space-y-6">
          {/* upcoming expected decisions */}
          <Card>
            <CardHeader>
              <div>
                <CardKicker>Watch the calendar</CardKicker>
                <CardTitle>Next expected decisions</CardTitle>
              </div>
              <CalendarClock className="h-4 w-4 text-ink-faint" />
            </CardHeader>
            <div className="divide-y divide-line border-t border-line">
              {upcoming.length === 0 && (
                <div className="px-5 py-6 text-sm text-ink-faint">
                  No expected dates on the in-flight items.
                </div>
              )}
              {upcoming.map((a) => {
                const d = daysFromNow(a.expectedDate);
                const proj = projectById(a.projectId);
                const past = d !== null && d < 0;
                return (
                  <div key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-ink">
                        {a.authority} · {a.title}
                      </div>
                      <div className="truncate text-xs text-ink-faint">{proj?.name}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-medium text-ink tnum">
                        {shortDate(a.expectedDate)}
                      </div>
                      <div
                        className={cn(
                          "text-[11px] tnum",
                          past ? "text-rust" : "text-ink-ghost",
                        )}
                      >
                        {d === null ? "" : past ? `${-d}d past est.` : `in ${d}d`}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* explainer — why this is manual */}
          <Card drafting className="border-blue/20 bg-blue-ghost">
            <CardContent className="pt-5">
              <div className="flex items-start gap-3">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-blue text-paper">
                  <ShieldQuestion className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="label-draft">How we know this</span>
                    <ConfidenceBadge level="medium" />
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-soft">
                    The RAJUK ECPS portal has no API. Every status here is read off the
                    portal or logged by the liaison,{" "}
                    <span className="font-medium text-ink">Shahed Alam</span>, after a call or
                    visit. Confidence is medium by design — figures are only as fresh as the
                    last manual check, and the authorities give no machine-readable signal.
                  </p>
                  <p className="mt-2 text-[11px] text-ink-ghost">
                    Statutory windows (e.g. RAJUK 30 days) are the firm's clock; the
                    authorities rarely hold to them.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <p className="mt-8 text-center text-xs text-ink-ghost">
        Manually maintained from RAJUK ECPS + liaison capture · last reviewed{" "}
        {shortDate("2026-06-12")}. Every row links to its source record.
      </p>
    </Page>
  );
}

// ============================================================
// Critical banner
// ============================================================
function CriticalBanner({ approval }: { approval: Approval }) {
  const proj = projectById(approval.projectId);
  const over =
    approval.statutoryDays !== null ? approval.daysInStage - approval.statutoryDays : null;
  return (
    <Card className="mt-6 overflow-hidden border-rust/30 bg-rust-tint">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-rust text-paper">
          <AlertOctagon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="label-draft !text-rust">Critical · blocking delivery</span>
            <Badge tone="rust" size="sm" dot>
              Blocking
            </Badge>
          </div>
          <h3 className="mt-1 font-display text-[19px] leading-tight text-ink">
            {approval.authority} {approval.title} is{" "}
            <span className="tnum">{over !== null ? `${over} days` : `${approval.daysInStage} days`}</span>{" "}
            past the statutory window
          </h3>
          <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">
            {proj ? (
              <Link to={`/projects/${proj.id}`} className="font-medium text-ink hover:text-blue hover:underline">
                {proj.name}
              </Link>
            ) : (
              "This project"
            )}{" "}
            cannot start construction until this clears. Submitted{" "}
            {shortDate(approval.submittedDate)} ({approval.daysInStage}d in review against a{" "}
            {approval.statutoryDays}-day window). Liaison: {approval.owner}.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ApprovalBadge status={approval.status} />
            <span className="text-xs font-medium text-rust tnum">
              {approval.daysInStage}d / {approval.statutoryDays}d statutory
            </span>
            <SourceChip
              name={`${approval.source.sourceName} · ${approval.source.recordRef}`}
              status="manual"
            />
            {proj && (
              <Link
                to={`/projects/${proj.id}`}
                className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-blue hover:underline"
              >
                Open project <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// A group (by authority or status) with its rows
// ============================================================
function ApprovalGroup({
  label,
  groupBy,
  rows,
}: {
  label: string;
  groupBy: "authority" | "status";
  rows: Approval[];
}) {
  const overdueCount = rows.filter(isOverdue).length;
  const inFlightCount = rows.filter(isInFlight).length;
  const noApi = groupBy === "authority" && NO_API.includes(label as ApprovalAuthority);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          {groupBy === "authority" && <Landmark className="h-4 w-4 text-ink-faint" />}
          <CardTitle>{label}</CardTitle>
          <span className="text-xs text-ink-ghost tnum">
            {rows.length} {rows.length === 1 ? "item" : "items"}
          </span>
          {noApi && (
            <Badge tone="neutral" size="sm">
              No API · manual
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <Badge tone="rust" size="sm">
              {overdueCount} overdue
            </Badge>
          )}
          {inFlightCount > 0 && overdueCount === 0 && (
            <Badge tone="ochre" size="sm">
              {inFlightCount} in flight
            </Badge>
          )}
        </div>
      </CardHeader>
      <div className="divide-y divide-line border-t border-line">
        {rows.map((a) => (
          <ApprovalRow key={a.id} approval={a} groupBy={groupBy} />
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// A single approval row
// ============================================================
function ApprovalRow({
  approval: a,
  groupBy,
}: {
  approval: Approval;
  groupBy: "authority" | "status";
}) {
  const proj = projectById(a.projectId);
  const overdue = isOverdue(a);

  return (
    <div className="flex flex-col gap-2.5 px-5 py-3.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {proj ? (
            <Link
              to={`/projects/${proj.id}`}
              className="text-sm font-medium text-ink hover:text-blue hover:underline"
            >
              {proj.name}
            </Link>
          ) : (
            <span className="text-sm font-medium text-ink">Unknown project</span>
          )}
          {a.blocking && (
            <Badge tone="rust" size="sm" dot>
              Blocking
            </Badge>
          )}
        </div>
        <div className="mt-0.5 text-[13px] text-ink-soft">
          {/* When grouped by authority the authority is the heading, so drop it here. */}
          {groupBy === "status" ? `${a.authority} · ${a.title}` : a.title}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1">
            <UserRound className="h-3 w-3" /> {a.owner}
          </span>
          <span>·</span>
          <span>
            {a.submittedDate ? `Submitted ${shortDate(a.submittedDate)}` : "Not yet submitted"}
          </span>
          {a.expectedDate && a.status !== "approved" && (
            <>
              <span>·</span>
              <span>Expected {shortDate(a.expectedDate)}</span>
            </>
          )}
          {a.approvedDate && (
            <>
              <span>·</span>
              <span className="text-sage">Approved {shortDate(a.approvedDate)}</span>
            </>
          )}
        </div>
        <div className="mt-2">
          <SourceChip
            name={`${a.source.sourceName} · ${a.source.recordRef}`}
            status="manual"
          />
        </div>
      </div>

      <div className="flex shrink-0 flex-col items-start gap-1.5 sm:items-end">
        <ApprovalBadge status={a.status} />
        {overdue ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-rust tnum">
            <Clock className="h-3 w-3" />
            {a.daysInStage}d / {a.statutoryDays}d statutory
          </span>
        ) : a.statutoryDays !== null && isInFlight(a) ? (
          <span className="text-[11px] text-ink-ghost tnum">
            {a.daysInStage}d of {a.statutoryDays}d window
          </span>
        ) : null}
        <span className="text-[11px] text-ink-ghost">Updated {relative(a.lastUpdate)}</span>
      </div>
    </div>
  );
}
