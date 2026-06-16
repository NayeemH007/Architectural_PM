import type {
  Approval,
  Client,
  Decision,
  Deliverable,
  Employee,
  Invoice,
  Metric,
  Milestone,
  Opportunity,
  Payment,
  Project,
  Provenance,
  Risk,
  Task,
} from "@/lib/types";

export const TODAY = "2026-06-17";

export const firm = {
  name: "SPACE ESSE",
  legalName: "Space Esse Architects Ltd.",
  tagline: "Architecture · Interior · Urban — Dhaka",
  office: "Banani, Dhaka",
  staff: 22,
  founded: 2014,
  currency: "BDT" as const,
};

// ---- helpers ----
function prov(
  sourceId: string,
  sourceName: string,
  recordRef: string,
  observedAt: string,
): Provenance {
  return { sourceId, sourceName, recordRef, observedAt, ingestedAt: observedAt };
}

function metric(p: Partial<Metric> & Pick<Metric, "value" | "label" | "confidence">): Metric {
  return {
    completeness: 80,
    asOf: TODAY,
    sources: [],
    ...p,
  } as Metric;
}

// ---- employees ----
export const employees: Employee[] = [
  {
    id: "e1",
    name: "Tahmid Karim",
    role: "Owner / Principal",
    title: "Principal Architect",
    avatarTone: "blue",
    capacityHours: 40,
    allocatedHours: 46,
    activeProjects: 8,
    timesheetCompliance: 35,
    utilization: metric({
      value: null,
      label: "Billable utilization",
      unit: "pct",
      confidence: "insufficient",
      completeness: 22,
      note: "Principal does not log time — utilization not computable.",
    }),
  },
  {
    id: "e2",
    name: "Rezwana Hoque",
    role: "Project Director",
    title: "Director, Delivery",
    avatarTone: "sienna",
    capacityHours: 40,
    allocatedHours: 41,
    activeProjects: 5,
    timesheetCompliance: 78,
    utilization: metric({
      value: 86,
      label: "Billable utilization",
      unit: "pct",
      confidence: "medium",
      completeness: 78,
      deltaPct: 4,
      trend: [72, 75, 80, 83, 84, 86],
    }),
  },
  {
    id: "e3",
    name: "Arif Chowdhury",
    role: "Project Architect",
    title: "Senior Project Architect",
    avatarTone: "blue",
    capacityHours: 40,
    allocatedHours: 44,
    activeProjects: 3,
    timesheetCompliance: 92,
    utilization: metric({
      value: 94,
      label: "Billable utilization",
      unit: "pct",
      confidence: "high",
      completeness: 92,
      deltaPct: 6,
      trend: [80, 84, 88, 90, 92, 94],
      note: "Over 90% for 6 weeks — overload risk.",
    }),
  },
  {
    id: "e4",
    name: "Nusrat Jahan",
    role: "Design Lead",
    title: "Design Lead",
    avatarTone: "sage",
    capacityHours: 40,
    allocatedHours: 33,
    activeProjects: 4,
    timesheetCompliance: 70,
    utilization: metric({
      value: 71,
      label: "Billable utilization",
      unit: "pct",
      confidence: "medium",
      completeness: 70,
      deltaPct: -8,
      trend: [88, 84, 79, 76, 73, 71],
    }),
  },
  {
    id: "e5",
    name: "Sabbir Rahman",
    role: "Project Architect",
    title: "Project Architect",
    avatarTone: "ochre",
    capacityHours: 40,
    allocatedHours: 38,
    activeProjects: 3,
    timesheetCompliance: 64,
    utilization: metric({
      value: 79,
      label: "Billable utilization",
      unit: "pct",
      confidence: "low",
      completeness: 64,
      deltaPct: 2,
      trend: [70, 74, 72, 77, 78, 79],
    }),
  },
  {
    id: "e6",
    name: "Farhana Islam",
    role: "Architect",
    title: "Architect",
    avatarTone: "blue",
    capacityHours: 40,
    allocatedHours: 40,
    activeProjects: 2,
    timesheetCompliance: 81,
    utilization: metric({
      value: 88,
      label: "Billable utilization",
      unit: "pct",
      confidence: "medium",
      completeness: 81,
      deltaPct: 1,
      trend: [84, 85, 86, 87, 88, 88],
    }),
  },
  {
    id: "e7",
    name: "Imran Hossain",
    role: "Junior Architect",
    title: "Junior Architect",
    avatarTone: "sage",
    capacityHours: 40,
    allocatedHours: 28,
    activeProjects: 2,
    timesheetCompliance: 58,
    utilization: metric({
      value: 62,
      label: "Billable utilization",
      unit: "pct",
      confidence: "low",
      completeness: 58,
      deltaPct: -3,
      trend: [70, 68, 66, 64, 63, 62],
    }),
  },
  {
    id: "e8",
    name: "Maya Das",
    role: "Finance / Admin",
    title: "Finance & Admin Officer",
    avatarTone: "sienna",
    capacityHours: 40,
    allocatedHours: 36,
    activeProjects: 8,
    timesheetCompliance: 50,
    utilization: metric({
      value: null,
      label: "Billable utilization",
      unit: "pct",
      confidence: "insufficient",
      completeness: 0,
      note: "Non-billable role.",
    }),
  },
  {
    id: "e9",
    name: "Kamrul Pasha",
    role: "BIM / CAD Lead",
    title: "BIM & Visualization Lead",
    avatarTone: "ochre",
    capacityHours: 40,
    allocatedHours: 42,
    activeProjects: 4,
    timesheetCompliance: 73,
    utilization: metric({
      value: 90,
      label: "Billable utilization",
      unit: "pct",
      confidence: "medium",
      completeness: 73,
      deltaPct: 5,
      trend: [78, 82, 85, 87, 89, 90],
    }),
  },
  {
    id: "e10",
    name: "Shahed Alam",
    role: "Liaison",
    title: "Authority Liaison",
    avatarTone: "blue",
    capacityHours: 40,
    allocatedHours: 30,
    activeProjects: 6,
    timesheetCompliance: 20,
    utilization: metric({
      value: null,
      label: "Billable utilization",
      unit: "pct",
      confidence: "insufficient",
      completeness: 10,
      note: "Field role — minimal time capture.",
    }),
  },
];

