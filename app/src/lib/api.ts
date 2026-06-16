import { useQuery } from "@tanstack/react-query";
import {
  approvals,
  approvalsByProject,
  clients,
  decisions,
  decisionsByProject,
  deliverables,
  deliverablesByProject,
  employees,
  firm,
  invoices,
  invoicesByProject,
  milestones,
  milestonesByProject,
  opportunities,
  payments,
  projectById,
  projects,
  risks,
  risksByProject,
  tasks,
  tasksByProject,
} from "@/lib/mock/data";
import { dataSources } from "@/lib/mock/integrations";
import { aiReports, alerts } from "@/lib/mock/insights";
import { activityLog, contacts, meetings, reviewQueue, schedules, targets } from "@/lib/mock/ops";
import type { Confidence } from "@/lib/types";

// ---- swappable transport ---------------------------------------------------
// Every read goes through `resolve()`. Swap this for fetch() to a real backend
// later without touching components or hooks.
const LATENCY = 280;
function resolve<T>(data: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(structuredCloneSafe(data)), LATENCY));
}
function structuredCloneSafe<T>(d: T): T {
  return JSON.parse(JSON.stringify(d));
}

// ---- derived analytics -----------------------------------------------------
export function computePortfolio() {
  const active = projects.filter((p) => p.stage !== "closed");
  const totalContract = sum(active.map((p) => p.feeContract));
  const totalBilled = sum(active.map((p) => p.feeBilled));
  const totalCollected = sum(active.map((p) => p.feeCollected));
  const totalWip = sum(active.map((p) => p.feeWip));
  const overdue = invoices.filter((i) => i.status === "overdue");
  const overdueTotal = sum(overdue.map((i) => i.netReceivable - i.amountReceived));
  const unbilled = totalContract - totalBilled;
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0;
  const atRisk = active.filter((p) => p.health === "at_risk" || p.health === "critical");
  const avgHealth = avg(active.map((p) => p.healthScore.value ?? 0));
  const avgCompleteness = avg(active.map((p) => p.completeness));
  const pipelineWeighted = sum(
    opportunities
      .filter((o) => o.stage !== "won" && o.stage !== "lost")
      .map((o) => (o.estFee * o.probability) / 100),
  );
  return {
    activeProjects: active.length,
    totalContract,
    totalBilled,
    totalCollected,
    totalWip,
    unbilled,
    overdueTotal,
    overdueCount: overdue.length,
    collectionRate,
    atRiskCount: atRisk.length,
    avgHealth,
    avgCompleteness,
    pipelineWeighted,
    openApprovals: approvals.filter((a) => a.status !== "approved" && a.status !== "rejected").length,
    overdueApprovals: approvals.filter(
      (a) => a.statutoryDays !== null && a.daysInStage > (a.statutoryDays ?? 0) && a.status !== "approved",
    ).length,
  };
}

export function agingBuckets() {
  const open = invoices.filter((i) => i.status !== "paid" && i.status !== "draft");
  const bucket = (lo: number, hi: number) =>
    sum(
      open
        .filter((i) => i.agingDays >= lo && i.agingDays < hi)
        .map((i) => i.netReceivable - i.amountReceived),
    );
  return [
    { label: "Current", value: bucket(-9999, 1), tone: "sage" },
    { label: "1–30", value: bucket(1, 31), tone: "ochre" },
    { label: "31–60", value: bucket(31, 61), tone: "ochre" },
    { label: "61–90", value: bucket(61, 91), tone: "sienna" },
    { label: "90+", value: bucket(91, 9999), tone: "rust" },
  ];
}

export function pipelineByStage() {
  const stages: { key: string; label: string }[] = [
    { key: "lead", label: "Lead" },
    { key: "qualified", label: "Qualified" },
    { key: "proposal", label: "Proposal" },
    { key: "negotiation", label: "Negotiation" },
    { key: "won", label: "Won" },
  ];
  return stages.map((s) => {
    const items = opportunities.filter((o) => o.stage === s.key);
    return { ...s, count: items.length, value: sum(items.map((o) => o.estFee)) };
  });
}

