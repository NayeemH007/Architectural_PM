import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, AlertTriangle, Receipt, Building2 } from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/states";
import { PaymentStatusBadge, phaseShort } from "@/components/archintel/badges";
import { AreaTrend, BarSeries, Donut, CHART } from "@/components/charts";
import {
  useAiFinance,
  useAiFlow,
  useAiPayments,
  useAiExpenses,
  useAiProfitability,
  useAiExpenseByCategory,
} from "@/lib/archintel/api";
import { projectById } from "@/lib/archintel/data";
import type { PaymentMilestone } from "@/lib/archintel/data";
import { bdt, shortDate, daysFromNow } from "@/lib/format";
import { cn } from "@/lib/cn";

// expense category → label + donut colour
const CAT_META: Record<string, { label: string; color: string }> = {
  salaries: { label: "Salaries", color: CHART.blue },
  rent: { label: "Rent", color: CHART.sienna },
  software: { label: "Software", color: CHART.sage },
  utilities: { label: "Utilities", color: CHART.ochre },
  vendor: { label: "Vendor / outsourcing", color: CHART.slate },
  marketing: { label: "Marketing", color: CHART.taupe },
  misc: { label: "Misc", color: CHART.ink },
};
const catLabel = (c: string) => CAT_META[c]?.label ?? c;
const catColor = (c: string) => CAT_META[c]?.color ?? CHART.taupe;

const monthLabel = (m: string) => {
  const [, mm] = m.split("-");
  const names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names[Number(mm)] ?? m;
};

