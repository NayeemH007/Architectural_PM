import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock, Download, Scale } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BarSeries, CHART } from "@/components/charts";
import { ConfidenceBadge, DataCompleteness } from "@/components/trust";
import { InsufficientData } from "@/components/states";
import { SourceChip } from "@/components/data-source";
import { STAGE_LABELS } from "@/components/status";
import { bdt, pct, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useProjects } from "@/lib/api";
import type { Metric, Project } from "@/lib/types";

const AS_OF = "2026-06-17";

// Per-project timesheet coverage feeding the labour-cost confidence story.
// Below 65% we treat margin as fee-based only; Space Esse refuses a true firm margin.
const TIMESHEET_COVERAGE: Record<string, number> = {
  p1: 61,
  p2: 58,
  p3: 88,
  p4: 60,
  p5: 64,
  p6: 30,
  p7: 76,
  p8: 25,
};

const src = (id: string, name: string, ref: string): Metric["sources"][number] => ({
  sourceId: id,
  sourceName: name,
  recordRef: ref,
  observedAt: "2026-06-12",
});

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

export default function Profitability() {
  const { data: projects = [], isLoading } = useProjects();
  const [stage, setStage] = useState("all");

  const active = projects.filter((p) => p.stage !== "closed");
  const lowCoverage = active.filter((p) => (TIMESHEET_COVERAGE[p.id] ?? 0) < 65);

  const portfolioRevenue = sum(active.map((p) => p.feeContract));
  const costToDate = sum(active.map((p) => p.costToDate));
  const collected = sum(active.map((p) => p.feeCollected));
  // Fee-based blended margin: (contract fee − cost-to-date) ÷ contract fee.
  // Honest proxy only — costToDate is mostly labour and labour capture is partial.
  const blendedMargin = portfolioRevenue > 0 ? ((portfolioRevenue - costToDate) / portfolioRevenue) * 100 : 0;
  const realization = portfolioRevenue > 0 ? (collected / portfolioRevenue) * 100 : 0;
  const avgCoverage = active.length ? sum(active.map((p) => TIMESHEET_COVERAGE[p.id] ?? 0)) / active.length : 0;

  const kRevenue: Metric = {
    value: portfolioRevenue,
    unit: "bdt",
    label: "Portfolio revenue (contracted)",
    confidence: "high",
    completeness: 92,
    asOf: AS_OF,
    deltaPct: 6,
    trend: [148, 152, 161, 169, 174, 180].map((v) => v * 100000),
    formula: "Σ contracted fee across active projects",
    sources: [src("ds_tally", "TallyPrime", "Contracts ledger"), src("ds_manual", "Manual capture", "Fee proposals")],
  };
  const kCost: Metric = {
    value: costToDate,
    unit: "bdt",
    label: "Cost-to-date (partial labour)",
    confidence: "medium",
    completeness: 64,
    asOf: AS_OF,
    deltaPct: 9,
    trend: [21, 24, 27, 29, 31, 34].map((v) => v * 1000000),
    formula: "Σ incurred cost (mostly labour) — captured where timesheets exist",
    note: "Labour cost is under-captured; figure understates true cost on low-coverage projects.",
    sources: [src("ds_tally", "TallyPrime", "Cost ledger"), src("ds_time", "Timesheet capture", "coverage ~64%")],
  };
  const kMargin: Metric = {
    value: Math.round(blendedMargin),
    unit: "pct",
    label: "Blended margin (fee-based)",
    confidence: "low",
    completeness: 62,
    asOf: AS_OF,
    deltaPct: -4,
    trend: [24, 23, 22, 21, 20, Math.round(blendedMargin)],
    formula: "(Contracted fee − cost-to-date) ÷ contracted fee × 100. Fee-based proxy, not true margin.",
    note: "Indicative only. True margin needs full labour cost; timesheet coverage is ~64% across the portfolio.",
    sources: [src("ds_tally", "TallyPrime", "Cost & fee ledgers"), src("ds_time", "Timesheet capture", "coverage 64%")],
  };
  const kRealization: Metric = {
    value: Math.round(realization),
    unit: "pct",
    label: "Realization",
    confidence: "medium",
    completeness: 88,
    asOf: AS_OF,
    deltaPct: -3,
    trend: [62, 60, 58, 57, 56, Math.round(realization)],
    formula: "Collected (net of VAT/VDS/AIT) ÷ contracted fee × 100",
    note: "Cash realized against contract value — billing still trails delivery on several projects.",
    sources: [src("ds_tally", "TallyPrime", "Receipts ledger")],
  };

  // Margin-by-project bar chart. Null forecasts surface as 0 with an "insufficient" caption.
  const marginData = active.map((p) => ({
    name: p.code,
    margin: p.forecastMargin.value ?? 0,
    insufficient: p.forecastMargin.value === null,
  }));
  const insufficientMargins = marginData.filter((d) => d.insufficient).length;

  // Planned vs actual cost, grouped, in BDT.
  const costData = active.map((p) => ({
    name: p.code,
    budget: p.budgetCost,
    actual: p.costToDate,
  }));

  const tableRows = (stage === "all" ? active : active.filter((p) => p.stage === stage)) as Project[];

  const stageOptions = [
    { value: "all", label: "All stages" },
    ...Array.from(new Set(active.map((p) => p.stage))).map((s) => ({
      value: s,
      label: STAGE_LABELS[s],
    })),
  ];

  return (
    <Page>
      <PageHeader
        kicker="Finance"
        title="Profitability"
        description="Margin by project and phase. These figures are fee-based — revenue against captured cost — not true margin. With timesheet coverage at ~64%, labour cost is partial, so most margins stay low-confidence until capture improves."
        actions={
          <Button variant="outline">
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-44" />)
        ) : (
          <>
            <KpiCard kicker="Portfolio revenue" metric={kRevenue} sparkColor={CHART.blue} deltaGoodWhenUp />
            <KpiCard kicker="Cost-to-date" metric={kCost} sparkColor={CHART.slate} deltaGoodWhenUp={false} />
            <KpiCard kicker="Blended margin" metric={kMargin} sparkColor={CHART.sienna} />
            <KpiCard kicker="Realization" metric={kRealization} sparkColor={CHART.sage} deltaGoodWhenUp />
          </>
        )}
      </div>

      {/* honest-margin callout */}
      <Card drafting className="mt-6 border-sienna/20 bg-sienna-tint/40">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-sienna text-paper">
            <Scale className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base text-ink">Margin here is fee-based, not true margin</h3>
              <ConfidenceBadge level="low" />
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
              True project margin depends on labour cost, and labour cost depends on timesheets.{" "}
              <span className="font-medium text-ink">{lowCoverage.length} of {active.length} projects</span> have
              timesheet coverage below 65%, so their cost-to-date understates reality. We report a fee-based proxy and
              hold confidence low rather than overstate profit. Improve capture in{" "}
              <Link to="/resourcing" className="font-medium text-blue hover:underline">Resourcing</Link> and{" "}
              <Link to="/capture" className="font-medium text-blue hover:underline">Capture</Link> to firm these up.
            </p>
            <div className="mt-4 grid max-w-md gap-3">
              <InsufficientData
                metric="True firm-wide margin"
                hint={`it requires full labour cost, but portfolio timesheet coverage is only ~${Math.round(avgCoverage)}%`}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardKicker>By project</CardKicker>
              <CardTitle>Forecast margin</CardTitle>
            </div>
            <Badge tone="sienna" dot>fee-based %</Badge>
          </CardHeader>
          <CardContent>
            <BarSeries
              data={marginData}
              xKey="name"
              height={230}
              bars={[{ key: "margin", color: CHART.sienna, label: "Forecast margin %" }]}
            />
            <p className="mt-2 text-xs text-ink-faint">
              {insufficientMargins > 0
                ? `${insufficientMargins} project(s) shown at 0% — forecast margin is insufficient (no reliable cost/timesheet data).`
                : "All active projects have a forecastable margin."}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardKicker>Cost discipline</CardKicker>
              <CardTitle>Planned vs. actual cost</CardTitle>
            </div>
            <Badge tone="neutral" dot>BDT</Badge>
          </CardHeader>
          <CardContent>
            <BarSeries
              data={costData}
              xKey="name"
              currency
              height={230}
              bars={[
                { key: "budget", color: CHART.slate, label: "Budget cost" },
                { key: "actual", color: CHART.blue, label: "Cost-to-date" },
              ]}
            />
            <p className="mt-2 text-xs text-ink-faint">
              Actuals are partial where timesheets lag — a low bar can mean low cost or low capture, not certainty.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* project table */}
      <PageSection
        className="mt-8"
        title="Profitability by project"
        description="Contract fee against captured cost. Confidence reflects labour-cost completeness, not optimism."
        actions={
          <div className="flex items-center gap-2">
            <SourceChip name="TallyPrime · export 12 Jun" status="stale" />
            <Select size="sm" value={stage} onValueChange={setStage} options={stageOptions} />
          </div>
        }
      >
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Project</TH>
                <TH>Stage</TH>
                <TH className="text-right">Contract fee</TH>
                <TH className="text-right">Cost-to-date</TH>
                <TH>Forecast margin</TH>
                <TH>Data completeness</TH>
              </TR>
            </THead>
            <TBody>
              {tableRows.map((p) => {
                const m = p.forecastMargin;
                const coverage = TIMESHEET_COVERAGE[p.id] ?? 0;
                return (
                  <TR key={p.id} interactive>
                    <TD>
                      <Link to={`/projects/${p.id}`} className="text-ink hover:text-blue">
                        <span className="font-medium">{p.name}</span>
                        <span className="ml-2 font-mono text-xs text-ink-faint">{p.code}</span>
                      </Link>
                      <div className="mt-0.5 text-xs text-ink-faint">
                        Timesheet coverage {coverage}%
                        {coverage < 65 && <span className="ml-1 text-sienna">· labour partial</span>}
                      </div>
                    </TD>
                    <TD className="text-ink-soft">{STAGE_LABELS[p.stage]}</TD>
                    <TD className="text-right tnum">{bdt(p.feeContract, { compact: true })}</TD>
                    <TD className="text-right tnum text-ink-soft">{bdt(p.costToDate, { compact: true })}</TD>
                    <TD>
                      {m.value === null ? (
                        <span className="inline-flex items-center gap-2 text-xs text-ink-faint">
                          <ConfidenceBadge level="insufficient" />
                          Insufficient data
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "tnum text-sm font-medium",
                              m.value < 10 ? "text-rust" : m.value < 20 ? "text-ochre" : "text-ink",
                            )}
                          >
                            {pct(m.value)}
                          </span>
                          <ConfidenceBadge level={m.confidence} />
                        </div>
                      )}
                    </TD>
                    <TD>
                      <DataCompleteness value={p.completeness} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      </PageSection>

      <p className="mt-8 flex items-center justify-center gap-1.5 text-center text-xs text-ink-ghost">
        <Clock className="h-3.5 w-3.5" />
        Fee-based margins as of {shortDate(AS_OF)}. True margin unlocks when timesheet coverage clears 80% firm-wide.
      </p>
    </Page>
  );
}
