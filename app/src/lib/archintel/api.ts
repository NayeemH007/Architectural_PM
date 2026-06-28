import { useQuery } from "@tanstack/react-query";
import {
  activeProjects,
  activityA,
  approvalsA,
  clientsA,
  decisionsA,
  files,
  members,
  payments,
  projectById,
  projectsA,
  submissions,
  PHASE_TEMPLATE,
  type ProjectA,
} from "./data";
import { predictedRisks, riskInsights, stageRisk } from "./intelligence";
import { expenses, financeOverview, monthlyFlow, profitabilityByProject, expenseByCategory } from "./finance";
import type { Metric, Provenance } from "@/lib/types";
// Single clock authority (CONTEXT.md ⑤ / clock as_of). Injected — see lib/clock.ts.
import { AS_OF } from "@/lib/clock";

const LATENCY = 240;
function resolve<T>(data: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(JSON.parse(JSON.stringify(data))), LATENCY));
}

// ---- Slice 2b: flag-gated data source for the management overview (⑦ seam swap) ----
// Default OFF keeps `vite build` / deploy unaffected: with the flag off the dev/build
// path never fetches and Slice-2a behaviour is byte-identical (mock seam, unchanged).
const USE_BACKEND_AI = import.meta.env.VITE_USE_BACKEND_AI === "true";
const BACKEND_AI_URL =
  (import.meta.env.VITE_BACKEND_AI_URL as string | undefined) ?? "http://localhost:8787";
// Locked demo principal (finance-eligible so the overdue card stays visible).
// Per-user finance gating is deferred to the Auth & Finance Gating manager (Step 2).
const FIRM_A = "00000000-0000-0000-0000-00000000aaaa";

/**
 * fetchOverview — the ⑦ seam wrapper for the management overview.
 *   OFF (default) → resolve(managementOverview()), the Slice-2a mock Metric (unchanged).
 *   ON            → fetch the pglite backend overview (same Metric shape); mock fallback
 *                   on any failure so the card never blanks.
 * Returns the SAME overview shape either way (overdueAmount is a Metric).
 */
export async function fetchOverview() {
  if (!USE_BACKEND_AI) return resolve(managementOverview());
  try {
    const res = await fetch(`${BACKEND_AI_URL}/api/v1/overview`, {
      headers: { "X-Company-Id": FIRM_A, "X-User-Role": "founder" },
    });
    if (!res.ok) throw new Error(`backend ${res.status}`);
    return await res.json();
  } catch {
    return resolve(managementOverview());
  }
}

// ---- S3 derived endpoints: same flag-gated seam as fetchOverview ----
// Default OFF keeps `vite build` / deploy unaffected (mock seam, byte-identical
// Slice-2a/3/4 behaviour). ON → fetch the pglite backend (same shape); mock
// fallback on ANY failure so a card never blanks. Demo principal = finance-
// eligible founder so the money cards stay visible.
const FINANCE_HEADERS = { "X-Company-Id": FIRM_A, "X-User-Role": "founder" };
async function fetchBackend<T>(path: string, fallback: () => T): Promise<T> {
  if (!USE_BACKEND_AI) return resolve(fallback());
  try {
    const res = await fetch(`${BACKEND_AI_URL}${path}`, { headers: FINANCE_HEADERS });
    if (!res.ok) throw new Error(`backend ${res.status}`);
    return (await res.json()) as T;
  } catch {
    return resolve(fallback());
  }
}

export const fetchFinance = () => fetchBackend("/api/v1/finance", financeOverview);
export const fetchProfitability = () => fetchBackend("/api/v1/profitability", profitabilityByProject);
export const fetchProjects = () => fetchBackend("/api/v1/projects", () => projectsA);
export const fetchClients = () => fetchBackend("/api/v1/clients", () => clientsA);
export const fetchPayments = () => fetchBackend("/api/v1/payments", () => payments);

// ---- derived ----
export function projectProgress(p: ProjectA): number {
  const totalItems = p.phases.reduce((s, ph) => s + ph.done.length, 0);
  const doneItems = p.phases.reduce((s, ph) => s + ph.done.filter(Boolean).length, 0);
  return totalItems ? Math.round((doneItems / totalItems) * 100) : 0;
}

export function phaseProgress(p: ProjectA, index: number): number {
  const ph = p.phases.find((x) => x.index === index);
  if (!ph || ph.done.length === 0) return 0;
  return Math.round((ph.done.filter(Boolean).length / ph.done.length) * 100);
}

