// New datasets powering the added features: clients contacts, meetings,
// activity/audit log, scheduled reports, goals/targets, and the review queue.
import type { AIReportKind, Confidence, Provenance } from "@/lib/types";

export const TODAY = "2026-06-17";

// ---- contacts (client side) ----
export interface Contact {
  id: string;
  clientId: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  primary: boolean;
}

export const contacts: Contact[] = [
  { id: "ct1", clientId: "c1", name: "Imtiaz Aldenair", role: "Managing Director", email: "imtiaz@aldenair.com", phone: "+8801711000001", primary: true },
  { id: "ct2", clientId: "c1", name: "Sumona Reza", role: "Project Coordinator", email: "sumona@aldenair.com", phone: "+8801711000002", primary: false },
  { id: "ct3", clientId: "c2", name: "Sohel Bashati", role: "Director", email: "sohel@bashati.com", phone: "+8801711000010", primary: true },
  { id: "ct4", clientId: "c3", name: "Dr. Anwar Hossain", role: "Owner", email: "anwar@gmail.com", phone: "+8801711000020", primary: true },
  { id: "ct5", clientId: "c4", name: "Mr. Sohel (Meghna)", role: "GM Admin", email: "sohel@meghnatex.com", phone: "+8801711000030", primary: true },
  { id: "ct6", clientId: "c5", name: "Brig. (Retd.) Karim", role: "Trustee", email: "karim@cst.edu.bd", phone: "+8801711000040", primary: true },
  { id: "ct7", clientId: "c7", name: "Lumina Procurement", role: "Procurement Lead", email: "procure@lumina.com.bd", phone: "+8801711000050", primary: true },
];
export const contactsByClient = (cid: string) => contacts.filter((c) => c.clientId === cid);

// ---- meetings (calendar) ----
export interface Meeting {
  id: string;
  title: string;
  projectId: string | null;
  date: string; // ISO datetime
  durationMin: number;
  type: "client" | "internal" | "site" | "authority";
  attendees: string[];
  location: string;
}

export const meetings: Meeting[] = [
  { id: "mt1", title: "Aldenair — CD coordination review", projectId: "p1", date: "2026-06-18T11:00:00", durationMin: 60, type: "client", attendees: ["Rezwana Hoque", "Arif Chowdhury", "Imtiaz Aldenair"], location: "Office · Banani" },
  { id: "mt2", title: "Bashati — FSCD resubmission prep", projectId: "p2", date: "2026-06-18T15:30:00", durationMin: 45, type: "internal", attendees: ["Shahed Alam", "Sabbir Rahman"], location: "Office" },
  { id: "mt3", title: "Meghna — change-order reconciliation", projectId: "p4", date: "2026-06-19T12:00:00", durationMin: 90, type: "client", attendees: ["Nusrat Jahan", "Mr. Sohel (Meghna)"], location: "Narayanganj site" },
  { id: "mt4", title: "Lumina — tender briefing", projectId: "p7", date: "2026-06-20T10:30:00", durationMin: 60, type: "client", attendees: ["Nusrat Jahan", "Farhana Islam", "Lumina Procurement"], location: "Online" },
  { id: "mt5", title: "Anwar Residence — site inspection (finishes)", projectId: "p3", date: "2026-06-22T09:00:00", durationMin: 120, type: "site", attendees: ["Arif Chowdhury", "Imran Hossain"], location: "Dhanmondi site" },
  { id: "mt6", title: "RAJUK liaison — permit follow-up", projectId: "p2", date: "2026-06-23T14:00:00", durationMin: 30, type: "authority", attendees: ["Shahed Alam"], location: "RAJUK Bhaban" },
  { id: "mt7", title: "Weekly studio review", projectId: null, date: "2026-06-24T17:00:00", durationMin: 60, type: "internal", attendees: ["Tahmid Karim", "Rezwana Hoque", "Nusrat Jahan"], location: "Office" },
  { id: "mt8", title: "Cantonment School — DD sign-off", projectId: "p5", date: "2026-06-25T11:00:00", durationMin: 60, type: "client", attendees: ["Arif Chowdhury", "Brig. (Retd.) Karim"], location: "Cantonment" },
  { id: "mt9", title: "GreenRoot — concept presentation", projectId: "p8", date: "2026-06-30T15:00:00", durationMin: 90, type: "client", attendees: ["Tahmid Karim", "Nusrat Jahan", "Kamrul Pasha"], location: "Office" },
  { id: "mt10", title: "Purbachal Villa — proposal negotiation", projectId: null, date: "2026-06-19T16:00:00", durationMin: 45, type: "client", attendees: ["Tahmid Karim", "Imtiaz Aldenair"], location: "Online" },
];

