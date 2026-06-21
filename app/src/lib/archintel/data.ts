// ============================================================
// ArchIntel — central project-control data model for an interior
// design studio (workspace: SPACE ESSE). Mock data, frontend-only.
// Reflects the Space Esse discovery meeting: 4-phase workflow,
// design/material approvals (Raiana = final approver), client
// approvals over WhatsApp, phase-based payments, file register,
// and a completed-project archive.
// ============================================================

export const TODAY = "2026-06-22";

export const workspace = {
  product: "ArchIntel",
  firm: "SPACE ESSE",
  legalName: "Space Esse — Interior Design Studio",
  city: "Dhaka",
  tools: ["Adobe InDesign", "AutoCAD", "SketchUp", "D5 Render", "MS Word", "MS Excel"],
};

// ---- members / roles ----
export type MemberRole = "founder" | "principal" | "project_lead" | "designer" | "finance";

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  title: string;
  tone: string;
  isApprover: boolean; // final design/material approver
  email: string;
}

export const members: Member[] = [
  { id: "m1", name: "Sharif Raiana Mahmud", role: "founder", title: "Chief Interior Architect & Founder", tone: "sienna", isApprover: true, email: "raiana@spaceesse.com" },
  { id: "m2", name: "Fariha Karim", role: "principal", title: "Principal Architect & Co-Founder", tone: "blue", isApprover: false, email: "fariha@spaceesse.com" },
  { id: "m3", name: "Tasnia Rahman", role: "project_lead", title: "Project Lead", tone: "sage", isApprover: false, email: "tasnia@spaceesse.com" },
  { id: "m4", name: "Imran Kabir", role: "project_lead", title: "Project Lead", tone: "ochre", isApprover: false, email: "imran@spaceesse.com" },
  { id: "m5", name: "Nabila Hasan", role: "designer", title: "3D & Visualization Designer", tone: "blue", isApprover: false, email: "nabila@spaceesse.com" },
  { id: "m6", name: "Rifat Ahmed", role: "designer", title: "Junior Designer (Technical)", tone: "sage", isApprover: false, email: "rifat@spaceesse.com" },
];
export const memberById = (id: string) => members.find((m) => m.id === id);
export const approver = members.find((m) => m.isApprover)!;

// ---- clients ----
export interface ClientA {
  id: string;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  whatsappGroup: string;
  type: "residential" | "hospitality" | "corporate" | "retail" | "healthcare";
}

export const clientsA: ClientA[] = [
  { id: "c1", name: "Mr. Rahim (Gulshan)", contactName: "Mr. Abdur Rahim", phone: "+8801711000101", email: "rahim@gmail.com", whatsappGroup: "Gulshan Apt · Space Esse", type: "residential" },
  { id: "c2", name: "Lumen Hospitality", contactName: "Sadia Islam", phone: "+8801711000102", email: "sadia@lumen.com.bd", whatsappGroup: "Lumen Café · Space Esse", type: "hospitality" },
  { id: "c3", name: "MediCare Ltd.", contactName: "Dr. Anwar", phone: "+8801711000103", email: "anwar@medicare.com.bd", whatsappGroup: "MediCare Clinic · Space Esse", type: "healthcare" },
  { id: "c4", name: "Mrs. Anika (Bashundhara)", contactName: "Mrs. Anika Chowdhury", phone: "+8801711000104", email: "anika@gmail.com", whatsappGroup: "Penthouse · Space Esse", type: "residential" },
  { id: "c5", name: "Bashati Group", contactName: "Sohel Bashati", phone: "+8801711000105", email: "sohel@bashati.com", whatsappGroup: "Tejgaon Office · Space Esse", type: "corporate" },
  { id: "c6", name: "Aura Boutique", contactName: "Farzana Aura", phone: "+8801711000106", email: "farzana@aura.com.bd", whatsappGroup: "Aura Uttara · Space Esse", type: "retail" },
];
export const clientById = (id: string) => clientsA.find((c) => c.id === id);

// ---- 4-phase workflow template (verbatim from Space Esse) ----
export interface ChecklistItemDef {
  label: string;
  gate?: boolean; // a gating step that must be done to advance
}
export interface PhaseTemplate {
  index: number;
  key: string;
  name: string;
  ownerRole: MemberRole;
  gateRule: string;
  checklist: ChecklistItemDef[];
}

