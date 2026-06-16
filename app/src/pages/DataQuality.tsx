import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, Database, GitMerge } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardFooter, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { CHART } from "@/components/charts";
import { ConfidenceBadge, CONFIDENCE } from "@/components/trust";
import { KIND_ICON, SOURCE_STATUS, StatusDot } from "@/components/data-source";
import { EmptyState } from "@/components/states";
import { num, pct, relative, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useDataSources, useProjects, usePortfolio } from "@/lib/api";
import { dataSources, KIND_LABELS } from "@/lib/mock/integrations";
import { projects } from "@/lib/mock/data";
import type { Confidence, CrossRef, DataSource, Metric, Project } from "@/lib/types";

const TODAY = "2026-06-17";
const STALE_HOURS = 48;

const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);

const src = (id: string, name: string, ref: string): Metric["sources"][number] => ({
  sourceId: id,
  sourceName: name,
  recordRef: ref,
  observedAt: TODAY,
});

// ---- completeness-by-domain model ----
type Domain = {
  key: string;
  label: string;
  value: number;
  confidence: Confidence;
  tone: "sage" | "ochre" | "sienna" | "rust";
  note: string;
  feeds: string;
};

const DOMAINS: Domain[] = [
  {
    key: "money",
    label: "Money — fees, billing, collections",
    value: 85,
    confidence: "high",
    tone: "sage",
    note: "TallyPrime + Excel cover the ledger end-to-end. Only freshness lags on the weekly export.",
    feeds: "TallyPrime · Excel",
  },
  {
    key: "delivery",
    label: "Delivery — drawings, tasks, milestones",
    value: 70,
    confidence: "medium",
    tone: "ochre",
    note: "Drive + AutoCAD give file-presence signals; Trello is on 3 of 8 projects, so task coverage is uneven.",
    feeds: "Google Drive · AutoCAD · Trello",
  },
  {
    key: "people",
    label: "People — timesheets & effort",
    value: 40,
    confidence: "low",
    tone: "rust",
    note: "No timesheet tool. Effort is captured manually and the principal logs none — labour cost and margin stay indicative.",
    feeds: "Manual Capture only",
  },
  {
    key: "approvals",
    label: "Approvals — authority status",
    value: 65,
    confidence: "medium",
    tone: "ochre",
    note: "RAJUK ECPS has no API; the liaison enters status by hand, so the dominant schedule driver is the most opaque.",
    feeds: "RAJUK ECPS (manual) · Manual Capture",
  },
];

