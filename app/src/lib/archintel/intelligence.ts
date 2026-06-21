// ============================================================
// ArchIntel "Risk Radar" — proactive risk-prevention intelligence.
// The vision: an assistant that learns the studio over time and
// flags risks BEFORE they happen — which stage is riskiest, whose
// projects slip, where bottlenecks form, and what to do now.
//
// FRONTEND-ONLY: these are pre-authored, rule-derived flags over
// the mock project data. Real "learning over time" (an LLM + a
// history of decisions, approvals, slips and payments) is [BACKEND].
// ============================================================

export type RiskSeverity = "critical" | "high" | "medium" | "low";

export interface PredictedRisk {
  id: string;
  projectId: string | null;
  severity: RiskSeverity;
  stage: string; // phase / gate where it surfaces
  title: string;
  reasoning: string; // why ArchIntel thinks this is a risk
  signals: string[]; // the observed signals behind it
  likelihood: number; // 0–100 (modelled, not certain)
  detectedDate: string;
  recommendedAction: string;
  owner: string; // who should act
  status: "open" | "watching" | "mitigated";
}

// Proactive flags raised before the issue fully materialises.
export const predictedRisks: PredictedRisk[] = [
  {
    id: "r1", projectId: "a5", severity: "critical", stage: "Concept → Layout freeze",
    title: "Tejgaon Office is about to stall",
    reasoning:
      "Two blocking conditions are converging: the layout freeze has waited 3 days in Raiana's approval queue, and the Phase-2 payment is 18 days overdue. Historically, when an approval and a payment block the same gate, the project stops within the week.",
    signals: ["Layout freeze pending review 3 days", "Phase-2 payment ৳9.3L overdue 18 days", "Phase status: blocked"],
    likelihood: 86, detectedDate: "2026-06-22", recommendedAction: "Escalate the layout freeze to Raiana today and pause new work until the Phase-2 payment is cleared.",
    owner: "Fariha Karim", status: "open",
  },
  {
    id: "r2", projectId: "a2", severity: "high", stage: "Concept → revision loop",
    title: "Banani Café concept heading into a third revision",
    reasoning:
      "The moodboard was sent back for a warmer palette, and the client also requested warmer tones over WhatsApp — two independent signals pointing the same way. Concept projects that pass revision-two without a layout freeze tend to slip 2–3 weeks.",
    signals: ["Approval status: sent to revise", "Client WhatsApp: 'wants warmer tones'", "No layout freeze after 11 weeks"],
    likelihood: 64, detectedDate: "2026-06-21", recommendedAction: "Consolidate both feedback notes into one revised concept and book a decision call before starting revision three.",
    owner: "Imran Kabir", status: "open",
  },
  {
    id: "r3", projectId: "a3", severity: "medium", stage: "Construction docs",
    title: "MediCare change request may erode margin",
    reasoning:
      "A reception feature wall was added as a change request in Phase 4 with cost impact still 'pending'. Late-stage change requests without a costed amount are the studio's most common source of unbilled scope.",
    signals: ["Change request raised in Phase 4", "Cost impact: pending", "Construction-docs payment only partially received"],
    likelihood: 58, detectedDate: "2026-06-20", recommendedAction: "Cost the feature wall and issue a change-order before releasing the drawing set for execution.",
    owner: "Fariha Karim", status: "watching",
  },
  {
    id: "r4", projectId: "a1", severity: "medium", stage: "Design development",
    title: "Gulshan material approval blocking the Phase-3 payment",
    reasoning:
      "The material selection sheet is awaiting Raiana's approval, and the Phase-3 (design development) payment is due in 3 days. The client typically releases payment only after material sign-off — so the approval delay risks a late payment.",
    signals: ["Material approval pending review", "Phase-3 payment due 25 Jun", "Client awaiting material sheet"],
    likelihood: 47, detectedDate: "2026-06-22", recommendedAction: "Clear the material approval this week so the client can release the Phase-3 payment on time.",
    owner: "Raiana Mahmud", status: "open",
  },
  {
    id: "r5", projectId: null, severity: "high", stage: "Studio-wide",
    title: "Approval bottleneck forming around one reviewer",
    reasoning:
      "Four design/material approvals are queued, all routed to a single approver (Raiana). When her queue passes three items, projects across the studio begin to wait at their gates. This is the studio's top structural risk.",
    signals: ["4 approvals pending, 1 reviewer", "2 projects blocked at a gate", "Avg time-in-queue rising"],
    likelihood: 72, detectedDate: "2026-06-22", recommendedAction: "Triage the queue by deadline, and consider delegating low-risk material approvals so concept/technical gates clear faster.",
    owner: "Fariha Karim", status: "open",
  },
];

