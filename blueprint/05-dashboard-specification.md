# Dashboard Specification

> **Scope.** This document specifies all 15 PracticeLens dashboards. PracticeLens is an AI-powered reporting & analytics **layer** over a Dhaka architecture firm's existing (mostly informal) tools — not a replacement ERP/BIM/PM app. Every number on every dashboard must be **provenance-backed**: each KPI tile, chart series and table cell resolves to the underlying `IntegrationRecord` / `DataSource` rows, the dates, and the calculation logic. Where data is missing, the dashboard **shows the gap** rather than guessing.
>
> **Reading this doc.** KPI calculation formulas here are concise; the authoritative definitions (windows, edge cases, BDT/USD handling, confidence bands) live in `04-kpi-dictionary.md`. Canonical entity, KPI, and role names are used throughout. Currency is **BDT** with multi-currency support (FX captured at invoice and at settlement per the finance model).

## Cross-cutting design rules (apply to every dashboard)

- **Provenance & anti-hallucination.** Every tile exposes a "Why this number?" affordance → source records, dates, formula, and a **confidence badge** (High / Medium / Low / Insufficient-Data). Tiles with insufficient data render greyed with a "Capture this →" call-to-action linking to the relevant manual-capture form, never a fabricated value.
- **Data Completeness Score is omnipresent.** Every dashboard header shows the **Data Completeness Score** for its data domain. A profitability number built on zero timesheets is labelled as such — this is the single most important honesty mechanism for a firm with no historical structured data.
- **Currency.** All financial tiles show BDT by default with a USD toggle for foreign-client projects; FX rate and date shown on hover. VAT (15%), VDS and AIT/TDS are modelled as distinct lines (gross fee → VAT → VDS withheld → AIT withheld → net cash).
- **Bilingual.** Project/client names render in stored script (Bangla + Latin); reports/PDF exports embed a Unicode Bengali font (Nikosh).
- **Refresh semantics.** "Refresh frequency" = max staleness target. API connectors sync on webhook/delta where available; manual-capture and Excel imports update on submit/import. A "Data as of <timestamp>" stamp sits in every header.
- **Permissions.** Finance domains are restricted to **Company Owner / Managing Director / Finance Team**. Project-scoped users see only their assigned `Project` rows. RBAC is enforced server-side, not by hiding tiles.
- **MVP tagging.** Dashboards 1, 3, 4, 7 are **MVP** (Executive, Project Health, Financial, Resource). Dashboard 12 (Authority Approvals) is tagged **MVP-HighValue** — Bangladesh-specific, owner's top delivery concern; ships in the pilot even though "Delivery" is priority 2.

---

## 1. Executive Company Overview `[MVP]`

| Field | Specification |
|---|---|
| **Purpose** | One screen that replaces "the principal's head" as the firm-level dashboard: are we profitable, what's coming in, what's overdue, what needs a decision today. |
| **Target user** | Company Owner, Managing Director. |
| **KPIs** | Forecast Project Margin (firm roll-up), Work in Progress (WIP), Unbilled Revenue, Invoice Aging, Collection Rate, Weighted Pipeline, Utilization Rate (firm), Project Health Score (portfolio avg), Data Completeness Score. |
| **Charts** | (a) Cash & revenue waterfall: Contracted fee → Invoiced → Collected → Outstanding (BDT). (b) Backlog-months gauge (signed fee remaining ÷ monthly burn). (c) Portfolio health heatmap (one cell per active `Project`, RAG-coloured by Project Health Score). (d) 12-month revenue vs. collections trend. |
| **Tables** | "Attention list" — top 5 projects by margin erosion; top 5 overdue invoices (BDT, days aged); milestones due in next 14 days (incl. authority approvals). |
| **Filters** | Date range, `Office`, service line (residential / commercial / interior / institutional), active vs. all. |
| **Drill-down** | Health cell → Dashboard 3 (that project). Invoice row → Dashboard 5. Margin row → Dashboard 6. |
| **Alerts** | Collection Rate < target; any project Forecast Project Margin turns negative; backlog < 2 months; firm Data Completeness Score < 50%. |
| **Data sources** | Accounting connector (Tally/QuickBooks/Xero) or manual finance register import; manual-capture (milestones, decisions); file-store activity; Timesheet (if present). |
| **Refresh** | Daily (financial roll-ups); real-time for manual-capture alerts. |
| **Formulas** | Forecast Project Margin = (Contract Fee − EAC cost) ÷ Contract Fee. WIP = earned-but-uninvoiced fee. Collection Rate = collected ÷ invoiced (period). Backlog months = remaining signed fee ÷ trailing-3-mo cost burn. (See KPI dictionary.) |
| **Permissions** | Owner, Managing Director only (full financial visibility). |

