// ============================================================
// ArchIntel Finance — firm-level financial flow & control.
// Income (received payments) vs studio expenses, cash position,
// receivables, and per-project profitability. Mock, frontend-only.
// ============================================================
import { payments, projectsA, projectById } from "./data";
import type { Metric, Provenance } from "@/lib/types";

// Locked clock oracle (CONTEXT.md ⑤ / clock as_of). Injected — never read the wall clock.
const AS_OF = "2026-06-22T00:00:00.000Z";

export type ExpenseCategory = "salaries" | "rent" | "software" | "utilities" | "vendor" | "marketing" | "misc";

export interface Expense {
  id: string;
  category: ExpenseCategory;
  label: string;
  amount: number;
  month: string; // YYYY-MM
  projectId: string | null; // project-direct cost, else studio overhead
}

export const expenses: Expense[] = [
  // recurring studio overhead (June)
  { id: "ex1", category: "salaries", label: "Studio salaries (6 staff)", amount: 1_050_000, month: "2026-06", projectId: null },
  { id: "ex2", category: "rent", label: "Studio rent — Banani", amount: 120_000, month: "2026-06", projectId: null },
  { id: "ex3", category: "software", label: "Software (Adobe, AutoCAD, D5, SketchUp)", amount: 65_000, month: "2026-06", projectId: null },
  { id: "ex4", category: "utilities", label: "Utilities & internet", amount: 28_000, month: "2026-06", projectId: null },
  { id: "ex5", category: "marketing", label: "Marketing & socials", amount: 40_000, month: "2026-06", projectId: null },
  // project-direct costs (samples)
  { id: "ex6", category: "vendor", label: "3D render outsourcing — Gulshan", amount: 45_000, month: "2026-06", projectId: "a1" },
  { id: "ex7", category: "misc", label: "Site visits & printing — MediCare", amount: 32_000, month: "2026-06", projectId: "a3" },
  { id: "ex8", category: "vendor", label: "Sample boards — Tejgaon", amount: 22_000, month: "2026-05", projectId: "a5" },
  { id: "ex9", category: "misc", label: "Presentation printing — Banani", amount: 14_000, month: "2026-05", projectId: "a2" },
];

// 6-month income vs expense flow.
// D2: this is hand-authored illustrative data — NOT reconcilable to the live
// `payments` milestone lineage. It renders as a clearly-marked sample chart, and
// any KPI card derived from it (ytd*/monthNet/monthIncome) inherits the stamp below.
export const monthlyFlow = [
  { m: "Jan", income: 1_500_000, expense: 1_180_000 },
  { m: "Feb", income: 980_000, expense: 1_210_000 },
  { m: "Mar", income: 1_240_000, expense: 1_260_000 },
  { m: "Apr", income: 2_740_000, expense: 1_300_000 },
  { m: "May", income: 1_360_000, expense: 1_340_000 },
  { m: "Jun", income: 600_000, expense: 1_373_000 },
];

// Honest provenance stamp for the monthlyFlow series + everything derived from it.
// Per D2 we do NOT claim a false manual-capture source — it is illustrative sample
// data not yet reconciled to TallyPrime. confidence:'low' + an honest note.
export const monthlyFlowMeta = {
  confidence: "low" as const,
  note: "Illustrative — sample monthly totals, not yet reconciled to TallyPrime.",
  sources: [
    {
      sourceId: "sample",
      sourceName: "Illustrative · monthly flow",
      recordRef: "sample:monthly-flow",
      observedAt: AS_OF,
    },
  ] as Provenance[],
};

// modelled per-project direct cost (design labour + renders + printing + site)
const PROJECT_COST: Record<string, number> = {
  a1: 980_000, a2: 720_000, a3: 1_180_000, a4: 1_640_000, a5: 1_150_000, a6: 560_000, a7: 760_000, a8: 470_000,
};

// One Provenance per payment milestone (gross lineage into TallyPrime, drillable).
const PAYMENT_SOURCES: Provenance[] = payments.map((pm) => ({
  sourceId: "tally",
  sourceName: "TallyPrime",
  recordRef: `tally:${pm.id}`,
  observedAt: pm.dueDate,
}));
const GROSS_NOTE = "Gross figure — VAT/VDS/AIT withholding not modeled.";

