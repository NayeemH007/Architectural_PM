import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Users } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { BarSeries, CHART, Donut } from "@/components/charts";
import { EmptyState } from "@/components/states";
import { bdt, num } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useClients } from "@/lib/api";
import type { Client } from "@/lib/types";

const CLIENT_TYPE: Record<Client["type"], { label: string; tone: "blue" | "sage" | "ochre" | "sienna" | "neutral" }> = {
  developer: { label: "Developer", tone: "blue" },
  private: { label: "Private", tone: "sage" },
  corporate: { label: "Corporate", tone: "ochre" },
  government: { label: "Government", tone: "sienna" },
  institution: { label: "Institution", tone: "neutral" },
};

const RELATIONSHIP: Record<Client["relationship"], { label: string; tone: "sage" | "neutral" | "rust"; color: string }> = {
  strong: { label: "Strong", tone: "sage", color: CHART.sage },
  neutral: { label: "Neutral", tone: "neutral", color: CHART.ochre },
  at_risk: { label: "At risk", tone: "rust", color: CHART.sienna },
};

/** Short label for chart axes — keeps long company names from crowding the bars. */
function shortName(name: string): string {
  return name.length > 16 ? `${name.slice(0, 15)}…` : name;
}

export default function Clients() {
  const { data: clients = [], isLoading } = useClients();
  const [query, setQuery] = useState("");

  const sorted = useMemo(
    () => [...clients].sort((a, b) => b.lifetimeFee - a.lifetimeFee),
    [clients],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        CLIENT_TYPE[c.type].label.toLowerCase().includes(q),
    );
  }, [sorted, query]);

  const totals = useMemo(() => {
    const lifetime = clients.reduce((s, c) => s + c.lifetimeFee, 0);
    const outstanding = clients.reduce((s, c) => s + c.outstanding, 0);
    const atRisk = clients.filter((c) => c.relationship === "at_risk").length;
    return { lifetime, outstanding, atRisk };
  }, [clients]);

  const revenueData = useMemo(
    () => sorted.map((c) => ({ label: shortName(c.name), lifetimeFee: c.lifetimeFee })),
    [sorted],
  );

  const outstandingData = useMemo(
    () =>
      sorted
        .filter((c) => c.outstanding > 0)
        .map((c) => ({ label: shortName(c.name), outstanding: c.outstanding })),
    [sorted],
  );

  const relationshipData = useMemo(() => {
    return (["strong", "neutral", "at_risk"] as const)
      .map((rel) => ({
        name: RELATIONSHIP[rel].label,
        value: clients.filter((c) => c.relationship === rel).length,
        color: RELATIONSHIP[rel].color,
      }))
      .filter((d) => d.value > 0);
  }, [clients]);

  return (
    <Page>
      <PageHeader
        kicker="Clients & Growth"
        title="Clients"
        description="Every account at a glance — lifetime fees earned, cash still outstanding, and the health of each relationship across the Space Esse book of work."
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard kicker="Clients" value={num(clients.length)} sparkColor={CHART.blue} />
            <KpiCard
              kicker="Lifetime fee"
              value={bdt(totals.lifetime, { compact: true })}
              sparkColor={CHART.sage}
            />
            <KpiCard
              kicker="Outstanding"
              value={bdt(totals.outstanding, { compact: true })}
              footnote={<span className="text-xs text-ink-faint">across {outstandingData.length} accounts</span>}
            />
            <KpiCard
              kicker="At-risk relationships"
              value={num(totals.atRisk)}
              footnote={
                <span className={cn("text-xs", totals.atRisk > 0 ? "text-rust" : "text-ink-faint")}>
                  {totals.atRisk > 0 ? "needs attention" : "all healthy"}
                </span>
              }
            />
          </>
        )}
      </div>

      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>Lifetime value</CardKicker>
              <CardTitle>Revenue by client</CardTitle>
            </div>
            <Badge tone="neutral" dot>BDT</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : (
              <BarSeries
                data={revenueData}
                xKey="label"
                currency
                bars={[{ key: "lifetimeFee", color: CHART.blue, label: "Lifetime fee" }]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardKicker>Portfolio</CardKicker>
              <CardTitle>Relationship health</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[200px] w-full" />
            ) : (
              <>
                <Donut
                  data={relationshipData}
                  centerValue={num(clients.length)}
                  centerLabel="clients"
                />
                <div className="mt-4 space-y-1.5">
                  {relationshipData.map((d) => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-ink-soft">
                        <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                        {d.name}
                      </span>
                      <span className="font-medium text-ink tnum">{num(d.value)}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outstanding by client */}
      <Card className="mt-6">
        <CardHeader>
          <div>
            <CardKicker>Receivables</CardKicker>
            <CardTitle>Outstanding by client</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-[210px] w-full" />
          ) : outstandingData.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-faint">No outstanding balances. Every account is current.</p>
          ) : (
            <BarSeries
              data={outstandingData}
              xKey="label"
              currency
              height={210}
              bars={[{ key: "outstanding", color: CHART.sienna, label: "Outstanding" }]}
            />
          )}
        </CardContent>
      </Card>

      {/* Client table */}
      <PageSection
        className="mt-8"
        title="All clients"
        description="Sorted by lifetime fee. Click a name to open the account."
        actions={
          <SearchInput
            placeholder="Search clients…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full sm:w-64"
          />
        }
      >
        <Card>
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={Users}
                title="No clients match"
                description="Try a different name, city or client type."
              />
            </div>
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Client</TH>
                  <TH>Type</TH>
                  <TH className="text-right">Active projects</TH>
                  <TH className="text-right">Lifetime fee</TH>
                  <TH className="text-right">Outstanding</TH>
                  <TH>Relationship</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((c) => {
                  const flagged = c.outstanding > 0 && c.relationship === "at_risk";
                  return (
                    <TR key={c.id} interactive>
                      <TD>
                        <Link
                          to={`/clients/${c.id}`}
                          className="group inline-flex items-center gap-1.5 font-medium text-ink hover:text-blue"
                        >
                          {c.name}
                          <ArrowUpRight className="h-3.5 w-3.5 text-ink-ghost opacity-0 transition-opacity group-hover:opacity-100" />
                          <span className="ml-1 text-xs font-normal text-ink-ghost">{c.city}</span>
                        </Link>
                      </TD>
                      <TD>
                        <Badge tone={CLIENT_TYPE[c.type].tone} size="sm">
                          {CLIENT_TYPE[c.type].label}
                        </Badge>
                      </TD>
                      <TD className="text-right tnum text-ink-soft">{num(c.activeProjects)}</TD>
                      <TD className="text-right tnum font-medium">{bdt(c.lifetimeFee, { compact: true })}</TD>
                      <TD className={cn("text-right tnum", flagged ? "font-medium text-rust" : "text-ink-soft")}>
                        {c.outstanding > 0 ? bdt(c.outstanding, { compact: true }) : "—"}
                      </TD>
                      <TD>
                        <Badge tone={RELATIONSHIP[c.relationship].tone} size="sm" dot>
                          {RELATIONSHIP[c.relationship].label}
                        </Badge>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </Card>
      </PageSection>
    </Page>
  );
}
