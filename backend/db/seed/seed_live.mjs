// ============================================================
// seed_live.mjs — seeds canonical from the LIVE ArchIntel arrays
// (app/src/lib/archintel/data.ts is ground truth).
//
// default export: `export default async function seed(db) { … }`
// called by backend/test/harness.mjs after migrations apply.
//
// pglite HARD RULES honoured:
//   * ALL uuids minted in JS (crypto.randomUUID()) and passed in.
//   * provenance minted at seed (live facts have no refs):
//       source_system   = 'tallyprime'
//       source_record_ref = 'tally:' + <milestone id>     (e.g. 'tally:pm10')
//       observed_at      = deterministic ISO from received_date (or due_date
//                          when unreceived) — NO wall clock.
//       source_id        = one minted uuid per (company, source_system),
//                          so mart.kpi_lineage.source_id is NOT NULL.
//   * DEFERRED tax columns (net_receivable/vat/vds_withheld/ait_withheld)
//     left NULL (lock ⑤).
//
// Firm A (company_id 0000-…-aaaa) = the REAL live entities (m1..m6, a1..a8,
//   payments incl pm10, c1..c6).
// Firm B (company_id 0000-…-bbbb) = synthetic isolation proof (1 project,
//   2 milestones with DISTINCT refs).
// ============================================================
import { randomUUID } from "node:crypto";

const FIRM_A = "00000000-0000-0000-0000-00000000aaaa";
const FIRM_B = "00000000-0000-0000-0000-00000000bbbb";

// ─── LIVE Firm-A data (verbatim from app/src/lib/archintel/data.ts) ───
// PD-A: m1 (Raiana, founder) + m2 (Fariha, principal/co-founder) are PRIVILEGED:
// finance_grant=true (isFinanceEligible keys off it) and can_check=true. The live
// `Member` carries neither flag — the SEED stamps them (data.ts is read-only).
const membersA = [
  { id: "m1", name: "Sharif Raiana Mahmud", role: "founder",      title: "Chief Interior Architect & Founder", is_approver: true,  email: "raiana@spaceesse.com", can_check: true,  finance_grant: true  },
  { id: "m2", name: "Fariha Karim",         role: "principal",    title: "Principal Architect & Co-Founder",   is_approver: false, email: "fariha@spaceesse.com", can_check: true,  finance_grant: true  },
  { id: "m3", name: "Tasnia Rahman",        role: "project_lead", title: "Project Lead",                       is_approver: false, email: "tasnia@spaceesse.com", can_check: false, finance_grant: false },
  { id: "m4", name: "Imran Kabir",          role: "project_lead", title: "Project Lead",                       is_approver: false, email: "imran@spaceesse.com",  can_check: false, finance_grant: false },
  { id: "m5", name: "Nabila Hasan",         role: "designer",     title: "3D & Visualization Designer",        is_approver: false, email: "nabila@spaceesse.com", can_check: false, finance_grant: false },
  { id: "m6", name: "Rifat Ahmed",          role: "designer",     title: "Junior Designer (Technical)",        is_approver: false, email: "rifat@spaceesse.com",  can_check: false, finance_grant: false },
];

const clientsAData = [
  { id: "c1", name: "Mr. Rahim (Gulshan)",        contact_name: "Mr. Abdur Rahim",      phone: "+8801711000101", email: "rahim@gmail.com",        whatsapp_group: "Gulshan Apt · Space Esse",   type: "residential" },
  { id: "c2", name: "Lumen Hospitality",          contact_name: "Sadia Islam",          phone: "+8801711000102", email: "sadia@lumen.com.bd",     whatsapp_group: "Lumen Café · Space Esse",    type: "hospitality" },
  { id: "c3", name: "MediCare Ltd.",              contact_name: "Dr. Anwar",            phone: "+8801711000103", email: "anwar@medicare.com.bd",  whatsapp_group: "MediCare Clinic · Space Esse", type: "healthcare" },
  { id: "c4", name: "Mrs. Anika (Bashundhara)",   contact_name: "Mrs. Anika Chowdhury", phone: "+8801711000104", email: "anika@gmail.com",        whatsapp_group: "Penthouse · Space Esse",     type: "residential" },
  { id: "c5", name: "Bashati Group",              contact_name: "Sohel Bashati",        phone: "+8801711000105", email: "sohel@bashati.com",      whatsapp_group: "Tejgaon Office · Space Esse", type: "corporate" },
  { id: "c6", name: "Aura Boutique",              contact_name: "Farzana Aura",         phone: "+8801711000106", email: "farzana@aura.com.bd",    whatsapp_group: "Aura Uttara · Space Esse",   type: "retail" },
];

const projectsAData = [
  { id: "a1", code: "SE-101", name: "Gulshan Apartment",            client_id: "c1", lead_id: "m3", type: "residential", status: "active",   current_phase: 3, contract_value: 2_800_000, health: "on_track", blocker: null },
  { id: "a2", code: "SE-104", name: "Banani Café — Lumen",          client_id: "c2", lead_id: "m4", type: "hospitality", status: "active",   current_phase: 2, contract_value: 1_900_000, health: "watch",    blocker: null },
  { id: "a3", code: "SE-098", name: "Dhanmondi Clinic — MediCare",  client_id: "c3", lead_id: "m3", type: "healthcare",  status: "active",   current_phase: 4, contract_value: 3_400_000, health: "on_track", blocker: null },
  { id: "a4", code: "SE-106", name: "Bashundhara Penthouse",        client_id: "c4", lead_id: "m4", type: "residential", status: "active",   current_phase: 1, contract_value: 4_600_000, health: "on_track", blocker: null },
  { id: "a5", code: "SE-103", name: "Tejgaon Office — Bashati",     client_id: "c5", lead_id: "m3", type: "corporate",   status: "active",   current_phase: 2, contract_value: 3_100_000, health: "at_risk",  blocker: "Layout freeze waiting on Raiana's approval · Phase-2 payment 18 days overdue" },
  { id: "a6", code: "SE-100", name: "Uttara Boutique — Aura",       client_id: "c6", lead_id: "m4", type: "retail",      status: "active",   current_phase: 3, contract_value: 1_500_000, health: "on_track", blocker: null },
  { id: "a7", code: "SE-088", name: "Mirpur Restaurant — Spice Garden", client_id: "c2", lead_id: "m4", type: "hospitality", status: "archived", current_phase: 4, contract_value: 2_200_000, health: "on_track", blocker: null },
  { id: "a8", code: "SE-091", name: "Gulshan Salon — Glow",         client_id: "c6", lead_id: "m3", type: "retail",      status: "archived", current_phase: 4, contract_value: 1_300_000, health: "on_track", blocker: null },
];