// ---- activity / audit log ----
export type ActivityType = "capture" | "sync" | "approval" | "report" | "match" | "invoice" | "alert";
export interface ActivityEvent {
  id: string;
  type: ActivityType;
  actor: string; // person or system
  summary: string;
  projectId: string | null;
  timestamp: string; // ISO
  sourceName: string;
  recordRef?: string;
}

export const activityLog: ActivityEvent[] = [
  { id: "ac1", type: "alert", actor: "Space Esse AI", summary: "Flagged RAJUK Construction Permit overdue 61 days (blocking) on Bashati Tower", projectId: "p2", timestamp: "2026-06-17T07:30:00", sourceName: "RAJUK ECPS", recordRef: "ECPS-2024-88213" },
  { id: "ac2", type: "sync", actor: "System", summary: "Google Drive sync completed — 38 files scanned, 4 new revisions detected", projectId: null, timestamp: "2026-06-17T08:55:00", sourceName: "Google Drive" },
  { id: "ac3", type: "capture", actor: "Nusrat Jahan", summary: "Captured scope change: upgraded reception stone (cost impact pending) — from WhatsApp", projectId: "p4", timestamp: "2026-06-16T17:42:00", sourceName: "WhatsApp → capture", recordRef: "Change #214" },
  { id: "ac4", type: "report", actor: "Space Esse AI", summary: "Generated weekly report for Aldenair Lake Residences", projectId: "p1", timestamp: "2026-06-12T17:00:00", sourceName: "AI reporting", recordRef: "rep_weekly_p1" },
  { id: "ac5", type: "match", actor: "Maya Das", summary: "Confirmed project alias: 'Aldenair Lake Res.' (Tally) ↔ Aldenair Lake Residences", projectId: "p1", timestamp: "2026-06-15T10:20:00", sourceName: "Project matching", recordRef: "SK-2401" },
  { id: "ac6", type: "invoice", actor: "System", summary: "TallyPrime export imported — 12 invoices, 4 payments reconciled", projectId: null, timestamp: "2026-06-12T17:10:00", sourceName: "TallyPrime", recordRef: "export 2026-06-12" },
  { id: "ac7", type: "approval", actor: "Tahmid Karim", summary: "Approved external weekly report for Lumina before sending", projectId: "p7", timestamp: "2026-06-13T09:15:00", sourceName: "Review queue", recordRef: "rep_weekly_p7" },
  { id: "ac8", type: "capture", actor: "Arif Chowdhury", summary: "Logged effort: 6.5h on Anwar Residence snagging", projectId: "p3", timestamp: "2026-06-16T18:30:00", sourceName: "Timesheet capture" },
  { id: "ac9", type: "capture", actor: "Shahed Alam", summary: "Updated RAJUK status to 'In review' (day 61) on Bashati Tower", projectId: "p2", timestamp: "2026-06-12T14:00:00", sourceName: "Manual capture", recordRef: "Approval #112" },
  { id: "ac10", type: "alert", actor: "Space Esse AI", summary: "Detected Meghna receivable crossed 90 days — ৳39.0L at risk", projectId: "p4", timestamp: "2026-06-12T17:12:00", sourceName: "TallyPrime", recordRef: "INV-2026-019" },
  { id: "ac11", type: "sync", actor: "System", summary: "Gmail metadata sync — 41 threads scanned for approval/response signals", projectId: null, timestamp: "2026-06-17T08:50:00", sourceName: "Gmail" },
  { id: "ac12", type: "capture", actor: "Rezwana Hoque", summary: "Recorded decision: beam drop confirmed at grid C-4 after MEP review", projectId: "p1", timestamp: "2026-06-11T16:05:00", sourceName: "Manual capture", recordRef: "Decision #221" },
  { id: "ac13", type: "report", actor: "Space Esse AI", summary: "Daily executive briefing generated", projectId: null, timestamp: "2026-06-17T07:30:00", sourceName: "AI reporting", recordRef: "rep_daily" },
  { id: "ac14", type: "match", actor: "Space Esse AI", summary: "Proposed alias match needs confirmation: 'Meghna FitOut' (WhatsApp) → Meghna Textiles HQ", projectId: "p4", timestamp: "2026-06-16T11:30:00", sourceName: "Project matching" },
];