export const PHASE_TEMPLATE: PhaseTemplate[] = [
  {
    index: 1, key: "discovery", name: "Discovery & Site Analysis", ownerRole: "project_lead",
    gateRule: "Concept design cannot begin before the client requirement is approved.",
    checklist: [
      { label: "Site measurement completed" },
      { label: "As-built drawings prepared" },
      { label: "Client requirement document prepared" },
      { label: "Budget range defined" },
      { label: "Functional zoning draft prepared" },
      { label: "Constraints list prepared" },
      { label: "Mood direction draft prepared" },
      { label: "Internal review conducted" },
      { label: "Client approval received", gate: true },
    ],
  },
  {
    index: 2, key: "concept", name: "Concept Design", ownerRole: "project_lead",
    gateRule: "No layout change after layout freeze unless a formal change request is approved.",
    checklist: [
      { label: "Zoning plan finalized" },
      { label: "Furniture layout prepared" },
      { label: "Moodboard & concept direction developed" },
      { label: "Initial 3D model created" },
      { label: "Concept visuals prepared" },
      { label: "Preliminary cost range prepared" },
      { label: "Client presentation conducted" },
      { label: "Client feedback recorded" },
      { label: "Revision round one completed" },
      { label: "Revision round two completed (if required)" },
      { label: "Layout freeze signed", gate: true },
    ],
  },
  {
    index: 3, key: "design_dev", name: "Design Development", ownerRole: "principal",
    gateRule: "Working drawings cannot begin before material & design direction are locked.",
    checklist: [
      { label: "Layout lock confirmed" },
      { label: "Material selection sheet prepared" },
      { label: "Finish schedule prepared" },
      { label: "Lighting concept developed" },
      { label: "Furniture specifications prepared" },
      { label: "3D visuals approved" },
      { label: "BOQ draft prepared" },
      { label: "Technical coordination completed with execution team" },
      { label: "Client approval received", gate: true },
    ],
  },
  {
    index: 4, key: "construction_docs", name: "Construction Documentation", ownerRole: "principal",
    gateRule: "Drawing set released for execution only after technical approval is issued.",
    checklist: [
      { label: "Working drawings completed" },
      { label: "Electrical layout completed" },
      { label: "Ceiling plan completed" },
      { label: "Joinery drawings completed" },
      { label: "Section drawings completed" },
      { label: "Final BOQ completed" },
      { label: "Technical approval issued", gate: true },
      { label: "Drawing set released for execution" },
    ],
  },
];

export type PhaseStatus = "not_started" | "in_progress" | "blocked" | "complete";

export interface ProjectPhase {
  index: number;
  status: PhaseStatus;
  done: boolean[]; // per checklist item
}

export type ProjectStatusA = "active" | "on_hold" | "completed" | "archived";

export interface ProjectA {
  id: string;
  code: string;
  name: string;
  clientId: string;
  leadId: string;
  teamIds: string[];
  type: ClientA["type"];
  address: string;
  status: ProjectStatusA;
  currentPhase: number; // 1..4
  startDate: string;
  targetDate: string;
  paymentPlan: "upfront" | "phased";
  contractValue: number; // BDT
  whatsappLink: string;
  tone: string;
  phases: ProjectPhase[];
  // derived/health
  health: "on_track" | "watch" | "at_risk";
  blocker: string | null;
}

// helper to build phase done-arrays
function ph(index: number, status: PhaseStatus, doneCount: number): ProjectPhase {
  const total = PHASE_TEMPLATE[index - 1].checklist.length;
  return { index, status, done: Array.from({ length: total }, (_, i) => i < doneCount) };
}

