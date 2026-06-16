import { useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { BarSeries, CHART } from "@/components/charts";
import { ConfidenceBadge } from "@/components/trust";
import { TYPE_LABELS } from "@/components/status";
import { EmptyState } from "@/components/states";
import { bdt, pct, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { pipelineByStage, useOpportunities, usePortfolio } from "@/lib/api";
import type { Metric, OppStage, Opportunity } from "@/lib/types";

// Board lanes (won shown as the closing column; lost is excluded from the board).
const BOARD_STAGES: { key: OppStage; label: string; tone: "neutral" | "blue" | "ochre" | "sienna" | "sage" }[] = [
  { key: "lead", label: "Lead", tone: "neutral" },
  { key: "qualified", label: "Qualified", tone: "blue" },
  { key: "proposal", label: "Proposal", tone: "ochre" },
  { key: "negotiation", label: "Negotiation", tone: "sienna" },
  { key: "won", label: "Won", tone: "sage" },
];

const TYPE_TONE: Record<string, "neutral" | "blue" | "sage" | "ochre" | "sienna"> = {
  residential: "blue",
  commercial: "ochre",
  mixed_use: "ochre",
  interior: "sage",
  institutional: "blue",
  industrial: "sienna",
  planning: "neutral",
};

const weighted = (o: Opportunity) => (o.estFee * o.probability) / 100;

export default function Pipeline() {
  const { data: portfolio } = usePortfolio();
  const { data: opportunities = [], isLoading } = useOpportunities();
  const [owner, setOwner] = useState("all");

  const byStage = pipelineByStage();
  const owners = useMemo(
    () => Array.from(new Set(opportunities.map((o) => o.owner))).sort(),
    [opportunities],
  );

  const visible = useMemo(
    () => opportunities.filter((o) => (owner === "all" ? true : o.owner === owner)),
    [opportunities, owner],
  );

  // ---- derived figures ----
  const open = opportunities.filter((o) => o.stage !== "won" && o.stage !== "lost");
  const openValue = open.reduce((s, o) => s + o.estFee, 0);
  const won = opportunities.filter((o) => o.stage === "won").length;
  const lost = opportunities.filter((o) => o.stage === "lost").length;
  const closed = won + lost;
  const winRate = closed > 0 ? (won / closed) * 100 : null;
  const avgDeal = open.length ? openValue / open.length : 0;

  // ---- inline Metric objects (trust model) ----
  const src = (id: string, n: string, r: string): Metric["sources"][number] => ({
    sourceId: id,
    sourceName: n,
    recordRef: r,
    observedAt: "2026-06-14",
  });

  const kWeighted: Metric = {
    value: portfolio?.pipelineWeighted ?? null,
    unit: "bdt",
    label: "Weighted pipeline",
    confidence: "medium",
    completeness: 60,
    asOf: "2026-06-17",
    deltaPct: 8,
    formula: "Σ (est. fee × win probability) across open opportunities",
    note: "Probabilities are the owner's judgement, not a fitted model.",
    sources: [src("ds_manual", "Manual capture", "Pipeline board"), src("ds_gmail", "Gmail", "BD threads")],
  };
  const kOpen: Metric = {
    value: openValue,
    unit: "bdt",
    label: "Open pipeline value",
    confidence: "low",
    completeness: 52,
    asOf: "2026-06-17",
    formula: "Σ est. fee for stages lead → negotiation",
    note: "Face value if every open deal closed at full fee — not a forecast.",
    sources: [src("ds_manual", "Manual capture", "Pipeline board")],
  };
  const kWinRate: Metric = {
    value: winRate,
    unit: "pct",
    label: "Win rate",
    confidence: "low",
    completeness: 20,
    asOf: "2026-06-17",
    formula: "Won ÷ (Won + Lost) × 100",
    note: `Only ${closed} closed ${closed === 1 ? "deal" : "deals"} on record — too few to trust. Most lost bids never get logged.`,
    sources: [src("ds_manual", "Manual capture", "Closed opportunities")],
  };
  const kAvgDeal: Metric = {
    value: open.length ? avgDeal : null,
    unit: "bdt",
    label: "Avg expected deal size",
    confidence: "medium",
    completeness: 55,
    asOf: "2026-06-17",
    formula: "Open pipeline value ÷ open opportunity count",
    sources: [src("ds_manual", "Manual capture", "Pipeline board")],
  };

  // weighted-by-stage chart data (open stages + won)
  const stageWeighted = BOARD_STAGES.map((s) => {
    const items = opportunities.filter((o) => o.stage === s.key);
    return {
      label: s.label,
      weighted: Math.round(items.reduce((sum, o) => sum + weighted(o), 0)),
    };
  });

  const sortedTable = useMemo(
    () => [...visible].sort((a, b) => +new Date(a.expectedDecision) - +new Date(b.expectedDecision)),
    [visible],
  );

  return (
    <Page>
      <PageHeader
        kicker="Team & Growth"
        title="Business development"
        description="The new-work pipeline — part CRM, part the owner's memory. We track what's written down and stay honest about what isn't."
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard kicker="Weighted pipeline" metric={kWeighted} sparkColor={CHART.blue} />
        <KpiCard kicker="Open pipeline value" metric={kOpen} sparkColor={CHART.ochre} />
        <KpiCard
          kicker="Win rate"
          metric={kWinRate}
          deltaGoodWhenUp
          footnote={<ConfidenceBadge level="low" />}
        />
        <KpiCard kicker="Avg expected deal" metric={kAvgDeal} sparkColor={CHART.sage} />
      </div>

      {/* honesty note — pipeline is the lowest-priority, least-instrumented lane */}
      <Card className="mt-4 border-ochre/20 bg-ochre-tint/40 p-4">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-ochre" />
          <p className="text-sm text-ink-soft">
            Pipeline is the least-instrumented part of the practice — much of it still lives in the principal's head and
            WhatsApp threads. Win probabilities are <span className="font-medium text-ink">manual estimates</span>, and
            with only {closed} closed {closed === 1 ? "deal" : "deals"} logged, <span className="font-medium text-ink">win
            rate is low-confidence</span>. Treat these figures as a working view, not a forecast.
          </p>
        </div>
      </Card>

      {/* Kanban board */}
      <PageSection
        className="mt-8"
        title="Pipeline board"
        description="Open opportunities by stage. Each column shows count and total estimated fee."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
          {BOARD_STAGES.map((s) => {
            const cards = visible
              .filter((o) => o.stage === s.key)
              .sort((a, b) => b.probability - a.probability);
            // Σ value: firm-wide from the contract fn when unfiltered, else the owner's visible cards.
            const colValue =
              owner === "all"
                ? byStage.find((b) => b.key === s.key)?.value ?? 0
                : cards.reduce((sum, o) => sum + o.estFee, 0);
            return (
              <div key={s.key} className="flex flex-col rounded-lg border border-line bg-paper-2/50">
                <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <Badge tone={s.tone} size="sm" dot>
                      {s.label}
                    </Badge>
                    <span className="text-xs text-ink-faint tnum">{cards.length}</span>
                  </div>
                  <span className="text-xs font-medium text-ink-soft tnum">
                    {bdt(colValue, { compact: true })}
                  </span>
                </div>
                <div className="flex flex-col gap-2.5 p-2.5">
                  {cards.length === 0 ? (
                    <p className="px-1 py-4 text-center text-xs text-ink-ghost">
                      {owner === "all" ? "No opportunities" : "None for this owner"}
                    </p>
                  ) : (
                    cards.map((o) => (
                      <Card key={o.id} className="p-3 shadow-none transition-shadow hover:shadow-card">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-medium text-ink">{o.name}</div>
                            <div className="truncate text-xs text-ink-faint">{o.client}</div>
                          </div>
                          <Badge tone={TYPE_TONE[o.type] ?? "neutral"} size="sm">
                            {TYPE_LABELS[o.type]}
                          </Badge>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between">
                          <span className="font-display text-sm text-ink tnum">
                            {bdt(o.estFee, { compact: true })}
                          </span>
                          <span className="text-xs text-ink-faint tnum">{pct(o.probability)}</span>
                        </div>
                        <Progress
                          value={o.probability}
                          tone={o.probability >= 60 ? "sage" : o.probability >= 35 ? "ochre" : "sienna"}
                          className="mt-1.5"
                        />
                        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[11px] text-ink-ghost">
                          <span>Decision {shortDate(o.expectedDecision)}</span>
                          <span className="truncate">{o.owner}</span>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PageSection>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* weighted by stage chart */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <div>
              <CardKicker>Weighted · BDT</CardKicker>
              <CardTitle>Weighted pipeline by stage</CardTitle>
            </div>
            <Badge tone="neutral" dot>
              Est. fee × prob.
            </Badge>
          </CardHeader>
          <CardContent>
            <BarSeries
              data={stageWeighted}
              xKey="label"
              currency
              height={230}
              bars={[{ key: "weighted", color: CHART.blue, label: "Weighted value" }]}
            />
          </CardContent>
        </Card>

        {/* full opportunity table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>All opportunities</CardKicker>
              <CardTitle>Pipeline detail</CardTitle>
            </div>
            <Select
              size="sm"
              value={owner}
              onValueChange={setOwner}
              options={[
                { value: "all", label: "All owners" },
                ...owners.map((o) => ({ value: o, label: o })),
              ]}
            />
          </CardHeader>
          {sortedTable.length === 0 && !isLoading ? (
            <EmptyState title="No opportunities" description="No pipeline entries match this owner." />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Opportunity</TH>
                  <TH>Client</TH>
                  <TH>Type</TH>
                  <TH className="text-right">Est. fee</TH>
                  <TH className="text-right">Prob.</TH>
                  <TH className="text-right">Weighted</TH>
                  <TH>Decision</TH>
                  <TH>Owner</TH>
                </TR>
              </THead>
              <TBody>
                {sortedTable.map((o) => {
                  const closedRow = o.stage === "won" || o.stage === "lost";
                  return (
                    <TR key={o.id}>
                      <TD>
                        <div className="font-medium text-ink">{o.name}</div>
                        <div className="text-xs text-ink-faint capitalize">
                          {o.stage.replace("_", " ")}
                        </div>
                      </TD>
                      <TD className="text-ink-soft">{o.client}</TD>
                      <TD>
                        <Badge tone={TYPE_TONE[o.type] ?? "neutral"} size="sm">
                          {TYPE_LABELS[o.type]}
                        </Badge>
                      </TD>
                      <TD className="text-right tnum text-ink-soft">{bdt(o.estFee, { compact: true })}</TD>
                      <TD className="text-right tnum">
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-ink-soft">{pct(o.probability)}</span>
                          <Progress
                            value={o.probability}
                            tone={o.probability >= 60 ? "sage" : o.probability >= 35 ? "ochre" : "sienna"}
                            className="w-12"
                          />
                        </div>
                      </TD>
                      <TD className="text-right tnum font-medium text-ink">
                        {bdt(weighted(o), { compact: true })}
                      </TD>
                      <TD className={cn("text-ink-soft", closedRow && "text-ink-ghost")}>
                        {shortDate(o.expectedDecision)}
                      </TD>
                      <TD className="text-ink-soft">{o.owner}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
          <div className="border-t border-line px-5 py-3 text-xs text-ink-ghost">
            Showing {sortedTable.length} of {opportunities.length} opportunities · sorted by expected decision · est.
            fees are pre-tax contract values.
          </div>
        </Card>
      </div>
    </Page>
  );
}