export const employeeById = (id: string) => employees.find((e) => e.id === id);

// ---- clients ----
export const clients: Client[] = [
  { id: "c1", name: "Aldenair Developments", type: "developer", city: "Dhaka", activeProjects: 2, lifetimeFee: 34_500_000, outstanding: 4_180_000, relationship: "strong" },
  { id: "c2", name: "Bashati Group", type: "corporate", city: "Dhaka", activeProjects: 1, lifetimeFee: 18_200_000, outstanding: 2_650_000, relationship: "neutral" },
  { id: "c3", name: "Dr. Anwar Residence", type: "private", city: "Dhaka", activeProjects: 1, lifetimeFee: 4_100_000, outstanding: 0, relationship: "strong" },
  { id: "c4", name: "Meghna Textiles", type: "corporate", city: "Narayanganj", activeProjects: 1, lifetimeFee: 9_700_000, outstanding: 3_900_000, relationship: "at_risk" },
  { id: "c5", name: "Cantonment School Trust", type: "institution", city: "Dhaka", activeProjects: 1, lifetimeFee: 12_400_000, outstanding: 1_240_000, relationship: "neutral" },
  { id: "c6", name: "Rafiq Family", type: "private", city: "Dhaka", activeProjects: 1, lifetimeFee: 2_900_000, outstanding: 620_000, relationship: "strong" },
  { id: "c7", name: "Lumina Retail Ltd.", type: "corporate", city: "Dhaka", activeProjects: 1, lifetimeFee: 6_300_000, outstanding: 0, relationship: "neutral" },
  { id: "c8", name: "GreenRoot Housing", type: "developer", city: "Dhaka", activeProjects: 1, lifetimeFee: 0, outstanding: 0, relationship: "neutral" },
];

export const clientById = (id: string) => clients.find((c) => c.id === id);