export const projectsA: ProjectA[] = [
  {
    id: "a1", code: "SE-101", name: "Gulshan Apartment", clientId: "c1", leadId: "m3", teamIds: ["m3", "m5", "m6"],
    type: "residential", address: "Gulshan 2, Dhaka", status: "active", currentPhase: 3,
    startDate: "2026-02-10", targetDate: "2026-08-30", paymentPlan: "phased", contractValue: 2_800_000,
    whatsappLink: "https://chat.whatsapp.com/gulshan-apt", tone: "blue", health: "on_track", blocker: null,
    phases: [ph(1, "complete", 9), ph(2, "complete", 11), ph(3, "in_progress", 5), ph(4, "not_started", 0)],
  },
  {
    id: "a2", code: "SE-104", name: "Banani Café — Lumen", clientId: "c2", leadId: "m4", teamIds: ["m4", "m5"],
    type: "hospitality", address: "Banani, Dhaka", status: "active", currentPhase: 2,
    startDate: "2026-04-01", targetDate: "2026-09-15", paymentPlan: "upfront", contractValue: 1_900_000,
    whatsappLink: "https://chat.whatsapp.com/lumen-cafe", tone: "ochre", health: "watch", blocker: null,
    phases: [ph(1, "complete", 9), ph(2, "in_progress", 7), ph(3, "not_started", 0), ph(4, "not_started", 0)],
  },
  {
    id: "a3", code: "SE-098", name: "Dhanmondi Clinic — MediCare", clientId: "c3", leadId: "m3", teamIds: ["m3", "m6"],
    type: "healthcare", address: "Dhanmondi, Dhaka", status: "active", currentPhase: 4,
    startDate: "2025-11-20", targetDate: "2026-07-10", paymentPlan: "phased", contractValue: 3_400_000,
    whatsappLink: "https://chat.whatsapp.com/medicare-clinic", tone: "sage", health: "on_track", blocker: null,
    phases: [ph(1, "complete", 9), ph(2, "complete", 11), ph(3, "complete", 9), ph(4, "in_progress", 5)],
  },
  {
    id: "a4", code: "SE-106", name: "Bashundhara Penthouse", clientId: "c4", leadId: "m4", teamIds: ["m4", "m5"],
    type: "residential", address: "Bashundhara R/A, Dhaka", status: "active", currentPhase: 1,
    startDate: "2026-05-25", targetDate: "2027-01-20", paymentPlan: "phased", contractValue: 4_600_000,
    whatsappLink: "https://chat.whatsapp.com/penthouse", tone: "blue", health: "on_track", blocker: null,
    phases: [ph(1, "in_progress", 4), ph(2, "not_started", 0), ph(3, "not_started", 0), ph(4, "not_started", 0)],
  },
  {
    id: "a5", code: "SE-103", name: "Tejgaon Office — Bashati", clientId: "c5", leadId: "m3", teamIds: ["m3", "m6", "m5"],
    type: "corporate", address: "Tejgaon, Dhaka", status: "active", currentPhase: 2,
    startDate: "2026-03-15", targetDate: "2026-10-01", paymentPlan: "phased", contractValue: 3_100_000,
    whatsappLink: "https://chat.whatsapp.com/tejgaon-office", tone: "sienna", health: "at_risk",
    blocker: "Layout freeze waiting on Raiana's approval · Phase-2 payment 18 days overdue",
    phases: [ph(1, "complete", 9), ph(2, "blocked", 10), ph(3, "not_started", 0), ph(4, "not_started", 0)],
  },
  {
    id: "a6", code: "SE-100", name: "Uttara Boutique — Aura", clientId: "c6", leadId: "m4", teamIds: ["m4", "m5"],
    type: "retail", address: "Uttara, Dhaka", status: "active", currentPhase: 3,
    startDate: "2026-01-12", targetDate: "2026-07-30", paymentPlan: "upfront", contractValue: 1_500_000,
    whatsappLink: "https://chat.whatsapp.com/aura-boutique", tone: "ochre", health: "on_track", blocker: null,
    phases: [ph(1, "complete", 9), ph(2, "complete", 11), ph(3, "in_progress", 3), ph(4, "not_started", 0)],
  },
  // archived / completed
  {
    id: "a7", code: "SE-088", name: "Mirpur Restaurant — Spice Garden", clientId: "c2", leadId: "m4", teamIds: ["m4", "m5", "m6"],
    type: "hospitality", address: "Mirpur 10, Dhaka", status: "archived", currentPhase: 4,
    startDate: "2025-06-01", targetDate: "2025-12-20", paymentPlan: "phased", contractValue: 2_200_000,
    whatsappLink: "https://chat.whatsapp.com/spice-garden", tone: "sage", health: "on_track", blocker: null,
    phases: [ph(1, "complete", 9), ph(2, "complete", 11), ph(3, "complete", 9), ph(4, "complete", 8)],
  },
  {
    id: "a8", code: "SE-091", name: "Gulshan Salon — Glow", clientId: "c6", leadId: "m3", teamIds: ["m3", "m5"],
    type: "retail", address: "Gulshan 1, Dhaka", status: "archived", currentPhase: 4,
    startDate: "2025-08-10", targetDate: "2026-02-15", paymentPlan: "upfront", contractValue: 1_300_000,
    whatsappLink: "https://chat.whatsapp.com/glow-salon", tone: "blue", health: "on_track", blocker: null,
    phases: [ph(1, "complete", 9), ph(2, "complete", 11), ph(3, "complete", 9), ph(4, "complete", 8)],
  },
];
export const projectById = (id: string) => projectsA.find((p) => p.id === id);
export const activeProjects = projectsA.filter((p) => p.status === "active");
export const archivedProjects = projectsA.filter((p) => p.status === "archived");