// live `amount` -> gross_amount. linked_phase null becomes 0 to satisfy the
// (company,project,label,linked_phase) idempotency key (NULL would skip it).
const paymentsAData = [
  { id: "pm1",  project_id: "a1", label: "Mobilisation (10%)",        linked_phase: 1,    type: "phased",  gross_amount: 280_000,   due_date: "2026-02-15", received_amount: 280_000,   received_date: "2026-02-14", status: "paid"    },
  { id: "pm2",  project_id: "a1", label: "Concept sign-off (30%)",    linked_phase: 2,    type: "phased",  gross_amount: 840_000,   due_date: "2026-04-25", received_amount: 840_000,   received_date: "2026-04-26", status: "paid"    },
  { id: "pm3",  project_id: "a1", label: "Design development (30%)",  linked_phase: 3,    type: "phased",  gross_amount: 840_000,   due_date: "2026-06-25", received_amount: 0,         received_date: null,         status: "pending" },
  { id: "pm4",  project_id: "a1", label: "Construction docs (30%)",   linked_phase: 4,    type: "phased",  gross_amount: 840_000,   due_date: "2026-08-20", received_amount: 0,         received_date: null,         status: "pending" },
  { id: "pm5",  project_id: "a2", label: "Full payment (upfront)",    linked_phase: null, type: "upfront", gross_amount: 1_900_000, due_date: "2026-04-05", received_amount: 1_900_000, received_date: "2026-04-04", status: "paid"    },
  { id: "pm6",  project_id: "a3", label: "Mobilisation (20%)",        linked_phase: 1,    type: "phased",  gross_amount: 680_000,   due_date: "2025-11-25", received_amount: 680_000,   received_date: "2025-11-24", status: "paid"    },
  { id: "pm7",  project_id: "a3", label: "Design development (40%)",  linked_phase: 3,    type: "phased",  gross_amount: 1_360_000, due_date: "2026-04-10", received_amount: 1_360_000, received_date: "2026-04-12", status: "paid"    },
  { id: "pm8",  project_id: "a3", label: "Construction docs (40%)",   linked_phase: 4,    type: "phased",  gross_amount: 1_360_000, due_date: "2026-06-30", received_amount: 600_000,   received_date: "2026-06-18", status: "partial" },
  { id: "pm9",  project_id: "a5", label: "Mobilisation (20%)",        linked_phase: 1,    type: "phased",  gross_amount: 620_000,   due_date: "2026-03-20", received_amount: 620_000,   received_date: "2026-03-19", status: "paid"    },
  { id: "pm10", project_id: "a5", label: "Concept sign-off (30%)",    linked_phase: 2,    type: "phased",  gross_amount: 930_000,   due_date: "2026-06-04", received_amount: 0,         received_date: null,         status: "overdue" },
  { id: "pm11", project_id: "a4", label: "Mobilisation (15%)",        linked_phase: 1,    type: "phased",  gross_amount: 690_000,   due_date: "2026-05-30", received_amount: 690_000,   received_date: "2026-05-29", status: "paid"    },
  { id: "pm12", project_id: "a6", label: "Full payment (upfront)",    linked_phase: null, type: "upfront", gross_amount: 1_500_000, due_date: "2026-01-15", received_amount: 1_500_000, received_date: "2026-01-14", status: "paid"    },
];

// live ProjectA.{leadId, teamIds} for project_member derivation (data.ts:182).
const projectTeams = {
  a1: { leadId: "m3", teamIds: ["m3", "m5", "m6"] },
  a2: { leadId: "m4", teamIds: ["m4", "m5"] },
  a3: { leadId: "m3", teamIds: ["m3", "m6"] },
  a4: { leadId: "m4", teamIds: ["m4", "m5"] },
  a5: { leadId: "m3", teamIds: ["m3", "m6", "m5"] },
  a6: { leadId: "m4", teamIds: ["m4", "m5"] },
  a7: { leadId: "m4", teamIds: ["m4", "m5", "m6"] },
  a8: { leadId: "m3", teamIds: ["m3", "m5"] },
};

// ─── LIVE design approvals (data.ts:309). submitted_by=submittedById,
//     decided_by=reviewerId (NULL until decided — pending rows). ───
const approvalsAData = [
  { id: "ap1", project_id: "a5", type: "concept",   title: "Layout freeze — open-plan workstations", submitted_by: "m3", reviewer_id: "m1", status: "pending",  submitted_date: "2026-06-19", decided_date: null,         version: "v2", phase: 2 },
  { id: "ap2", project_id: "a1", type: "material",  title: "Material selection — living & dining",    submitted_by: "m3", reviewer_id: "m1", status: "pending",  submitted_date: "2026-06-20", decided_date: null,         version: "v3", phase: 3 },
  { id: "ap3", project_id: "a2", type: "concept",   title: "Concept direction & moodboard",           submitted_by: "m4", reviewer_id: "m1", status: "revise",   submitted_date: "2026-06-14", decided_date: "2026-06-16", version: "v2", phase: 2 },
  { id: "ap4", project_id: "a3", type: "material",  title: "Finish schedule — clinic",                submitted_by: "m3", reviewer_id: "m1", status: "approved", submitted_date: "2026-05-30", decided_date: "2026-06-02", version: "v2", phase: 3 },
  { id: "ap5", project_id: "a6", type: "design",    title: "3D visuals — boutique",                   submitted_by: "m5", reviewer_id: "m1", status: "pending",  submitted_date: "2026-06-21", decided_date: null,         version: "v2", phase: 3 },
  { id: "ap6", project_id: "a3", type: "technical", title: "Technical approval — working drawings Set A", submitted_by: "m2", reviewer_id: "m1", status: "approved", submitted_date: "2026-06-18", decided_date: "2026-06-20", version: "v5", phase: 4 },
];