// ---- projects ----
export const projects: Project[] = [
  {
    id: "p1",
    code: "SK-2401",
    name: "Aldenair Lake Residences",
    nameBn: "অ্যালডেনায়ার লেক রেসিডেন্স",
    client: "Aldenair Developments",
    clientId: "c1",
    type: "residential",
    stage: "construction_docs",
    city: "Bashundhara, Dhaka",
    leadId: "e2",
    teamIds: ["e2", "e3", "e6", "e9"],
    startDate: "2024-03-10",
    targetHandover: "2026-11-30",
    health: "watch",
    healthScore: metric({ value: 68, label: "Project Health", unit: "score", confidence: "medium", completeness: 74, deltaPct: -5, trend: [78, 76, 74, 72, 70, 68], formula: "0.30·Budget + 0.25·Schedule + 0.20·Deliverable + 0.15·Approval + 0.10·Completeness" }),
    feeContract: 22_000_000,
    feeBilled: 13_400_000,
    feeCollected: 9_220_000,
    feeWip: 2_350_000,
    budgetCost: 12_100_000,
    costToDate: 8_900_000,
    forecastMargin: metric({ value: 19, label: "Forecast margin", unit: "pct", confidence: "low", completeness: 61, deltaPct: -6, note: "Labour cost partial (timesheet coverage 61%) — margin is indicative." }),
    pctComplete: 64,
    scheduleVarianceDays: -18,
    openRisks: 3,
    openApprovals: 1,
    completeness: 74,
    currency: "BDT",
    crossRefs: [
      { sourceId: "ds_tally", sourceName: "Tally", alias: "Aldenair Lake Res.", matched: true, confidence: "high" },
      { sourceId: "ds_drive", sourceName: "Google Drive", alias: "01_Aldenair_Lake", matched: true, confidence: "high" },
      { sourceId: "ds_acad", sourceName: "AutoCAD (Drive)", alias: "ALR-CD", matched: true, confidence: "medium" },
      { sourceId: "ds_wa", sourceName: "WhatsApp", alias: "Aldenair Site Grp", matched: false, confidence: "low" },
    ],
  },
  {
    id: "p2",
    code: "SK-2406",
    name: "Bashati Corporate Tower",
    client: "Bashati Group",
    clientId: "c2",
    type: "commercial",
    stage: "authority_approval",
    city: "Gulshan, Dhaka",
    leadId: "e2",
    teamIds: ["e2", "e5", "e9", "e10"],
    startDate: "2024-09-02",
    targetHandover: "2027-06-15",
    health: "at_risk",
    healthScore: metric({ value: 48, label: "Project Health", unit: "score", confidence: "medium", completeness: 70, deltaPct: -12, trend: [70, 66, 60, 56, 52, 48], note: "Capped at 49 — RAJUK Construction Permit overdue (blocking).", formula: "Hard-cap: overdue blocking authority approval" }),
    feeContract: 31_500_000,
    feeBilled: 14_800_000,
    feeCollected: 12_150_000,
    feeWip: 1_900_000,
    budgetCost: 17_300_000,
    costToDate: 9_400_000,
    forecastMargin: metric({ value: 22, label: "Forecast margin", unit: "pct", confidence: "low", completeness: 58 }),
    pctComplete: 41,
    scheduleVarianceDays: -47,
    openRisks: 4,
    openApprovals: 2,
    completeness: 70,
    currency: "BDT",
    crossRefs: [
      { sourceId: "ds_tally", sourceName: "Tally", alias: "Bashati Tower", matched: true, confidence: "high" },
      { sourceId: "ds_drive", sourceName: "Google Drive", alias: "Bashati_GULSHAN", matched: true, confidence: "medium" },
      { sourceId: "ds_ecps", sourceName: "RAJUK ECPS", alias: "ECPS-2024-88213", matched: true, confidence: "high" },
    ],
  },
  {
    id: "p3",
    code: "SK-2503",
    name: "Dr. Anwar Residence",
    client: "Dr. Anwar Residence",
    clientId: "c3",
    type: "residential",
    stage: "construction_admin",
    city: "Dhanmondi, Dhaka",
    leadId: "e3",
    teamIds: ["e3", "e7", "e10"],
    startDate: "2025-01-20",
    targetHandover: "2026-08-30",
    health: "healthy",
    healthScore: metric({ value: 82, label: "Project Health", unit: "score", confidence: "high", completeness: 88, deltaPct: 3, trend: [76, 78, 79, 80, 81, 82] }),
    feeContract: 4_500_000,
    feeBilled: 3_800_000,
    feeCollected: 3_800_000,
    feeWip: 250_000,
    budgetCost: 2_300_000,
    costToDate: 1_980_000,
    forecastMargin: metric({ value: 31, label: "Forecast margin", unit: "pct", confidence: "high", completeness: 88 }),
    pctComplete: 88,
    scheduleVarianceDays: 4,
    openRisks: 1,
    openApprovals: 0,
    completeness: 88,
    currency: "BDT",
    crossRefs: [
      { sourceId: "ds_tally", sourceName: "Tally", alias: "Anwar Residence", matched: true, confidence: "high" },
      { sourceId: "ds_drive", sourceName: "Google Drive", alias: "Anwar_Dhanmondi", matched: true, confidence: "high" },
    ],
  },
  {
    id: "p4",
    code: "SK-2505",
    name: "Meghna Textiles HQ Interior",
    client: "Meghna Textiles",
    clientId: "c4",
    type: "interior",
    stage: "construction_admin",
    city: "Narayanganj",
    leadId: "e4",
    teamIds: ["e4", "e5", "e6"],
    startDate: "2025-03-15",
    targetHandover: "2026-07-20",
    health: "critical",
    healthScore: metric({ value: 39, label: "Project Health", unit: "score", confidence: "medium", completeness: 66, deltaPct: -18, trend: [62, 58, 52, 47, 43, 39], note: "Scope creep + aged receivable." }),
    feeContract: 7_800_000,
    feeBilled: 6_900_000,
    feeCollected: 3_000_000,
    feeWip: 1_400_000,
    budgetCost: 4_200_000,
    costToDate: 4_650_000,
    forecastMargin: metric({ value: 4, label: "Forecast margin", unit: "pct", confidence: "low", completeness: 60, deltaPct: -21, note: "Cost-to-date exceeds plan; unbilled change orders detected." }),
    pctComplete: 79,
    scheduleVarianceDays: -22,
    openRisks: 5,
    openApprovals: 0,
    completeness: 66,
    currency: "BDT",
    crossRefs: [
      { sourceId: "ds_tally", sourceName: "Tally", alias: "Meghna Interior", matched: true, confidence: "high" },
      { sourceId: "ds_drive", sourceName: "Google Drive", alias: "Meghna_HQ", matched: true, confidence: "medium" },
      { sourceId: "ds_wa", sourceName: "WhatsApp", alias: "Meghna FitOut", matched: false, confidence: "low" },
    ],
  },
  {
    id: "p5",
    code: "SK-2508",
    name: "Cantonment School Block C",
    client: "Cantonment School Trust",
    clientId: "c5",
    type: "institutional",
    stage: "design_dev",
    city: "Dhaka Cantonment",
    leadId: "e3",
    teamIds: ["e3", "e6", "e7", "e9"],
    startDate: "2025-06-01",
    targetHandover: "2027-09-30",
    health: "healthy",
    healthScore: metric({ value: 76, label: "Project Health", unit: "score", confidence: "medium", completeness: 72, deltaPct: 2, trend: [70, 71, 73, 74, 75, 76] }),
    feeContract: 14_200_000,
    feeBilled: 5_100_000,
    feeCollected: 3_860_000,
    feeWip: 1_650_000,
    budgetCost: 7_800_000,
    costToDate: 2_700_000,
    forecastMargin: metric({ value: 24, label: "Forecast margin", unit: "pct", confidence: "low", completeness: 64 }),
    pctComplete: 32,
    scheduleVarianceDays: 2,
    openRisks: 2,
    openApprovals: 1,
    completeness: 72,
    currency: "BDT",
    crossRefs: [
      { sourceId: "ds_tally", sourceName: "Tally", alias: "Cantonment School", matched: true, confidence: "high" },
      { sourceId: "ds_drive", sourceName: "Google Drive", alias: "CST_BlockC", matched: true, confidence: "high" },
    ],
  },
  {
    id: "p6",
    code: "SK-2511",
    name: "Rafiq Duplex",
    client: "Rafiq Family",
    clientId: "c6",
    type: "residential",
    stage: "schematic",
    city: "Uttara, Dhaka",
    leadId: "e5",
    teamIds: ["e5", "e7"],
    startDate: "2025-10-12",
    targetHandover: "2027-03-15",
    health: "watch",
    healthScore: metric({ value: 64, label: "Project Health", unit: "score", confidence: "low", completeness: 48, deltaPct: 0, trend: [64, 63, 64, 65, 64, 64], note: "Low data — recently onboarded into Space Esse." }),
    feeContract: 3_200_000,
    feeBilled: 640_000,
    feeCollected: 640_000,
    feeWip: 180_000,
    budgetCost: 1_700_000,
    costToDate: 410_000,
    forecastMargin: metric({ value: null, label: "Forecast margin", unit: "pct", confidence: "insufficient", completeness: 30, note: "Insufficient timesheet + cost data to forecast margin." }),
    pctComplete: 18,
    scheduleVarianceDays: -3,
    openRisks: 1,
    openApprovals: 1,
    completeness: 48,
    currency: "BDT",
    crossRefs: [
      { sourceId: "ds_drive", sourceName: "Google Drive", alias: "Rafiq_Uttara", matched: true, confidence: "medium" },
      { sourceId: "ds_tally", sourceName: "Tally", alias: "—", matched: false, confidence: "insufficient" },
    ],
  },
  {
    id: "p7",
    code: "SK-2512",
    name: "Lumina Flagship Store",
    client: "Lumina Retail Ltd.",
    clientId: "c7",
    type: "interior",
    stage: "tender",
    city: "Banani, Dhaka",
    leadId: "e4",
    teamIds: ["e4", "e6"],
    startDate: "2025-11-25",
    targetHandover: "2026-09-10",
    health: "healthy",
    healthScore: metric({ value: 79, label: "Project Health", unit: "score", confidence: "medium", completeness: 76, deltaPct: 1, trend: [74, 75, 77, 78, 78, 79] }),
    feeContract: 6_300_000,
    feeBilled: 3_780_000,
    feeCollected: 3_780_000,
    feeWip: 520_000,
    budgetCost: 3_100_000,
    costToDate: 1_850_000,
    forecastMargin: metric({ value: 27, label: "Forecast margin", unit: "pct", confidence: "medium", completeness: 76 }),
    pctComplete: 58,
    scheduleVarianceDays: 1,
    openRisks: 1,
    openApprovals: 0,
    completeness: 76,
    currency: "BDT",
    crossRefs: [
      { sourceId: "ds_tally", sourceName: "Tally", alias: "Lumina Store", matched: true, confidence: "high" },
      { sourceId: "ds_drive", sourceName: "Google Drive", alias: "Lumina_Banani", matched: true, confidence: "high" },
    ],
  },
  {
    id: "p8",
    code: "SK-2601",
    name: "GreenRoot Mixed-Use (Concept)",
    client: "GreenRoot Housing",
    clientId: "c8",
    type: "mixed_use",
    stage: "concept",
    city: "Purbachal, Dhaka",
    leadId: "e2",
    teamIds: ["e2", "e4", "e9"],
    startDate: "2026-02-01",
    targetHandover: "2028-12-31",
    health: "watch",
    healthScore: metric({ value: 61, label: "Project Health", unit: "score", confidence: "low", completeness: 40, deltaPct: 0, trend: [60, 61, 60, 61, 61, 61], note: "Concept stage — limited data." }),
    feeContract: 9_500_000,
    feeBilled: 0,
    feeCollected: 0,
    feeWip: 480_000,
    budgetCost: 5_100_000,
    costToDate: 320_000,
    forecastMargin: metric({ value: null, label: "Forecast margin", unit: "pct", confidence: "insufficient", completeness: 25 }),
    pctComplete: 8,
    scheduleVarianceDays: 0,
    openRisks: 2,
    openApprovals: 0,
    completeness: 40,
    currency: "BDT",
    crossRefs: [
      { sourceId: "ds_drive", sourceName: "Google Drive", alias: "GreenRoot_Concept", matched: true, confidence: "medium" },
    ],
  },
];