export function managementOverview() {
  const active = projectsA.filter((p) => p.status === "active");
  const pending = approvalsA.filter((a) => a.status === "pending");
  const overdue = payments.filter((p) => p.status === "overdue");
  // One Provenance per overdue milestone — REAL refs into TallyPrime (drillable).
  const overdueSources: Provenance[] = overdue.map((pm) => ({
    sourceId: "tally",
    sourceName: "TallyPrime",
    recordRef: `tally:${pm.id}`, // e.g. "tally:pm10" — contains the real milestone id
    observedAt: pm.dueDate, // when the unpaid milestone became true
  }));
  const grossOverdue = overdue.reduce((s, p) => s + (p.amount - p.receivedAmount), 0);
  // overdueAmount is a cited, low-confidence Metric (promise ① + ⑤ tax DEFERRED → gross).
  // value MUST equal Σ over the milestones the sources cite (VALUE = Σ LINEAGE).
  const overdueAmount: Metric = {
    value: grossOverdue,
    unit: "bdt",
    label: `Overdue payments (gross) — ${overdue.length} milestone${overdue.length === 1 ? "" : "s"}`,
    confidence: "low", // ⑤ tax DEFERRED → gross figure is low-trust
    completeness: 100, // gross-complete at the milestone grain (not net)
    asOf: AS_OF,
    formula: "Σ (gross_amount − received_amount) over status='overdue' milestones",
    note: "Gross overdue receivable — VAT/VDS/AIT withholding not modeled.",
    sources: overdueSources,
  };
  const blocked = active.filter((p) => p.health === "at_risk" || p.phases.some((ph) => ph.status === "blocked"));
  const totalContract = active.reduce((s, p) => s + p.contractValue, 0);
  const received = payments.reduce((s, p) => s + p.receivedAmount, 0);
  const billable = payments.reduce((s, p) => s + p.amount, 0);
  // B2: pendingApprovals — a complete, fully-observed count of internal approval
  // records → cited Metric, confidence:'high'. One Provenance per pending approval
  // (recordRef contains the real approval id → VALUE = Σ lineage drillable).
  const pendingSources: Provenance[] = pending.map((a) => ({
    sourceId: "approvals",
    sourceName: "ArchIntel · Approvals",
    recordRef: `approval:${a.id}`, // e.g. "approval:ap1"
    observedAt: a.submittedDate,
  }));
  const pendingApprovals: Metric = {
    value: pending.length,
    unit: "count",
    label: "Pending approvals",
    confidence: "high", // a direct, complete count of internal records — no estimation
    completeness: 100,
    asOf: AS_OF,
    formula: "count(approvals where status='pending')",
    sources: pendingSources,
  };
  // B1: collectionRate — gross low-confidence Metric (⑤ tax DEFERRED → receipts are
  // face value, withholding not modeled). value === Σreceived ÷ Σbillable × 100 over
  // payments. One Provenance per contributing payment milestone (drillable lineage).
  const collectionSources: Provenance[] = payments.map((pm) => ({
    sourceId: "tally",
    sourceName: "TallyPrime",
    recordRef: `tally:${pm.id}`,
    observedAt: pm.dueDate,
  }));
  const collectionRate: Metric = {
    value: billable ? Math.round((received / billable) * 100) : 0,
    unit: "pct",
    label: "Collection rate (gross)",
    confidence: "low", // ⑤ gross — withholding not modeled
    completeness: 100,
    asOf: AS_OF,
    formula: "Σ received ÷ Σ billable (gross)",
    note: "Gross collection — VAT/VDS/AIT withholding not modeled.",
    sources: collectionSources,
  };
  return {
    activeCount: active.length,
    completedCount: projectsA.filter((p) => p.status === "archived").length,
    pendingApprovals,
    overdueCount: overdue.length,
    overdueAmount,
    blockedCount: blocked.length,
    totalContract,
    received,
    billable,
    collectionRate,
  };
}

// member workload — active projects led/assigned
export function memberWorkload() {
  return members.map((m) => {
    const led = activeProjects.filter((p) => p.leadId === m.id).length;
    const assigned = activeProjects.filter((p) => p.teamIds.includes(m.id)).length;
    return { member: m, led, assigned };
  });
}

// ---- hooks ----
export const useAiProjects = () => useQuery({ queryKey: ["ai-projects"], queryFn: () => fetchProjects() });
export const useAiProject = (id?: string) =>
  useQuery({ queryKey: ["ai-project", id], queryFn: () => resolve(projectById(id!) ?? null), enabled: !!id });
export const useAiMembers = () => useQuery({ queryKey: ["ai-members"], queryFn: () => resolve(members) });
export const useAiClients = () => useQuery({ queryKey: ["ai-clients"], queryFn: () => fetchClients() });
export const useAiFiles = () => useQuery({ queryKey: ["ai-files"], queryFn: () => resolve(files) });
export const useAiApprovals = () => useQuery({ queryKey: ["ai-approvals"], queryFn: () => resolve(approvalsA) });
export const useAiSubmissions = () => useQuery({ queryKey: ["ai-subs"], queryFn: () => resolve(submissions) });
export const useAiPayments = () => useQuery({ queryKey: ["ai-payments"], queryFn: () => fetchPayments() });
export const useAiDecisions = () => useQuery({ queryKey: ["ai-decisions"], queryFn: () => resolve(decisionsA) });
export const useAiActivity = () => useQuery({ queryKey: ["ai-activity"], queryFn: () => resolve(activityA) });
export const useAiOverview = () => useQuery({ queryKey: ["ai-overview"], queryFn: () => fetchOverview() });

// risk intelligence
export const useAiRisks = () => useQuery({ queryKey: ["ai-risks"], queryFn: () => resolve(predictedRisks) });
export const useAiStageRisk = () => useQuery({ queryKey: ["ai-stagerisk"], queryFn: () => resolve(stageRisk) });
export const useAiInsights = () => useQuery({ queryKey: ["ai-insights"], queryFn: () => resolve(riskInsights) });

// finance
export const useAiFinance = () => useQuery({ queryKey: ["ai-finance"], queryFn: () => fetchFinance() });
export const useAiExpenses = () => useQuery({ queryKey: ["ai-expenses"], queryFn: () => resolve(expenses) });
export const useAiFlow = () => useQuery({ queryKey: ["ai-flow"], queryFn: () => resolve(monthlyFlow) });
export const useAiProfitability = () => useQuery({ queryKey: ["ai-profit"], queryFn: () => fetchProfitability() });
export const useAiExpenseByCategory = () => useQuery({ queryKey: ["ai-expcat"], queryFn: () => resolve(expenseByCategory()) });

export { PHASE_TEMPLATE };
