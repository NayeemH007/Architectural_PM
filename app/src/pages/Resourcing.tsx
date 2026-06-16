import { Link } from "react-router-dom";
import { Clock3, Flame, TrendingDown } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardFooter, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { BarSeries, CHART } from "@/components/charts";
import { ConfidenceBadge, DataCompleteness } from "@/components/trust";
import { InsufficientData } from "@/components/states";
import { num, pct } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useEmployees, utilizationSummary } from "@/lib/api";
import { employees as employeesSeed } from "@/lib/mock/data";
import type { Employee, Metric } from "@/lib/types";

// Utilization governance ----------------------------------------------------
// Healthy band 75–90%. Over 90% = overload; under 75% (when logged) = slack.
const BAND = { healthyLow: 75, healthyHigh: 90 } as const;
const OVERLOADED_ID = "e3"; // Arif Chowdhury — flagged >90% for 6 weeks

const ASOF = "2026-06-17";

function metricSource(id: string, name: string, ref: string): Metric["sources"][number] {
  return { sourceId: id, sourceName: name, recordRef: ref, observedAt: "2026-06-12" };
}

/** Band classification for a (non-null) utilization value. */
function utilTone(v: number): "rust" | "sage" | "ochre" {
  if (v > BAND.healthyHigh) return "rust";
  if (v >= BAND.healthyLow) return "sage";
  return "ochre";
}