---

## 2. Project Portfolio Health

| Field | Specification |
|---|---|
| **Purpose** | Compare all active projects side-by-side to triage where leadership attention is needed; surface the at-risk set before cash runs out. |
| **Target user** | Managing Director, Project Director. |
| **KPIs** | Project Health Score, Schedule Variance, Forecast Project Margin, Fee Burn Rate, Milestone Completion Rate, Task Overdue Rate, Data Completeness Score (per project). |
| **Charts** | Bubble chart: x = Schedule Variance, y = Forecast Project Margin, bubble size = Contract Fee, colour = Health Score (the "money vs. delivery" quadrant). Stacked bar of projects per phase. |
| **Tables** | Sortable portfolio grid: Project, Client, phase, Health Score, Schedule Variance (days), margin %, fee burn %, next milestone, completeness %. |
| **Filters** | `Office`, Project Director / Project Manager, service line, phase, health band, currency. |
| **Drill-down** | Any row → Dashboard 3. |
| **Alerts** | Health Score drops a band week-over-week; Schedule Variance > 14 days; Fee Burn Rate > % complete by a configurable margin. |
| **Data sources** | Manual-capture (phase %, milestones), Timesheet, accounting connector, file-store activity, task tools (Trello/Asana/ClickUp/monday if connected). |
| **Refresh** | Daily. |
| **Formulas** | Project Health Score = weighted composite (schedule, margin, milestone, approval, data-completeness sub-scores; weights in dictionary). Schedule Variance = actual vs. baseline milestone dates. Fee Burn Rate = cost incurred ÷ fee. |
| **Permissions** | Director-level; PMs see own projects. |

---

## 3. Individual Project Performance `[MVP]`

| Field | Specification |
|---|---|
| **Purpose** | The single project's full picture across money, delivery, people, approvals — the workhorse screen for a Project Manager. |
| **Target user** | Project Manager, Project Director, Project Architect (assigned). |
| **KPIs** | Project Health Score, Schedule Variance, Milestone Completion Rate, Deliverable Completion Rate, Planned vs Actual Hours, Estimate at Completion (EAC), Forecast Project Margin, Fee Burn Rate, Client Approval Time, Change Exposure. |
| **Charts** | (a) Phase timeline / Gantt (Concept → Handover) with authority-approval milestones overlaid as diamonds. (b) Fee-burn S-curve: planned vs actual hours/cost vs % complete. (c) EAC vs Contract Fee gauge. |
| **Tables** | Milestone register (incl. RAJUK LUC/CP, FSCD, CAAB, DoE, utilities); Deliverable/Drawing list with Revision; open Decisions/Approvals awaiting client; Change log. |
| **Filters** | Phase, deliverable type, date range, currency. |
| **Drill-down** | Deliverable → Revision history + source file (file-store). Decision → captured WhatsApp/meeting record + provenance. Fee line → invoice. |
| **Alerts** | Milestone slips baseline; EAC exceeds fee; deliverable overdue; client approval pending > threshold; uncaptured change suspected (AI flag, low-confidence, prompts capture). |
| **Data sources** | Manual-capture (primary: phase %, decisions, approvals, changes), Timesheet, file-store (drawing presence/last-modified), accounting (project fees/expenses), task tools. |
| **Refresh** | Real-time for manual-capture; daily for financial. |
| **Formulas** | EAC = actual cost + (remaining work ÷ performance factor). Deliverable Completion Rate = issued ÷ planned. Client Approval Time = decision date − request date (from captured records). |
| **Permissions** | Assigned project team + Directors; finance sub-panel gated to Owner/Finance. |

---