export default function Finance() {
  const { data: fin, isLoading: loadingFin } = useAiFinance();
  const { data: flow = [], isLoading: loadingFlow } = useAiFlow();
  const { data: payments = [], isLoading: loadingPay } = useAiPayments();
  const { data: expenses = [], isLoading: loadingExp } = useAiExpenses();
  const { data: profit = [], isLoading: loadingProf } = useAiProfitability();
  const { data: byCat = [], isLoading: loadingCat } = useAiExpenseByCategory();

  return (
    <Page>
      <PageHeader
        kicker="SPACE ESSE · Finance"
        title="Firm finance & control"
        description="Cash flow, receivables tracked against the four-phase plan, studio expenses, and per-project profitability."
      />

      {/* ---- KPI row ---- */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loadingFin || !fin ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              kicker="Income received"
              value={bdt(fin.income, { compact: true })}
              footnote={
                <span className="text-xs text-ink-ghost">
                  of {bdt(fin.billable, { compact: true })} billed
                </span>
              }
            />
            <KpiCard
              kicker="Receivables outstanding"
              value={bdt(fin.receivables, { compact: true })}
              footnote={
                <span className="text-xs text-ink-ghost">across active plans</span>
              }
            />
            <KpiCard
              kicker="Overdue"
              value={<span className="text-rust">{bdt(fin.overdue, { compact: true })}</span>}
              footnote={
                <span className="text-xs text-rust">
                  {payments.filter((p) => p.status === "overdue").length} milestone
                  {payments.filter((p) => p.status === "overdue").length === 1 ? "" : "s"}
                </span>
              }
            />
            <KpiCard
              kicker="Collection rate"
              value={`${fin.collectionRate}%`}
              footnote={
                <span className="text-xs text-ink-ghost">received ÷ billed</span>
              }
            />
          </>
        )}
      </div>

      {/* ---- Tabs ---- */}
      <Tabs defaultValue="overview" className="mt-7">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="receivables">Receivables</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
        </TabsList>

        {/* ============ OVERVIEW ============ */}
        <TabsContent value="overview">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <div>
                  <CardKicker>Last 6 months</CardKicker>
                  <CardTitle>Income vs expense</CardTitle>
                </div>
                <div className="hidden items-center gap-4 sm:flex">
                  <span className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.sage }} />
                    Income
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHART.sienna }} />
                    Expense
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                {loadingFlow ? (
                  <Skeleton className="h-60 w-full" />
                ) : (
                  <AreaTrend
                    data={flow}
                    xKey="m"
                    height={260}
                    currency
                    series={[
                      { key: "income", color: CHART.sage, label: "Income" },
                      { key: "expense", color: CHART.sienna, label: "Expense" },
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col gap-5">
              {/* cash summary */}
              <Card drafting>
                <CardHeader>
                  <div>
                    <CardKicker>Year to date</CardKicker>
                    <CardTitle>Cash position</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingFin || !fin ? (
                    <Skeleton className="h-28 w-full" />
                  ) : (
                    <div className="space-y-3">
                      <CashRow
                        icon={<TrendingUp className="h-4 w-4 text-sage" />}
                        label="YTD income"
                        value={bdt(fin.ytdIncome, { compact: true })}
                      />
                      <CashRow
                        icon={<TrendingDown className="h-4 w-4 text-sienna" />}
                        label="YTD expense"
                        value={bdt(fin.ytdExpense, { compact: true })}
                      />
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink">Net YTD</span>
                        <span
                          className={cn(
                            "font-display text-xl tnum",
                            fin.ytdNet >= 0 ? "text-sage" : "text-rust",
                          )}
                        >
                          {bdt(fin.ytdNet, { compact: true })}
                        </span>
                      </div>
                      <p className="text-xs text-ink-ghost">
                        This month net{" "}
                        <span className={fin.monthNet >= 0 ? "text-sage tnum" : "text-rust tnum"}>
                          {bdt(fin.monthNet, { compact: true })}
                        </span>{" "}
                        on {bdt(fin.monthIncome, { compact: true })} in.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* receivables breakdown */}
              <Card>
                <CardHeader>
                  <div>
                    <CardKicker>Outstanding</CardKicker>
                    <CardTitle>Receivables breakdown</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingFin || !fin ? (
                    <Skeleton className="h-24 w-full" />
                  ) : (
                    <div className="space-y-3">
                      <BreakdownBar
                        label="Overdue"
                        amount={fin.overdue}
                        total={fin.receivables || 1}
                        tone="bg-rust"
                      />
                      <BreakdownBar
                        label="Not yet due"
                        amount={Math.max(fin.receivables - fin.overdue, 0)}
                        total={fin.receivables || 1}
                        tone="bg-blue"
                      />
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-ink">Total outstanding</span>
                        <span className="font-display text-lg text-ink tnum">
                          {bdt(fin.receivables, { compact: true })}
                        </span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* ============ RECEIVABLES ============ */}
        <TabsContent value="receivables">
          <ReceivablesTab payments={payments} loading={loadingPay} />
        </TabsContent>

        {/* ============ EXPENSES ============ */}
        <TabsContent value="expenses">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <div>
                  <CardKicker>Studio & project costs</CardKicker>
                  <CardTitle>Expenses</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {loadingExp ? (
                  <div className="space-y-2 p-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Expense</TH>
                        <TH>Category</TH>
                        <TH>Attribution</TH>
                        <TH>Month</TH>
                        <TH className="text-right">Amount</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {expenses.map((e) => {
                        const proj = e.projectId ? projectById(e.projectId) : null;
                        return (
                          <TR key={e.id}>
                            <TD>
                              <div className="font-medium text-ink">{e.label}</div>
                            </TD>
                            <TD>
                              <span className="inline-flex items-center gap-1.5 text-ink-soft">
                                <span
                                  className="h-2 w-2 rounded-full"
                                  style={{ background: catColor(e.category) }}
                                />
                                {catLabel(e.category)}
                              </span>
                            </TD>
                            <TD>
                              {proj ? (
                                <Link
                                  to={`/projects/${proj.id}`}
                                  className="text-blue hover:underline"
                                >
                                  {proj.name}
                                </Link>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 text-ink-faint">
                                  <Building2 className="h-3.5 w-3.5" />
                                  Studio overhead
                                </span>
                              )}
                            </TD>
                            <TD className="text-ink-soft">{monthLabel(e.month)}</TD>
                            <TD className="text-right font-medium text-ink tnum">
                              {bdt(e.amount, { compact: true })}
                            </TD>
                          </TR>
                        );
                      })}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div>
                  <CardKicker>This period</CardKicker>
                  <CardTitle>By category</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCat ? (
                  <Skeleton className="h-48 w-full" />
                ) : (
                  <>
                    <Donut
                      height={200}
                      centerLabel="Total"
                      centerValue={bdt(
                        byCat.reduce((s, c) => s + c.amount, 0),
                        { compact: true },
                      )}
                      data={byCat.map((c) => ({
                        name: catLabel(c.category),
                        value: c.amount,
                        color: catColor(c.category),
                      }))}
                    />
                    <div className="mt-4 space-y-1.5">
                      {[...byCat]
                        .sort((a, b) => b.amount - a.amount)
                        .map((c) => (
                          <div key={c.category} className="flex items-center justify-between text-sm">
                            <span className="inline-flex items-center gap-2 text-ink-soft">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ background: catColor(c.category) }}
                              />
                              {catLabel(c.category)}
                            </span>
                            <span className="text-ink tnum">{bdt(c.amount, { compact: true })}</span>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ============ PROFITABILITY ============ */}
        <TabsContent value="profitability">
          <div className="grid gap-5">
            <Card>
              <CardHeader>
                <div>
                  <CardKicker>Per project</CardKicker>
                  <CardTitle>Contract vs cost</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {loadingProf ? (
                  <Skeleton className="h-60 w-full" />
                ) : (
                  <BarSeries
                    data={profit.map((r) => ({
                      name: r.project.code,
                      contract: r.contract,
                      cost: r.cost,
                    }))}
                    xKey="name"
                    height={260}
                    currency
                    bars={[
                      { key: "contract", color: CHART.blue, label: "Contract" },
                      { key: "cost", color: CHART.sienna, label: "Cost" },
                    ]}
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                {loadingProf ? (
                  <div className="space-y-2 p-5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : (
                  <Table>
                    <THead>
                      <TR>
                        <TH>Project</TH>
                        <TH className="text-right">Contract</TH>
                        <TH className="text-right">Received</TH>
                        <TH className="text-right">Cost</TH>
                        <TH className="text-right">Profit</TH>
                        <TH className="text-right">Margin</TH>
                      </TR>
                    </THead>
                    <TBody>
                      {profit.map((r) => (
                        <TR key={r.project.id}>
                          <TD>
                            <Link
                              to={`/projects/${r.project.id}`}
                              className="font-medium text-ink hover:text-blue hover:underline"
                            >
                              {r.project.name}
                            </Link>
                            <div className="text-xs text-ink-faint">{r.project.code}</div>
                          </TD>
                          <TD className="text-right text-ink-soft tnum">
                            {bdt(r.contract, { compact: true })}
                          </TD>
                          <TD className="text-right text-ink-soft tnum">
                            {bdt(r.received, { compact: true })}
                          </TD>
                          <TD className="text-right text-ink-soft tnum">
                            {bdt(r.cost, { compact: true })}
                          </TD>
                          <TD
                            className={cn(
                              "text-right font-medium tnum",
                              r.profit >= 0 ? "text-sage" : "text-rust",
                            )}
                          >
                            {bdt(r.profit, { compact: true })}
                          </TD>
                          <TD className="text-right">
                            <span
                              className={cn(
                                "tnum font-medium",
                                r.margin >= 40
                                  ? "text-sage"
                                  : r.margin >= 20
                                    ? "text-ochre"
                                    : "text-rust",
                              )}
                            >
                              {r.margin}%
                            </span>
                          </TD>
                        </TR>
                      ))}
                    </TBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </Page>
  );
}

// -------------------- Receivables tab (phase payment tracker) --------------------
function ReceivablesTab({
  payments,
  loading,
}: {
  payments: PaymentMilestone[];
  loading: boolean;
}) {
  const [status, setStatus] = useState("all");
  const [project, setProject] = useState("all");

  const projectOptions = useMemo(() => {
    const ids = Array.from(new Set(payments.map((p) => p.projectId)));
    return ids
      .map((id) => projectById(id))
      .filter((p): p is NonNullable<ReturnType<typeof projectById>> => !!p)
      .map((p) => ({ value: p.id, label: `${p.code} · ${p.name}` }));
  }, [payments]);

  const filtered = useMemo(
    () =>
      payments.filter((p) => {
        if (status !== "all" && p.status !== status) return false;
        if (project !== "all" && p.projectId !== project) return false;
        return true;
      }),
    [payments, status, project],
  );

  const overdueCount = filtered.filter((p) => p.status === "overdue").length;
  const hasFilters = status !== "all" || project !== "all";

  if (loading) {
    return (
      <Card>
        <CardContent className="space-y-2 pt-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <Receipt className="h-4 w-4 text-blue" />
          Phase payment tracker
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1 text-rust">
              <AlertTriangle className="h-3.5 w-3.5" />
              {overdueCount} overdue
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="sm"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "all", label: "All status" },
              { value: "paid", label: "Paid" },
              { value: "partial", label: "Partial" },
              { value: "pending", label: "Pending" },
              { value: "overdue", label: "Overdue" },
            ]}
          />
          <Select
            size="sm"
            value={project}
            onValueChange={setProject}
            options={[{ value: "all", label: "All projects" }, ...projectOptions]}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No milestones match"
              description="Try widening the status or project filter."
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Milestone</TH>
                  <TH>Phase</TH>
                  <TH>Plan</TH>
                  <TH className="text-right">Amount</TH>
                  <TH className="text-right">Received</TH>
                  <TH>Due</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((p) => {
                  const proj = projectById(p.projectId);
                  const isOverdue = p.status === "overdue";
                  const days = daysFromNow(p.dueDate);
                  return (
                    <TR key={p.id} className={cn(isOverdue && "bg-rust-tint/40")}>
                      <TD>
                        <div className="font-medium text-ink">{p.label}</div>
                        {proj && (
                          <Link
                            to={`/projects/${proj.id}`}
                            className="text-xs text-blue hover:underline"
                          >
                            {proj.code} · {proj.name}
                          </Link>
                        )}
                      </TD>
                      <TD className="text-ink-soft">
                        {p.linkedPhase ? phaseShort(p.linkedPhase) : "—"}
                      </TD>
                      <TD className="capitalize text-ink-soft">{p.type}</TD>
                      <TD className="text-right text-ink tnum">{bdt(p.amount, { compact: true })}</TD>
                      <TD className="text-right tnum">
                        <span className={p.receivedAmount > 0 ? "text-sage" : "text-ink-faint"}>
                          {bdt(p.receivedAmount, { compact: true })}
                        </span>
                      </TD>
                      <TD>
                        <div className="text-ink-soft">{shortDate(p.dueDate)}</div>
                        {isOverdue && days !== null && (
                          <div className="text-xs text-rust tnum">{Math.abs(days)}d overdue</div>
                        )}
                      </TD>
                      <TD>
                        <PaymentStatusBadge status={p.status} />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-ink-ghost">
        Showing {filtered.length} of {payments.length} milestones
        {hasFilters && (
          <>
            {" · "}
            <button
              className="text-blue hover:underline"
              onClick={() => {
                setStatus("all");
                setProject("all");
              }}
            >
              clear filters
            </button>
          </>
        )}
      </p>
    </div>
  );
}

// -------------------- small presentational helpers --------------------
function CashRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-sm text-ink-soft">
        {icon}
        {label}
      </span>
      <span className="font-display text-base text-ink tnum">{value}</span>
    </div>
  );
}

function BreakdownBar({
  label,
  amount,
  total,
  tone,
}: {
  label: string;
  amount: number;
  total: number;
  tone: string;
}) {
  const w = Math.min(100, Math.round((amount / total) * 100));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-ink-soft">{label}</span>
        <span className="text-ink tnum">{bdt(amount, { compact: true })}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-bone-2">
        <div className={cn("h-full rounded-full transition-all", tone)} style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}