export const projectById = (id: string) => projects.find((p) => p.id === id);

// ---- authority approvals ----
export const approvals: Approval[] = [
  { id: "ap1", projectId: "p2", authority: "RAJUK", title: "Construction Permit (Form 301)", status: "in_review", submittedDate: "2026-03-18", expectedDate: "2026-04-17", approvedDate: null, daysInStage: 61, statutoryDays: 30, blocking: true, owner: "Shahed Alam", lastUpdate: "2026-06-12", source: prov("ds_ecps", "RAJUK ECPS", "ECPS-2024-88213", "2026-06-12") },
  { id: "ap2", projectId: "p2", authority: "FSCD", title: "Fire Service Design NOC", status: "query_raised", submittedDate: "2026-04-02", expectedDate: "2026-05-15", approvedDate: null, daysInStage: 33, statutoryDays: null, blocking: true, owner: "Shahed Alam", lastUpdate: "2026-06-09", source: prov("ds_manual", "Manual capture", "Approval log #112", "2026-06-09") },
  { id: "ap3", projectId: "p1", authority: "RAJUK", title: "Land Use Clearance (Form 101)", status: "approved", submittedDate: "2024-05-10", expectedDate: "2024-06-09", approvedDate: "2024-07-02", daysInStage: 0, statutoryDays: 30, blocking: false, owner: "Shahed Alam", lastUpdate: "2024-07-02", source: prov("ds_ecps", "RAJUK ECPS", "ECPS-2024-41882", "2024-07-02") },
  { id: "ap4", projectId: "p1", authority: "DPDC", title: "Electrical Load Connection", status: "preparing", submittedDate: null, expectedDate: "2026-09-01", approvedDate: null, daysInStage: 0, statutoryDays: null, blocking: false, owner: "Shahed Alam", lastUpdate: "2026-06-10", source: prov("ds_manual", "Manual capture", "Approval log #131", "2026-06-10") },
  { id: "ap5", projectId: "p5", authority: "RAJUK", title: "Land Use Clearance (Form 101)", status: "submitted", submittedDate: "2026-05-28", expectedDate: "2026-06-27", approvedDate: null, daysInStage: 20, statutoryDays: 30, blocking: false, owner: "Shahed Alam", lastUpdate: "2026-06-11", source: prov("ds_ecps", "RAJUK ECPS", "ECPS-2025-77310", "2026-06-11") },
  { id: "ap6", projectId: "p6", authority: "RAJUK", title: "Land Use Clearance (Form 101)", status: "not_started", submittedDate: null, expectedDate: "2026-08-15", approvedDate: null, daysInStage: 0, statutoryDays: 30, blocking: false, owner: "Shahed Alam", lastUpdate: "2026-06-05", source: prov("ds_manual", "Manual capture", "Approval log #140", "2026-06-05") },
  { id: "ap7", projectId: "p2", authority: "CAAB", title: "Height Clearance (OLS)", status: "approved", submittedDate: "2025-01-15", expectedDate: "2025-03-15", approvedDate: "2025-04-08", daysInStage: 0, statutoryDays: null, blocking: false, owner: "Shahed Alam", lastUpdate: "2025-04-08", source: prov("ds_manual", "Manual capture", "Approval log #88", "2025-04-08") },
  { id: "ap8", projectId: "p5", authority: "DoE", title: "Environmental Clearance (ECC)", status: "preparing", submittedDate: null, expectedDate: "2026-08-30", approvedDate: null, daysInStage: 0, statutoryDays: null, blocking: false, owner: "Rezwana Hoque", lastUpdate: "2026-06-08", source: prov("ds_manual", "Manual capture", "Approval log #145", "2026-06-08") },
];