## 4. Financial Performance `[MVP]`

| Field | Specification |
|---|---|
| **Purpose** | Firm-level money health: revenue, cost, margin, WIP and cash — the priority-1 pain. Honest even when labour cost is partial. |
| **Target user** | Company Owner, Managing Director, Finance Team. |
| **KPIs** | Forecast Project Margin (firm), Work in Progress (WIP), Unbilled Revenue, Invoice Aging, Collection Rate, Fee Burn Rate, Estimate at Completion (firm roll-up), Data Completeness Score (finance). |
| **Charts** | P&L-style revenue/cost/margin trend; WIP & Unbilled Revenue bar over time; cash-in vs cash-out; margin by service line. |
| **Tables** | Project margin table (Contract Fee, invoiced, collected, cost-to-date, EAC, forecast margin); VAT/VDS/AIT reconciliation table (gross → VAT 15% → VDS → AIT → net cash). |
| **Filters** | Period, `Office`, service line, client, currency (BDT/USD). |
| **Drill-down** | Margin row → Dashboard 6; cash row → Dashboard 5; cost → Timesheet/expense detail. |
| **Alerts** | Negative forecast margin; WIP growth without invoicing; AIT withholding materially reducing expected cash; FX exposure on USD projects. |
| **Data sources** | Accounting connector (Tally XML / QuickBooks / Xero) **or** templated Excel finance-register import; Timesheet for cost; manual-capture for fee milestones. |
| **Refresh** | Daily (or on import for Excel-only firms). |
| **Formulas** | WIP = earned revenue − invoiced. Unbilled Revenue = (% complete × fee) − invoiced. Net cash = gross fee − VDS − AIT. Margin = (fee − cost) ÷ fee. |
| **Permissions** | Owner, Managing Director, Finance Team **only**. |

---

## 5. Fees, Billing & Collections

| Field | Specification |
|---|---|
| **Purpose** | Manage the invoice lifecycle and the Bangladesh-specific collection drag (15% VAT, VDS, ~10% AIT withholding shrinking net cash). |
| **Target user** | Finance Team, Owner. |
| **KPIs** | Invoice Aging, Collection Rate, Unbilled Revenue, Fee Burn Rate, WIP. |
| **Charts** | AR aging buckets (0–30 / 31–60 / 61–90 / 90+ days, BDT); invoiced vs collected trend; milestone-billing progress per project (phase-triggered % of fee). |
| **Tables** | Invoice register (Invoice, Project, Client, gross, VAT, VDS withheld, AIT withheld, net expected, received, status, due); upcoming milestone-billing triggers; reimbursables pending billing. |
| **Filters** | Status (draft/sent/part-paid/paid/overdue), client, project, currency, aging bucket, date range. |
| **Drill-down** | Invoice → linked Fee/milestone + Payment(s) + provenance; client → all invoices. |
| **Alerts** | Invoice crosses 60/90 days; milestone completed but not invoiced (lost-billing flag); AIT certificate outstanding. |
| **Data sources** | Accounting connector / Excel register import; manual-capture for phase completion triggering billing; Contract for fee schedule. |
| **Refresh** | Daily. |
| **Formulas** | Invoice Aging = today − due date by bucket. Collection Rate = collected ÷ invoiced. Net expected = gross + VAT − VDS − AIT (per FY2025-26 model). |
| **Permissions** | Finance Team, Owner; Directors see own-project billing summary only. |

---

## 6. Profitability by Project & Phase

