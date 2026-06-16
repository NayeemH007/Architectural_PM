// ============================================================
// Space Esse domain types
// The "trust model" is central: numbers carry provenance,
// confidence, and a completeness fraction. "insufficient"
// is a first-class state — never a fabricated value.
// ============================================================

export type Confidence = "high" | "medium" | "low" | "insufficient";

export type DataSourceKind =
  | "accounting"
  | "bim_cad"
  | "project_mgmt"
  | "document_mgmt"
  | "file_storage"
  | "communication"
  | "time_tracking"
  | "calendar"
  | "manual_capture"
  | "authority";

export type SourceStatus =
  | "connected"
  | "syncing"
  | "stale"
  | "error"
  | "manual"
  | "not_connected";

export type IngestMethod =
  | "api"
  | "webhook"
  | "csv_import"
  | "file_watch"
  | "email"
  | "manual"
  | "odbc";

export type Cadence = "realtime" | "near_realtime" | "scheduled" | "manual";

export interface Provenance {
  sourceId: string;
  sourceName: string;
  recordRef: string; // e.g. "INV-2026-014", "Drive: /Projects/.../A-201.dwg"
  observedAt: string; // ISO — when the fact was true
  ingestedAt?: string; // ISO — when we learned it
}

/** A KPI / metric value wrapped with its trust metadata. */
export interface Metric {
  value: number | null;
  unit?: "bdt" | "pct" | "days" | "hours" | "count" | "ratio" | "score";
  label: string;
  confidence: Confidence;
  completeness: number; // 0–100
  asOf: string; // ISO
  deltaPct?: number | null; // period-over-period
  formula?: string;
  sources: Provenance[];
  trend?: number[]; // sparkline series
  note?: string; // e.g. "Labour cost absent — margin is fee-only"
}

export type HealthBand = "healthy" | "watch" | "at_risk" | "critical";

export type ProjectStage =
  | "concept"
  | "schematic"
  | "design_dev"
  | "authority_approval"
  | "construction_docs"
  | "tender"
  | "construction_admin"
  | "handover"
  | "on_hold"
  | "closed";

export type ProjectType =
  | "residential"
  | "commercial"
  | "mixed_use"
  | "interior"
  | "institutional"
  | "industrial"
  | "planning";

export interface CrossRef {
  sourceId: string;
  sourceName: string;
  alias: string; // how the project is named in that system
  matched: boolean;
  confidence: Confidence;
}

export interface Project {
  id: string;
  code: string; // internal code e.g. SK-2412
  name: string;
  nameBn?: string;
  client: string;
  clientId: string;
  type: ProjectType;
  stage: ProjectStage;
  city: string;
  leadId: string; // project lead employee id
  teamIds: string[];
  startDate: string;
  targetHandover: string;
  health: HealthBand;
  healthScore: Metric;
  // financial rollup
  feeContract: number; // BDT total contract fee
  feeBilled: number;
  feeCollected: number;
  feeWip: number; // work-in-progress (earned not billed)
  budgetCost: number; // planned internal cost
  costToDate: number; // incurred (mostly labour — may be partial)
  forecastMargin: Metric;
  pctComplete: number; // 0–100 (deliverable/phase weighted)
  scheduleVarianceDays: number; // negative = behind
  openRisks: number;
  openApprovals: number;
  crossRefs: CrossRef[];
  completeness: number; // data completeness 0–100
  currency: "BDT" | "USD";
}

export type ApprovalAuthority =
  | "RAJUK"
  | "FSCD"
  | "CAAB"
  | "DoE"
  | "City Corporation"
  | "DPDC"
  | "DESCO"
  | "WASA"
  | "Titas"
  | "Land Mutation";

export type ApprovalStatus =
  | "not_started"
  | "preparing"
  | "submitted"
  | "in_review"
  | "query_raised"
  | "approved"
  | "rejected";

export interface Approval {
  id: string;
  projectId: string;
  authority: ApprovalAuthority;
  title: string; // e.g. "Land Use Clearance (Form 101)"
  status: ApprovalStatus;
  submittedDate: string | null;
  expectedDate: string | null;
  approvedDate: string | null;
  daysInStage: number;
  statutoryDays: number | null;
  blocking: boolean; // blocks downstream phases
  owner: string; // person/liaison
  lastUpdate: string;
  source: Provenance;
}

export type MilestoneStatus = "done" | "due_soon" | "overdue" | "upcoming" | "blocked";

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  phase: ProjectStage;
  dueDate: string;
  status: MilestoneStatus;
  completedDate: string | null;
}