export const approvalsByProject = (pid: string) => approvals.filter((a) => a.projectId === pid);

// ---- milestones ----
export const milestones: Milestone[] = [
  { id: "m1", projectId: "p1", name: "Construction Documents — 50% set", phase: "construction_docs", dueDate: "2026-06-30", status: "due_soon", completedDate: null },
  { id: "m2", projectId: "p1", name: "Structural coordination freeze", phase: "construction_docs", dueDate: "2026-06-10", status: "overdue", completedDate: null },
  { id: "m3", projectId: "p2", name: "RAJUK Construction Permit", phase: "authority_approval", dueDate: "2026-04-17", status: "overdue", completedDate: null },
  { id: "m4", projectId: "p3", name: "Site inspection — finishes", phase: "construction_admin", dueDate: "2026-06-22", status: "due_soon", completedDate: null },
  { id: "m5", projectId: "p4", name: "Joinery shop drawings approval", phase: "construction_admin", dueDate: "2026-06-05", status: "overdue", completedDate: null },
  { id: "m6", projectId: "p5", name: "Design Development sign-off", phase: "design_dev", dueDate: "2026-07-15", status: "upcoming", completedDate: null },
  { id: "m7", projectId: "p7", name: "Tender issue to contractors", phase: "tender", dueDate: "2026-06-20", status: "due_soon", completedDate: null },
  { id: "m8", projectId: "p3", name: "Schematic design approval", phase: "schematic", dueDate: "2025-04-10", status: "done", completedDate: "2025-04-08" },
  { id: "m9", projectId: "p6", name: "Concept presentation", phase: "concept", dueDate: "2026-01-20", status: "done", completedDate: "2026-01-22" },
  { id: "m10", projectId: "p8", name: "Concept design pack", phase: "concept", dueDate: "2026-07-01", status: "upcoming", completedDate: null },
];