| Field | Specification |
|---|---|
| **Purpose** | Answer the question small firms cannot: *which projects, clients, service lines and phases make or lose money* — and expose CA-phase loss leakage. |
| **Target user** | Owner, Managing Director, Project Director. |
| **KPIs** | Forecast Project Margin, Estimate at Completion (EAC), Planned vs Actual Hours, Fee Burn Rate, Change Exposure. |
| **Charts** | Margin by project (bar, sorted); margin by service line; phase-level fee vs cost (stacked, per phase: Concept→CA→Handover), highlighting negative-margin phases; planned vs actual hours by phase. |
| **Tables** | Per-phase P&L grid (phase fee allocation, hours, labour cost, expenses, margin); change/scope-creep table (Change Exposure = unbilled scope value). |
| **Filters** | Project, service line, client, phase, completed vs in-flight, currency. |
| **Drill-down** | Phase → Timesheet/effort detail; change → captured decision/approval record. |
| **Alerts** | Phase margin negative (esp. CA); actual hours > planned by threshold; Change Exposure rising (unbilled scope). |
| **Data sources** | Timesheet (critical — flagged when absent), accounting (fees/expenses), manual-capture (phase %, changes), Contract (fee-by-phase split). |
| **Refresh** | Daily. |
| **Formulas** | Phase margin = phase fee − (Σ hours × cost rate + expenses). EAC by phase = cost-to-date + remaining ÷ CPI. Change Exposure = Σ uncontracted scope value. Confidence is **Low** when timesheet coverage is low — shown explicitly. |
| **Permissions** | Owner, Managing Director, Finance, Project Director. |

---

## 7. Resource Capacity & Utilization `[MVP]`

| Field | Specification |
|---|---|
| **Purpose** | Show who is over/under-loaded and firm utilization — **and bootstrap the timesheets that don't yet exist** (this dashboard's first job is to make capture worthwhile). |
| **Target user** | HR/Resource Manager, Managing Director, Project Director. |
| **KPIs** | Utilization Rate, Billable Utilization, Planned vs Actual Hours, Resource Capacity, Data Completeness Score (timesheet coverage). |
| **Charts** | Utilization by Employee (bar vs 75–90% healthy band, 81.9% median benchmark); capacity heatmap (Employee × week, allocated vs available); billable vs non-billable split. |
| **Tables** | ResourceAssignment grid (Employee, project, allocated %, this-week hours, utilization); under-utilized / over-allocated lists. |
| **Filters** | `Team`, `Office`, role, date range, billable only. |
| **Drill-down** | Employee → their projects + timesheet entries; project → its assignments. |
| **Alerts** | Utilization > 100% (overload) or < target (idle); **timesheet missing for the week** (drives capture); coverage below threshold (KPIs labelled estimate-only). |
| **Data sources** | **Timesheet via manual-capture (primary path)** — lightweight daily/weekly entry forms; ResourceAssignment; later Toggl/Harvest/Monograph/ClickUp time imports. |
| **Refresh** | Daily; weekly utilization roll-up. |
| **Formulas** | Utilization Rate = billable + non-billable project hours ÷ available hours. Billable Utilization = billable ÷ available. Resource Capacity = available − allocated. When coverage low, all values badged **Low confidence**. |
| **Permissions** | HR/Resource Manager, Directors, Owner; individuals see own utilization. |

---

## 8. BD & Proposal Pipeline

| Field | Specification |
|---|---|
| **Purpose** | Make the relationship/referral-driven, head-stored pipeline visible: what's in flight, weighted value, win rate, pursuit cost. (Priority 4 — lighter, later.) |
| **Target user** | Business Development, Owner, Managing Director. |
| **KPIs** | Pipeline Value, Weighted Pipeline, Proposal Win Rate. |
| **Charts** | Pipeline funnel (Lead → Opportunity → Proposal → Contract); weighted pipeline by stage (BDT); win rate trend; lead source mix. |
| **Tables** | Opportunity register (Client, Contact, estimated fee, stage, probability, next action, owner); Proposal log (sent date, value, status, win/loss reason). |
| **Filters** | Stage, owner, source, service line, date range. |
| **Drill-down** | Won opportunity → resulting Contract/Project; lost → loss reason. |
| **Alerts** | Stale opportunity (no activity > N days); proposal pending decision > threshold; pipeline thinning vs backlog need. |
| **Data sources** | Manual-capture (opportunity/proposal entry — primary, since no CRM); email/calendar connector for activity signals; Proposal documents in file-store. |
| **Refresh** | On capture; daily roll-up. |
| **Formulas** | Weighted Pipeline = Σ (opportunity value × stage probability). Proposal Win Rate = won ÷ (won + lost). Pipeline Value = Σ open opportunity fees. |
| **Permissions** | BD, Owner, Managing Director. |

---

## 9. Deliverables & Document Control