// ---- file register ----
export type FileKind = "drawing" | "render" | "boq" | "presentation" | "material_sheet" | "brief" | "site_doc" | "final";
export type FileStatus = "draft" | "shared" | "approved" | "superseded" | "archived";
export type FileStorage = "local" | "gdrive" | "archintel";

export interface FileRecord {
  id: string;
  projectId: string;
  name: string;
  kind: FileKind;
  ownerId: string;
  storage: FileStorage;
  version: string;
  uploadedDate: string;
  status: FileStatus;
  phase: number;
  ext: string;
}

export const files: FileRecord[] = [
  { id: "f1", projectId: "a1", name: "Material Selection Sheet", kind: "material_sheet", ownerId: "m3", storage: "gdrive", version: "v3", uploadedDate: "2026-06-15", status: "shared", phase: 3, ext: "PDF" },
  { id: "f2", projectId: "a1", name: "Finish Schedule", kind: "boq", ownerId: "m6", storage: "archintel", version: "v2", uploadedDate: "2026-06-18", status: "draft", phase: 3, ext: "XLSX" },
  { id: "f3", projectId: "a1", name: "Living Room Render", kind: "render", ownerId: "m5", storage: "gdrive", version: "v4", uploadedDate: "2026-06-12", status: "approved", phase: 3, ext: "JPG" },
  { id: "f4", projectId: "a1", name: "Concept Presentation", kind: "presentation", ownerId: "m3", storage: "local", version: "v2", uploadedDate: "2026-04-20", status: "superseded", phase: 2, ext: "INDD" },
  { id: "f5", projectId: "a3", name: "Working Drawings — Set A", kind: "drawing", ownerId: "m6", storage: "archintel", version: "v5", uploadedDate: "2026-06-19", status: "shared", phase: 4, ext: "DWG" },
  { id: "f6", projectId: "a3", name: "Ceiling Plan", kind: "drawing", ownerId: "m6", storage: "archintel", version: "v3", uploadedDate: "2026-06-17", status: "approved", phase: 4, ext: "DWG" },
  { id: "f7", projectId: "a3", name: "Final BOQ", kind: "boq", ownerId: "m3", storage: "gdrive", version: "v4", uploadedDate: "2026-06-16", status: "shared", phase: 4, ext: "XLSX" },
  { id: "f8", projectId: "a5", name: "Furniture Layout", kind: "drawing", ownerId: "m3", storage: "local", version: "v2", uploadedDate: "2026-05-28", status: "shared", phase: 2, ext: "DWG" },
  { id: "f9", projectId: "a5", name: "Concept Visuals", kind: "render", ownerId: "m5", storage: "gdrive", version: "v3", uploadedDate: "2026-06-02", status: "shared", phase: 2, ext: "JPG" },
  { id: "f10", projectId: "a2", name: "Moodboard", kind: "presentation", ownerId: "m4", storage: "gdrive", version: "v2", uploadedDate: "2026-05-10", status: "approved", phase: 2, ext: "PDF" },
  { id: "f11", projectId: "a2", name: "Initial 3D Model", kind: "render", ownerId: "m5", storage: "local", version: "v1", uploadedDate: "2026-05-22", status: "draft", phase: 2, ext: "SKP" },
  { id: "f12", projectId: "a4", name: "As-built Drawings", kind: "drawing", ownerId: "m4", storage: "local", version: "v1", uploadedDate: "2026-06-01", status: "draft", phase: 1, ext: "DWG" },
  { id: "f13", projectId: "a4", name: "Client Requirement Document", kind: "brief", ownerId: "m4", storage: "gdrive", version: "v1", uploadedDate: "2026-06-05", status: "shared", phase: 1, ext: "DOCX" },
  { id: "f14", projectId: "a6", name: "Material Selection Sheet", kind: "material_sheet", ownerId: "m4", storage: "archintel", version: "v1", uploadedDate: "2026-06-20", status: "draft", phase: 3, ext: "PDF" },
  { id: "f15", projectId: "a7", name: "Final Drawing Set", kind: "final", ownerId: "m4", storage: "archintel", version: "v6", uploadedDate: "2025-12-18", status: "archived", phase: 4, ext: "PDF" },
  { id: "f16", projectId: "a7", name: "Final BOQ", kind: "boq", ownerId: "m6", storage: "archintel", version: "v5", uploadedDate: "2025-12-15", status: "archived", phase: 4, ext: "XLSX" },
];
export const filesByProject = (pid: string) => files.filter((f) => f.projectId === pid);

