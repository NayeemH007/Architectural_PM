# MVP Scope Definition

> **Working name:** PracticeLens (placeholder). **Goal of this document:** define the smallest version of the product that is genuinely useful to *one* Dhaka architecture firm (5-30 staff), pilotable in ~6 months, while being multi-tenant-*ready* underneath. This is the contract for what we build first. Anything not explicitly listed as IN is OUT, and the OUT list below is enforced, not aspirational.
>
> **The one rule that governs this scope:** the highest-value data in a small Dhaka firm is *uncaptured* — it lives in the principal's head, WhatsApp, phone calls, and paper. So the MVP is not "connect APIs and visualize." The MVP is **stand up a thin data spine, make manual capture frictionless, and prove the four dashboards + the weekly AI report tell the owner something they could not previously know — with every number traceable.** We deliberately under-build integrations and over-build trust (provenance, anti-hallucination, Data Completeness Score).
>
> **Sequencing inside the MVP:** we build and stabilize in the owner's pain order — **MONEY → DELIVERY → PEOPLE → PIPELINE** — and Pipeline is intentionally a thin slice. See §4.

---

## 1. MVP design constraints (non-negotiable, apply to every feature below)

| Constraint | What it means in the MVP build |
|---|---|
| **Read-first, source-of-truth stays put** | We never write back to Tally/Excel/Drive/M365. PracticeLens is a derived analytics mirror. If PracticeLens and the firm's books disagree, **the books win** and the discrepancy is shown, not hidden. |
| **Manual capture is a first-class connector** | Smart web forms + templated Excel/CSV import are co-equal with API connectors. The pilot will run substantially on manually-captured data because the firm has almost no structured historical data. |
| **Provenance on every record** | Every `IntegrationRecord` carries `DataSource`, capture timestamp, and captured-by. Every KPI tile exposes "Why this number?" → source rows + dates + formula + confidence badge. |
| **Anti-hallucination / refuse-on-missing** | The weekly AI report and every dashboard tile degrade to "insufficient data — capture this" rather than fabricate. No estimated margin where there are zero timesheets. |
| **Data Completeness Score everywhere** | Each dashboard domain header shows its completeness %. This is the single most important honesty mechanism for a firm starting from near-zero structured data. |
| **Multi-tenant-ready, single-tenant-run** | Schema, auth, and storage are tenant-scoped from day one (Company-keyed rows, tenant_id on everything), but the pilot runs as one tenant with no self-serve onboarding and no billing engine. |
| **BDT-native, multi-currency-capable** | Default currency BDT; USD supported for occasional foreign clients. VAT (15%), VDS, and AIT/TDS withholding modelled as distinct lines so *net cash collected* is correct. |
| **Bilingual storage** | Bangla + Latin stored side-by-side on names/addresses; UTF-8 throughout; Bijoy/ANSI → Unicode normalization on import; Nikosh embedded in PDF exports. |
| **MVP RBAC** | Roles in the pilot: **Company Owner, Managing Director, Project Director/Manager, Project Architect, Finance/Admin.** Finance domains restricted to Owner / Managing Director / Finance Team. Project-scoped users see only their assigned `Project` rows. |

---

## 2. What is IN — feature by feature

Each block states **exactly what is IN**, the canonical entities it touches, the primary connector(s) feeding it, and the priority tier.

### 2.1 Project Master Data `[MONEY/DELIVERY foundation]`
The spine everything else hangs off. IN:
- Create/maintain `Company`, `Office`, `Client`, `Contact`, `Project`, `ProjectPhase`, `Service`, `Contract`, `Fee`.
- `Project` carries: bilingual name, client, service line (residential / commercial-mixed-use / interior-fitout / institutional-industrial-planning), assigned Project Director/Manager + Project Architect, currency, contract fee, fee basis (% of construction cost / per-sft / lump-sum), construction-cost estimate (re-estimable), start date, current phase.
- **Phase model (fixed, BD-localized):** Concept → Schematic → Design Development → **Authority Approval** → Construction Documents → Tender/Procurement → Construction Administration → Handover/Closeout. Per-phase planned fee % and target dates.
- **`ProjectCrossReference` (alias resolution):** the same project is named five different ways across Drive folder, Tally ledger, Excel register, and WhatsApp. IN scope is a **human-confirmed matching UI** (suggested matches + one-click confirm), not fully automatic ML matching.
- Provenance + `AuditLog` on every create/edit.

