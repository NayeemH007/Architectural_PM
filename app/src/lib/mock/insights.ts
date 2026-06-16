import type { Alert, AIReport } from "@/lib/types";

export const alerts: Alert[] = [
  {
    id: "al1",
    severity: "critical",
    title: "RAJUK Construction Permit overdue 61 days",
    detail:
      "Bashati Corporate Tower — Form 301 submitted 18 Mar, statutory window 30 days. Blocks construction start; project health capped at 49.",
    projectId: "p2",
    category: "Authority approval",
    createdAt: "2026-06-17T07:30:00",
    confidence: "high",
    source: { sourceId: "ds_ecps", sourceName: "RAJUK ECPS", recordRef: "ECPS-2024-88213", observedAt: "2026-06-12" },
    acknowledged: false,
  },
  {
    id: "al2",
    severity: "critical",
    title: "Meghna receivable ৳39.0L aged 90+ days",
    detail:
      "Two invoices (INV-2026-019, INV-2026-022) past due. Net cash at risk after VAT/VDS/AIT. Client relationship flagged at-risk.",
    projectId: "p4",
    category: "Collections",
    createdAt: "2026-06-17T07:30:00",
    confidence: "high",
    source: { sourceId: "ds_tally", sourceName: "TallyPrime", recordRef: "INV-2026-019, INV-2026-022", observedAt: "2026-06-12" },
    acknowledged: false,
  },
  {
    id: "al3",
    severity: "warning",
    title: "Meghna Interior margin forecast down to 4%",
    detail:
      "Cost-to-date exceeds plan and unbilled change orders (~৳1.4L) detected. Margin is low-confidence — timesheet coverage 60%.",
    projectId: "p4",
    category: "Profitability",
    createdAt: "2026-06-16T18:00:00",
    confidence: "low",
    source: { sourceId: "ds_manual", sourceName: "Manual capture", recordRef: "Change log; Decision #214", observedAt: "2026-06-09" },
    acknowledged: false,
  },
  {
    id: "al4",
    severity: "warning",
    title: "Arif Chowdhury > 90% utilization for 6 weeks",
    detail:
      "Sustained overload across Anwar Residence + Cantonment School. Consider rebalancing before CD push on Aldenair.",
    projectId: null,
    category: "Resourcing",
    createdAt: "2026-06-16T09:15:00",
    confidence: "high",
    source: { sourceId: "ds_manual", sourceName: "Timesheet capture", recordRef: "Utilization series e3", observedAt: "2026-06-15" },
    acknowledged: false,
  },
  {
    id: "al5",
    severity: "warning",
    title: "Aldenair CD set behind by 18 days",
    detail:
      "Structural set R3 returned for revision; 50% CD milestone due 30 Jun at risk. Schedule variance −18d and widening.",
    projectId: "p1",
    category: "Schedule",
    createdAt: "2026-06-15T16:40:00",
    confidence: "medium",
    source: { sourceId: "ds_drive", sourceName: "Google Drive", recordRef: "S-101_R3 (revise)", observedAt: "2026-06-08" },
    acknowledged: true,
  },
  {
    id: "al6",
    severity: "warning",
    title: "TallyPrime export is 5 days stale",
    detail:
      "Last finance export 12 Jun. Collections, WIP and margin KPIs may lag. Upload this week's export to refresh.",
    projectId: null,
    category: "Data quality",
    createdAt: "2026-06-17T06:00:00",
    confidence: "high",
    source: { sourceId: "ds_tally", sourceName: "TallyPrime", recordRef: "export 2026-06-12", observedAt: "2026-06-12" },
    acknowledged: false,
  },
  {
    id: "al7",
    severity: "info",
    title: "FSCD query raised on Bashati Tower",
    detail:
      "Fire Service requested refuge floor area revision. Resubmission targeted 20 Jun (captured via phone note — not yet promoted).",
    projectId: "p2",
    category: "Authority approval",
    createdAt: "2026-06-16T11:00:00",
    confidence: "medium",
    source: { sourceId: "ds_manual", sourceName: "Phone note", recordRef: "Decision #219", observedAt: "2026-06-09" },
    acknowledged: false,
  },
  {
    id: "al8",
    severity: "positive",
    title: "Anwar Residence collected in full",
    detail: "INV-2026-014 paid. Project margin holding at 31% (high confidence).",
    projectId: "p3",
    category: "Collections",
    createdAt: "2026-06-14T10:00:00",
    confidence: "high",
    source: { sourceId: "ds_tally", sourceName: "TallyPrime", recordRef: "INV-2026-014", observedAt: "2026-02-10" },
    acknowledged: true,
  },
];