export type TaskStatus = "todo" | "in_progress" | "review" | "done" | "blocked";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  assigneeId: string;
  status: TaskStatus;
  dueDate: string;
  overdue: boolean;
  source: string; // system name
}

export type DeliverableStatus =
  | "not_started"
  | "in_progress"
  | "internal_review"
  | "issued"
  | "approved"
  | "revise";

export interface Deliverable {
  id: string;
  projectId: string;
  name: string; // e.g. "A-201 Ground Floor Plan"
  discipline: "Architecture" | "Structure" | "MEP" | "Interior" | "Landscape";
  status: DeliverableStatus;
  revision: string; // e.g. "R3"
  revisionCount: number;
  dueDate: string;
  issuedDate: string | null;
  fileRef: string | null; // file-presence signal
  source: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  title: string;
  avatarTone: string; // a token color
  utilization: Metric; // billable utilization (may be insufficient)
  capacityHours: number;
  allocatedHours: number;
  activeProjects: number;
  timesheetCompliance: number; // % of weeks submitted
}

export interface Client {
  id: string;
  name: string;
  type: "developer" | "private" | "corporate" | "government" | "institution";
  city: string;
  activeProjects: number;
  lifetimeFee: number;
  outstanding: number;
  relationship: "strong" | "neutral" | "at_risk";
}

export type InvoiceStatus = "draft" | "sent" | "part_paid" | "paid" | "overdue";

export interface Invoice {
  id: string;
  number: string;
  projectId: string;
  client: string;
  issueDate: string;
  dueDate: string;
  grossFee: number; // before tax
  vat: number; // 15% NBR VAT
  vdsWithheld: number; // VAT deducted at source by client
  aitWithheld: number; // ~10% AIT/TDS
  netReceivable: number; // expected cash
  amountReceived: number;
  status: InvoiceStatus;
  agingDays: number;
  currency: "BDT" | "USD";
}

export interface Payment {
  id: string;
  invoiceNumber: string;
  projectId: string;
  date: string;
  amount: number;
  method: "bank" | "cheque" | "bkash" | "card";
  currency: "BDT" | "USD";
}

export interface Risk {
  id: string;
  projectId: string;
  title: string;
  category: "schedule" | "financial" | "approval" | "scope" | "resource" | "client";
  likelihood: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  status: "open" | "mitigating" | "closed";
  owner: string;
  raisedDate: string;
}

export interface Decision {
  id: string;
  projectId: string;
  summary: string;
  decidedBy: string;
  date: string;
  channel: "meeting" | "whatsapp" | "email" | "call" | "site";
  promoted: boolean; // verified into a citable record
  source: Provenance;
}

export type OppStage = "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost";

export interface Opportunity {
  id: string;
  name: string;
  client: string;
  type: ProjectType;
  stage: OppStage;
  estFee: number;
  probability: number; // 0–100
  owner: string;
  expectedDecision: string;
  lastActivity: string;
}

// ---- Integrations / data sources ----
export interface DataSource {
  id: string;
  name: string;
  vendor: string;
  kind: DataSourceKind;
  status: SourceStatus;
  method: IngestMethod;
  cadence: Cadence;
  readOnly: boolean;
  lastSync: string | null;
  recordsIngested: number;
  freshnessHours: number | null;
  health: number; // 0–100
  mvp: boolean;
  authMethod: string;
  notes: string;
  logoGlyph: string; // short label glyph for the tile
  feeds: string[]; // which entities it feeds
}

export type AlertSeverity = "critical" | "warning" | "info" | "positive";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  title: string;
  detail: string;
  projectId: string | null;
  category: string;
  createdAt: string;
  confidence: Confidence;
  source: Provenance;
  acknowledged: boolean;
}

export type AIReportKind =
  | "daily_brief"
  | "weekly_project"
  | "monthly_company"
  | "risk_summary"
  | "cash_warning";

export interface AICitation {
  ref: string;
  sourceName: string;
  observedAt: string;
}

export interface AIReportBlock {
  heading: string;
  body: string;
  citations: AICitation[];
  confidence: Confidence;
  insufficient?: boolean;
}

export interface AIReport {
  id: string;
  kind: AIReportKind;
  title: string;
  projectId: string | null;
  generatedAt: string;
  status: "draft" | "published" | "needs_review";
  audience: "internal" | "external";
  summary: string;
  blocks: AIReportBlock[];
  completeness: number;
}