OUT of this block: WBS/cost-code hierarchies, multi-office consolidation accounting, sub-projects.

### 2.2 Tasks & Milestones — including Authority Approvals `[DELIVERY]`
- `Task` (lightweight: title, project, phase, assignee, due date, status) — created in-app or imported from a PM tool if one exists; **we do not become the firm's daily task manager** (see OUT list).
- `Milestone` with planned vs. actual/forecast dates and phase linkage.
- **`Approval` as a first-class, Bangladesh-specific entity** — modelled with type, submitting authority, submission date, expected/statutory date, status, and stall reason. Tracked authorities (each a milestone with hard dates): **RAJUK Land Use Clearance (Form 101), RAJUK Construction Permit (Form 301), Fire Service & Civil Defence design NOC, DoE Environmental Clearance, CAAB height clearance, utility connections (DESCO/DPDC, WASA, Titas), City Corporation, land mutation (pre-start gate).** Each carries a typical/statutory duration reference for variance.
- KPIs computed: `Milestone Completion Rate`, `Task Overdue Rate`, `Schedule Variance`.

### 2.3 Timesheets & Resources `[PEOPLE — and the MVP must help *create* this data]`
The firm almost certainly has **no timesheets today.** The MVP's job here is to make starting them nearly frictionless and to be honest about the gap until then. IN:
- `Employee`, `Role`, `Team`, `ResourceAssignment`, `Timesheet`.
- **A 30-second-a-day capture form** (web; mobile-web responsive — *not* a native app): pick project → phase → hours → optional note. Pre-filled with the person's recent projects. Weekly grid view for catch-up entry.
- `ResourceAssignment` = who is assigned to what (even without hours), so that resource load has a **proxy signal from day one** before timesheet adoption matures.
- KPIs: `Planned vs Actual Hours`, `Utilization Rate`, `Billable Utilization`, `Resource Capacity` — **all gated by Data Completeness Score**; below threshold they render as "assignment-count proxy only," never a confident utilization figure.
- Pilot rollout assumption: timesheets start with the **~3-10 MVP users (leads + architects)**, not whole-firm. Whole-firm timesheet entry is a later expansion.

### 2.4 Fees / Invoices / Payments / Expenses `[MONEY — priority 1, build first]`
The strongest small-firm pain and the first thing we ship. IN:
- `Fee`, `Invoice`, `Payment`, `Expense`, `Budget`.
- **BD finance model done correctly:** gross fee → VAT (15%) → VDS withheld → AIT/TDS withheld (~10% resident) → **net cash collected**, all as distinct lines. Reimbursables (printing, RAJUK/authority submission costs, model-making) as separate line items on top of the % fee.
- **Phase/milestone-triggered billing** aligned to the IAB-style staged pattern (e.g. Concept → DD → CD/Tender Docs → Tender → Construction Supervision → handover), with editable phase-fee splits per contract.
- Multi-currency invoices (BDT default, USD for foreign clients) with FX captured **at invoice and at settlement**.
- KPIs: `Fee Burn Rate`, `Work in Progress (WIP)`, `Unbilled Revenue`, `Invoice Aging`, `Collection Rate`, `Estimate at Completion (EAC)`, `Forecast Project Margin`. Margin/EAC are **labour-cost-dependent** and therefore Data-Completeness-gated on timesheets.
- Connectors: templated Excel/CSV finance-register import (the realistic pilot path), plus a **pluggable** read-only Tally/QuickBooks/Xero connector if the firm has one — but the MVP must work fully on Excel import alone.

### 2.5 Deliverables & Document Status `[DELIVERY]`
- `Deliverable`, `Document`, `Drawing`, `Model`, `Revision` — tracked as **status + presence signals**, not content.
- **File-presence telemetry** from the cloud file store (Google Drive / OneDrive-SharePoint): existence, name, size, last-modified, folder, inferred revision (`_rev`, `_final2` filename patterns surfaced as a *risk*, not trusted as truth).
- Manual deliverable register: what was issued, to whom, when, which revision — replacing the "reconstruct it from the sent-mail folder" reality with a lightweight transmittal log.
- KPIs: `Deliverable Completion Rate`, `Drawing Revision Rate`.
- Explicitly NOT reading inside `.dwg`/`.skp`/`.rvt` — CAD/BIM files are deliverable signals only (see OUT list).

