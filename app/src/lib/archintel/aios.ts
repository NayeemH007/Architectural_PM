// ============================================================
// ArchIntel AIOS — the Automation layer (Layer 4).
// A working FRONTEND SIMULATION of the operating layer: a Task
// Audit of the studio's recurring coordination work, the 3 AIOS
// KPIs, a daily brief, and the agent-action feed.
//
// Real execution (sending, drafting, capturing, learning) runs on
// the BACKEND (separate repo). This models the experience.
// ============================================================
import { useQuery } from "@tanstack/react-query";
import type { Confidence, Provenance } from "@/lib/types";
import { projectsA, members } from "@/lib/archintel/data";
// Single clock authority — inject, never read the wall clock (see lib/clock.ts).
import { AS_OF, AS_OF_DATE as TODAY } from "@/lib/clock";
export { TODAY };

const LATENCY = 220;
function resolve<T>(d: T): Promise<T> {
  return new Promise((r) => setTimeout(() => r(JSON.parse(JSON.stringify(d))), LATENCY));
}

// ---- Slice 3 (S3): flag-gated backend seam for the AIOS KPIs (⑦ seam swap) ----
// Default OFF keeps `vite build` / deploy unaffected (mock seam, byte-identical).
// ON → fetch the pglite backend /api/v1/aios/kpis (same AiosKpi[] shape: autonomy
// refused / output 3.0 / automated low); mock fallback on ANY failure so a card
// never blanks. Operational (not money-gated); the demo principal is a founder.
const USE_BACKEND_AIOS = import.meta.env.VITE_USE_BACKEND_AIOS === "true";
const BACKEND_AI_URL =
  (import.meta.env.VITE_BACKEND_AI_URL as string | undefined) ?? "http://localhost:8787";
const FIRM_A = "00000000-0000-0000-0000-00000000aaaa";

export async function fetchAiosKpis(): Promise<AiosKpi[]> {
  if (!USE_BACKEND_AIOS) return resolve(aiosKpis());
  try {
    const res = await fetch(`${BACKEND_AI_URL}/api/v1/aios/kpis`, {
      headers: { "X-Company-Id": FIRM_A, "X-User-Role": "founder" },
    });
    if (!res.ok) throw new Error(`backend ${res.status}`);
    return (await res.json()) as AiosKpi[];
  } catch {
    return resolve(aiosKpis());
  }
}

// ---- Task Audit (Layer 4) ----
export type TaskStatus = "automated" | "assisted" | "manual";
export interface AuditTask {
  id: string;
  title: string;
  owner: string;
  cadence: string;
  minPerWeek: number; // est. human minutes/week today
  automatable: "high" | "medium";
  humanGate: boolean; // a human must approve the output
  behavior: string; // what the agent does
  status: TaskStatus;
}

export const auditTasks: AuditTask[] = [
  { id: "t1", title: "Chase client for approval on WhatsApp + log the reply", owner: "Project Lead", cadence: "Per submission", minPerWeek: 90, automatable: "high", humanGate: true, behavior: "Sends the reminder, captures the reply into the client-approval record, advances status.", status: "automated" },
  { id: "t2", title: "Nudge Raiana's pending queue + assemble the approval package", owner: "Fariha / Lead", cadence: "Daily", minPerWeek: 75, automatable: "high", humanGate: true, behavior: "Compiles the design/material package and queues it for Raiana. Never decides.", status: "automated" },
  { id: "t3", title: "Chase overdue payments + flag 'progressing without payment'", owner: "Fariha / Finance", cadence: "Weekly", minPerWeek: 60, automatable: "high", humanGate: true, behavior: "Detects overdue milestones, drafts a polite reminder, flags the project gate.", status: "automated" },
  { id: "t4", title: "Keep the file register current + version + move finished files central", owner: "Everyone", cadence: "Continuous", minPerWeek: 120, automatable: "high", humanGate: true, behavior: "Watches Drive, versions files, registers them, flags local-only / single-person files.", status: "automated" },
  { id: "t5", title: "Phase-gate checklist nudges to the owner", owner: "Project Lead", cadence: "Per phase", minPerWeek: 45, automatable: "high", humanGate: true, behavior: "Nudges on incomplete gate items; blocks advance until the gate clears.", status: "automated" },
  { id: "t6", title: "Draft the weekly client update / status", owner: "Project Lead", cadence: "Weekly", minPerWeek: 80, automatable: "high", humanGate: true, behavior: "Drafts from the week's activity; a human reviews and sends.", status: "assisted" },
  { id: "t7", title: "Compile requirement doc / finish schedule / BOQ draft", owner: "Lead / Fariha", cadence: "Per project", minPerWeek: 110, automatable: "medium", humanGate: true, behavior: "Drafts the first version from inputs; a human refines (creative execution, accelerated).", status: "assisted" },
  { id: "t8", title: "Capture decisions / scope changes from WhatsApp & calls", owner: "Project Lead", cadence: "Continuous", minPerWeek: 70, automatable: "high", humanGate: true, behavior: "Extracts into a structured Decision / Change record; a human confirms.", status: "assisted" },
  { id: "t9", title: "Status meetings just to stay informed", owner: "All", cadence: "Weekly", minPerWeek: 150, automatable: "high", humanGate: false, behavior: "Replaced by the AI Daily Brief — no meeting needed to stay informed.", status: "automated" },
  { id: "t10", title: "New-assignment + due-date notifications", owner: "Project Lead", cadence: "Per task", minPerWeek: 30, automatable: "high", humanGate: false, behavior: "Auto-notifies the assignee with context and due date.", status: "manual" },
];