// ─── LIVE file register (data.ts:265) ───
const filesAData = [
  { id: "f1",  project_id: "a1", name: "Material Selection Sheet", kind: "material_sheet", owner_id: "m3", storage: "gdrive",    version: "v3", uploaded_date: "2026-06-15", status: "shared",     phase: 3, ext: "PDF" },
  { id: "f2",  project_id: "a1", name: "Finish Schedule",          kind: "boq",            owner_id: "m6", storage: "archintel", version: "v2", uploaded_date: "2026-06-18", status: "draft",      phase: 3, ext: "XLSX" },
  { id: "f3",  project_id: "a1", name: "Living Room Render",       kind: "render",         owner_id: "m5", storage: "gdrive",    version: "v4", uploaded_date: "2026-06-12", status: "approved",   phase: 3, ext: "JPG" },
  { id: "f4",  project_id: "a1", name: "Concept Presentation",     kind: "presentation",   owner_id: "m3", storage: "local",     version: "v2", uploaded_date: "2026-04-20", status: "superseded", phase: 2, ext: "INDD" },
  { id: "f5",  project_id: "a3", name: "Working Drawings — Set A",  kind: "drawing",        owner_id: "m6", storage: "archintel", version: "v5", uploaded_date: "2026-06-19", status: "shared",     phase: 4, ext: "DWG" },
  { id: "f6",  project_id: "a3", name: "Ceiling Plan",             kind: "drawing",        owner_id: "m6", storage: "archintel", version: "v3", uploaded_date: "2026-06-17", status: "approved",   phase: 4, ext: "DWG" },
  { id: "f7",  project_id: "a3", name: "Final BOQ",                kind: "boq",            owner_id: "m3", storage: "gdrive",    version: "v4", uploaded_date: "2026-06-16", status: "shared",     phase: 4, ext: "XLSX" },
  { id: "f8",  project_id: "a5", name: "Furniture Layout",         kind: "drawing",        owner_id: "m3", storage: "local",     version: "v2", uploaded_date: "2026-05-28", status: "shared",     phase: 2, ext: "DWG" },
  { id: "f9",  project_id: "a5", name: "Concept Visuals",          kind: "render",         owner_id: "m5", storage: "gdrive",    version: "v3", uploaded_date: "2026-06-02", status: "shared",     phase: 2, ext: "JPG" },
  { id: "f10", project_id: "a2", name: "Moodboard",                kind: "presentation",   owner_id: "m4", storage: "gdrive",    version: "v2", uploaded_date: "2026-05-10", status: "approved",   phase: 2, ext: "PDF" },
  { id: "f11", project_id: "a2", name: "Initial 3D Model",         kind: "render",         owner_id: "m5", storage: "local",     version: "v1", uploaded_date: "2026-05-22", status: "draft",      phase: 2, ext: "SKP" },
  { id: "f12", project_id: "a4", name: "As-built Drawings",        kind: "drawing",        owner_id: "m4", storage: "local",     version: "v1", uploaded_date: "2026-06-01", status: "draft",      phase: 1, ext: "DWG" },
  { id: "f13", project_id: "a4", name: "Client Requirement Document", kind: "brief",       owner_id: "m4", storage: "gdrive",    version: "v1", uploaded_date: "2026-06-05", status: "shared",     phase: 1, ext: "DOCX" },
  { id: "f14", project_id: "a6", name: "Material Selection Sheet", kind: "material_sheet", owner_id: "m4", storage: "archintel", version: "v1", uploaded_date: "2026-06-20", status: "draft",      phase: 3, ext: "PDF" },
  { id: "f15", project_id: "a7", name: "Final Drawing Set",        kind: "final",          owner_id: "m4", storage: "archintel", version: "v6", uploaded_date: "2025-12-18", status: "archived",   phase: 4, ext: "PDF" },
  { id: "f16", project_id: "a7", name: "Final BOQ",                kind: "boq",            owner_id: "m6", storage: "archintel", version: "v5", uploaded_date: "2025-12-15", status: "archived",   phase: 4, ext: "XLSX" },
];

// ─── LIVE client submissions (data.ts:336) ───
const submissionsAData = [
  { id: "s1", project_id: "a1", package: "Concept Presentation",        version: "v2", sent_via: "whatsapp", sent_date: "2026-04-22", sent_by: "m3", feedback: "Loved the palette, approved.", status: "approved",            approved_date: "2026-04-24" },
  { id: "s2", project_id: "a1", package: "Material Selection Sheet",     version: "v3", sent_via: "whatsapp", sent_date: "2026-06-16", sent_by: "m3", feedback: "Reviewing with family.",     status: "feedback",            approved_date: null },
  { id: "s3", project_id: "a2", package: "Moodboard & Concept",         version: "v2", sent_via: "whatsapp", sent_date: "2026-06-12", sent_by: "m4", feedback: "Wants warmer tones.",       status: "revision_requested",  approved_date: null },
  { id: "s4", project_id: "a3", package: "Working Drawing Set A",        version: "v5", sent_via: "whatsapp", sent_date: "2026-06-20", sent_by: "m3", feedback: null,                        status: "sent",                approved_date: null },
  { id: "s5", project_id: "a5", package: "Concept Visuals",              version: "v3", sent_via: "whatsapp", sent_date: "2026-06-03", sent_by: "m3", feedback: "Approved, proceed to freeze.", status: "approved",          approved_date: "2026-06-06" },
  { id: "s6", project_id: "a4", package: "Client Requirement Document",  version: "v1", sent_via: "email",    sent_date: "2026-06-06", sent_by: "m4", feedback: null,                        status: "sent",                approved_date: null },
];