export function utilizationSummary() {
  const billable = employees.filter((e) => e.utilization.value !== null);
  const coverage = avg(employees.map((e) => e.timesheetCompliance));
  const meanUtil = avg(billable.map((e) => e.utilization.value ?? 0));
  return {
    meanUtil,
    coverage,
    overloaded: employees.filter((e) => (e.utilization.value ?? 0) > 90).length,
    underloaded: employees.filter((e) => e.utilization.value !== null && (e.utilization.value ?? 0) < 70).length,
    unknown: employees.filter((e) => e.utilization.value === null).length,
    confidence: (coverage > 80 ? "high" : coverage > 60 ? "medium" : "low") as Confidence,
  };
}

const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
const avg = (a: number[]) => (a.length ? sum(a) / a.length : 0);

// ---- hooks -----------------------------------------------------------------
export const useProjects = () => useQuery({ queryKey: ["projects"], queryFn: () => resolve(projects) });
export const useProject = (id?: string) =>
  useQuery({ queryKey: ["project", id], queryFn: () => resolve(projectById(id!) ?? null), enabled: !!id });
export const useEmployees = () => useQuery({ queryKey: ["employees"], queryFn: () => resolve(employees) });
export const useClients = () => useQuery({ queryKey: ["clients"], queryFn: () => resolve(clients) });
export const useInvoices = () => useQuery({ queryKey: ["invoices"], queryFn: () => resolve(invoices) });
export const usePayments = () => useQuery({ queryKey: ["payments"], queryFn: () => resolve(payments) });
export const useApprovals = () => useQuery({ queryKey: ["approvals"], queryFn: () => resolve(approvals) });
export const useMilestones = () => useQuery({ queryKey: ["milestones"], queryFn: () => resolve(milestones) });
export const useTasks = () => useQuery({ queryKey: ["tasks"], queryFn: () => resolve(tasks) });
export const useDeliverables = () => useQuery({ queryKey: ["deliverables"], queryFn: () => resolve(deliverables) });
export const useRisks = () => useQuery({ queryKey: ["risks"], queryFn: () => resolve(risks) });
export const useDecisions = () => useQuery({ queryKey: ["decisions"], queryFn: () => resolve(decisions) });
export const useOpportunities = () => useQuery({ queryKey: ["opps"], queryFn: () => resolve(opportunities) });
export const useDataSources = () => useQuery({ queryKey: ["sources"], queryFn: () => resolve(dataSources) });
export const useAlerts = () => useQuery({ queryKey: ["alerts"], queryFn: () => resolve(alerts) });
export const useAIReports = () => useQuery({ queryKey: ["reports"], queryFn: () => resolve(aiReports) });
export const usePortfolio = () => useQuery({ queryKey: ["portfolio"], queryFn: () => resolve(computePortfolio()) });

export const useProjectBundle = (id?: string) =>
  useQuery({
    queryKey: ["bundle", id],
    enabled: !!id,
    queryFn: () =>
      resolve({
        project: projectById(id!) ?? null,
        approvals: approvalsByProject(id!),
        milestones: milestonesByProject(id!),
        tasks: tasksByProject(id!),
        deliverables: deliverablesByProject(id!),
        invoices: invoicesByProject(id!),
        risks: risksByProject(id!),
        decisions: decisionsByProject(id!),
      }),
  });

export const useContacts = () => useQuery({ queryKey: ["contacts"], queryFn: () => resolve(contacts) });
export const useMeetings = () => useQuery({ queryKey: ["meetings"], queryFn: () => resolve(meetings) });
export const useActivity = () => useQuery({ queryKey: ["activity"], queryFn: () => resolve(activityLog) });
export const useSchedules = () => useQuery({ queryKey: ["schedules"], queryFn: () => resolve(schedules) });
export const useTargets = () => useQuery({ queryKey: ["targets"], queryFn: () => resolve(targets) });
export const useReviewQueue = () => useQuery({ queryKey: ["review"], queryFn: () => resolve(reviewQueue) });

export { firm };