// ---- design / material approvals (internal — Raiana is final approver) ----
export type ApprovalType = "concept" | "design" | "material" | "revision" | "technical";
export type ApprovalStatusA = "pending" | "approved" | "revise" | "rejected";

export interface ApprovalComment {
  by: string;
  text: string;
  date: string;
}
export interface DesignApproval {
  id: string;
  projectId: string;
  type: ApprovalType;
  title: string;
  submittedById: string;
  reviewerId: string; // m1 Raiana
  status: ApprovalStatusA;
  submittedDate: string;
  decidedDate: string | null;
  version: string;
  phase: number;
  comments: ApprovalComment[];
}

export const approvalsA: DesignApproval[] = [
  { id: "ap1", projectId: "a5", type: "concept", title: "Layout freeze — open-plan workstations", submittedById: "m3", reviewerId: "m1", status: "pending", submittedDate: "2026-06-19", decidedDate: null, version: "v2", phase: 2, comments: [{ by: "m3", text: "Client verbally agreed; need internal sign-off before freeze.", date: "2026-06-19" }] },
  { id: "ap2", projectId: "a1", type: "material", title: "Material selection — living & dining", submittedById: "m3", reviewerId: "m1", status: "pending", submittedDate: "2026-06-20", decidedDate: null, version: "v3", phase: 3, comments: [] },
  { id: "ap3", projectId: "a2", type: "concept", title: "Concept direction & moodboard", submittedById: "m4", reviewerId: "m1", status: "revise", submittedDate: "2026-06-14", decidedDate: "2026-06-16", version: "v2", phase: 2, comments: [{ by: "m1", text: "Warmer palette; revisit ceiling feature. Resubmit.", date: "2026-06-16" }] },
  { id: "ap4", projectId: "a3", type: "material", title: "Finish schedule — clinic", submittedById: "m3", reviewerId: "m1", status: "approved", submittedDate: "2026-05-30", decidedDate: "2026-06-02", version: "v2", phase: 3, comments: [{ by: "m1", text: "Approved. Anti-bacterial finishes confirmed.", date: "2026-06-02" }] },
  { id: "ap5", projectId: "a6", type: "design", title: "3D visuals — boutique", submittedById: "m5", reviewerId: "m1", status: "pending", submittedDate: "2026-06-21", decidedDate: null, version: "v2", phase: 3, comments: [] },
  { id: "ap6", projectId: "a3", type: "technical", title: "Technical approval — working drawings Set A", submittedById: "m2", reviewerId: "m1", status: "approved", submittedDate: "2026-06-18", decidedDate: "2026-06-20", version: "v5", phase: 4, comments: [{ by: "m1", text: "Issued. Release set for execution.", date: "2026-06-20" }] },
];
export const approvalsByProject = (pid: string) => approvalsA.filter((a) => a.projectId === pid);
export const pendingApprovals = approvalsA.filter((a) => a.status === "pending");

// ---- client submissions / approval log (over WhatsApp) ----
export type SubmissionStatus = "sent" | "feedback" | "revision_requested" | "approved";

export interface ClientSubmission {
  id: string;
  projectId: string;
  package: string;
  version: string;
  sentVia: "whatsapp" | "email";
  sentDate: string;
  sentById: string;
  feedback: string | null;
  status: SubmissionStatus;
  approvedDate: string | null;
}