// ─── LIVE decisions (data.ts:395). promoted=false / promoted_by/at=NULL (PD-2). ───
const decisionsAData = [
  { id: "d1", project_id: "a1", type: "layout_freeze",  summary: "Living/dining layout frozen after revision 2",                     decided_by: "Tasnia Rahman", decided_date: "2026-04-24", phase: 2 },
  { id: "d2", project_id: "a3", type: "material_lock",  summary: "Anti-bacterial flooring & wall finishes locked",                   decided_by: "Raiana Mahmud", decided_date: "2026-06-02", phase: 3 },
  { id: "d3", project_id: "a3", type: "change_request", summary: "Client added a reception feature wall — CR raised, cost impact pending", decided_by: "Tasnia Rahman", decided_date: "2026-06-10", phase: 4 },
  { id: "d4", project_id: "a6", type: "layout_freeze",  summary: "Retail floor layout frozen",                                       decided_by: "Imran Kabir",   decided_date: "2026-03-18", phase: 2 },
  { id: "d5", project_id: "a5", type: "decision",       summary: "Open-plan over cabins agreed verbally with client (WhatsApp)",     decided_by: "Tasnia Rahman", decided_date: "2026-06-18", phase: 2 },
];

// ─── LIVE activity log (data.ts:413). occurred_at = live `date`. ───
const activityAData = [
  { id: "ac1",  project_id: "a5", type: "approval",   actor: "Tasnia Rahman", summary: "Submitted layout freeze for Raiana's approval",                  occurred_at: "2026-06-19T16:20:00" },
  { id: "ac2",  project_id: "a3", type: "approval",   actor: "Raiana Mahmud", summary: "Issued technical approval — Working Drawings Set A",              occurred_at: "2026-06-20T11:05:00" },
  { id: "ac3",  project_id: "a1", type: "submission", actor: "Tasnia Rahman", summary: "Sent Material Selection Sheet v3 to client via WhatsApp",         occurred_at: "2026-06-16T18:40:00" },
  { id: "ac4",  project_id: "a3", type: "payment",    actor: "System",        summary: "Partial payment ৳6.0L received — Construction docs milestone",   occurred_at: "2026-06-18T10:00:00" },
  { id: "ac5",  project_id: "a3", type: "file",       actor: "Rifat Ahmed",   summary: "Uploaded Working Drawings Set A v5 to ArchIntel",                occurred_at: "2026-06-19T14:30:00" },
  { id: "ac6",  project_id: "a5", type: "payment",    actor: "System",        summary: "Concept sign-off payment is 18 days overdue (৳9.3L)",            occurred_at: "2026-06-22T08:00:00" },
  { id: "ac7",  project_id: "a2", type: "approval",   actor: "Raiana Mahmud", summary: "Sent concept moodboard back for revision (warmer palette)",      occurred_at: "2026-06-16T09:30:00" },
  { id: "ac8",  project_id: "a1", type: "decision",   actor: "Tasnia Rahman", summary: "Logged layout freeze for Phase 2",                               occurred_at: "2026-04-24T12:00:00" },
  { id: "ac9",  project_id: "a4", type: "phase",      actor: "Imran Kabir",   summary: "Started Discovery & Site Analysis",                              occurred_at: "2026-05-25T09:00:00" },
  { id: "ac10", project_id: "a3", type: "decision",   actor: "Tasnia Rahman", summary: "Raised change request — reception feature wall",                 occurred_at: "2026-06-10T15:10:00" },
];

// ─── LIVE audit tasks (aios.ts:37). lock ⑦: t1/t3/t4/t5 human_gate -> true
//     (read-only-strict; the live array has them false — SEED overrides). ───
const HUMAN_GATE_TRUE = new Set(["t1", "t3", "t4", "t5"]);
const auditTasksData = [
  { id: "t1",  title: "Chase client for approval on WhatsApp + log the reply",          owner: "Project Lead",    cadence: "Per submission", min_per_week: 90,  automatable: "high",   behavior: "Sends the reminder, captures the reply into the client-approval record, advances status.", status: "automated" },
  { id: "t2",  title: "Nudge Raiana's pending queue + assemble the approval package",   owner: "Fariha / Lead",   cadence: "Daily",          min_per_week: 75,  automatable: "high",   behavior: "Compiles the design/material package and queues it for Raiana. Never decides.", status: "automated" },
  { id: "t3",  title: "Chase overdue payments + flag 'progressing without payment'",    owner: "Fariha / Finance",cadence: "Weekly",         min_per_week: 60,  automatable: "high",   behavior: "Detects overdue milestones, drafts a polite reminder, flags the project gate.", status: "automated" },
  { id: "t4",  title: "Keep the file register current + version + move finished files central", owner: "Everyone", cadence: "Continuous",  min_per_week: 120, automatable: "high",   behavior: "Watches Drive, versions files, registers them, flags local-only / single-person files.", status: "automated" },
  { id: "t5",  title: "Phase-gate checklist nudges to the owner",                       owner: "Project Lead",    cadence: "Per phase",      min_per_week: 45,  automatable: "high",   behavior: "Nudges on incomplete gate items; blocks advance until the gate clears.", status: "automated" },
  { id: "t6",  title: "Draft the weekly client update / status",                        owner: "Project Lead",    cadence: "Weekly",         min_per_week: 80,  automatable: "high",   behavior: "Drafts from the week's activity; a human reviews and sends.", status: "assisted" },
  { id: "t7",  title: "Compile requirement doc / finish schedule / BOQ draft",          owner: "Lead / Fariha",   cadence: "Per project",    min_per_week: 110, automatable: "medium", behavior: "Drafts the first version from inputs; a human refines (creative execution, accelerated).", status: "assisted" },
  { id: "t8",  title: "Capture decisions / scope changes from WhatsApp & calls",        owner: "Project Lead",    cadence: "Continuous",     min_per_week: 70,  automatable: "high",   behavior: "Extracts into a structured Decision / Change record; a human confirms.", status: "assisted" },
  { id: "t9",  title: "Status meetings just to stay informed",                          owner: "All",             cadence: "Weekly",         min_per_week: 150, automatable: "high",   behavior: "Replaced by the AI Daily Brief — no meeting needed to stay informed.", status: "automated" },
  { id: "t10", title: "New-assignment + due-date notifications",                        owner: "Project Lead",    cadence: "Per task",       min_per_week: 30,  automatable: "high",   behavior: "Auto-notifies the assignee with context and due date.", status: "manual" },
];

