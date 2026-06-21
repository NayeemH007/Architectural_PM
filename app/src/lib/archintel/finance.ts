// ============================================================
// ArchIntel Finance — firm-level financial flow & control.
// Income (received payments) vs studio expenses, cash position,
// receivables, and per-project profitability. Mock, frontend-only.
// ============================================================
import { payments, projectsA, projectById } from "./data";

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

// 6-month income vs expense flow
export const monthlyFlow = [
  { m: "Jan", income: 1_500_000, expense: 1_180_000 },
  { m: "Feb", income: 980_000, expense: 1_210_000 },
  { m: "Mar", income: 1_240_000, expense: 1_260_000 },
  { m: "Apr", income: 2_740_000, expense: 1_300_000 },
  { m: "May", income: 1_360_000, expense: 1_340_000 },
  { m: "Jun", income: 600_000, expense: 1_373_000 },
];

// modelled per-project direct cost (design labour + renders + printing + site)
const PROJECT_COST: Record<string, number> = {
  a1: 980_000, a2: 720_000, a3: 1_180_000, a4: 1_640_000, a5: 1_150_000, a6: 560_000, a7: 760_000, a8: 470_000,
};

export function financeOverview() {
  const income = payments.reduce((s, p) => s + p.receivedAmount, 0);
  const billable = payments.reduce((s, p) => s + p.amount, 0);
  const receivables = payments
    .filter((p) => p.status !== "paid")
    .reduce((s, p) => s + (p.amount - p.receivedAmount), 0);
  const overdue = payments
    .filter((p) => p.status === "overdue")
    .reduce((s, p) => s + (p.amount - p.receivedAmount), 0);
  const monthExpense = expenses.filter((e) => e.month === "2026-06").reduce((s, e) => s + e.amount, 0);
  const monthIncome = monthlyFlow[monthlyFlow.length - 1].income;
  const ytdIncome = monthlyFlow.reduce((s, r) => s + r.income, 0);
  const ytdExpense = monthlyFlow.reduce((s, r) => s + r.expense, 0);
  return {
    income, billable, receivables, overdue,
    monthIncome, monthExpense, monthNet: monthIncome - monthExpense,
    ytdIncome, ytdExpense, ytdNet: ytdIncome - ytdExpense,
    collectionRate: billable ? Math.round((income / billable) * 100) : 0,
  };
}

export function profitabilityByProject() {
  return projectsA
    .filter((p) => p.status === "active" || p.status === "archived")
    .map((p) => {
      const received = payments.filter((x) => x.projectId === p.id).reduce((s, x) => s + x.receivedAmount, 0);
      const cost = PROJECT_COST[p.id] ?? 0;
      const margin = p.contractValue ? Math.round(((p.contractValue - cost) / p.contractValue) * 100) : 0;
      return { project: p, contract: p.contractValue, received, cost, profit: p.contractValue - cost, margin };
    });
}

export const expenseByCategory = () => {
  const m = new Map<string, number>();
  for (const e of expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount);
  return [...m.entries()].map(([category, amount]) => ({ category, amount }));
};

export { projectById };