export const submissions: ClientSubmission[] = [
  { id: "s1", projectId: "a1", package: "Concept Presentation", version: "v2", sentVia: "whatsapp", sentDate: "2026-04-22", sentById: "m3", feedback: "Loved the palette, approved.", status: "approved", approvedDate: "2026-04-24" },
  { id: "s2", projectId: "a1", package: "Material Selection Sheet", version: "v3", sentVia: "whatsapp", sentDate: "2026-06-16", sentById: "m3", feedback: "Reviewing with family.", status: "feedback", approvedDate: null },
  { id: "s3", projectId: "a2", package: "Moodboard & Concept", version: "v2", sentVia: "whatsapp", sentDate: "2026-06-12", sentById: "m4", feedback: "Wants warmer tones.", status: "revision_requested", approvedDate: null },
  { id: "s4", projectId: "a3", package: "Working Drawing Set A", version: "v5", sentVia: "whatsapp", sentDate: "2026-06-20", sentById: "m3", feedback: null, status: "sent", approvedDate: null },
  { id: "s5", projectId: "a5", package: "Concept Visuals", version: "v3", sentVia: "whatsapp", sentDate: "2026-06-03", sentById: "m3", feedback: "Approved, proceed to freeze.", status: "approved", approvedDate: "2026-06-06" },
  { id: "s6", projectId: "a4", package: "Client Requirement Document", version: "v1", sentVia: "email", sentDate: "2026-06-06", sentById: "m4", feedback: null, status: "sent", approvedDate: null },
];
export const submissionsByProject = (pid: string) => submissions.filter((s) => s.projectId === pid);

// ---- payment milestones (phase-based / upfront) ----
export type PaymentStatusA = "pending" | "partial" | "paid" | "overdue";

export interface PaymentMilestone {
  id: string;
  projectId: string;
  label: string;
  linkedPhase: number | null;
  type: "upfront" | "phased";
  amount: number;
  dueDate: string;
  receivedAmount: number;
  receivedDate: string | null;
  status: PaymentStatusA;
}

export const payments: PaymentMilestone[] = [
  // a1 phased
  { id: "pm1", projectId: "a1", label: "Mobilisation (10%)", linkedPhase: 1, type: "phased", amount: 280_000, dueDate: "2026-02-15", receivedAmount: 280_000, receivedDate: "2026-02-14", status: "paid" },
  { id: "pm2", projectId: "a1", label: "Concept sign-off (30%)", linkedPhase: 2, type: "phased", amount: 840_000, dueDate: "2026-04-25", receivedAmount: 840_000, receivedDate: "2026-04-26", status: "paid" },
  { id: "pm3", projectId: "a1", label: "Design development (30%)", linkedPhase: 3, type: "phased", amount: 840_000, dueDate: "2026-06-25", receivedAmount: 0, receivedDate: null, status: "pending" },
  { id: "pm4", projectId: "a1", label: "Construction docs (30%)", linkedPhase: 4, type: "phased", amount: 840_000, dueDate: "2026-08-20", receivedAmount: 0, receivedDate: null, status: "pending" },
  // a2 upfront
  { id: "pm5", projectId: "a2", label: "Full payment (upfront)", linkedPhase: null, type: "upfront", amount: 1_900_000, dueDate: "2026-04-05", receivedAmount: 1_900_000, receivedDate: "2026-04-04", status: "paid" },
  // a3 phased
  { id: "pm6", projectId: "a3", label: "Mobilisation (20%)", linkedPhase: 1, type: "phased", amount: 680_000, dueDate: "2025-11-25", receivedAmount: 680_000, receivedDate: "2025-11-24", status: "paid" },
  { id: "pm7", projectId: "a3", label: "Design development (40%)", linkedPhase: 3, type: "phased", amount: 1_360_000, dueDate: "2026-04-10", receivedAmount: 1_360_000, receivedDate: "2026-04-12", status: "paid" },
  { id: "pm8", projectId: "a3", label: "Construction docs (40%)", linkedPhase: 4, type: "phased", amount: 1_360_000, dueDate: "2026-06-30", receivedAmount: 600_000, receivedDate: "2026-06-18", status: "partial" },
  // a5 phased — overdue (blocker)
  { id: "pm9", projectId: "a5", label: "Mobilisation (20%)", linkedPhase: 1, type: "phased", amount: 620_000, dueDate: "2026-03-20", receivedAmount: 620_000, receivedDate: "2026-03-19", status: "paid" },
  { id: "pm10", projectId: "a5", label: "Concept sign-off (30%)", linkedPhase: 2, type: "phased", amount: 930_000, dueDate: "2026-06-04", receivedAmount: 0, receivedDate: null, status: "overdue" },
  // a4 phased
  { id: "pm11", projectId: "a4", label: "Mobilisation (15%)", linkedPhase: 1, type: "phased", amount: 690_000, dueDate: "2026-05-30", receivedAmount: 690_000, receivedDate: "2026-05-29", status: "paid" },
  // a6 upfront
  { id: "pm12", projectId: "a6", label: "Full payment (upfront)", linkedPhase: null, type: "upfront", amount: 1_500_000, dueDate: "2026-01-15", receivedAmount: 1_500_000, receivedDate: "2026-01-14", status: "paid" },
];
export const paymentsByProject = (pid: string) => payments.filter((p) => p.projectId === pid);