| Field | Specification |
|---|---|
| **Purpose** | Replace the "filename version control" risk with a defensible deliverable/revision register; track drawing production and issue status. |
| **Target user** | BIM Manager, Project Architect, Project Manager. |
| **KPIs** | Deliverable Completion Rate, Drawing Revision Rate, Schedule Variance (deliverables). |
| **Charts** | Deliverables by status (planned/in-progress/issued/superseded); revision velocity per project; drawing activity trend (file-store last-modified as design-activity proxy). |
| **Tables** | Drawing/Deliverable register (Drawing, current Revision, status, last-modified, issued-to, transmittal date); superseded/duplicate-version warnings. |
| **Filters** | Project, phase, discipline, type, status. |
| **Drill-down** | Deliverable → Revision history + source file metadata (OneDrive/SharePoint/Drive/Dropbox); transmittal → recipients. |
| **Alerts** | Multiple "final" filename variants detected (wrong-version risk); deliverable overdue; no transmittal record for an issued set. |
| **Data sources** | File-store connectors (Microsoft Graph / Google Drive / Dropbox — **file-presence only**; CAD/SketchUp/D5 expose no data API); manual-capture for transmittals/issue status. |
| **Refresh** | Hourly (file-store delta) / on capture. |
| **Formulas** | Deliverable Completion Rate = issued ÷ planned. Drawing Revision Rate = revisions ÷ drawing ÷ period (high rate = churn/rework signal). |
| **Permissions** | Project team, BIM Manager, Directors. |

---

## 10. Consultant Coordination

| Field | Specification |
|---|---|
| **Purpose** | Track external structural/MEP consultant responsiveness and coordination issues that today live only in WhatsApp/email threads. |
| **Target user** | Project Manager, Project Architect, Design Lead. |
| **KPIs** | Consultant Response Time, RFI Aging, Submittal Aging, Issue closure rate. |
| **Charts** | Response-time by Consultant (avg days); open coordination Issues over time; issue ageing buckets. |
| **Tables** | Consultant register (Consultant, discipline, open items, avg response); coordination Issue log (raised, assigned, status, age). |
| **Filters** | Project, consultant, discipline, status, age bucket. |
| **Drill-down** | Issue → captured thread/decision + provenance; consultant → all their items. |
| **Alerts** | Consultant response overdue; coordination issue open > threshold; latest-file-version ambiguity flag. |
| **Data sources** | Manual-capture (primary — coordination items, responses); email connector (consultant correspondence); file-store (consultant file versions). |
| **Refresh** | On capture; daily. |
| **Formulas** | Consultant Response Time = response date − request date (avg). RFI/Submittal/Issue Aging = today − raised date by bucket. |
| **Permissions** | Project team, Design Lead, Directors. |

---

## 11. Client Approvals & Decisions

| Field | Specification |
|---|---|
| **Purpose** | Turn verbal/WhatsApp client approvals into a defensible audit trail and measure decision latency — a top, unmeasured schedule driver. |
| **Target user** | Project Manager, Project Director, Owner. |
| **KPIs** | Client Approval Time, Milestone Completion Rate (approval-gated), Change Exposure. |
| **Charts** | Client Approval Time per project (avg days); pending-decision ageing; decisions captured per week (capture-adoption signal). |
| **Tables** | Decision/Approval register (item, requested date, decided date, decision, channel = WhatsApp/email/meeting/verbal, captured-by, provenance); open approvals blocking phases. |
| **Filters** | Project, client, status (pending/approved/rejected), channel, date range. |
| **Drill-down** | Decision → source record (captured WhatsApp message log / Meeting / email) with confidence badge; rejected → linked Change. |
| **Alerts** | Approval pending beyond threshold (schedule risk); scope-affecting decision lacking written confirmation (dispute/liability risk); phase blocked awaiting client. |
| **Data sources** | **Manual-capture (primary)** — quick decision-log form, optionally seeded from persisted WhatsApp webhook payloads (forward-only, no backfill); email/Meeting; file-store sign-offs. |
| **Refresh** | Real-time on capture. |
| **Formulas** | Client Approval Time = decided date − requested date. Pending age = today − requested date. |
| **Permissions** | Project team, Directors, Owner. |

---