export const milestonesByProject = (pid: string) => milestones.filter((m) => m.projectId === pid);

// ---- tasks ----
export const tasks: Task[] = [
  { id: "t1", projectId: "p1", title: "Coordinate beam drops with MEP", assigneeId: "e3", status: "in_progress", dueDate: "2026-06-16", overdue: true, source: "Trello" },
  { id: "t2", projectId: "p1", title: "Update façade detail A-431", assigneeId: "e6", status: "review", dueDate: "2026-06-19", overdue: false, source: "Trello" },
  { id: "t3", projectId: "p2", title: "Respond to FSCD query letter", assigneeId: "e10", status: "todo", dueDate: "2026-06-15", overdue: true, source: "Manual capture" },
  { id: "t4", projectId: "p4", title: "Issue revised reception millwork", assigneeId: "e5", status: "blocked", dueDate: "2026-06-12", overdue: true, source: "WhatsApp → capture" },
  { id: "t5", projectId: "p4", title: "Reconcile change orders with client", assigneeId: "e4", status: "todo", dueDate: "2026-06-18", overdue: false, source: "Manual capture" },
  { id: "t6", projectId: "p5", title: "Classroom daylight study", assigneeId: "e7", status: "in_progress", dueDate: "2026-06-25", overdue: false, source: "Trello" },
  { id: "t7", projectId: "p7", title: "Finalize BoQ for tender", assigneeId: "e6", status: "in_progress", dueDate: "2026-06-19", overdue: false, source: "Excel import" },
  { id: "t8", projectId: "p3", title: "Snag list — level 2", assigneeId: "e7", status: "in_progress", dueDate: "2026-06-21", overdue: false, source: "Manual capture" },
];

export const tasksByProject = (pid: string) => tasks.filter((t) => t.projectId === pid);

// ---- deliverables ----
export const deliverables: Deliverable[] = [
  { id: "d1", projectId: "p1", name: "A-201 Ground Floor Plan", discipline: "Architecture", status: "issued", revision: "R4", revisionCount: 4, dueDate: "2026-06-10", issuedDate: "2026-06-09", fileRef: "Drive: /01_Aldenair/CD/A-201_R4.dwg", source: "Google Drive" },
  { id: "d2", projectId: "p1", name: "A-431 Façade Detail", discipline: "Architecture", status: "internal_review", revision: "R2", revisionCount: 2, dueDate: "2026-06-19", issuedDate: null, fileRef: "Drive: /01_Aldenair/CD/A-431_R2.dwg", source: "Google Drive" },
  { id: "d3", projectId: "p1", name: "S-101 Foundation Layout", discipline: "Structure", status: "revise", revision: "R3", revisionCount: 3, dueDate: "2026-06-08", issuedDate: null, fileRef: null, source: "Consultant (email)" },
  { id: "d4", projectId: "p2", name: "Permit Set — Architectural", discipline: "Architecture", status: "issued", revision: "R1", revisionCount: 1, dueDate: "2026-03-15", issuedDate: "2026-03-16", fileRef: "Drive: /Bashati/Permit/ARCH_R1.pdf", source: "Google Drive" },
  { id: "d5", projectId: "p4", name: "ID-210 Reception Millwork", discipline: "Interior", status: "revise", revision: "R5", revisionCount: 5, dueDate: "2026-06-05", issuedDate: null, fileRef: "Drive: /Meghna/ID/ID-210_R5.dwg", source: "Google Drive", },
  { id: "d6", projectId: "p4", name: "ID-110 Layout & RCP", discipline: "Interior", status: "issued", revision: "R3", revisionCount: 3, dueDate: "2026-05-20", issuedDate: "2026-05-21", fileRef: "Drive: /Meghna/ID/ID-110_R3.dwg", source: "Google Drive" },
  { id: "d7", projectId: "p5", name: "DD Package — Block C", discipline: "Architecture", status: "in_progress", revision: "R1", revisionCount: 1, dueDate: "2026-07-15", issuedDate: null, fileRef: null, source: "—" },
  { id: "d8", projectId: "p7", name: "Tender Drawing Set", discipline: "Interior", status: "internal_review", revision: "R2", revisionCount: 2, dueDate: "2026-06-20", issuedDate: null, fileRef: "Drive: /Lumina/Tender/SET_R2.pdf", source: "Google Drive" },
  { id: "d9", projectId: "p3", name: "As-built Floor Plans", discipline: "Architecture", status: "in_progress", revision: "R1", revisionCount: 1, dueDate: "2026-07-30", issuedDate: null, fileRef: null, source: "AutoCAD (Drive)" },
];