export function auditSummary(tasks: AuditTask[]) {
  const total = tasks.length;
  const automated = tasks.filter((t) => t.status === "automated").length;
  const assisted = tasks.filter((t) => t.status === "assisted").length;
  // coordination-automated %: fully-automated count + half credit for assisted
  const pct = Math.round(((automated + assisted * 0.5) / total) * 100);
  const minSaved = tasks
    .filter((t) => t.status !== "manual")
    .reduce((s, t) => s + (t.status === "automated" ? t.minPerWeek : Math.round(t.minPerWeek * 0.6)), 0);
  return { total, automated, assisted, manual: total - automated - assisted, pct, hrsSaved: Math.round(minSaved / 60) };
}

// ---- The 3 AIOS KPIs (studio version) ----
// Each KPI now carries trust metadata (Slice 3): a `value` that may be null
// (an honest refusal), a `confidence`, real provenance `sources`, and the
// formula/note that explain it. Fabricated `trend`/`target` are dropped — a
// sparkline of invented points is itself a fabrication.
export interface AiosKpi {
  key: string;
  label: string;
  value: number | null;
  unit: "pct" | "ratio";
  sub: string;
  confidence: Confidence;
  completeness: number; // 0–100
  asOf: string; // ISO
  sources: Provenance[];
  formula?: string;
  note?: string;
  trend?: number[]; // only present when a real series exists
  target?: number; // only present when a real target exists
}
export function aiosKpis(): AiosKpi[] {
  const a = auditSummary(auditTasks);

  // #1 `output` — COMPUTE → Metric. active projects ÷ design staff (designers).
  // Recompute from the live arrays; never hardcode. 6 / 2 = 3.0 (NOT 1.5).
  const active = projectsA.filter((p) => p.status === "active");
  const designers = members.filter((m) => m.role === "designer");
  const outputValue = active.length / designers.length;
  const outputSources: Provenance[] = [
    ...active.map((p) => ({
      sourceId: "archintel-projects",
      sourceName: "ArchIntel · Projects",
      recordRef: `project:${p.id}`,
      observedAt: AS_OF,
    })),
    ...designers.map((m) => ({
      sourceId: "archintel-members",
      sourceName: "ArchIntel · Members",
      recordRef: `member:${m.id}`,
      observedAt: AS_OF,
    })),
  ];

  // #3 `automated` — still computed from auditSummary, but stamped low-confidence:
  // the per-task status classification is editorial judgement, not observed.
  const automatedSources: Provenance[] = auditTasks.map((t) => ({
    sourceId: "archintel-audit",
    sourceName: "ArchIntel · Task Audit",
    recordRef: `auditTask:${t.id}`,
    observedAt: AS_OF,
  }));

  return [
    // #2 `autonomy` — REFUSE. No signal exists to measure it; don't fabricate 64.
    {
      key: "autonomy",
      label: "Studio autonomy",
      value: null,
      unit: "pct",
      sub: "gates · approvals · payments moving without a principal chasing",
      confidence: "insufficient",
      completeness: 0,
      asOf: AS_OF,
      sources: [],
      note: "No signal yet — needs an intervention/escalation log (who chased which gate/approval/payment) to measure autonomy. Not estimated.",
    },
    // #3 `automated` — COMPUTE, stamped low (editorial classification).
    {
      key: "automated",
      label: "Coordination automated",
      value: a.pct,
      unit: "pct",
      sub: `${a.automated} of ${a.total} recurring tasks · ~${a.hrsSaved} hrs/wk saved`,
      confidence: "low",
      completeness: 100,
      asOf: AS_OF,
      sources: automatedSources,
      formula: "(#automated + 0.5·#assisted) ÷ total recurring tasks",
      note: "Based on editorial task-status classification, not an observed automation rate.",
    },
    // #1 `output` — COMPUTE → Metric. value === active ÷ designers === 3.0.
    {
      key: "output",
      label: "Output per designer",
      value: outputValue,
      unit: "ratio",
      sub: "active projects per designer (design-production staff) — rises as overhead falls",
      confidence: "low",
      completeness: 100,
      asOf: AS_OF,
      sources: outputSources,
      formula: "active projects ÷ design staff (role='designer')",
      note: "Head-count load per designer, not a productivity measure. Design staff = the two designer-role members.",
    },
  ];
}

