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

const LATENCY = 240;
function resolve<T>(data: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(JSON.parse(JSON.stringify(data))), LATENCY));
}

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
  const overdueAmount = overdue.reduce((s, p) => s + (p.amount - p.receivedAmount), 0);
  const blocked = active.filter((p) => p.health === "at_risk" || p.phases.some((ph) => ph.status === "blocked"));
  const totalContract = active.reduce((s, p) => s + p.contractValue, 0);
  const received = payments.reduce((s, p) => s + p.receivedAmount, 0);
  const billable = payments.reduce((s, p) => s + p.amount, 0);
  return {
    activeCount: active.length,
    completedCount: projectsA.filter((p) => p.status === "archived").length,
    pendingApprovals: pending.length,
    overdueCount: overdue.length,
    overdueAmount,
    blockedCount: blocked.length,
    totalContract,
    received,
    billable,
    collectionRate: billable ? Math.round((received / billable) * 100) : 0,
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
export const useAiProjects = () => useQuery({ queryKey: ["ai-projects"], queryFn: () => resolve(projectsA) });
export const useAiProject = (id?: string) =>
  useQuery({ queryKey: ["ai-project", id], queryFn: () => resolve(projectById(id!) ?? null), enabled: !!id });
export const useAiMembers = () => useQuery({ queryKey: ["ai-members"], queryFn: () => resolve(members) });
export const useAiClients = () => useQuery({ queryKey: ["ai-clients"], queryFn: () => resolve(clientsA) });
export const useAiFiles = () => useQuery({ queryKey: ["ai-files"], queryFn: () => resolve(files) });
export const useAiApprovals = () => useQuery({ queryKey: ["ai-approvals"], queryFn: () => resolve(approvalsA) });
export const useAiSubmissions = () => useQuery({ queryKey: ["ai-subs"], queryFn: () => resolve(submissions) });
export const useAiPayments = () => useQuery({ queryKey: ["ai-payments"], queryFn: () => resolve(payments) });
export const useAiDecisions = () => useQuery({ queryKey: ["ai-decisions"], queryFn: () => resolve(decisionsA) });
export const useAiActivity = () => useQuery({ queryKey: ["ai-activity"], queryFn: () => resolve(activityA) });
export const useAiOverview = () => useQuery({ queryKey: ["ai-overview"], queryFn: () => resolve(managementOverview()) });

// risk intelligence
export const useAiRisks = () => useQuery({ queryKey: ["ai-risks"], queryFn: () => resolve(predictedRisks) });
export const useAiStageRisk = () => useQuery({ queryKey: ["ai-stagerisk"], queryFn: () => resolve(stageRisk) });
export const useAiInsights = () => useQuery({ queryKey: ["ai-insights"], queryFn: () => resolve(riskInsights) });

// finance
export const useAiFinance = () => useQuery({ queryKey: ["ai-finance"], queryFn: () => resolve(financeOverview()) });
export const useAiExpenses = () => useQuery({ queryKey: ["ai-expenses"], queryFn: () => resolve(expenses) });
export const useAiFlow = () => useQuery({ queryKey: ["ai-flow"], queryFn: () => resolve(monthlyFlow) });
export const useAiProfitability = () => useQuery({ queryKey: ["ai-profit"], queryFn: () => resolve(profitabilityByProject()) });
export const useAiExpenseByCategory = () => useQuery({ queryKey: ["ai-expcat"], queryFn: () => resolve(expenseByCategory()) });

export { PHASE_TEMPLATE };