export const deliverablesByProject = (pid: string) => deliverables.filter((d) => d.projectId === pid);

// ---- invoices ----
export const invoices: Invoice[] = [
  inv("INV-2026-031", "p1", "Aldenair Developments", "2026-05-02", "2026-06-01", 2_400_000, "sent"),
  inv("INV-2026-028", "p1", "Aldenair Developments", "2026-03-15", "2026-04-14", 1_800_000, "overdue"),
  inv("INV-2026-035", "p2", "Bashati Group", "2026-05-20", "2026-06-19", 2_650_000, "sent"),
  inv("INV-2026-019", "p4", "Meghna Textiles", "2026-02-10", "2026-03-12", 2_200_000, "overdue"),
  inv("INV-2026-022", "p4", "Meghna Textiles", "2026-03-28", "2026-04-27", 1_700_000, "overdue"),
  inv("INV-2026-030", "p5", "Cantonment School Trust", "2026-04-30", "2026-05-30", 1_240_000, "part_paid"),
  inv("INV-2026-014", "p3", "Dr. Anwar Residence", "2026-01-18", "2026-02-17", 900_000, "paid"),
  inv("INV-2026-037", "p7", "Lumina Retail Ltd.", "2026-06-01", "2026-07-01", 1_260_000, "sent"),
  inv("INV-2026-040", "p6", "Rafiq Family", "2026-05-25", "2026-06-24", 640_000, "part_paid"),
  inv("INV-2026-012", "p1", "Aldenair Developments", "2026-01-05", "2026-02-04", 2_000_000, "paid"),
];

function inv(
  number: string,
  projectId: string,
  client: string,
  issueDate: string,
  dueDate: string,
  grossFee: number,
  status: Invoice["status"],
): Invoice {
  const vat = Math.round(grossFee * 0.15);
  const vdsWithheld = Math.round(vat * 0.6);
  const aitWithheld = Math.round(grossFee * 0.1);
  const netReceivable = grossFee + vat - vdsWithheld - aitWithheld;
  const received =
    status === "paid" ? netReceivable : status === "part_paid" ? Math.round(netReceivable * 0.5) : 0;
  const aging =
    status === "overdue"
      ? Math.max(0, Math.round((+new Date(TODAY) - +new Date(dueDate)) / 86400000))
      : status === "paid"
        ? 0
        : Math.max(0, Math.round((+new Date(TODAY) - +new Date(dueDate)) / 86400000));
  return {
    id: number,
    number,
    projectId,
    client,
    issueDate,
    dueDate,
    grossFee,
    vat,
    vdsWithheld,
    aitWithheld,
    netReceivable,
    amountReceived: received,
    status,
    agingDays: aging,
    currency: "BDT",
  };
}

export const invoicesByProject = (pid: string) => invoices.filter((i) => i.projectId === pid);

export const payments: Payment[] = [
  { id: "pay1", invoiceNumber: "INV-2026-014", projectId: "p3", date: "2026-02-10", amount: 1_012_500, method: "bank", currency: "BDT" },
  { id: "pay2", invoiceNumber: "INV-2026-012", projectId: "p1", date: "2026-02-01", amount: 2_250_000, method: "bank", currency: "BDT" },
  { id: "pay3", invoiceNumber: "INV-2026-030", projectId: "p5", date: "2026-05-29", amount: 697_500, method: "cheque", currency: "BDT" },
  { id: "pay4", invoiceNumber: "INV-2026-040", projectId: "p6", date: "2026-06-10", amount: 360_000, method: "bkash", currency: "BDT" },
];