### 2.6 Meetings / Decisions / Approvals (capture layer) `[DELIVERY/MONEY — highest-leverage capture]`
This is where the uncaptured gold lives. IN:
- `Meeting`, `Decision`, `Approval`, `Change` (scope change), `Risk`, `Issue` — captured via **smart manual-capture forms**.
- **Manual WhatsApp/phone outcome logging:** a fast form (and paste-a-message field) to record a verbal client approval, a RAJUK query received by phone, a scope change agreed on site — capturing the *outcome* with date, project, source, and who. This is **manual logging only — no WhatsApp API automation** (see OUT list).
- `Change` carries a billable-or-not flag and an estimated unbilled BDT exposure → feeds margin and the weekly report's scope-creep signal.
- KPIs touched: `Client Approval Time` (decision latency — a top, currently-unmeasured schedule driver), `Change Exposure`.

### 2.7 Executive Dashboard `[MVP dashboard 1]`
- Firm-level one-screen replacement for "the principal's head": `Forecast Project Margin` (firm roll-up), `WIP`, `Unbilled Revenue`, `Invoice Aging`, `Collection Rate`, `Weighted Pipeline` (thin), portfolio `Project Health Score`, firm `Utilization Rate` (if timesheets), `Data Completeness Score`.
- Cash/revenue waterfall (Contracted → Invoiced → Collected → Outstanding, BDT), backlog-months gauge, portfolio health heatmap, "what needs you today" attention list (overdue invoices, milestones/approvals due in 14 days).
- Owner / Managing Director only.

### 2.8 Project Health Dashboard `[MVP dashboard 3]`
- Per-project deep view: `Project Health Score`, `Schedule Variance`, `Milestone Completion Rate` (incl. authority approvals), `Deliverable Completion Rate`, `Fee Burn Rate` vs. % complete, `Forecast Project Margin`, open `Decision`s/`Change`s, `Data Completeness Score` for that project.
- Authority-approval status strip (RAJUK LUC/CP, FSCD, DoE, CAAB, utilities) with planned-vs-actual and stall age.

### 2.9 Financial Dashboard `[MVP dashboard]`
- `Invoice Aging` buckets, `Collection Rate`, `WIP`, `Unbilled Revenue`, `Fee Burn Rate`, per-project and per-service-line margin, VAT/VDS/AIT breakdown, net-cash-collected view.
- BDT default, USD toggle; finance-restricted RBAC.

### 2.10 Resource Dashboard `[MVP dashboard 4]`
- `Utilization Rate`, `Billable Utilization`, `Planned vs Actual Hours`, `Resource Capacity`, per-person/team load.
- **Degrades gracefully:** with no/low timesheet data it shows assignment-count load and a prominent "capture timesheets to unlock utilization" state — never a fabricated 80% figure.

### 2.11 Scheduled Weekly AI Report `[MONEY→DELIVERY→PEOPLE→PIPELINE narrative]`
- **One report per active `Project`, generated Thursday PM (pre-weekend in BD), plus a firm-level owner summary header.**
- Deterministic detectors compute the facts; the LLM (Claude Sonnet, current gen) narrates. Content: money status (burn vs. fee, unbilled exposure), delivery (phase %, approvals movement, deliverables shipped, schedule variance, stalled approvals with stall age + cause if known), people (load/overload, proxy if no timesheets), light pipeline note.
- **Every claim carries a source chip** (records + dates + calc + confidence). Items below Data Completeness threshold render as "we can't tell you this yet — here's what to capture."
- **External-facing variants are draft-only**, routed to an Owner/Finance approval queue before any outward send; logged in `AuditLog`. Internal owner/PM digests publish automatically.