## 12. Authority Approvals `[MVP-HighValue]`

| Field | Specification |
|---|---|
| **Purpose** | Track Bangladesh statutory approvals as first-class schedule milestones — the owner's top delivery concern. Where is each submission stuck, for how long, and what's gating the project. |
| **Target user** | Owner, Project Director, Project Manager, liaison/Construction Administration staff. |
| **KPIs** | Milestone Completion Rate (approvals), Schedule Variance (approval-driven), approval cycle time, % projects gated by a pending approval. |
| **Charts** | Approval status board per project (RAJUK LUC ⭐, RAJUK CP ⭐, FSCD design NOC, CAAB height clearance, DoE ECC, DPDC/DESCO, WASA, Titas, City Corporation, land mutation pre-gate) — RAG by status; cycle-time-vs-statutory (e.g. RAJUK LUC 30-day statutory vs actual); approvals timeline overlaid on project schedule. |
| **Tables** | Approval register (Approval, authority, project, form ref e.g. Form 101/301, submitted date, expected/statutory date, status, days pending, gating dependency, liaison/owner); resubmission/query-round log. |
| **Filters** | Authority, project, status (not-started/submitted/in-review/query/approved/rejected), gating-only, location-conditional (CAAB OLS, DoE category). |
| **Drill-down** | Approval → submission history, query rounds, captured receipts/portal status, linked drawing sets (5-set CP requirement), provenance. |
| **Alerts** | Approval exceeds statutory/expected window; LUC 24-month validity expiring; CAAB clearance required (plot in OLS zone) but not started; CP blocked by missing FSCD/CAAB prerequisite; resubmission overdue. |
| **Data sources** | **Manual-capture (primary)** — approval-tracking form mirroring RAJUK ECPS stages, liaison status updates; email/file-store for submission receipts. (No authority API exists.) |
| **Refresh** | On capture; daily ageing recompute. |
| **Formulas** | Approval cycle time = decision/approval date − submission date. Schedule Variance = approval actual vs planned gating date. Pending age = today − submitted date vs statutory SLA (LUC 30d). |
| **Permissions** | Owner, Directors, PM, CA/liaison; read-only for project team. |

---

## 13. Construction Administration

| Field | Specification |
|---|---|
| **Purpose** | Bring CA out of WhatsApp photos and verbal site instructions into a tracked log — and expose whether CA (often run at a loss) is consuming unbilled effort. |
| **Target user** | Construction Administration staff, Project Manager, Project Director. |
| **KPIs** | RFI Aging, Submittal Aging, Change Exposure, Planned vs Actual Hours (CA phase), Forecast Project Margin (CA phase). |
| **Charts** | Open RFIs/Submittals ageing; site-instruction volume over time; CA effort (hours) vs CA fee burn; defect status. |
| **Tables** | SiteReport / site-instruction log (date, instruction, photo ref, issued-by); RFI & Submittal registers; Change/Defect logs. |
| **Filters** | Project, item type, status, age, date range. |
| **Drill-down** | Item → captured WhatsApp media / SiteReport / Meeting record + provenance; change → billing status. |
| **Alerts** | RFI/Submittal open > threshold; site instruction lacking written record (liability); CA hours exceeding CA fee (margin leak); as-built deviation uncaptured. |
| **Data sources** | Manual-capture (primary — site reports, instructions, RFIs, defects, photos); persisted WhatsApp media; Timesheet (CA effort); later Procore/Newforma connectors (productization). |
| **Refresh** | On capture; daily. |
| **Formulas** | RFI/Submittal Aging = today − raised by bucket. CA margin = CA fee − CA hours×rate. Change Exposure = unbilled change value. |
| **Permissions** | CA staff, Project team, Directors. |

---

## 14. Risk & Issue Management

