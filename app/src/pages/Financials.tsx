import { useState } from "react";
import { Link } from "react-router-dom";
import { Download, Info } from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AreaTrend, BarSeries, CHART } from "@/components/charts";
import { SourceChip } from "@/components/data-source";
import { Tooltip } from "@/components/ui/tooltip";
import { bdt, pct, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { agingBuckets, useClients, useInvoices, usePortfolio } from "@/lib/api";
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

export default function Financials() {
  const { data: portfolio } = usePortfolio();
  const { data: invoices = [] } = useInvoices();
  const { data: clients = [] } = useClients();
  const [status, setStatus] = useState("all");

  const aging = agingBuckets().map((b) => ({ label: b.label, amount: b.value }));
  const filtered = invoices.filter((i) => (status === "all" ? true : i.status === status));

  const src = (id: string, n: string, r: string): Metric["sources"][number] => ({
    sourceId: id,
    sourceName: n,
    recordRef: r,
    observedAt: "2026-06-12",
  });

  const kBilled: Metric = {
    value: portfolio?.totalBilled ?? null, unit: "bdt", label: "Billed", confidence: "high", completeness: 90,
    asOf: "2026-06-17", deltaPct: 5, trend: moneyTrend.map((d) => d.billed),
    formula: "Σ gross fee invoiced across active projects", sources: [src("ds_tally", "TallyPrime", "AR ledger")],
  };
  const kCollected: Metric = {
    value: portfolio?.totalCollected ?? null, unit: "bdt", label: "Collected", confidence: "high", completeness: 90,
    asOf: "2026-06-17", deltaPct: -7, trend: moneyTrend.map((d) => d.collected),
    formula: "Σ payments received (net of VAT/VDS/AIT)", sources: [src("ds_tally", "TallyPrime", "receipts")],
  };
  const kRate: Metric = {
    value: portfolio?.collectionRate ?? null, unit: "pct", label: "Collection rate", confidence: "high", completeness: 90,
    asOf: "2026-06-17", deltaPct: -4, trend: [82, 84, 76, 95, 75, 74], formula: "Collected ÷ Billed × 100",
    sources: [src("ds_tally", "TallyPrime", "AR")],
  };
  const kWip: Metric = {
    value: portfolio?.totalWip ?? null, unit: "bdt", label: "Work-in-progress", confidence: "medium", completeness: 70,
    asOf: "2026-06-17", deltaPct: 3, formula: "Earned (by % complete) − billed", note: "Depends on % complete, which is partly manual.",
    sources: [src("ds_manual", "Manual capture", "phase progress"), src("ds_tally", "TallyPrime", "billed")],
  };

  return (
    <Page>
      <PageHeader
        kicker="Finance"
        title="Fees, billing & collections"
        description="Cash, not invoice face value. Every figure is net of 15% VAT, VDS and ~10% AIT withholding."
        actions={
          <Button variant="outline">
            <Download className="h-4 w-4" /> Export
          </Button>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard kicker="Billed" metric={kBilled} sparkColor={CHART.blue} />
        <KpiCard kicker="Collected (net)" metric={kCollected} sparkColor={CHART.sage} />
        <KpiCard kicker="Collection rate" metric={kRate} sparkColor={CHART.ochre} />
        <KpiCard kicker="Work-in-progress" metric={kWip} sparkColor={CHART.slate} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>Cash flow · 6 months</CardKicker>
              <CardTitle>Billed vs. collected</CardTitle>
            </div>
            <Badge tone="neutral" dot>BDT</Badge>
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
              <CardKicker>Receivables</CardKicker>
              <CardTitle>Invoice aging</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <BarSeries
              data={aging}
              xKey="label"
              currency
              height={210}
              bars={[{ key: "amount", color: CHART.sienna, label: "Outstanding" }]}
            />
            <div className="mt-2 flex items-center justify-between rounded-md bg-rust-tint/60 px-3 py-2 text-xs">
              <span className="text-rust">90+ days overdue</span>
              <span className="font-medium text-rust tnum">{bdt(aging[4]?.amount ?? 0, { compact: true })}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* withholding explainer */}
      <Card className="mt-6 border-blue/15 bg-blue-ghost p-5">
        <div className="flex items-start gap-3">
          <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue" />
          <div className="flex-1">
            <h3 className="font-display text-base text-ink">Why "billed" never equals "cash"</h3>
            <p className="mt-1 text-sm text-ink-soft">
              In Bangladesh, corporate clients deduct VAT at source (VDS) and ~10% AIT/TDS before paying. Space Esse
              models each step so collection KPIs reflect real cash.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {[
                ["Gross fee", "৳10.0L", "neutral"],
                ["+ VAT 15%", "৳1.5L", "blue"],
                ["− VDS", "−৳0.9L", "ochre"],
                ["− AIT ~10%", "−৳1.0L", "ochre"],
                ["= Net cash", "৳9.6L", "sage"],
              ].map(([k, v, tone], i) => (
                <div key={k} className="flex items-center gap-2">
                  <div className={cn(
                    "rounded-md border px-3 py-1.5 text-center",
                    tone === "sage" ? "border-sage/30 bg-sage-tint" : tone === "blue" ? "border-blue/20 bg-paper" : tone === "ochre" ? "border-ochre/25 bg-ochre-tint" : "border-line bg-paper",
                  )}>
                    <div className="label-draft !text-[10px]">{k}</div>
                    <div className="font-display text-sm text-ink tnum">{v}</div>
                  </div>
                  {i < 4 && <span className="text-ink-ghost">→</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* invoices */}
      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardKicker>Ledger</CardKicker>
            <CardTitle>Invoices</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <SourceChip name="TallyPrime · export 12 Jun" status="stale" />
            <Select
              size="sm"
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "all", label: "All" },
                { value: "overdue", label: "Overdue" },
                { value: "sent", label: "Sent" },
                { value: "part_paid", label: "Part paid" },
                { value: "paid", label: "Paid" },
              ]}
            />
          </div>
        </CardHeader>
        <Table>
          <THead>
            <TR>
              <TH>Invoice</TH>
              <TH>Project</TH>
              <TH className="text-right">Gross</TH>
              <TH className="text-right">
                <Tooltip content="Gross + VAT − VDS − AIT">
                  <span className="cursor-help underline decoration-dotted">Net receivable</span>
                </Tooltip>
              </TH>
              <TH className="text-right">Received</TH>
              <TH>Due</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {filtered.map((i) => {
              const proj = projectById(i.projectId);
              return (
                <TR key={i.id}>
                  <TD className="font-mono text-xs">{i.number}</TD>
                  <TD>
                    <Link to={`/projects/${i.projectId}`} className="text-ink hover:text-blue">
                      {proj?.name ?? i.client}
                    </Link>
                  </TD>
                  <TD className="text-right tnum text-ink-soft">{bdt(i.grossFee, { compact: true })}</TD>
                  <TD className="text-right tnum font-medium">{bdt(i.netReceivable, { compact: true })}</TD>
                  <TD className="text-right tnum text-ink-soft">{bdt(i.amountReceived, { compact: true })}</TD>
                  <TD className="text-ink-soft">{shortDate(i.dueDate)}</TD>
                  <TD>
                    <Badge
                      tone={i.status === "overdue" ? "rust" : i.status === "paid" ? "sage" : i.status === "part_paid" ? "ochre" : "neutral"}
                      size="sm"
                    >
                      {i.status === "overdue" ? `${i.agingDays}d overdue` : i.status.replace("_", " ")}
                    </Badge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      {/* by client */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Outstanding by client</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {[...clients]
            .filter((c) => c.outstanding > 0)
            .sort((a, b) => b.outstanding - a.outstanding)
            .map((c) => {
              const maxO = Math.max(...clients.map((x) => x.outstanding));
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <span className="w-44 shrink-0 truncate text-sm text-ink">{c.name}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-bone-2">
                    <div
                      className={cn("h-full rounded-full", c.relationship === "at_risk" ? "bg-rust" : "bg-sienna")}
                      style={{ width: `${(c.outstanding / maxO) * 100}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right text-sm font-medium text-ink tnum">
                    {bdt(c.outstanding, { compact: true })}
                  </span>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </Page>
  );
}