// ---- scheduled reports ----
export interface Recipient {
  name: string;
  role: string;
}
export interface ScheduledReport {
  id: string;
  name: string;
  kind: AIReportKind;
  cadence: "daily" | "weekly" | "monthly";
  schedule: string; // human label e.g. "Weekdays 07:30"
  recipients: Recipient[];
  channel: "email" | "whatsapp" | "in_app";
  active: boolean;
  nextRun: string;
  lastRun: string | null;
  audience: "internal" | "external";
}

export const schedules: ScheduledReport[] = [
  { id: "sc1", name: "Daily executive briefing", kind: "daily_brief", cadence: "daily", schedule: "Weekdays · 07:30", recipients: [{ name: "Tahmid Karim", role: "Owner" }], channel: "in_app", active: true, nextRun: "2026-06-18T07:30:00", lastRun: "2026-06-17T07:30:00", audience: "internal" },
  { id: "sc2", name: "Weekly project reports (all active)", kind: "weekly_project", cadence: "weekly", schedule: "Thursdays · 16:00", recipients: [{ name: "Tahmid Karim", role: "Owner" }, { name: "Rezwana Hoque", role: "Project Director" }], channel: "email", active: true, nextRun: "2026-06-18T16:00:00", lastRun: "2026-06-12T16:00:00", audience: "internal" },
  { id: "sc3", name: "Monthly company performance", kind: "monthly_company", cadence: "monthly", schedule: "1st of month · 09:00", recipients: [{ name: "Tahmid Karim", role: "Owner" }], channel: "email", active: true, nextRun: "2026-07-01T09:00:00", lastRun: "2026-06-01T09:00:00", audience: "internal" },
  { id: "sc4", name: "Cash collection warning", kind: "cash_warning", cadence: "weekly", schedule: "Mondays · 08:00", recipients: [{ name: "Maya Das", role: "Finance" }, { name: "Tahmid Karim", role: "Owner" }], channel: "in_app", active: true, nextRun: "2026-06-22T08:00:00", lastRun: "2026-06-15T08:00:00", audience: "internal" },
  { id: "sc5", name: "Client weekly update — Aldenair", kind: "weekly_project", cadence: "weekly", schedule: "Fridays · 10:00", recipients: [{ name: "Imtiaz Aldenair", role: "Client" }], channel: "email", active: false, nextRun: "2026-06-19T10:00:00", lastRun: null, audience: "external" },
  { id: "sc6", name: "Project risk summary", kind: "risk_summary", cadence: "weekly", schedule: "Wednesdays · 09:00", recipients: [{ name: "Rezwana Hoque", role: "Project Director" }], channel: "in_app", active: true, nextRun: "2026-06-24T09:00:00", lastRun: "2026-06-17T09:00:00", audience: "internal" },
];

// ---- goals / targets ----
export interface Target {
  id: string;
  scope: "firm" | "project";
  projectId: string | null;
  label: string;
  metric: string;
  unit: "bdt" | "pct" | "count" | "days" | "ratio";
  target: number;
  actual: number;
  period: string;
  status: "ahead" | "on_track" | "behind" | "at_risk";
  owner: string;
}

export const targets: Target[] = [
  { id: "g1", scope: "firm", projectId: null, label: "Annual fee revenue", metric: "Billed fee (FY26)", unit: "bdt", target: 90_000_000, actual: 52_080_000, period: "FY 2025–26", status: "on_track", owner: "Tahmid Karim" },
  { id: "g2", scope: "firm", projectId: null, label: "Collection rate", metric: "Collected ÷ billed", unit: "pct", target: 85, actual: 74, period: "YTD", status: "behind", owner: "Maya Das" },
  { id: "g3", scope: "firm", projectId: null, label: "Billable utilization", metric: "Mean billable utilization", unit: "pct", target: 80, actual: 81, period: "This quarter", status: "on_track", owner: "Rezwana Hoque" },
  { id: "g4", scope: "firm", projectId: null, label: "New pipeline won", metric: "Won fee value", unit: "bdt", target: 30_000_000, actual: 9_500_000, period: "FY 2025–26", status: "at_risk", owner: "Tahmid Karim" },
  { id: "g5", scope: "firm", projectId: null, label: "Timesheet coverage", metric: "% staff-weeks logged", unit: "pct", target: 80, actual: 64, period: "This month", status: "behind", owner: "Rezwana Hoque" },
  { id: "g6", scope: "firm", projectId: null, label: "Portfolio data completeness", metric: "Avg project completeness", unit: "pct", target: 75, actual: 67, period: "This month", status: "behind", owner: "Maya Das" },
  { id: "g7", scope: "project", projectId: "p1", label: "Aldenair margin", metric: "Forecast margin", unit: "pct", target: 22, actual: 19, period: "Project", status: "behind", owner: "Rezwana Hoque" },
  { id: "g8", scope: "project", projectId: "p3", label: "Anwar on-time handover", metric: "Schedule variance", unit: "days", target: 0, actual: 4, period: "Project", status: "ahead", owner: "Arif Chowdhury" },
];