export default function Resourcing() {
  const { data: employees = employeesSeed, isLoading } = useEmployees();
  const u = utilizationSummary();

  // Only people who actually log time can carry a utilization figure.
  const logged = employees.filter((e: Employee) => e.utilization.value !== null);
  const unlogged = employees.filter((e: Employee) => e.utilization.value === null);

  // Spare capacity = unfilled hours across people who log time. Deliberately
  // partial: with coverage at ~{u.coverage}% this is a floor, not a truth.
  const spareHours = logged.reduce(
    (acc, e) => acc + Math.max(0, e.capacityHours - e.allocatedHours),
    0,
  );

  // ---- KPI metrics (built inline; trust metadata is the whole point) ----
  const kMeanUtil: Metric = {
    value: Math.round(u.meanUtil),
    unit: "pct",
    label: "Mean billable utilization",
    confidence: "medium",
    completeness: Math.round(u.coverage),
    asOf: ASOF,
    deltaPct: 3,
    trend: [74, 77, 80, 81, 82, Math.round(u.meanUtil)],
    formula: "mean(utilization) over staff who log time",
    note: `Averaged across ${logged.length} of ${employees.length} people — those without timesheets are excluded, not counted as zero.`,
    sources: [metricSource("ds_timesheet", "Timesheets", "weekly submissions")],
  };
  const kCoverage: Metric = {
    value: Math.round(u.coverage),
    unit: "pct",
    label: "Timesheet coverage",
    confidence: u.confidence,
    completeness: Math.round(u.coverage),
    asOf: ASOF,
    deltaPct: 6,
    trend: [41, 44, 49, 52, 55, Math.round(u.coverage)],
    formula: "mean(timesheet weeks submitted) across all staff",
    note: "Every utilization number on this page is gated on this figure.",
    sources: [metricSource("ds_timesheet", "Timesheets", "submission log")],
  };
  const kOverloaded: Metric = {
    value: u.overloaded,
    unit: "count",
    label: "Overloaded (>90%)",
    confidence: "medium",
    completeness: Math.round(u.coverage),
    asOf: ASOF,
    formula: "count(utilization > 90%) among people who log time",
    note: "Sustained overload is a burnout and quality risk.",
    sources: [metricSource("ds_timesheet", "Timesheets", "weekly submissions")],
  };
  // Spare capacity is intentionally INSUFFICIENT: it can't be trusted while
  // most of the firm doesn't log time.
  const kSpare: Metric = {
    value: null,
    unit: "hours",
    label: "Spare capacity",
    confidence: "insufficient",
    completeness: Math.round(u.coverage),
    asOf: ASOF,
    note: `Coverage only ${Math.round(u.coverage)}% — firm-wide spare capacity isn't reliable.`,
    sources: [metricSource("ds_timesheet", "Timesheets", "allocation vs capacity")],
  };

  // ---- chart series: utilization by logged person ----
  const chartData = [...logged]
    .sort((a, b) => (b.utilization.value ?? 0) - (a.utilization.value ?? 0))
    .map((e) => ({
      name: e.name.split(" ")[0],
      util: e.utilization.value ?? 0,
    }));

  // Stable team-load ordering: overloaded first, then by utilization desc,
  // then unlogged at the bottom.
  const teamRows = [...employees].sort((a, b) => {
    const av = a.utilization.value ?? -1;
    const bv = b.utilization.value ?? -1;
    return bv - av;
  });

  return (
    <Page>
      <PageHeader
        kicker="Team & Growth"
        title="Resourcing & capacity"
        description="Utilization is only as honest as timesheet coverage. Where time isn't logged we say so — people without timesheets read as 'no time logged', never as idle."
        actions={
          <Link
            to="/capture"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-blue-tint px-4 text-sm font-medium text-blue transition-colors hover:bg-blue-ghost"
          >
            <Clock3 className="h-4 w-4" /> Set up time capture
          </Link>
        }
      />

      {/* KPI row */}
      {isLoading ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard kicker="Mean billable util." metric={kMeanUtil} sparkColor={CHART.blue} />
          <KpiCard kicker="Timesheet coverage" metric={kCoverage} sparkColor={CHART.ochre} />
          <KpiCard
            kicker="Overloaded (>90%)"
            metric={kOverloaded}
            footnote={<span className="text-xs text-rust">burnout risk</span>}
          />
          <KpiCard kicker="Spare capacity" metric={kSpare} />
        </div>
      )}

      {/* Coverage callout — the central narrative */}
      <Card className="mt-6 border-ochre/20 bg-ochre-tint/30 p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <InsufficientData
              className="border-ochre/30 bg-paper/60"
              metric="Firm spare capacity"
              hint={`only ${Math.round(u.coverage)}% of weeks are timesheeted, so unfilled hours can't be summed across the firm. ${u.unknown} of ${employees.length} people don't log time at all`}
            />
          </div>
          <div className="shrink-0">
            <Button variant="subtle">
              <Clock3 className="h-4 w-4" /> Set up time capture
            </Button>
            <p className="mt-2 max-w-[14rem] text-[11px] text-ink-faint">
              Bootstrap weekly timesheets and these numbers become trustworthy.
            </p>
          </div>
        </div>
      </Card>

      {/* Utilization by person + load distribution */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>Billable utilization · logged staff</CardKicker>
              <CardTitle>Where the load actually sits</CardTitle>
            </div>
            <Badge tone="sage" dot>
              Healthy {BAND.healthyLow}–{BAND.healthyHigh}%
            </Badge>
          </CardHeader>
          <CardContent>
            <BarSeries
              data={chartData}
              xKey="name"
              height={230}
              bars={[{ key: "util", color: CHART.blue, label: "Utilization %" }]}
            />
            <p className="mt-2 text-xs text-ink-faint">
              {unlogged.length} {unlogged.length === 1 ? "person doesn't" : "people don't"} log time and are
              omitted here — that's <span className="text-ink-soft">unknown, not idle</span>. Bars above{" "}
              {BAND.healthyHigh}% are overloaded.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardKicker>Distribution</CardKicker>
              <CardTitle>Load split</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                key: "over",
                label: `Overloaded (>${BAND.healthyHigh}%)`,
                count: u.overloaded,
                tone: "rust" as const,
                icon: Flame,
              },
              {
                key: "healthy",
                label: `Healthy (${BAND.healthyLow}–${BAND.healthyHigh}%)`,
                count: logged.filter(
                  (e) =>
                    (e.utilization.value ?? 0) >= BAND.healthyLow &&
                    (e.utilization.value ?? 0) <= BAND.healthyHigh,
                ).length,
                tone: "sage" as const,
                icon: null,
              },
              {
                key: "under",
                label: `Slack (<${BAND.healthyLow}%)`,
                count: u.underloaded,
                tone: "ochre" as const,
                icon: TrendingDown,
              },
              {
                key: "unknown",
                label: "No time logged",
                count: u.unknown,
                tone: "neutral" as const,
                icon: null,
              },
            ].map((row) => {
              const Icon = row.icon;
              const denom = employees.length || 1;
              return (
                <div key={row.key}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-ink-soft">
                      {Icon && (
                        <Icon
                          className={cn(
                            "h-3.5 w-3.5",
                            row.tone === "rust" ? "text-rust" : "text-ochre",
                          )}
                        />
                      )}
                      {row.label}
                    </span>
                    <span className="font-medium text-ink tnum">{num(row.count)}</span>
                  </div>
                  <Progress
                    value={(row.count / denom) * 100}
                    tone={row.tone === "neutral" ? "ink" : row.tone}
                    className="mt-1.5"
                  />
                </div>
              );
            })}
          </CardContent>
          <CardFooter>
            <DataCompleteness value={Math.round(u.coverage)} />
            <span className="text-xs text-ink-faint">across {employees.length} people</span>
          </CardFooter>
        </Card>
      </div>

      {/* Overload warning — Arif Chowdhury */}
      {(() => {
        const arif = employees.find((e: Employee) => e.id === OVERLOADED_ID);
        if (!arif || arif.utilization.value === null) return null;
        return (
          <Card className="mt-6 border-rust/25 bg-rust-tint/40 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-rust/15 text-rust">
                <Flame className="h-5 w-5" />
              </span>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-base text-ink">{arif.name} is carrying too much</h3>
                  <Badge tone="rust" size="sm" dot>
                    {pct(arif.utilization.value)} · 6 weeks
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-ink-soft">
                  {arif.title} has sat above {BAND.healthyHigh}% utilization for six straight weeks across{" "}
                  {arif.activeProjects} projects ({num(arif.allocatedHours)}h allocated vs{" "}
                  {num(arif.capacityHours)}h capacity). His timesheets are {arif.timesheetCompliance}% complete,
                  so this signal is trustworthy — re-balance before it becomes a delivery or burnout risk.
                </p>
              </div>
            </div>
          </Card>
        );
      })()}

      {/* Team load table */}
      <PageSection className="mt-6" title="Team load">
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Person</TH>
                <TH className="text-right">Projects</TH>
                <TH className="text-right">Allocated / Capacity</TH>
                <TH>Utilization</TH>
                <TH>Timesheet compliance</TH>
              </TR>
            </THead>
            <TBody>
              {teamRows.map((e: Employee) => {
                const v = e.utilization.value;
                const over = e.allocatedHours > e.capacityHours;
                const isOverloaded = v !== null && v > BAND.healthyHigh;
                return (
                  <TR key={e.id} className={cn(isOverloaded && "bg-rust-tint/30")}>
                    <TD>
                      <div className="flex items-center gap-3">
                        <Avatar name={e.name} tone={e.avatarTone} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-ink">{e.name}</span>
                            {isOverloaded && (
                              <Badge tone="rust" size="sm">
                                Overload
                              </Badge>
                            )}
                          </div>
                          <div className="text-xs text-ink-faint">{e.title}</div>
                        </div>
                      </div>
                    </TD>
                    <TD className="text-right tnum text-ink-soft">{num(e.activeProjects)}</TD>
                    <TD className="text-right">
                      <span
                        className={cn(
                          "tnum font-medium",
                          over ? "text-sienna" : "text-ink",
                        )}
                      >
                        {num(e.allocatedHours)}
                        <span className="text-ink-ghost"> / {num(e.capacityHours)}h</span>
                      </span>
                      {over && (
                        <div className="text-[11px] text-sienna">
                          +{num(e.allocatedHours - e.capacityHours)}h over
                        </div>
                      )}
                    </TD>
                    <TD>
                      {v === null ? (
                        <span className="text-xs text-ink-faint">No time logged</span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-display text-sm tnum",
                              utilTone(v) === "rust"
                                ? "text-rust"
                                : utilTone(v) === "ochre"
                                  ? "text-ochre"
                                  : "text-ink",
                            )}
                          >
                            {pct(v)}
                          </span>
                          <ConfidenceBadge level={e.utilization.confidence} />
                        </div>
                      )}
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="w-28">
                          <Progress
                            value={e.timesheetCompliance}
                            tone={
                              e.timesheetCompliance >= 75
                                ? "sage"
                                : e.timesheetCompliance >= 50
                                  ? "ochre"
                                  : "rust"
                            }
                          />
                        </div>
                        <span className="w-9 text-right text-xs tabular-nums text-ink-faint tnum">
                          {e.timesheetCompliance}%
                        </span>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <CardFooter>
            <span className="text-xs text-ink-faint">
              {logged.length} of {employees.length} log time · {spareHours}h nominal slack among them (partial)
            </span>
            <Link
              to="/capture"
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-bone-2 hover:text-ink"
            >
              <Clock3 className="h-4 w-4" /> Improve coverage
            </Link>
          </CardFooter>
        </Card>
      </PageSection>
    </Page>
  );
}