export const aiReports: AIReport[] = [
  {
    id: "rep_daily",
    kind: "daily_brief",
    title: "Daily Executive Briefing",
    projectId: null,
    generatedAt: "2026-06-17T07:30:00",
    status: "published",
    audience: "internal",
    completeness: 73,
    summary:
      "Two items need your attention today: Bashati's RAJUK permit is now 61 days overdue (blocking), and Meghna's ৳39L receivable has crossed 90 days. Portfolio fee-margin is holding, but one project's margin is low-confidence pending timesheets.",
    blocks: [
      {
        heading: "Money",
        body: "Net cash collected this month is ৳1.07Cr against ৳1.42Cr billed. Collection rate is 75% — pulled down almost entirely by Meghna Textiles (INV-2026-019 and INV-2026-022, ৳39.0L, 90+ days). Anwar Residence cleared in full on 14 Jun.",
        confidence: "high",
        citations: [
          { ref: "INV-2026-019", sourceName: "TallyPrime", observedAt: "2026-06-12" },
          { ref: "INV-2026-022", sourceName: "TallyPrime", observedAt: "2026-06-12" },
          { ref: "INV-2026-014", sourceName: "TallyPrime", observedAt: "2026-02-10" },
        ],
      },
      {
        heading: "Delivery & Approvals",
        body: "Bashati Corporate Tower's RAJUK Construction Permit (Form 301) has been in review 61 days versus the 30-day statutory window — it blocks construction start and has capped the project's health score at 49. FSCD also raised a query (refuge floor area); resubmission is targeted for 20 Jun.",
        confidence: "high",
        citations: [
          { ref: "ECPS-2024-88213", sourceName: "RAJUK ECPS", observedAt: "2026-06-12" },
          { ref: "Decision #219", sourceName: "Phone note", observedAt: "2026-06-09" },
        ],
      },
      {
        heading: "People",
        body: "Firm-wide utilization cannot be stated with confidence: only 6 of 10 staff log time, and timesheet coverage is 64% this week. Arif Chowdhury is the clear signal — above 90% for six straight weeks.",
        confidence: "low",
        citations: [{ ref: "Utilization series e3", sourceName: "Timesheet capture", observedAt: "2026-06-15" }],
      },
      {
        heading: "Portfolio margin forecast",
        body: "A reliable firm-wide margin forecast is not yet available. Four of eight projects have timesheet coverage below 65%, so labour cost — and therefore true margin — is incomplete. The figures shown are fee-based and labelled low-confidence rather than fabricated.",
        confidence: "insufficient",
        insufficient: true,
        citations: [],
      },
    ],
  },
  {
    id: "rep_weekly_p1",
    kind: "weekly_project",
    title: "Weekly Report — Aldenair Lake Residences",
    projectId: "p1",
    generatedAt: "2026-06-12T17:00:00",
    status: "published",
    audience: "internal",
    completeness: 74,
    summary:
      "CD phase is 64% complete but slipping (−18 days). The structural set returned for revision is the main driver; the 50% CD milestone on 30 Jun is at risk. Money is healthy; margin is indicative only.",
    blocks: [
      {
        heading: "Schedule",
        body: "Schedule variance is −18 days and widening. S-101 Foundation Layout (R3) was returned for revision on 8 Jun and the structural coordination freeze (due 10 Jun) is overdue. The 50% CD set due 30 Jun is now at risk.",
        confidence: "medium",
        citations: [
          { ref: "S-101_R3", sourceName: "Consultant (email)", observedAt: "2026-06-08" },
          { ref: "Milestone: Structural coordination freeze", sourceName: "Manual capture", observedAt: "2026-06-10" },
        ],
      },
      {
        heading: "Money",
        body: "৳1.34Cr billed, ৳92.2L collected, ৳23.5L work-in-progress. One invoice (INV-2026-028, ৳18L) is overdue 46 days. Net of VAT/VDS/AIT, expected cash on the open invoice is ৳18.7L.",
        confidence: "high",
        citations: [
          { ref: "INV-2026-028", sourceName: "TallyPrime", observedAt: "2026-06-12" },
          { ref: "INV-2026-031", sourceName: "TallyPrime", observedAt: "2026-06-12" },
        ],
      },
      {
        heading: "Margin",
        body: "Forecast margin is ~19% but low-confidence: timesheet coverage on this project is 61%, so labour cost is partial. Treat as indicative until effort capture improves.",
        confidence: "low",
        citations: [{ ref: "Cost-to-date e2/e3/e6", sourceName: "Timesheet capture", observedAt: "2026-06-15" }],
      },
    ],
  },
  {
    id: "rep_cash",
    kind: "cash_warning",
    title: "Cash Collection Warning",
    projectId: null,
    generatedAt: "2026-06-17T07:35:00",
    status: "needs_review",
    audience: "internal",
    completeness: 88,
    summary:
      "৳58.0L is overdue across 3 invoices; ৳39.0L of it (Meghna Textiles) is over 90 days and the client is flagged at-risk.",
    blocks: [
      {
        heading: "Overdue receivables",
        body: "Three invoices are overdue: Meghna INV-2026-019 (৳22L, 97d) and INV-2026-022 (৳17L, 51d), and Aldenair INV-2026-028 (৳18L, 46d). After VAT/VDS/AIT, net cash at risk is ~৳49L.",
        confidence: "high",
        citations: [
          { ref: "INV-2026-019", sourceName: "TallyPrime", observedAt: "2026-06-12" },
          { ref: "INV-2026-022", sourceName: "TallyPrime", observedAt: "2026-06-12" },
          { ref: "INV-2026-028", sourceName: "TallyPrime", observedAt: "2026-06-12" },
        ],
      },
    ],
  },
];

export const reportById = (id: string) => aiReports.find((r) => r.id === id);