### 2.12 Data-Quality Monitoring `[cross-cutting — the trust backbone]`
- `Data Completeness Score` computed per domain (finance, schedule, time, deliverables) and firm-wide, shown on every dashboard header and in the weekly report.
- **Capture-gap surfacing:** every "insufficient data" tile links to the exact manual-capture form to fill the gap (turning honesty into a to-do).
- Ingest health: `DataSource` freshness ("data as of"), failed/duplicate import detection, `ProjectCrossReference` unmatched-record queue, Bijoy/Unicode normalization flags, FX-rate-missing flags.
- Provenance + `AuditLog` queryable for any number on any screen.

---

## 3. Explicitly OUT OF SCOPE for the MVP

These are **decisions, not omissions.** Scope discipline is what separates an adopted layer from another abandoned heavy platform.

| OUT of MVP | Why it's out | Where it goes |
|---|---|---|
| **BIM / CAD model analytics** (reading geometry, element counts, quantities from `.dwg`/`.skp`/`.rvt`) | No practice-data API; Autodesk APS is High-difficulty + new consumption pricing; the firm is largely AutoCAD-2D anyway | Files are **presence/deliverable signals only**. APS/Archicad connectors are post-MVP, richer-market productization. |
| **Deep Construction-Administration: structured RFIs / Submittals** | These barely exist as discrete items in the pilot firm (verbal/WhatsApp); building Procore-grade logs is wasted effort here | `RFI`, `Submittal`, `Defect`, `SiteReport` entities exist in the schema but are **capture-only stubs**, not full workflows. Procore/Newforma connectors are productization-tier. |
| **WhatsApp API automation** | Cloud API has **no message history/replay**, requires you to persist webhooks from day one, and pulls us toward owning the conversation | **Manual logging only** — capture the *outcome* (approval/decision/change) via forms. WhatsApp ingestion automation is post-MVP and opt-in. |
| **Full multi-tenant billing + self-serve onboarding** | The pilot is one firm; building Stripe/bKash billing + signup flows now is premature (and Stripe isn't even available in BD without an offshore entity) | Schema is multi-tenant-ready; **onboarding is manual/white-glove**; billing engine is productization-phase. |
| **Heavy ML** (custom-trained models, automatic entity matching, forecasting models) | Not enough data; erodes the anti-hallucination posture | Use **deterministic detectors + LLM narration**; matching is human-confirmed; forecasts are rule-based (EAC), clearly labelled. |
| **Consultant & client portals** | External-user auth, sharing, and permissions are a large surface; not needed to prove value to the owner | `Consultant`/`Contractor` tracked internally only. External draft reports go out as PDF/email, owner-gated — not a logged-in portal. |
| **Native mobile app** | Adoption risk + build cost; the capture forms must be mobile-*reachable*, not a separate app | **Responsive mobile-web** for capture forms. Native app is post-MVP if adoption demands it. |
| **Write-back to source systems** | Violates read-first / source-of-truth principle | Never in MVP. Opt-in pluggable module only if a future tenant demands it. |
| **Tender/Procurement & full Pipeline CRM** | Lightest pain, later priority | Pipeline is a **thin slice** (see §4). Tendering is out entirely. |

---

## 4. MONEY → DELIVERY → PEOPLE → PIPELINE inside the MVP

The owner selected *all* priorities, so we sequence the build (and the pilot's value story) deliberately. Each tier ships before the next is hardened.

| Order | Theme | Built in MVP because… | Depth in MVP |
|---|---|---|---|
| **1** | **MONEY** | Strongest small-firm pain; provable from Excel import alone on day one; doesn't depend on timesheets for invoicing/collections | **Full:** Fees, Invoices, Payments, Expenses, VAT/VDS/AIT, Invoice Aging, Collection Rate, WIP, Unbilled Revenue, Financial + Executive dashboards. (Margin/EAC are full but Data-Completeness-gated on time data.) |
| **2** | **DELIVERY** | Owner's top *delivery* concern is authority approvals — a Bangladesh-specific, high-value, hard-dated milestone story | **Full** for Milestones/Approvals/Schedule Variance/Deliverable status; Project Health dashboard; weekly per-project report. Authority-approval tracking is a flagship MVP feature even though Delivery is priority 2. |
| **3** | **PEOPLE** | Depends on timesheets that **don't exist yet** — the MVP must *create* the data before it can analyze it | **Bootstrapping:** capture forms + assignment proxy + utilization KPIs that activate as data accrues. Resource dashboard ships but is honest about the gap. |
| **4** | **PIPELINE** | Lightest pain, lightest data; full CRM is overkill for the pilot | **Thin slice only:** `Opportunity`, `Proposal`, simple stage + `Pipeline Value` / `Weighted Pipeline` / `Proposal Win Rate`. No nurture, no BD CRM, no source-ROI analytics. |

---

## 5. MVP Connectors (the integration surface)

The MVP integration surface ≈ **{templated Excel/CSV import + Google connector + Microsoft connector + email/calendar + manual capture}.** Rich API connectors (Tally, QuickBooks/Xero, APS, Procore, Deltek, BQE) are **pluggable and post-MVP / opportunistic**, behind the same connector interface so the pilot can adopt one if the firm happens to have it.

| Connector | In MVP? | What it reads (read-only) | Notes |
|---|---|---|---|
| **Templated Excel/CSV import** | **Yes — core** | Finance registers, fee schedules, project lists, deliverable/transmittal logs, ad-hoc timesheets | The realistic pilot backbone. Versioned templates + validation + Bijoy→Unicode + duplicate detection. |
| **Manual capture (web/mobile-web forms)** | **Yes — core, first-class** | Timesheets, decisions, approvals (incl. authority status), changes, meetings, WhatsApp/phone outcomes | Equal priority to APIs. The only way to capture the high-value uncaptured data. |
| **Google Workspace** | **Yes** | Drive file-presence/metadata, Gmail (client/consultant correspondence signals), Calendar (meetings) | OAuth read scopes; Drive `files.export` / Sheets read for templated imports. |
| **Microsoft 365 / Graph** | **Yes** | SharePoint/OneDrive file-presence, Outlook mail/calendar | Delta queries; tenant-admin consent; permission-heavy — budget setup time. |
| **Email / Calendar (Gmail + Outlook)** | **Yes** | Correspondence + meeting signals feeding `Meeting`, `Client Approval Time`, deliverable-sent timestamps | Treated as signal source, not a mailbox client. |
| **Tally / QuickBooks / Xero** | **Pluggable, not required** | Ledger balances, invoices, payments, AR/AP | Built behind the connector interface; activated only if the pilot firm uses one. MVP works fully on Excel import without it. |
| **PM tools (Trello/Asana/ClickUp/monday)** | **Pluggable, opportunistic** | Tasks/boards if the firm already uses one | Read-only ingest only; we do not require or push a PM tool. |
| **WhatsApp Cloud API** | **No (manual logging only)** | — | Explicitly out; see §3. |
| **APS / Archicad / Procore / Deltek / BQE / Bluebeam / Newforma** | **No (productization tier)** | — | Pluggable later for richer markets. |

---

## 6. MVP Success Criteria (quantified)

Success is **decision-change, not features shipped.** Measured at end of the ~6-month pilot.

| # | Criterion | Target |
|---|---|---|
| **S1** | **Money visibility** | 100% of the firm's active `Project`s have a contract fee, fee basis, and at least one invoice modelled; `Invoice Aging` + `Collection Rate` computed for **≥ 90%** of issued invoices (BDT), with VAT/VDS/AIT correctly separated. |
| **S2** | **Approval tracking** | **100%** of in-flight authority approvals (RAJUK LUC/CP, FSCD, DoE, CAAB, utilities) tracked with planned-vs-actual dates; `Schedule Variance` and stall-age visible per project. |
| **S3** | **Timesheet bootstrap** | **≥ 70%** of the ~3-10 MVP users submit timesheets in **≥ 80%** of pilot weeks by month 6; at least one project reaches "sufficient" Data Completeness on time data to show a real `Utilization Rate` and labour-based `Forecast Project Margin`. |
| **S4** | **Capture adoption** | **≥ 50** decisions/approvals/changes logged via manual capture over the pilot (proving the WhatsApp/verbal gold is being captured), with **≥ 80%** carrying a usable source reference. |
| **S5** | **Data completeness uplift** | Firm-wide `Data Completeness Score` rises from baseline (near-zero structured data) to **≥ 60%** across the four MVP domains by month 6. |
| **S6** | **Weekly AI report reliability** | Weekly per-project reports generate for **100%** of active projects every week with **zero hallucinated financial figures** (every number traces to a source record; missing data is shown as missing). Owner reads it (open/ack rate **≥ 75%**). |
| **S7** | **Provenance** | **100%** of dashboard tiles answer "Why this number?" with source rows + dates + formula + confidence. |
| **S8** | **Trust / decision-change (the real test)** | Owner can answer the four north-star questions (which projects make/lose money; what's late & where approvals are stuck; who's overloaded; what's in the pipeline) **in under a minute, with evidence**, and reports **≥ 2 concrete decisions** (a pricing, staffing, or collection action) made *because of* PracticeLens data they didn't have before. |
| **S9** | **Adoption durability** | Firm still actively using PracticeLens (logins + captures) in the **final pilot month**, and signs intent to continue. |

---

## 7. Definition of Done (one page)

The MVP is **DONE** when *all* of the following are true for the pilot firm:

**Data spine**
- [ ] `Company`, `Office`, `Client`, `Project`, `ProjectPhase`, `Service`, `Contract`, `Fee` modelled for all active projects; bilingual names stored (Bangla + Latin); multi-tenant `tenant_id` on every row.
- [ ] `ProjectCrossReference` matching UI live; unmatched-record queue actively worked; no orphaned finance rows above threshold.
- [ ] Provenance (`DataSource`, timestamp, captured-by) and `AuditLog` on every create/edit.

**Connectors**
- [ ] Templated Excel/CSV import working with validation + Bijoy→Unicode normalization + duplicate detection.
- [ ] Google + Microsoft connectors authenticated and reading file-presence + email/calendar signals.
- [ ] Manual-capture forms (timesheet, decision, approval, change, meeting, WhatsApp/phone outcome) live on web + responsive mobile-web.

**Money (priority 1)**
- [ ] Invoices/Payments/Expenses modelled with VAT (15%) / VDS / AIT/TDS / net-cash lines; multi-currency with FX at invoice + settlement.
- [ ] `Invoice Aging`, `Collection Rate`, `WIP`, `Unbilled Revenue`, `Fee Burn Rate`, `EAC`, `Forecast Project Margin` computed and provenance-backed.

**Delivery (priority 2)**
- [ ] `Milestone`/`Approval` tracking incl. all BD authorities with planned-vs-actual + stall age; `Schedule Variance`, `Milestone Completion Rate`, `Deliverable Completion Rate` live.

**People (priority 3)**
- [ ] Timesheet capture live; `Utilization Rate`/`Billable Utilization`/`Resource Capacity` activate with Data-Completeness gating (assignment-proxy fallback shown when below threshold).

**Pipeline (priority 4, thin)**
- [ ] `Opportunity`/`Proposal` stage + `Pipeline Value`/`Weighted Pipeline`/`Proposal Win Rate` computed.

**Dashboards & reporting**
- [ ] Executive, Project Health, Financial, Resource dashboards live; each tile has "Why this number?" + confidence badge; each header shows `Data Completeness Score`.
- [ ] Weekly per-project AI report generates Thursday PM with source chips, insufficient-data degradation, and owner-gated drafts for any external-facing variant.

**Trust & honesty**
- [ ] `Data Completeness Score` per domain + firm-wide, with capture-gap CTAs linking to forms.
- [ ] Anti-hallucination verified: no fabricated financial figures in any report; missing data renders as missing.

**RBAC & compliance posture**
- [ ] MVP roles enforced server-side; finance restricted to Owner / Managing Director / Finance Team.
- [ ] Data minimization in place; sensitive identifiers (NID/TIN/passport) minimized/segregated; region-selectable residency (Singapore/Mumbai) with a local-mirror path designed (per PDPO 2025 + 2026 amendment) even if the pilot data isn't classed restricted.

**Acceptance**
- [ ] Success criteria S1-S9 (§6) met or formally waived with the pilot firm; owner sign-off recorded.

---

**Bottom line:** the MVP proves a narrow, deep thesis — *that a thin, honest, provenance-first analytics layer fed mostly by Excel + lightweight forms can turn a Dhaka firm's "principal's-head" operation into a queryable dataset and change real BDT-scale decisions* — without building BIM analytics, deep CA, WhatsApp automation, portals, billing, or a native app. Everything deferred is parked behind the same pluggable connector and module interfaces so productization is an extension, not a rewrite.