// ---- Agent actions feed ----
export type ActionStatus = "done" | "needs_approval";
export interface AgentAction {
  id: string;
  projectId: string | null;
  taskId: string;
  status: ActionStatus;
  summary: string;
  detail: string;
  at: string;
}
export const agentActions: AgentAction[] = [
  { id: "g1", projectId: "a1", taskId: "t1", status: "done", summary: "Reminded the Gulshan client about Material Sheet v3 on WhatsApp", detail: "No reply in 4 days → sent a polite nudge and logged it to the approval record.", at: "2026-06-22T08:10:00" },
  { id: "g2", projectId: "a5", taskId: "t3", status: "done", summary: "Chased Tejgaon's overdue payment (৳9.3L, 18 days)", detail: "Drafted + sent a reminder to Bashati and flagged the Phase-2 gate as payment-blocked.", at: "2026-06-22T08:05:00" },
  { id: "g3", projectId: "a3", taskId: "t4", status: "done", summary: "Versioned & filed Working Drawings Set A (v5)", detail: "Detected a new upload on Drive, set version v5, superseded v4, registered owner + location.", at: "2026-06-21T17:40:00" },
  { id: "g4", projectId: null, taskId: "t5", status: "done", summary: "Nudged 2 owners on incomplete phase checklists", detail: "Banani Café & Bashundhara Penthouse had stale gate items.", at: "2026-06-22T07:30:00" },
  { id: "g5", projectId: "a6", taskId: "t2", status: "done", summary: "Assembled the boutique 3D-visuals approval package for Raiana", detail: "Bundled the latest renders + context and queued it in her review inbox.", at: "2026-06-21T16:20:00" },
  // waiting on a human (assisted tasks)
  { id: "g6", projectId: "a1", taskId: "t6", status: "needs_approval", summary: "Drafted this week's client update for Gulshan", detail: "Ready to send — review the draft and approve.", at: "2026-06-22T08:15:00" },
  { id: "g7", projectId: "a3", taskId: "t7", status: "needs_approval", summary: "Drafted the Final BOQ for MediCare clinic", detail: "First pass from the finish schedule + layout — refine before issuing.", at: "2026-06-22T07:55:00" },
  { id: "g8", projectId: "a5", taskId: "t8", status: "needs_approval", summary: "Captured a scope change from WhatsApp (Tejgaon)", detail: "Client asked for an extra meeting pod — confirm to log as a Change Request.", at: "2026-06-21T19:05:00" },
];

// ---- Daily Brief ----
export interface BriefItem {
  id: string;
  text: string;
  meta: string;
  projectId: string | null;
  tone: "rust" | "ochre" | "blue" | "sage";
}
export interface DailyBrief {
  date: string;
  summary: string;
  needsYou: BriefItem[];
  handled: { id: string; text: string; meta: string }[];
}
export function dailyBrief(): DailyBrief {
  return {
    date: TODAY,
    summary:
      "I handled 5 coordination tasks for you overnight. 3 things need a human: Raiana has 4 approvals waiting, Tejgaon is at risk of stalling, and 2 drafts are ready for you to send.",
    needsYou: [
      { id: "n1", text: "Raiana — 4 design/material approvals waiting", meta: "1 is blocking Tejgaon's layout freeze", projectId: "a5", tone: "ochre" },
      { id: "n2", text: "Tejgaon Office — high concern, likely to stall", meta: "overdue payment + pending freeze on the same gate", projectId: "a5", tone: "rust" },
      { id: "n3", text: "2 AI drafts ready to send", meta: "Gulshan client update · MediCare BOQ", projectId: "a1", tone: "blue" },
      { id: "n4", text: "Gulshan Phase-3 payment due in 3 days", meta: "gated on the pending material approval", projectId: "a1", tone: "ochre" },
    ],
    handled: agentActions
      .filter((a) => a.status === "done")
      .map((a) => ({ id: a.id, text: a.summary, meta: a.detail })),
  };
}

// ---- hooks ----
export const useTaskAudit = () => useQuery({ queryKey: ["aios-audit"], queryFn: () => resolve(auditTasks) });
export const useAiosKpis = () => useQuery({ queryKey: ["aios-kpis"], queryFn: () => fetchAiosKpis() });
export const useDailyBrief = () => useQuery({ queryKey: ["aios-brief"], queryFn: () => resolve(dailyBrief()) });
export const useAgentActions = () => useQuery({ queryKey: ["aios-actions"], queryFn: () => resolve(agentActions) });