// ─── Firm B synthetic isolation proof (distinct refs) ───
const projectsBData = [
  { id: "b1", code: "BB-001", name: "Firm-B Demo Project", client_id: null, lead_id: null, type: "corporate", status: "active", current_phase: 2, contract_value: 1_000_000, health: "at_risk", blocker: null },
];
const paymentsBData = [
  { id: "bpm1", project_id: "b1", label: "Firm-B milestone one", linked_phase: 1, type: "phased", gross_amount: 500_000, due_date: "2026-05-01", received_amount: 0, received_date: null, status: "overdue" },
  { id: "bpm2", project_id: "b1", label: "Firm-B milestone two", linked_phase: 2, type: "phased", gross_amount: 500_000, due_date: "2026-06-01", received_amount: 0, received_date: null, status: "overdue" },
];
// Firm-B member so symmetry test (2) has a principal; founder so isFinanceEligible.
const membersBData = [
  { id: "bm1", name: "Firm-B Founder", role: "founder", title: "Founder", is_approver: true, email: "founder@firmb.example", can_check: true, finance_grant: true },
];
// ≥1 synthetic row per NEW table for Firm B (distinct ids) — isolation proof only.
const approvalsBData = [
  { id: "bap1", project_id: "b1", type: "concept", title: "Firm-B concept", submitted_by: "bm1", reviewer_id: null, status: "pending", submitted_date: "2026-06-10", decided_date: null, version: "v1", phase: 2 },
];
const filesBData = [
  { id: "bf1", project_id: "b1", name: "Firm-B drawing", kind: "drawing", owner_id: "bm1", storage: "local", version: "v1", uploaded_date: "2026-06-10", status: "draft", phase: 2, ext: "DWG" },
];
const submissionsBData = [
  { id: "bs1", project_id: "b1", package: "Firm-B package", version: "v1", sent_via: "email", sent_date: "2026-06-10", sent_by: "bm1", feedback: null, status: "sent", approved_date: null },
];
const decisionsBData = [
  { id: "bd1", project_id: "b1", type: "decision", summary: "Firm-B decision", decided_by: "Firm-B Founder", decided_date: "2026-06-10", phase: 2 },
];
const activityBData = [
  { id: "bac1", project_id: "b1", type: "decision", actor: "Firm-B Founder", summary: "Firm-B logged a decision", occurred_at: "2026-06-10T10:00:00" },
];
const auditTasksBData = [
  { id: "bt1", title: "Firm-B recurring task", owner: "Firm-B", cadence: "Weekly", min_per_week: 30, automatable: "high", human_gate: true, behavior: "Firm-B behavior", status: "automated" },
];

// ─── S4: AIOS proposal ledger (mart.agent_action) — LIVE g1..g8 (aios.ts:192).
//     PROPOSE-ONLY (W1/w-2): every row seeds state='proposed' with NULL
//     delivery_receipt — the live `status:'done'` is NOT a real send, so it must
//     NOT seed as 'executed'. proposed_by = the MAKER (a non-checker member so a
//     checker (m1/m2) can later approve without violating checker != maker; au-3
//     needs ≥1 proposed action with proposed_by <> 'm1'). human_gated mirrors the
//     audit_task gate (t1/t3/t4/t5 gated). idempotency_key is per-action stable.
const agentActionsAData = [
  { id: "g1", project_id: "a1",  task_id: "t1", proposed_by: "m3", summary: "Reminded the Gulshan client about Material Sheet v3 on WhatsApp", detail: "No reply in 4 days → sent a polite nudge and logged it to the approval record.", proposed_at: "2026-06-22T08:10:00" },
  { id: "g2", project_id: "a5",  task_id: "t3", proposed_by: "m3", summary: "Chased Tejgaon's overdue payment (৳9.3L, 18 days)",            detail: "Drafted + sent a reminder to Bashati and flagged the Phase-2 gate as payment-blocked.", proposed_at: "2026-06-22T08:05:00" },
  { id: "g3", project_id: "a3",  task_id: "t4", proposed_by: "m6", summary: "Versioned & filed Working Drawings Set A (v5)",                detail: "Detected a new upload on Drive, set version v5, superseded v4, registered owner + location.", proposed_at: "2026-06-21T17:40:00" },
  { id: "g4", project_id: null,  task_id: "t5", proposed_by: "m4", summary: "Nudged 2 owners on incomplete phase checklists",               detail: "Banani Café & Bashundhara Penthouse had stale gate items.", proposed_at: "2026-06-22T07:30:00" },
  { id: "g5", project_id: "a6",  task_id: "t2", proposed_by: "m4", summary: "Assembled the boutique 3D-visuals approval package for Raiana", detail: "Bundled the latest renders + context and queued it in her review inbox.", proposed_at: "2026-06-21T16:20:00" },
  { id: "g6", project_id: "a1",  task_id: "t6", proposed_by: "m3", summary: "Drafted this week's client update for Gulshan",                detail: "Ready to send — review the draft and approve.", proposed_at: "2026-06-22T08:15:00" },
  { id: "g7", project_id: "a3",  task_id: "t7", proposed_by: "m3", summary: "Drafted the Final BOQ for MediCare clinic",                    detail: "First pass from the finish schedule + layout — refine before issuing.", proposed_at: "2026-06-22T07:55:00" },
  { id: "g8", project_id: "a5",  task_id: "t8", proposed_by: "m3", summary: "Captured a scope change from WhatsApp (Tejgaon)",              detail: "Client asked for an extra meeting pod — confirm to log as a Change Request.", proposed_at: "2026-06-21T19:05:00" },
];
const agentActionsBData = [
  { id: "bg1", project_id: "b1", task_id: "bt1", proposed_by: "bm1", summary: "Firm-B proposed action", detail: "Firm-B isolation row", proposed_at: "2026-06-22T08:00:00" },
];