// B4: each headline finance figure is a cited, gross low-confidence Metric (⑤).
// value === the recomputed Σ/ratio over `payments` (VALUE = Σ LINEAGE). The
// ytd*/month* figures derive from `monthlyFlow` → inherit the illustrative stamp.
export function financeOverview() {
  const incomeVal = payments.reduce((s, p) => s + p.receivedAmount, 0);
  const billableVal = payments.reduce((s, p) => s + p.amount, 0);
  const receivablesVal = payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.amount - p.receivedAmount), 0);
  const overdueVal = payments
    .filter((p) => p.status === "overdue")
    .reduce((s, p) => s + (p.amount - p.receivedAmount), 0);
  const monthExpenseVal = expenses.filter((e) => e.month === "2026-06").reduce((s, e) => s + e.amount, 0);
  const monthIncomeVal = monthlyFlow[monthlyFlow.length - 1].income;
  const ytdIncomeVal = monthlyFlow.reduce((s, r) => s + r.income, 0);
  const ytdExpenseVal = monthlyFlow.reduce((s, r) => s + r.expense, 0);
  const collectionVal = billableVal ? Math.round((incomeVal / billableVal) * 100) : 0;

  const grossBdt = (value: number, label: string, formula: string): Metric => ({
    value, unit: "bdt", label, confidence: "low", completeness: 100, asOf: AS_OF,
    formula, note: GROSS_NOTE, sources: PAYMENT_SOURCES,
  });
  // illustrative (monthlyFlow-derived) Metric — carries the D2 stamp, not gross note.
  const illustrativeBdt = (value: number, label: string): Metric => ({
    value, unit: "bdt", label, confidence: monthlyFlowMeta.confidence, completeness: 60,
    asOf: AS_OF, note: monthlyFlowMeta.note, sources: monthlyFlowMeta.sources,
  });

  const income = grossBdt(incomeVal, "Income received (gross)", "Σ received_amount over payments");
  const billable = grossBdt(billableVal, "Billable (gross)", "Σ amount over payments");
  const receivables = grossBdt(receivablesVal, "Receivables outstanding (gross)", "Σ (amount − received) where status≠'paid'");
  const overdue = grossBdt(overdueVal, "Overdue (gross)", "Σ (amount − received) where status='overdue'");
  const collectionRate: Metric = {
    value: collectionVal, unit: "pct", label: "Collection rate (gross)",
    confidence: "low", completeness: 100, asOf: AS_OF,
    formula: "Σ income ÷ Σ billable (gross)", note: "Gross collection — VAT/VDS/AIT withholding not modeled.",
    sources: PAYMENT_SOURCES,
  };
  const monthIncome = illustrativeBdt(monthIncomeVal, "This month income (illustrative)");
  const monthExpense = illustrativeBdt(monthExpenseVal, "This month expense");
  const monthNet = illustrativeBdt(monthIncomeVal - monthExpenseVal, "This month net (illustrative)");
  const ytdIncome = illustrativeBdt(ytdIncomeVal, "YTD income (illustrative)");
  const ytdExpense = illustrativeBdt(ytdExpenseVal, "YTD expense (illustrative)");
  const ytdNet = illustrativeBdt(ytdIncomeVal - ytdExpenseVal, "Net YTD (illustrative)");

  return {
    income, billable, receivables, overdue,
    monthIncome, monthExpense, monthNet,
    ytdIncome, ytdExpense, ytdNet,
    collectionRate,
  };
}

// B5 (④ RETIRED): margin is a fee-only, low-confidence Metric — NEVER a bare %.
// value === round((contract − modeled cost) ÷ contract × 100) per row. Cites the
// contract (real) + the modeled PROJECT_COST input (declared, not measured).
export function profitabilityByProject() {
  return projectsA
    .filter((p) => p.status === "active" || p.status === "archived")
    .map((p) => {
      const received = payments.filter((x) => x.projectId === p.id).reduce((s, x) => s + x.receivedAmount, 0);
      const cost = PROJECT_COST[p.id] ?? 0;
      const marginVal = p.contractValue ? Math.round(((p.contractValue - cost) / p.contractValue) * 100) : 0;
      const margin: Metric = {
        value: marginVal,
        unit: "pct",
        label: `Margin (fee-only) — ${p.code}`,
        confidence: "low", // ④ fee-only, no labour cost; cost is a modeled input
        completeness: 60, // < 100 — labour cost absent, cost modeled not measured
        asOf: AS_OF,
        formula: "(contract − modeled project cost) ÷ contract",
        note: "Fee-only margin — no labour cost; PROJECT_COST is a modeled input, not measured.",
        sources: [
          { sourceId: "projects", sourceName: "ArchIntel · Projects", recordRef: `project:${p.id}`, observedAt: AS_OF },
          { sourceId: "cost-model", sourceName: "ArchIntel · Cost model (modeled input)", recordRef: `model:PROJECT_COST:${p.id}`, observedAt: AS_OF },
        ],
      };
      return { project: p, contract: p.contractValue, received, cost, profit: p.contractValue - cost, margin };
    });
}

export const expenseByCategory = () => {
  const m = new Map<string, number>();
  for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
  return [...m.entries()].map(([category, amount]) => ({ category, amount }));
};

export { projectById };