// ---- risks ----
export const risks: Risk[] = [
  { id: "r1", projectId: "p2", title: "RAJUK Construction Permit overdue 61 days — blocks construction start", category: "approval", likelihood: "high", impact: "high", status: "mitigating", owner: "Shahed Alam", raisedDate: "2026-05-02" },
  { id: "r2", projectId: "p4", title: "Unbilled change orders (~৳1.4L) — margin erosion", category: "scope", likelihood: "high", impact: "high", status: "open", owner: "Nusrat Jahan", raisedDate: "2026-05-18" },
  { id: "r3", projectId: "p4", title: "Meghna receivable ৳39L aged 90+ days", category: "financial", likelihood: "high", impact: "high", status: "open", owner: "Maya Das", raisedDate: "2026-05-25" },
  { id: "r4", projectId: "p1", title: "Structural set R3 returned for revision — CD slip risk", category: "schedule", likelihood: "medium", impact: "high", status: "mitigating", owner: "Arif Chowdhury", raisedDate: "2026-06-02" },
  { id: "r5", projectId: "p1", title: "Site WhatsApp decisions not logged — coordination gaps", category: "scope", likelihood: "medium", impact: "medium", status: "open", owner: "Rezwana Hoque", raisedDate: "2026-06-08" },
  { id: "r6", projectId: "p3", title: "Final snag list slipping toward handover", category: "schedule", likelihood: "low", impact: "medium", status: "open", owner: "Arif Chowdhury", raisedDate: "2026-06-10" },
  { id: "r7", projectId: "p5", title: "DoE clearance not started — may delay later phases", category: "approval", likelihood: "medium", impact: "medium", status: "open", owner: "Rezwana Hoque", raisedDate: "2026-06-08" },
  { id: "r8", projectId: "p2", title: "Arif Chowdhury > 90% utilization 6 weeks — burnout/overload", category: "resource", likelihood: "medium", impact: "medium", status: "open", owner: "Rezwana Hoque", raisedDate: "2026-06-09" },
];

export const risksByProject = (pid: string) => risks.filter((r) => r.projectId === pid);

// ---- decisions ----
export const decisions: Decision[] = [
  { id: "dec1", projectId: "p4", summary: "Client approved upgraded reception stone — cost impact pending", decidedBy: "Meghna (Mr. Sohel)", date: "2026-06-09", channel: "whatsapp", promoted: true, source: prov("ds_manual", "WhatsApp → capture", "Decision #214", "2026-06-09") },
  { id: "dec2", projectId: "p1", summary: "Beam drop location confirmed at grid C-4 after MEP review", decidedBy: "Rezwana Hoque", date: "2026-06-11", channel: "meeting", promoted: true, source: prov("ds_manual", "Manual capture", "Decision #221", "2026-06-11") },
  { id: "dec3", projectId: "p2", summary: "FSCD query — revise refuge floor area; resubmit by 20 Jun", decidedBy: "Shahed Alam", date: "2026-06-09", channel: "call", promoted: false, source: prov("ds_manual", "Phone note", "Decision #219", "2026-06-09") },
  { id: "dec4", projectId: "p7", summary: "Tender to go to 3 contractors; shortlist agreed", decidedBy: "Lumina (procurement)", date: "2026-06-08", channel: "email", promoted: true, source: prov("ds_gmail", "Gmail", "thread:Re: Tender list", "2026-06-08") },
  { id: "dec5", projectId: "p3", summary: "Owner accepted alternate floor tile (lead time)", decidedBy: "Dr. Anwar", date: "2026-06-05", channel: "site", promoted: true, source: prov("ds_manual", "Site note", "Decision #210", "2026-06-05") },
];

export const decisionsByProject = (pid: string) => decisions.filter((d) => d.projectId === pid);

// ---- pipeline / opportunities ----
export const opportunities: Opportunity[] = [
  { id: "o1", name: "Tejgaon Office Refurb", client: "Bashati Group", type: "interior", stage: "proposal", estFee: 4_800_000, probability: 55, owner: "Rezwana Hoque", expectedDecision: "2026-07-10", lastActivity: "2026-06-12" },
  { id: "o2", name: "Purbachal Villa Cluster", client: "Aldenair Developments", type: "residential", stage: "negotiation", estFee: 12_000_000, probability: 70, owner: "Tahmid Karim", expectedDecision: "2026-06-30", lastActivity: "2026-06-14" },
  { id: "o3", name: "Banani Café Fit-out", client: "Lumina Retail Ltd.", type: "interior", stage: "qualified", estFee: 2_100_000, probability: 40, owner: "Nusrat Jahan", expectedDecision: "2026-07-25", lastActivity: "2026-06-05" },
  { id: "o4", name: "Mirpur Community Clinic", client: "Govt (DGHS)", type: "institutional", stage: "lead", estFee: 8_500_000, probability: 20, owner: "Tahmid Karim", expectedDecision: "2026-09-01", lastActivity: "2026-05-28" },
  { id: "o5", name: "Gulshan Penthouse Interior", client: "Private (Mr. Reza)", type: "interior", stage: "proposal", estFee: 3_600_000, probability: 50, owner: "Nusrat Jahan", expectedDecision: "2026-07-05", lastActivity: "2026-06-11" },
  { id: "o6", name: "Savar Factory Expansion", client: "Meghna Textiles", type: "industrial", stage: "lead", estFee: 6_000_000, probability: 15, owner: "Rezwana Hoque", expectedDecision: "2026-08-20", lastActivity: "2026-05-20" },
  { id: "o7", name: "Bashundhara Townhouses", client: "GreenRoot Housing", type: "residential", stage: "won", estFee: 9_500_000, probability: 100, owner: "Tahmid Karim", expectedDecision: "2026-01-28", lastActivity: "2026-02-01" },
];