export default function DataQuality() {
  const { data: sources = dataSources } = useDataSources();
  const { data: projectList = projects } = useProjects();
  const { data: portfolio } = usePortfolio();

  // ---- derived figures ----
  const live = sources.filter((s) => s.status === "connected" || s.status === "syncing").length;
  const attention = sources.filter((s) => s.status === "stale" || s.status === "error").length;

  const completeness = useMemo(
    () => avg((projectList as Project[]).map((p) => p.completeness)),
    [projectList],
  );

  const unmatched = useMemo(
    () =>
      (projectList as Project[]).flatMap((p) =>
        p.crossRefs.filter((r) => !r.matched).map((r) => ({ project: p, ref: r })),
      ),
    [projectList],
  );

  // ---- inline Metric objects for the KPI row ----
  const kCompleteness: Metric = {
    value: completeness,
    unit: "pct",
    label: "Firm data completeness",
    confidence: completeness >= 75 ? "high" : completeness >= 60 ? "medium" : "low",
    completeness: Math.round(completeness),
    asOf: TODAY,
    formula: "mean(project.completeness) across the active portfolio",
    trend: [62, 64, 66, 67, 68, Math.round(completeness)],
    note: "Driven down by the People/Timesheets gap and partial Trello adoption.",
    sources: [src("ds_manual", "Manual Capture", "completeness index"), src("ds_drive", "Google Drive", "file signals")],
  };
  const kLive: Metric = {
    value: live,
    unit: "count",
    label: "Live sources",
    confidence: "high",
    completeness: 100,
    asOf: TODAY,
    formula: "count(status ∈ {connected, syncing})",
    sources: [src("ds_drive", "Connector registry", "status")],
  };
  const kStale: Metric = {
    value: attention,
    unit: "count",
    label: "Stale / error sources",
    confidence: attention === 0 ? "high" : "medium",
    completeness: 100,
    asOf: TODAY,
    formula: "count(status ∈ {stale, error})",
    note: "TallyPrime export is 5 days old — finance KPIs may lag.",
    sources: [src("ds_tally", "TallyPrime", "last export")],
  };
  const kUnmatched: Metric = {
    value: unmatched.length,
    unit: "count",
    label: "Unmatched project aliases",
    confidence: unmatched.length === 0 ? "high" : "low",
    completeness: 100,
    asOf: TODAY,
    formula: "count(crossRefs where matched = false)",
    note: "Each needs a human to confirm the project ↔ source link.",
    sources: [src("ds_manual", "Reconciliation queue", "aliases")],
  };

  const activeSources = (sources as DataSource[]).filter((s) => s.status !== "not_connected");

  return (
    <Page>
      <PageHeader
        kicker="Data & setup"
        title="Data quality & integration health"
        description="The trust backbone. Freshness, matching and completeness are tracked here so no KPI is ever shown as confident when the data behind it isn't."
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard kicker="Firm data completeness" metric={kCompleteness} sparkColor={CHART.blue} />
        <KpiCard kicker="Live sources" metric={kLive} value={num(live)} />
        <KpiCard kicker="Stale / error sources" metric={kStale} value={num(attention)} />
        <KpiCard kicker="Unmatched aliases" metric={kUnmatched} value={num(unmatched.length)} />
      </div>

      {/* Source freshness */}
      <PageSection className="mt-8" title="Source freshness" description="Every connected feed, with how recently it last refreshed and how healthy its signal is.">
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Source</TH>
                <TH>Status</TH>
                <TH>Method</TH>
                <TH>Last sync</TH>
                <TH className="text-right">Freshness</TH>
                <TH className="text-right">Records</TH>
                <TH className="w-40">Health</TH>
              </TR>
            </THead>
            <TBody>
              {activeSources.map((s) => {
                const Icon = KIND_ICON[s.kind];
                const fh = s.freshnessHours;
                const stale = fh !== null && fh > STALE_HOURS;
                return (
                  <TR key={s.id}>
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0 text-ink-faint" />
                        <div>
                          <div className="font-medium text-ink">{s.name}</div>
                          <div className="text-[11px] text-ink-faint">{KIND_LABELS[s.kind]}</div>
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <span className="inline-flex items-center gap-1.5">
                        <StatusDot status={s.status} pulse />
                        <span className={cn("text-xs font-medium", SOURCE_STATUS[s.status].text)}>
                          {SOURCE_STATUS[s.status].label}
                        </span>
                      </span>
                    </TD>
                    <TD className="text-xs capitalize text-ink-soft">{s.method.replace("_", " ")}</TD>
                    <TD className="text-xs text-ink-soft">{relative(s.lastSync)}</TD>
                    <TD className="text-right tnum">
                      {fh === null ? (
                        <span className="text-ink-ghost">—</span>
                      ) : (
                        <span className={cn("text-xs font-medium", stale ? "text-rust" : fh > 12 ? "text-ochre" : "text-ink-soft")}>
                          {num(fh)}h
                        </span>
                      )}
                    </TD>
                    <TD className="text-right tnum text-ink-soft">{num(s.recordsIngested)}</TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <Progress
                          value={s.health}
                          tone={s.health > 80 ? "sage" : s.health > 55 ? "ochre" : "rust"}
                          className=""
                        />
                        <span className="w-7 shrink-0 text-right text-[11px] text-ink-faint tnum">{s.health}</span>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
          <CardFooter>
            <span className="text-xs text-ink-faint">
              Freshness flagged when older than {STALE_HOURS}h. Read-only feeds — source systems stay authoritative.
            </span>
            <span className="text-xs text-ink-ghost">{activeSources.length} active feeds</span>
          </CardFooter>
        </Card>
      </PageSection>

      {/* Completeness by domain */}
      <PageSection
        className="mt-8"
        title="Completeness by domain"
        description="Where the picture is solid — and where it isn't. Confidence on every KPI inherits from these."
      >
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {DOMAINS.map((d) => {
            const weak = d.key === "people";
            return (
              <Card key={d.key} className={cn("p-4", weak && "border-rust/30 bg-rust-tint/30")}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-ink">{d.label}</div>
                    <div className="mt-0.5 text-[11px] text-ink-faint">{d.feeds}</div>
                  </div>
                  <span className="font-display text-xl text-ink tnum">{pct(d.value)}</span>
                </div>
                <Progress value={d.value} tone={d.tone} className="mt-3" />
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <p className="text-xs leading-relaxed text-ink-soft">{d.note}</p>
                  <ConfidenceBadge level={d.confidence} className="shrink-0" />
                </div>
              </Card>
            );
          })}
        </div>

        {/* People callout — the gap */}
        <Card className="mt-4 border-rust/30 bg-rust-tint/40 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rust" />
            <div className="flex-1">
              <h3 className="font-display text-base text-ink">People &amp; timesheets is the weak domain</h3>
              <p className="mt-1 text-sm text-ink-soft">
                At <span className="font-medium text-rust tnum">{pct(40)}</span> completeness, effort data is the firm's
                thinnest signal. There is no timesheet tool, the principal logs no time, and field roles capture little —
                so utilization, labour cost and forecast margin are shown as <span className="font-medium text-ink">low confidence or insufficient</span>,
                never as fact.
              </p>
            </div>
          </div>
        </Card>
      </PageSection>

      {/* Project matching queue */}
      <PageSection
        className="mt-8"
        title="Project matching queue"
        description="Human-in-the-loop reconciliation. Each alias below is a project named differently in a source system, waiting to be confirmed."
        actions={<Badge tone={unmatched.length ? "rust" : "sage"} dot>{unmatched.length} pending</Badge>}
      >
        <Card>
          {unmatched.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              title="Every alias is matched"
              description="All source records are confidently linked to a project. Nothing to reconcile."
            />
          ) : (
            <div className="divide-y divide-line">
              {unmatched.map(({ project, ref }: { project: Project; ref: CrossRef }) => (
                <MatchRow key={`${project.id}-${ref.sourceId}`} project={project} xref={ref} />
              ))}
            </div>
          )}
        </Card>
      </PageSection>

      {/* Known data-health limits */}
      <PageSection className="mt-8" title="Known data-health limits" description="Honest constraints we surface rather than hide.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <div>
                <CardKicker>Communication · WhatsApp</CardKicker>
                <CardTitle>No backfill API</CardTitle>
              </div>
              <Database className="h-4 w-4 text-ink-faint" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-soft">
                WhatsApp offers no history or replay API, so past chats cannot be reconstructed. Decisions and approvals
                are captured only going forward, via forward/screenshot into structured records — history before capture
                is permanently invisible.
              </p>
            </CardContent>
            <CardFooter>
              <ConfidenceBadge level="low" />
              <span className="text-xs text-ink-ghost">Manual capture · forward / screenshot</span>
            </CardFooter>
          </Card>

          <Card className="border-ochre/30">
            <CardHeader>
              <div>
                <CardKicker>Accounting · TallyPrime</CardKicker>
                <CardTitle>Export is 5 days stale</CardTitle>
              </div>
              <AlertTriangle className="h-4 w-4 text-ochre" />
            </CardHeader>
            <CardContent>
              <p className="text-sm text-ink-soft">
                Tally's XML is desktop-bound, so finance is ingested via a weekly templated CSV/XLSX export — not a live
                API. The last export was <span className="font-medium text-ochre">12 Jun</span> ({relative("2026-06-12T17:10:00")}),
                so billing and collection figures may lag reality by several days.
              </p>
            </CardContent>
            <CardFooter>
              <ConfidenceBadge level="medium" />
              <span className="text-xs text-ink-ghost">Last export {shortDate("2026-06-12")}</span>
            </CardFooter>
          </Card>
        </div>
      </PageSection>
    </Page>
  );
}

function MatchRow({ project, xref }: { project: Project; xref: CrossRef }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3.5">
      <GitMerge className="h-4 w-4 shrink-0 text-ink-faint" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-ink">{project.name}</span>
          <span className="font-mono text-[11px] text-ink-ghost">{project.code}</span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-soft">
          <span>{xref.sourceName}</span>
          <span className="text-ink-ghost">·</span>
          <span className="font-mono text-ink-faint">"{xref.alias}"</span>
        </div>
      </div>
      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide",
          CONFIDENCE[xref.confidence].text,
        )}
      >
        {xref.confidence === "insufficient" ? "no signal" : `${xref.confidence} match`}
      </span>
      <Button variant="subtle" size="sm" className="shrink-0">
        <CheckCircle2 className="h-3.5 w-3.5" /> Confirm match
      </Button>
    </div>
  );
}