// ---- review queue (maker-checker) ----
export type ReviewKind = "capture" | "report" | "discrepancy" | "match";
export interface ReviewItem {
  id: string;
  kind: ReviewKind;
  title: string;
  detail: string;
  projectId: string | null;
  submittedBy: string;
  submittedAt: string;
  confidence: Confidence;
  status: "pending" | "approved" | "rejected";
  source: Provenance;
}

export const reviewQueue: ReviewItem[] = [
  { id: "rv1", kind: "report", title: "External weekly report — Aldenair Lake Residences", detail: "Client-facing report ready to send. Contains schedule slip (−18d) and one overdue invoice. Needs owner sign-off before sending to client.", projectId: "p1", submittedBy: "Space Esse AI", submittedAt: "2026-06-17T07:05:00", confidence: "high", status: "pending", source: { sourceId: "ds_ai", sourceName: "AI reporting", recordRef: "rep_weekly_p1", observedAt: "2026-06-17" } },
  { id: "rv2", kind: "capture", title: "Promote phone note → Decision (Bashati FSCD)", detail: "Captured via phone note: 'FSCD query — revise refuge floor area; resubmit by 20 Jun'. Confirm to make it a citable Decision record.", projectId: "p2", submittedBy: "Shahed Alam", submittedAt: "2026-06-16T11:00:00", confidence: "medium", status: "pending", source: { sourceId: "ds_manual", sourceName: "Phone note", recordRef: "Decision #219", observedAt: "2026-06-09" } },
  { id: "rv3", kind: "match", title: "Confirm project alias — 'Meghna FitOut' (WhatsApp)", detail: "AI proposes matching the WhatsApp group 'Meghna FitOut' to Meghna Textiles HQ Interior. Confirm to link captured records to the project.", projectId: "p4", submittedBy: "Space Esse AI", submittedAt: "2026-06-16T11:30:00", confidence: "low", status: "pending", source: { sourceId: "ds_wa", sourceName: "WhatsApp", recordRef: "Meghna FitOut", observedAt: "2026-06-16" } },
  { id: "rv4", kind: "discrepancy", title: "Fee mismatch — Cantonment School", detail: "Billed fee in TallyPrime (৳51.0L) differs from the contract fee schedule in Excel (৳52.4L) by ৳1.4L. Review which is correct before trusting margin.", projectId: "p5", submittedBy: "Space Esse AI", submittedAt: "2026-06-15T13:20:00", confidence: "medium", status: "pending", source: { sourceId: "ds_tally", sourceName: "TallyPrime vs Excel", recordRef: "SK-2508 fee", observedAt: "2026-06-12" } },
  { id: "rv5", kind: "capture", title: "Promote WhatsApp decision (Meghna stone upgrade)", detail: "Client approved upgraded reception stone — cost impact pending. Confirm and attach to a Change record for billing follow-up.", projectId: "p4", submittedBy: "Nusrat Jahan", submittedAt: "2026-06-16T17:42:00", confidence: "medium", status: "pending", source: { sourceId: "ds_manual", sourceName: "WhatsApp → capture", recordRef: "Decision #214", observedAt: "2026-06-09" } },
  { id: "rv6", kind: "report", title: "Monthly company performance — May 2026", detail: "Internal monthly report generated. Auto-published (internal). Open to review the narrative and completeness.", projectId: null, submittedBy: "Space Esse AI", submittedAt: "2026-06-01T09:00:00", confidence: "medium", status: "approved", source: { sourceId: "ds_ai", sourceName: "AI reporting", recordRef: "rep_monthly_may", observedAt: "2026-06-01" } },
];