// observed_at: deterministic ISO from received_date (or due_date if unreceived).
function observedAt(pm) {
  const d = pm.received_date ?? pm.due_date;
  return `${d}T00:00:00Z`;
}
// linked_phase 0 stand-in for NULL so the idempotency unique key never sees NULL.
const phaseKey = (lp) => (lp == null ? 0 : lp);

export default async function seed(db) {
  // one source per (company, source_system) — minted uuid keeps lineage.source_id NOT NULL.
  const srcA = randomUUID();
  const srcB = randomUUID();

  // IDEMPOTENT on (company_id, source_system): a fresh id is minted each call,
  // so conflict on the natural key (not id) keeps a re-seed a no-op and prevents
  // a duplicate tallyprime source from doubling the recompute lineage join.
  await db.query(
    `insert into canonical.source (id, company_id, source_system, display_name)
     values ($1,$2,'tallyprime','TallyPrime (Firm A)'), ($3,$4,'tallyprime','TallyPrime (Firm B)')
     on conflict (company_id, source_system) do nothing`,
    [srcA, FIRM_A, srcB, FIRM_B],
  );

  // Register the additional source systems the new ingested facts carry, so any
  // future lineage join (source_id) stays NOT NULL.
  for (const company of [FIRM_A, FIRM_B]) {
    for (const sys of ["manual_capture", "gdrive", "whatsapp"]) {
      await db.query(
        `insert into canonical.source (id, company_id, source_system, display_name)
         values ($1,$2,$3,$4) on conflict (company_id, source_system) do nothing`,
        [randomUUID(), company, sys, `${sys} (${company === FIRM_A ? "Firm A" : "Firm B"})`],
      );
    }
  }

  // members (Firm A + Firm B)
  for (const m of [...membersA.map((m) => ({ ...m, company_id: FIRM_A })),
                   ...membersBData.map((m) => ({ ...m, company_id: FIRM_B }))]) {
    await db.query(
      `insert into canonical.member (id, company_id, name, role, title, is_approver, email, can_check, finance_grant)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (id) do nothing`,
      [m.id, m.company_id, m.name, m.role, m.title, m.is_approver, m.email, m.can_check, m.finance_grant],
    );
  }

  // clients (Firm A)
  for (const c of clientsAData) {
    await db.query(
      `insert into canonical.client (id, company_id, name, contact_name, phone, email, whatsapp_group, type)
       values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
      [c.id, FIRM_A, c.name, c.contact_name, c.phone, c.email, c.whatsapp_group, c.type],
    );
  }

  // projects (Firm A + Firm B)
  for (const p of [...projectsAData.map((p) => ({ ...p, company_id: FIRM_A })),
                   ...projectsBData.map((p) => ({ ...p, company_id: FIRM_B }))]) {
    await db.query(
      `insert into canonical.project
         (id, company_id, code, name, client_id, lead_id, type, status, current_phase, contract_value, health, blocker, completeness)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,100) on conflict (id) do nothing`,
      [p.id, p.company_id, p.code, p.name, p.client_id, p.lead_id, p.type, p.status, p.current_phase, p.contract_value, p.health, p.blocker],
    );
  }

  // payment_milestones (Firm A + Firm B); tax columns left NULL (lock ⑤).
  const allPayments = [
    ...paymentsAData.map((pm) => ({ ...pm, company_id: FIRM_A })),
    ...paymentsBData.map((pm) => ({ ...pm, company_id: FIRM_B })),
  ];
  for (const pm of allPayments) {
    await db.query(
      `insert into canonical.payment_milestone
         (id, company_id, project_id, label, linked_phase, type,
          gross_amount, received_amount, due_date, received_date, status,
          net_receivable, vat, vds_withheld, ait_withheld,
          source_system, source_record_ref, observed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               null,null,null,null,
               'tallyprime', $12, $13)
       on conflict (company_id, project_id, label, linked_phase) do nothing`,
      [pm.id, pm.company_id, pm.project_id, pm.label, phaseKey(pm.linked_phase), pm.type,
       pm.gross_amount, pm.received_amount, pm.due_date, pm.received_date, pm.status,
       "tally:" + pm.id, observedAt(pm)],
    );
  }

  // deterministic ISO from a date-only string — NO wall clock.
  const iso = (d) => (d ? `${d}T00:00:00Z` : null);
  // occurred_at carries a time already in the live data; coerce both forms.
  const isoTs = (d) => (d ? (d.length > 10 ? `${d}Z` : `${d}T00:00:00Z`) : null);

  // design_approval (Firm A + Firm B). decided_by = reviewer_id (NULL until decided).
  for (const a of [...approvalsAData.map((a) => ({ ...a, company_id: FIRM_A })),
                   ...approvalsBData.map((a) => ({ ...a, company_id: FIRM_B }))]) {
    // decided_by NULL while pending so the self-approve CHECK never trips on seed.
    const decidedBy = a.decided_date ? a.reviewer_id : null;
    const obs = iso(a.decided_date ?? a.submitted_date);
    await db.query(
      `insert into canonical.design_approval
         (id, company_id, project_id, type, title, submitted_by, decided_by, status,
          submitted_date, decided_date, version, phase,
          source_system, source_record_ref, observed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'manual_capture',$13,$14)
       on conflict (id) do nothing`,
      [a.id, a.company_id, a.project_id, a.type, a.title, a.submitted_by, decidedBy, a.status,
       a.submitted_date, a.decided_date, a.version, a.phase,
       "manual:" + a.id, obs],
    );
  }

  // file_record (Firm A + Firm B). source_system gdrive.
  for (const f of [...filesAData.map((f) => ({ ...f, company_id: FIRM_A })),
                   ...filesBData.map((f) => ({ ...f, company_id: FIRM_B }))]) {
    await db.query(
      `insert into canonical.file_record
         (id, company_id, project_id, name, kind, owner_id, storage, version,
          uploaded_date, status, phase, ext,
          source_system, source_record_ref, observed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'gdrive',$13,$14)
       on conflict (id) do nothing`,
      [f.id, f.company_id, f.project_id, f.name, f.kind, f.owner_id, f.storage, f.version,
       f.uploaded_date, f.status, f.phase, f.ext,
       "gdrive:" + f.id, iso(f.uploaded_date)],
    );
  }

  // client_submission (Firm A + Firm B). source_system = whatsapp/email channel.
  for (const s of [...submissionsAData.map((s) => ({ ...s, company_id: FIRM_A })),
                   ...submissionsBData.map((s) => ({ ...s, company_id: FIRM_B }))]) {
    await db.query(
      `insert into canonical.client_submission
         (id, company_id, project_id, package, version, sent_via, sent_date, sent_by,
          feedback, status, approved_date,
          source_system, source_record_ref, observed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'whatsapp',$12,$13)
       on conflict (id) do nothing`,
      [s.id, s.company_id, s.project_id, s.package, s.version, s.sent_via, s.sent_date, s.sent_by,
       s.feedback, s.status, s.approved_date,
       (s.sent_via ?? "whatsapp") + ":" + s.id, iso(s.sent_date)],
    );
  }

  // decision (Firm A + Firm B). promoted=false / promoted_by/at=NULL (PD-2).
  for (const d of [...decisionsAData.map((d) => ({ ...d, company_id: FIRM_A })),
                   ...decisionsBData.map((d) => ({ ...d, company_id: FIRM_B }))]) {
    await db.query(
      `insert into canonical.decision
         (id, company_id, project_id, type, summary, decided_by, decided_date, phase,
          promoted, promoted_by, promoted_at,
          source_system, source_record_ref, observed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8, false, null, null, 'manual_capture',$9,$10)
       on conflict (id) do nothing`,
      [d.id, d.company_id, d.project_id, d.type, d.summary, d.decided_by, d.decided_date, d.phase,
       "manual:" + d.id, iso(d.decided_date)],
    );
  }

  // activity (Firm A + Firm B). occurred_at = live `date`.
  for (const ac of [...activityAData.map((a) => ({ ...a, company_id: FIRM_A })),
                    ...activityBData.map((a) => ({ ...a, company_id: FIRM_B }))]) {
    await db.query(
      `insert into canonical.activity
         (id, company_id, project_id, type, actor, summary, occurred_at,
          source_system, source_record_ref, observed_at)
       values ($1,$2,$3,$4,$5,$6,$7,'manual_capture',$8,$9)
       on conflict (id) do nothing`,
      [ac.id, ac.company_id, ac.project_id, ac.type, ac.actor, ac.summary, isoTs(ac.occurred_at),
       "manual:" + ac.id, isoTs(ac.occurred_at)],
    );
  }

  // audit_task (Firm A + Firm B). lock ⑦ override: t1/t3/t4/t5 human_gate=true.
  for (const t of [...auditTasksData.map((t) => ({ ...t, company_id: FIRM_A, human_gate: HUMAN_GATE_TRUE.has(t.id) })),
                   ...auditTasksBData.map((t) => ({ ...t, company_id: FIRM_B }))]) {
    await db.query(
      `insert into canonical.audit_task
         (id, company_id, title, owner, cadence, min_per_week, automatable, human_gate, behavior, status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       on conflict (id) do nothing`,
      [t.id, t.company_id, t.title, t.owner, t.cadence, t.min_per_week, t.automatable, t.human_gate, t.behavior, t.status],
    );
  }

  // project_member — derived from live leadId (role 'lead') + teamIds[] (role
  // 'team', de-duped against the lead). Firm-A from projectTeams; Firm-B (b1, bm1).
  const projectMembers = [];
  for (const [pid, { leadId, teamIds }] of Object.entries(projectTeams)) {
    projectMembers.push({ company_id: FIRM_A, project_id: pid, member_id: leadId, role_on_project: "lead" });
    for (const mid of teamIds) {
      if (mid === leadId) continue; // lead already added with role 'lead'
      projectMembers.push({ company_id: FIRM_A, project_id: pid, member_id: mid, role_on_project: "team" });
    }
  }
  // Firm-B link so isolation symmetry has a project_member row.
  projectMembers.push({ company_id: FIRM_B, project_id: "b1", member_id: "bm1", role_on_project: "lead" });
  for (const pm of projectMembers) {
    await db.query(
      `insert into canonical.project_member
         (company_id, project_id, member_id, role_on_project)
       values ($1,$2,$3,$4)
       on conflict (company_id, project_id, member_id) do nothing`,
      [pm.company_id, pm.project_id, pm.member_id, pm.role_on_project],
    );
  }

  // ─── S4: mart.agent_action (proposal ledger). PROPOSE-ONLY: state defaults to
  //     'proposed', delivery_receipt stays NULL (no live action has a real send).
  //     human_gated mirrors the audit_task gate (HUMAN_GATE_TRUE). idempotency_key
  //     is a stable per-action key (a re-proposal of the same logical action is a
  //     no-op, never a 2nd row → never a double send downstream).
  const AS_OF = "2026-06-22T00:00:00Z";
  for (const g of [...agentActionsAData.map((g) => ({ ...g, company_id: FIRM_A })),
                   ...agentActionsBData.map((g) => ({ ...g, company_id: FIRM_B }))]) {
    const humanGated = HUMAN_GATE_TRUE.has(g.task_id);
    await db.query(
      `insert into mart.agent_action
         (id, company_id, task_id, project_id, state, human_gated, summary, detail,
          proposed_by, approved_by, delivery_receipt, idempotency_key, lock_version,
          proposed_at, source_system)
       values ($1,$2,$3,$4,'proposed',$5,$6,$7,$8,null,null,$9,0,$10,'archintel-aios')
       on conflict (id) do nothing`,
      [g.id, g.company_id, g.task_id, g.project_id, humanGated, g.summary, g.detail,
       g.proposed_by, "aios:" + g.id, isoTs(g.proposed_at)],
    );
  }

  // ─── S4: mart.design_approval (maker-checker). submitted_by=submittedById (the
  //     MAKER); decided_by=reviewerId ONLY for decided rows (NULL while pending so
  //     the decided_consistency CHECK holds). decision maps live status. ap6
  //     (m2→m1) is the natural checker != maker pass.
  const DECISION_MAP = { pending: "pending", approved: "approved", revise: "revise", rejected: "rejected" };
  for (const a of [...approvalsAData.map((a) => ({ ...a, company_id: FIRM_A })),
                   ...approvalsBData.map((a) => ({ ...a, company_id: FIRM_B }))]) {
    const isPending = a.status === "pending" || !a.decided_date;
    const decidedBy = isPending ? null : a.reviewer_id;
    const decision = DECISION_MAP[a.status] ?? "pending";
    await db.query(
      `insert into mart.design_approval
         (id, company_id, project_id, type, title, submitted_by, decided_by, decision,
          submitted_at, decided_at, version, phase)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       on conflict (id) do nothing`,
      [a.id, a.company_id, a.project_id, a.type, a.title, a.submitted_by, decidedBy,
       isPending ? "pending" : decision,
       isoTs(a.submitted_date), a.decided_date ? isoTs(a.decided_date) : null,
       a.version, a.phase],
    );
  }

  // ─── S4: seed a multi-row audit chain so mart.verify_audit_chain has ≥2 rows to
  //     reconcile (au-1 tamper test). Use the append fn so seq/prev_hash/row_hash
  //     are minted correctly (genesis prev_hash NULL). Firm A gets ≥2; Firm B ≥1
  //     for isolation. occurred_at server-stamped from the pinned as_of.
  // IDEMPOTENT guard: append_audit_event mints seq/prev_hash and has NO on-conflict,
  // so a re-seed would collide on event_pkey + drift seq. Only append the chain
  // when the company has no events yet (schema-rls-auth-seed test 7).
  const auditSeedA = [
    { id: "ev_a1", type: "submission",  entity: "design_approval:ap1", actor: "m3", payload: { note: "layout freeze submitted" } },
    { id: "ev_a2", type: "approval",    entity: "design_approval:ap4", actor: "m1", payload: { note: "finish schedule approved" } },
    { id: "ev_a3", type: "member",      entity: "member:m2",           actor: "m1", payload: { note: "co-checker enabled" } },
  ];
  const haveAuditA = await db.query(
    `select count(*)::int as n from audit.event where company_id = $1::uuid`, [FIRM_A]);
  if (Number(haveAuditA.rows[0].n) === 0) {
    for (const e of auditSeedA) {
      await db.query(
        `select mart.append_audit_event($1,$2::uuid,$3,$4,$5,$6::jsonb,$7::timestamptz,null)`,
        [e.id, FIRM_A, e.type, e.entity, e.actor, JSON.stringify(e.payload), AS_OF],
      );
    }
  }
  const haveAuditB = await db.query(
    `select count(*)::int as n from audit.event where company_id = $1::uuid`, [FIRM_B]);
  if (Number(haveAuditB.rows[0].n) === 0) {
    await db.query(
      `select mart.append_audit_event($1,$2::uuid,$3,$4,$5,$6::jsonb,$7::timestamptz,null)`,
      ["ev_b1", FIRM_B, "member", "member:bm1", "bm1", JSON.stringify({ note: "firm-b genesis" }), AS_OF],
    );
  }

  // ─── S5 ingestion back-fill (CONTRACT-ingestion-reconciliation.md §4) ───
  // Seed ONE etl.connector per (firm, tallyprime) carrying the FRESHNESS clock #1
  // (connector_last_run), and back-fill ONE etl.ingest_event(event_type='sync')
  // per seeded milestone so the canonical projection has lineage. This MUST NOT
  // change any live milestone value — it only inserts into the append-only etl
  // log (re-projecting a milestone to the SAME amount it already holds is a no-op
  // on the canonical column, and the back-fill never calls the projection at all).
  //
  // FRESHNESS SPLIT (in-6): connector_last_run is set strictly AFTER the newest
  // milestone observed_at, so for ANY injected as_of, data_age > connector_age
  // (the connector synced after the newest fact was observed → a "fresh connector
  // carrying older data"). NO wall clock: the clock is derived from seed dates.
  //
  // content_hash mirrors etl._content_hash() (business fields only, PD-3) so a
  // later re-ingest of the same export row is a true no-op.
  for (const company of [FIRM_A, FIRM_B]) {
    const payments = company === FIRM_A ? paymentsAData : paymentsBData;

    // newest observed milestone fact for this firm → connector_last_run just after.
    let newestMs = 0;
    for (const pm of payments) {
      const t = Date.parse(observedAt(pm));
      if (t > newestMs) newestMs = t;
    }
    const connectorLastRun = new Date(newestMs + 60_000).toISOString(); // +1 min after newest fact

    await db.query(
      `insert into etl.connector (id, company_id, source_system, mode, connector_last_run)
       values ($1,$2,'tallyprime','read_only',$3)
       on conflict (company_id, source_system) do nothing`,
      [randomUUID(), company, connectorLastRun],
    );
    const cr = await db.query(
      `select id from etl.connector where company_id=$1::uuid and source_system='tallyprime'`,
      [company],
    );
    const cid = cr.rows[0].id;

    for (const pm of payments) {
      const obs = observedAt(pm);
      const payload = {
        gross_amount: pm.gross_amount,
        received_amount: pm.received_amount,
        status: pm.status,
        due_date: pm.due_date,
      };
      // content_hash matches etl._content_hash (business fields only).
      const hashSrc =
        `${pm.gross_amount}` + "|" + `${pm.received_amount}` + "|" +
        `${pm.status}` + "|" + `${pm.due_date ?? ""}`;
      await db.query(
        `insert into etl.ingest_event
           (id, company_id, connector_id, source_system, source_record_ref, event_type,
            supersedes_event_id, retracted, target_kind, target_ref, payload, content_hash,
            data_observed_at, ingested_at, superseded)
         select $1,$2,$3,'tallyprime',$4,'sync',
                null,false,'payment_milestone',$5,$6::jsonb, md5($7),
                $8,$8,false
         where not exists (
           select 1 from etl.ingest_event
            where company_id=$2::uuid and source_system='tallyprime'
              and source_record_ref=$4 and event_type='sync'
              and superseded=false and retracted=false)`,
        [randomUUID(), company, cid, "tally:" + pm.id, pm.id, JSON.stringify(payload), hashSrc, obs],
      );
    }
  }
}
