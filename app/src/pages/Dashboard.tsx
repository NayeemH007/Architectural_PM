import { Link } from "react-router-dom";
import { ArrowRight, FileText, Landmark, Sparkles } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AreaTrend, Donut, CHART } from "@/components/charts";
import { AlertRow } from "@/components/alert-row";
import { ProjectCard } from "@/components/project-card";
import { ConfidenceBadge, DataCompleteness } from "@/components/trust";
import { ApprovalBadge } from "@/components/status";
import { bdt, pct, shortDate } from "@/lib/format";
import { useAIReports, useAlerts, useApprovals, usePortfolio, useProjects } from "@/lib/api";
import { projectById } from "@/lib/mock/data";
import type { Metric } from "@/lib/types";

const moneyTrend = [
  { m: "Jan", billed: 3_800_000, collected: 3_100_000 },
  { m: "Feb", billed: 4_200_000, collected: 3_500_000 },
  { m: "Mar", billed: 5_100_000, collected: 3_900_000 },
  { m: "Apr", billed: 4_600_000, collected: 4_400_000 },
  { m: "May", billed: 5_400_000, collected: 4_050_000 },
  { m: "Jun", billed: 4_300_000, collected: 3_200_000 },
];

export default function Dashboard() {
  const { data: portfolio } = usePortfolio();
  const { data: projects = [] } = useProjects();
  const { data: alerts = [] } = useAlerts();
  const { data: approvals = [] } = useApprovals();
  const { data: reports = [] } = useAIReports();

  const brief = reports.find((r) => r.kind === "daily_brief");
  const overdueApprovals = approvals.filter(
    (a) => a.statutoryDays !== null && a.daysInStage > (a.statutoryDays ?? 0) && a.status !== "approved",
  );
  const watchlist = [...projects]
    .sort((a, b) => (a.healthScore.value ?? 0) - (b.healthScore.value ?? 0))
    .slice(0, 4);

  const src = (id: string, name: string, ref: string) => ({
    sourceId: id,
    sourceName: name,
    recordRef: ref,
    observedAt: "2026-06-12",
  });

  const kCollected: Metric = {
    value: portfolio?.totalCollected ?? null,
    unit: "bdt",
    label: "Collected (active)",
    confidence: "high",
    completeness: 88,
    asOf: "2026-06-17",
    deltaPct: -7,
    trend: moneyTrend.map((d) => d.collected),
    formula: "Σ payments received (net of VAT, VDS, AIT) across active projects",
    sources: [src("ds_tally", "TallyPrime", "GL · receipts"), src("ds_manual", "Manual capture", "Payment log")],
  };
  const kRate: Metric = {
    value: portfolio?.collectionRate ?? null,
    unit: "pct",
    label: "Collection rate",
    confidence: "high",
    completeness: 88,
    asOf: "2026-06-17",
    deltaPct: -4,
    trend: [82, 84, 76, 95, 75, 74],
    formula: "Collected ÷ Billed × 100",
    sources: [src("ds_tally", "TallyPrime", "AR ledger")],
  };
  const kOverdue: Metric = {
    value: portfolio?.overdueTotal ?? null,
    unit: "bdt",
    label: "Overdue receivable",
    confidence: "high",
    completeness: 90,
    asOf: "2026-06-17",
    deltaPct: 12,
    trend: [22, 28, 35, 30, 48, 58],
    formula: "Σ net receivable on invoices past due date",
    sources: [src("ds_tally", "TallyPrime", "INV-2026-019, -022, -028")],
  };
  const kMargin: Metric = {
    value: 18,
    unit: "pct",
    label: "Portfolio margin (fee-based)",
    confidence: "low",
    completeness: 62,
    asOf: "2026-06-17",
    deltaPct: -3,
    trend: [24, 23, 22, 21, 19, 18],
    formula: "Fee-based proxy. True margin needs labour cost — timesheet coverage 62%.",
    note: "Labour cost is partial across 4 of 8 projects — margin is indicative, not final.",
    sources: [src("ds_tally", "TallyPrime", "cost ledger"), src("ds_manual", "Timesheet capture", "coverage 62%")],
  };

  const healthDist = [
    { name: "Healthy", value: projects.filter((p) => p.health === "healthy").length, color: CHART.sage },
    { name: "Watch", value: projects.filter((p) => p.health === "watch").length, color: CHART.ochre },
    { name: "At risk", value: projects.filter((p) => p.health === "at_risk").length, color: CHART.sienna },
    { name: "Critical", value: projects.filter((p) => p.health === "critical").length, color: CHART.taupe },
  ];

  return (
    <Page>
      <PageHeader
        kicker="Executive overview · Tuesday, 17 June 2026"
        title="Good morning, Tahmid"
        description="Two items need you today: a 90-day Meghna receivable and an overdue RAJUK permit. Money is holding; one margin figure is low-confidence pending timesheets."
        actions={
          <>
            <Button variant="outline" size="md">
              <FileText className="h-4 w-4" /> This week
            </Button>
            <Button variant="primary" size="md">
              <Sparkles className="h-4 w-4" /> Generate brief
            </Button>
          </>
        }
      />

      {/* AI daily briefing */}
      {brief && (
        <Card drafting className="mt-6 border-blue/20 bg-blue-ghost">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue text-paper">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="label-draft">Daily executive briefing</span>
                <ConfidenceBadge level="medium" />
              </div>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{brief.summary}</p>
              <div className="mt-3 flex items-center gap-3">
                <Link to="/reports" className="inline-flex items-center gap-1 text-sm font-medium text-blue hover:underline">
                  Read full briefing <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <span className="text-xs text-ink-ghost">·</span>
                <DataCompleteness value={brief.completeness} />
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {portfolio ? (
          <>
            <KpiCard kicker="Collected · active" metric={kCollected} sparkColor={CHART.sage} deltaGoodWhenUp />
            <KpiCard kicker="Collection rate" metric={kRate} sparkColor={CHART.blue} />
            <KpiCard kicker="Overdue receivable" metric={kOverdue} sparkColor={CHART.sienna} deltaGoodWhenUp={false} />
            <KpiCard kicker="Portfolio margin" metric={kMargin} sparkColor={CHART.ochre} />
          </>
        ) : (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40" />)
        )}
      </div>

      {/* money + alerts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>Money · last 6 months</CardKicker>
              <CardTitle>Billed vs. collected</CardTitle>
            </div>
            <Badge tone="neutral" dot>
              BDT
            </Badge>
          </CardHeader>
          <CardContent>
            <AreaTrend
              data={moneyTrend}
              xKey="m"
              currency
              series={[
                { key: "billed", color: CHART.blue, label: "Billed" },
                { key: "collected", color: CHART.sage, label: "Collected" },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardKicker>Needs attention</CardKicker>
              <CardTitle>Top alerts</CardTitle>
            </div>
            <Link to="/risks" className="text-xs font-medium text-blue hover:underline">
              All
            </Link>
          </CardHeader>
          <div className="divide-y divide-line border-t border-line">
            {alerts
              .filter((a) => a.severity === "critical" || a.severity === "warning")
              .slice(0, 4)
              .map((a) => (
                <AlertRow key={a.id} alert={a} />
              ))}
          </div>
        </Card>
      </div>

      {/* approvals + health */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>Authority approvals · Dhaka</CardKicker>
              <CardTitle>Stuck & in-flight</CardTitle>
            </div>
            <Link to="/approvals" className="text-xs font-medium text-blue hover:underline">
              View tracker
            </Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {approvals
              .filter((a) => a.status !== "approved")
              .slice(0, 4)
              .map((a) => {
                const proj = projectById(a.projectId);
                const overdue = a.statutoryDays !== null && a.daysInStage > a.statutoryDays;
                return (
                  <div
                    key={a.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper-2 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Landmark className="h-4 w-4 shrink-0 text-ink-faint" />
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-ink">
                          {a.authority} · {a.title}
                        </div>
                        <div className="truncate text-xs text-ink-soft">{proj?.name}</div>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      {overdue && (
                        <span className="text-xs font-medium text-rust tnum">
                          {a.daysInStage}d / {a.statutoryDays}d
                        </span>
                      )}
                      <ApprovalBadge status={a.status} />
                    </div>
                  </div>
                );
              })}
            {overdueApprovals.length > 0 && (
              <p className="pt-1 text-xs text-ink-faint">
                {overdueApprovals.length} approval(s) past the statutory window — blocking downstream phases.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardKicker>Portfolio</CardKicker>
              <CardTitle>Health mix</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Donut
              data={healthDist}
              centerValue={String(portfolio?.activeProjects ?? projects.length)}
              centerLabel="projects"
            />
            <div className="mt-2 grid grid-cols-2 gap-2">
              {healthDist.map((h) => (
                <div key={h.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: h.color }} />
                  <span className="text-ink-soft">{h.name}</span>
                  <span className="ml-auto font-medium text-ink tnum">{h.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* watchlist */}
      <PageSection
        className="mt-8"
        title="Project watchlist"
        description="Lowest health scores first."
        actions={
          <Link to="/portfolio" className="text-sm font-medium text-blue hover:underline">
            All projects →
          </Link>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {watchlist.map((p) => (
            <ProjectCard key={p.id} p={p} />
          ))}
        </div>
      </PageSection>

      <p className="mt-8 text-center text-xs text-ink-ghost">
        Every figure links to its source. Last full sync {shortDate("2026-06-17")} · firm data completeness{" "}
        {pct(portfolio?.avgCompleteness ?? 0)}.
      </p>
    </Page>
  );
}