// Patterns ArchIntel has "learned" about the studio (mock illustrations).
export interface StagePattern {
  stage: string;
  riskIndex: number; // 0–100 relative riskiness
  note: string;
}
export const stageRisk: StagePattern[] = [
  { stage: "Discovery", riskIndex: 22, note: "Low risk — mostly internal, client requirement gate is rarely contested." },
  { stage: "Concept", riskIndex: 81, note: "Riskiest stage. Revision loops + the layout-freeze gate are where most projects stall." },
  { stage: "Design Dev", riskIndex: 64, note: "Material-lock gate and Raiana's approval are the common blockers." },
  { stage: "Construction Docs", riskIndex: 48, note: "Late change requests and final-payment timing drive risk here." },
];

export interface RiskInsight {
  id: string;
  kind: "stage" | "person" | "payment" | "bottleneck" | "timing";
  title: string;
  detail: string;
}
export const riskInsights: RiskInsight[] = [
  { id: "i1", kind: "stage", title: "Concept is your riskiest stage", detail: "Across active and archived projects, the Concept phase accounts for the most slips — almost always at the layout-freeze gate after a second revision." },
  { id: "i2", kind: "bottleneck", title: "Every design decision funnels through one approver", detail: "All design/material approvals route to Raiana. It protects quality, but a queue over three items reliably delays multiple projects. Delegating low-risk material sign-offs would relieve it." },
  { id: "i3", kind: "payment", title: "Payments lag right at phase transitions", detail: "Overdue payments cluster at concept-sign-off and design-development gates — exactly where work is ready to advance, so a late payment becomes a stall." },
  { id: "i4", kind: "person", title: "Revision loops concentrate on hospitality & retail", detail: "Café and boutique projects average more concept revisions than residential — worth setting a stricter 'revision-two then decide' rule for those types." },
  { id: "i5", kind: "timing", title: "Change requests after Phase 3 rarely get costed", detail: "Most late change requests are logged but not priced before execution, which quietly erodes margin. A 'cost-before-release' gate would catch them." },
];

// Proactive assistant — canned, risk-focused answers (mock; real version is an LLM).
export interface AIAnswer {
  q: string;
  body: string;
  refs: string[];
}
export const RISK_SUGGESTIONS = [
  "What's most likely to go wrong this week?",
  "Which project should I worry about?",
  "Why do our projects keep stalling at Concept?",
  "Where is money at risk right now?",
  "Is anyone overloaded with approvals?",
];
export const RISK_ANSWERS: Record<string, AIAnswer> = {
  "What's most likely to go wrong this week?": {
    q: "What's most likely to go wrong this week?",
    body: "Tejgaon Office (Bashati) is the one to watch — 86% likely to stall. Its layout freeze has been waiting on Raiana for 3 days and its Phase-2 payment is 18 days overdue; those two together have stopped projects within a week before. Clear the approval today and chase the payment.",
    refs: ["Tejgaon Office · blocked gate", "Risk Radar r1"],
  },
  "Which project should I worry about?": {
    q: "Which project should I worry about?",
    body: "Tejgaon Office first (critical, stalling). Then Banani Café — it's drifting into a third concept revision, which usually adds 2–3 weeks. MediCare is lower but watch the un-costed feature-wall change request before you release drawings.",
    refs: ["Risk Radar r1", "Risk Radar r2", "Risk Radar r3"],
  },
  "Why do our projects keep stalling at Concept?": {
    q: "Why do our projects keep stalling at Concept?",
    body: "Two reasons show up repeatedly: revision loops that run past round two without a decision, and the layout-freeze gate waiting on a single approver. Hospitality and retail projects are the worst for revisions. A firm 'revision-two then decide' rule plus faster freeze approvals would remove most of it.",
    refs: ["Stage risk · Concept 81/100", "Insight i1", "Insight i4"],
  },
  "Where is money at risk right now?": {
    q: "Where is money at risk right now?",
    body: "৳9.3L is overdue on Tejgaon (18 days), and Gulshan's Phase-3 payment (due 25 Jun) is at risk because the material sign-off it depends on is still pending. Separately, MediCare's feature-wall change request isn't costed yet — that's quiet margin leakage.",
    refs: ["Payments · overdue", "Risk Radar r4", "Risk Radar r3"],
  },
  "Is anyone overloaded with approvals?": {
    q: "Is anyone overloaded with approvals?",
    body: "Yes — Raiana has four approvals queued and two projects are already blocked at their gates. Every design/material decision routes through her, so the queue is the studio's top structural risk this week. Triage by deadline and consider delegating low-risk material sign-offs.",
    refs: ["Risk Radar r5", "Insight i2"],
  },
};
export function genericRiskAnswer(q: string): AIAnswer {
  return {
    q,
    body: "ArchIntel watches your projects for risk patterns and answers from what it has observed. I don't have a confident read on that yet — as the studio logs more approvals, payments and decisions, my answers get sharper. Try one of the suggested questions, or open the Risk Radar to see what's flagged now.",
    refs: [],
  };
}