| Field | Specification |
|---|---|
| **Purpose** | Consolidated, cross-project view of open Risks and Issues with the leading indicators that predict slippage and margin loss before they hit cash. |
| **Target user** | Project Director, Managing Director, Owner. |
| **KPIs** | Risk count by severity, Issue Aging, Change Exposure, Task Overdue Rate, RFI Aging / Submittal Aging roll-up. |
| **Charts** | Risk matrix (likelihood × impact); open issues by age & project; issue burndown; emerging-risk signals (overdue tasks, pending approvals, negative margin trend) feeding a composite risk view. |
| **Tables** | Risk register (Risk, project, likelihood, impact, owner, mitigation, status); Issue log (cross-project, age, severity). |
| **Filters** | Project, severity, status, owner, category, date range. |
| **Drill-down** | Risk/Issue → source records + linked project dashboard. |
| **Alerts** | New high-severity risk; issue ageing past SLA; multiple leading indicators converging on one project (AI-flagged, confidence-scored). |
| **Data sources** | Manual-capture (risk/issue register); derived signals from Dashboards 3/6/12 (overdue milestones, negative margin, stuck approvals); task tools. |
| **Refresh** | Daily; real-time for new high-severity capture. |
| **Formulas** | Issue Aging = today − raised. Risk score = likelihood × impact. Composite risk = weighted leading indicators (schedule + margin + approval + completeness). |
| **Permissions** | Directors, Owner; PMs see own-project risks. |

---

## 15. Data Quality & Integration Health

| Field | Specification |
|---|---|
| **Purpose** | The trust dashboard. Show how complete and fresh the underlying data is, which connectors are healthy, and where capture gaps undermine every other KPI — the honesty backbone of an analytics layer over informal data. |
| **Target user** | Owner, Managing Director, and the PracticeLens admin/implementation lead. |
| **KPIs** | Data Completeness Score (firm + per domain + per project), connector freshness/lag, capture-adoption rate (timesheets/decisions/approvals submitted vs expected), match confidence (ProjectCrossReference). |
| **Charts** | Completeness by domain (money/delivery/people/pipeline) gauge grid; connector status board (DataSource: connected/lagging/failed, last sync); capture-adoption trend; unmatched/ambiguous records count. |
| **Tables** | DataSource / connector register (type, status, last sync, error, rate-limit headroom); IntegrationRecord error/retry log; AuditLog of imports; unresolved ProjectCrossReference matches (bilingual name-matching queue). |
| **Filters** | DataSource, domain, project, status, confidence band. |
| **Drill-down** | Connector → sync history & errors; completeness gap → the capture form that fills it; unmatched record → manual match/merge UI. |
| **Alerts** | Connector failed / token expired (QuickBooks/Xero/Graph/Google OAuth); sync lag beyond SLA; rate-limit threshold (e.g. Xero 5,000/day, Graph throttling); completeness drops; unmatched records accumulating; WhatsApp webhook persistence gap (no backfill — critical). |
| **Data sources** | Internal: all DataSource, IntegrationRecord, AuditLog, ProjectCrossReference; OAuth token store; connector telemetry. |
| **Refresh** | Real-time / near-real-time. |
| **Formulas** | Data Completeness Score = Σ (present required fields ÷ expected) weighted by domain. Connector lag = now − last successful sync. Capture-adoption = submitted ÷ expected entries. |
| **Permissions** | Owner, Managing Director, PracticeLens admin. |

---

## Dashboard release map

| Phase | Dashboards | Rationale |
|---|---|---|
| **Pilot MVP** | 1 Executive, 3 Project Performance, 4 Financial, 7 Resource, **12 Authority Approvals**, 15 Data Quality | Money (priority 1) + delivery's owner-critical approvals + the timesheet/capture bootstrap + the trust backbone. 15 ships with MVP because honesty is non-negotiable for an informal-data firm. |
| **Pilot+ / late pilot** | 2 Portfolio, 5 Billing & Collections, 6 Profitability by Phase, 11 Client Approvals | Roll-ups and the deeper money/decision analytics once capture habits exist. |
| **Productization** | 8 Pipeline, 9 Deliverables, 10 Consultant Coordination, 13 Construction Admin, 14 Risk & Issue | Lighter or richer-market features; benefit from API connectors (Procore/Newforma/APS) added during multi-tenant productization. |

> **Build note.** Dashboards 1, 3, 4, 7, 12 must function on **manual-capture + Excel import alone** for the pilot — no firm tool guarantees an API. API connectors enrich these dashboards but are never a hard dependency. Confidence badges and the Data Completeness Score are what make a manual-capture-first analytics product credible.