// ---- decisions / freezes / locks / change requests ----
export type DecisionTypeA = "layout_freeze" | "material_lock" | "change_request" | "decision";
export interface DecisionA {
  id: string;
  projectId: string;
  type: DecisionTypeA;
  summary: string;
  by: string;
  date: string;
  phase: number;
}
export const decisionsA: DecisionA[] = [
  { id: "d1", projectId: "a1", type: "layout_freeze", summary: "Living/dining layout frozen after revision 2", by: "Tasnia Rahman", date: "2026-04-24", phase: 2 },
  { id: "d2", projectId: "a3", type: "material_lock", summary: "Anti-bacterial flooring & wall finishes locked", by: "Raiana Mahmud", date: "2026-06-02", phase: 3 },
  { id: "d3", projectId: "a3", type: "change_request", summary: "Client added a reception feature wall — CR raised, cost impact pending", by: "Tasnia Rahman", date: "2026-06-10", phase: 4 },
  { id: "d4", projectId: "a6", type: "layout_freeze", summary: "Retail floor layout frozen", by: "Imran Kabir", date: "2026-03-18", phase: 2 },
  { id: "d5", projectId: "a5", type: "decision", summary: "Open-plan over cabins agreed verbally with client (WhatsApp)", by: "Tasnia Rahman", date: "2026-06-18", phase: 2 },
];
export const decisionsByProject = (pid: string) => decisionsA.filter((d) => d.projectId === pid);

// ---- activity log ----
export interface ActivityA {
  id: string;
  projectId: string | null;
  type: "file" | "approval" | "submission" | "payment" | "phase" | "decision" | "member";
  actor: string;
  summary: string;
  date: string;
}
export const activityA: ActivityA[] = [
  { id: "ac1", projectId: "a5", type: "approval", actor: "Tasnia Rahman", summary: "Submitted layout freeze for Raiana's approval", date: "2026-06-19T16:20:00" },
  { id: "ac2", projectId: "a3", type: "approval", actor: "Raiana Mahmud", summary: "Issued technical approval — Working Drawings Set A", date: "2026-06-20T11:05:00" },
  { id: "ac3", projectId: "a1", type: "submission", actor: "Tasnia Rahman", summary: "Sent Material Selection Sheet v3 to client via WhatsApp", date: "2026-06-16T18:40:00" },
  { id: "ac4", projectId: "a3", type: "payment", actor: "System", summary: "Partial payment ৳6.0L received — Construction docs milestone", date: "2026-06-18T10:00:00" },
  { id: "ac5", projectId: "a3", type: "file", actor: "Rifat Ahmed", summary: "Uploaded Working Drawings Set A v5 to ArchIntel", date: "2026-06-19T14:30:00" },
  { id: "ac6", projectId: "a5", type: "payment", actor: "System", summary: "Concept sign-off payment is 18 days overdue (৳9.3L)", date: "2026-06-22T08:00:00" },
  { id: "ac7", projectId: "a2", type: "approval", actor: "Raiana Mahmud", summary: "Sent concept moodboard back for revision (warmer palette)", date: "2026-06-16T09:30:00" },
  { id: "ac8", projectId: "a1", type: "decision", actor: "Tasnia Rahman", summary: "Logged layout freeze for Phase 2", date: "2026-04-24T12:00:00" },
  { id: "ac9", projectId: "a4", type: "phase", actor: "Imran Kabir", summary: "Started Discovery & Site Analysis", date: "2026-05-25T09:00:00" },
  { id: "ac10", projectId: "a3", type: "decision", actor: "Tasnia Rahman", summary: "Raised change request — reception feature wall", date: "2026-06-10T15:10:00" },
];
