# End-to-End Architectural Workflows

> **Read this first — what this document is, and what the system actually is.**
>
> SPACE ESSE · Practice Intelligence is a **frontend-only, high-fidelity interactive prototype**. It is a Vite + React + TypeScript + Tailwind v4 application (React Router, TanStack Query, Recharts, Radix UI) in `app/`. **There is no backend, no database, no real authentication, no persistence, and no third-party integrations.** All data is mock data living in `src/lib/mock/{data,ops,insights,integrations}.ts`, served through `src/lib/api.ts` `resolve()`, which deep-clones the mock arrays (`JSON.parse(JSON.stringify(...))`) and resolves after a simulated ~280 ms latency. React Query hooks consume those reads. KPI figures are either computed **client-side** from mock data (`computePortfolio`, `agingBuckets`, `pipelineByStage`, `utilizationSummary`) or are hardcoded `Metric` objects in pages, each carrying a `formula` string surfaced in the "Why this number?" provenance popover.
>
> This document describes the **architecture-firm workflows** the product is *designed around* and maps each step of each workflow to its **real implementation status today**. Because a workflow is an end-to-end business process, almost every workflow has steps that are genuinely interactive in the prototype and steps that are not yet built. The status tags below are applied honestly and per-step.

## Status legend

| Tag | Meaning |
|---|---|
| **[IMPLEMENTED]** | Interactive and working in the frontend — client-side only, resets on refresh. |
| **[MOCK]** | Renders from mock data; the underlying read / sync / calculation is simulated, not live. |
| **[BACKEND]** | Designed in the UI but needs an API / database / persistence to actually function. |
| **[INTEGRATION]** | Needs a third-party connector (accounting, Drive, email, authority portal, etc.) to function. |
| **[PLANNED]** / **[RECOMMENDED]** | Not built; a future enhancement. |

A single workflow step can carry two tags where they describe different facets (e.g. a capture form is **[IMPLEMENTED]** as a UI interaction but **[BACKEND]** for persistence).

## The canonical chain

Every workflow below is described as the same seven-stage chain, so they can be compared at a glance:

**Input → Validation → Processing → Approval → Storage → Reporting → Follow-up**

A note that holds for the *entire* product and is therefore stated once here rather than repeated in every row:

- **Storage is never real.** No workflow writes to a database or file. Capture forms use local `useState` and show an inline success panel; Review approve/reject, Schedules toggles, and the Settings weight inputs mutate **local component state only**; everything resets on refresh. Treat every "Storage" cell as **[BACKEND]** unless it explicitly says otherwise.
- **Reporting is [MOCK].** Dashboards, KPI cards, charts and AI report narratives all render from mock data or hardcoded literals. Numbers do not recompute from new captures because captures are never saved.
- **The AI assistant answers from a fixed map**, not from inference. It returns canned answers for five known questions and a deliberate "insufficient data" refusal for everything else (`genericAnswer`). See *Decision tracking* and the worked examples.

---

## Modules referenced (route map)

Workflows touch these screens. Routes are confirmed from the 24-route table.

| Module | Route | Primary role in workflows |
|---|---|---|
| Dashboard | `/` | Executive triage of money, alerts, approvals, health |
| Delivery & Operations | `/delivery` | Schedule slip, approvals, deliverable health |
| Portfolio | `/portfolio` | All projects, filterable |
| Project Detail | `/projects/:id` | Single-project file, 7 tabs |
| Financials | `/financials` | Billing, collections, aging, tax |
| Profitability | `/profitability` | Fee-based margin by project |
| Resourcing | `/resourcing` | Utilization, capacity, timesheet coverage |
| Pipeline | `/pipeline` | Business-development board |
| Goals & Targets | `/goals` | Firm/project scorecard |
| Authority Approvals | `/approvals` | RAJUK/FSCD/etc. tracker |
| Document Control | `/deliverables` | Drawing register |
| Risks & Issues | `/risks` | Risk register + AI anomalies |
| Calendar | `/calendar` | Milestones, deadlines, meetings |
| Clients / Client Detail | `/clients`, `/clients/:id` | Accounts, contacts, ledger |
| AI Reports | `/reports` | Generated briefings |
| Review Queue | `/review` | Maker–checker sign-off |
| Scheduled Reports | `/schedules` | Delivery cadence |
| Activity Log | `/activity` | Append-only audit trail |
| Search | `/search` | Cross-dataset index |
| Manual Capture | `/capture` | Decisions, approvals, scope, effort |
| Data Sources | `/data-sources` | Connectors |
| Data Quality | `/data-quality` | Freshness, matching, completeness |
| Settings | `/settings` | Firm, roles, matching, thresholds, locale |

---

# 1. Lead → Client conversion (business development)

**Modules:** Pipeline (`/pipeline`), Clients (`/clients`), Goals (`/goals`).

The pipeline is described in-product as "part CRM, part the owner's memory" — explicitly the least-instrumented part of the practice.

| Stage | What happens | Status |
|---|---|---|
| Input | An opportunity exists as a mock `Opportunity` (7 records, o1–o7): name, client, type, `stage` (lead → qualified → proposal → negotiation → won/lost), `estFee`, `probability` (owner's manual judgement), owner, `expectedDecision`. | **[MOCK]** read; **[BACKEND]** to create/edit a lead |
| Validation | None. There is no lead-entry form anywhere in the app. Win probabilities are hand-set in mock data. | **[BACKEND]** / **[PLANNED]** |
| Processing | The kanban board renders 5 columns (`lead`, `qualified`, `proposal`, `negotiation`, `won`; `lost` excluded). Cards are sorted by probability descending. `weighted(o) = estFee × probability / 100`. Weighted pipeline, open value, win rate, avg deal are derived live from mock data. | **[IMPLEMENTED]** (compute) over **[MOCK]** data |
| Approval | Stage progression / closing a deal is **not** an action — there is no drag-drop, no click handler on cards. The owner `Select` filters the view only. | **[BACKEND]** |
| Storage | A won deal does not create a project or client record. | **[BACKEND]** |
| Reporting | Weighted-pipeline-by-stage bar chart, pipeline detail table, win-rate KPI (flagged low confidence: "Only N closed deals on record — too few to trust"). | **[MOCK]** |
| Follow-up | `expectedDecision` dates drive table sort; an ochre honesty callout warns the figures are "a working view, not a forecast." No reminders fire. | **[MOCK]** display; reminders **[PLANNED]** |

**Honest gap:** there is no path from "won opportunity" to "new client + project." That conversion is conceptual only.

---

# 2. Client onboarding

**Modules:** Clients (`/clients`, `/clients/:id`), Settings (`/settings` → matching), Data Quality (`/data-quality`).

| Stage | What happens | Status |
|---|---|---|
| Input | Clients are 8 mock records (c1–c8): name, type (`developer`/`private`/`corporate`/`government`/`institution`), city, `activeProjects`, `lifetimeFee`, `outstanding`, `relationship`. No "Add client" form exists. | **[MOCK]** read; **[BACKEND]** create |
| Validation | None. | **[BACKEND]** |
| Processing | Client list sorted by `lifetimeFee` desc; search over name/city/type. Client Detail derives `clientProjects`, `clientInvoices` (matched by `i.client === client.name`), and `contactsByClient(id)`. | **[IMPLEMENTED]** (filter/derive) over **[MOCK]** |
| Approval | Relationship status (`strong`/`neutral`/`at_risk`) is a stored mock field, not set through any control. | **[BACKEND]** |
| Storage | Contacts (7 mock `Contact` records) carry `mailto:`/`tel:` links that are **real anchors** — the only genuinely actionable element on the page — but adding/editing a contact is not possible. | Links **[IMPLEMENTED]**; CRUD **[BACKEND]** |
| Reporting | Revenue-by-client and outstanding-by-client bar charts; relationship-health donut; per-client KPIs. | **[MOCK]** |
| Follow-up | At-risk receivables flag red on Client Detail; no task or alert is generated. | **[MOCK]** |

---

# 3. Project setup

**Modules:** Project Detail (`/projects/:id`), Settings (matching), Data Sources, Data Quality.

A project is a rich mock `Project` (8 records, p1–p8) carrying code, name (+ `nameBn`), client, type, stage, city, lead, team, dates, health, fee fields, `crossRefs`, and `completeness`.

| Stage | What happens | Status |
|---|---|---|
| Input | No "New project" form. Project identity is mock data. | **[BACKEND]** create |
| Validation | None on creation. | **[BACKEND]** |
| Processing | The defining setup activity is **cross-reference matching**: each project lists how its name appears across sources (`crossRefs[]` — e.g. Meghna is "Meghna Interior" in Tally, "Meghna_HQ" in Drive, "Meghna FitOut" in WhatsApp). Matched/unmatched and per-alias confidence drive completeness. | **[MOCK]** |
| Approval | Settings → Project matching and Data Quality → matching queue both render unmatched aliases with **"Confirm match" / "Confirm" / "Re-match"** buttons — all **visual-only, no handlers**. | **[BACKEND]** |
| Storage | Canonical project id is shown (`canonical id: {p.id}` on the Overview tab); no write occurs when "confirming." | **[BACKEND]** |
| Reporting | Project Detail Overview "Where this project's data comes from" lists each source with a Matched/Needs-match badge and a `DataCompleteness` bar. | **[MOCK]** |
| Follow-up | "Unmatched aliases" KPI on Data Quality counts `crossRefs where matched=false`. | **[MOCK]** compute |

**The single most important real interaction here is the alias-matching *display*; the *confirm* action is not wired.**

---

# 4. Project planning

**Modules:** Project Detail (Schedule & Approvals tab), Delivery, Calendar, Goals.

| Stage | What happens | Status |
|---|---|---|
| Input | Milestones (10 mock), tasks (8 mock), and project `startDate`/`targetHandover` exist as data. No planning form. | **[MOCK]**; authoring **[BACKEND]** |
| Validation | None. | **[BACKEND]** |
| Processing | Phase stepper renders the 8-stage `STAGE_ORDER` against the project's current `stage` (visual-only, no clicks). `scheduleVarianceDays` (negative = behind) drives delivery analytics. | **[IMPLEMENTED]** (render) over **[MOCK]** |
| Approval | Plan sign-off is conceptual. | **[BACKEND]** |
| Storage | — | **[BACKEND]** |
| Reporting | Delivery "Schedule variance by project" bar chart; on-time-projects KPI; Calendar plots milestone due dates as blue chips. | **[MOCK]** |
| Follow-up | Milestones feed the Calendar agenda (next 14 days) and Delivery "due & overdue" list. | **[MOCK]** |

---

# 5. Design-stage management

**Modules:** Project Detail (phase stepper, Deliverables tab), Delivery, Document Control.

| Stage | What happens | Status |
|---|---|---|
| Input | A project's `stage` (concept → schematic → design_dev → … → handover) and `pctComplete` are mock fields. | **[MOCK]** |
| Validation | None. | **[BACKEND]** |
| Processing | Phase stepper marks completed stages (sage + check), current (blue), future (numbered). `% complete` rendered as a tone-banded progress bar. | **[IMPLEMENTED]** render over **[MOCK]** |
| Approval | No gate advances a stage. | **[BACKEND]** |
| Storage | — | **[BACKEND]** |
| Reporting | Delivery scorecard orders active projects by stage then schedule slip. | **[MOCK]** |
| Follow-up | Stage drives downstream views (e.g. authority-approval stage matters for permit tracking). | **[MOCK]** |

---

# 6. Drawing / document tracking

**Modules:** Document Control (`/deliverables`), Project Detail (Deliverables tab).

Document Control is one of the most fully-featured *display* workflows. Its honest premise: CAD apps (AutoCAD, SketchUp, D5) expose no data API, so these are **file-presence signals harvested from Google Drive**, not reads from the CAD tools.

**Deliverable fields tracked (9 mock records):**

| Field | Meaning |
|---|---|
| `name` | Sheet / drawing title (e.g. "ID-210 Reception Millwork") |
| `discipline` | Architecture / Structure / MEP / Interior / Landscape |
| `status` | not_started / in_progress / internal_review / issued / approved / revise |
| `revision`, `revisionCount` | e.g. `R5`, count 5 → high-churn flag if `>3` |
| `dueDate`, `issuedDate` | Schedule; overdue if past due and not closed |
| `fileRef` | Drive path, or null → "manual" / "No file" |
| `source` | e.g. "Google Drive" |

| Stage | What happens | Status |
|---|---|---|
| Input | Deliverables read from mock; in reality would be harvested from Drive file presence. | **[MOCK]** / **[INTEGRATION]** (Google Drive) |
| Validation | None at entry. Filters validate the *view*: search, discipline, status, project. | **[IMPLEMENTED]** filtering |
| Processing | Register table; donut by status; bar by discipline; stacked "revision load" (top 12, churn>3 highlighted). High-churn watchlist (`revisionCount >= 3`). Overdue = past due and not issued/approved. | **[IMPLEMENTED]** compute over **[MOCK]** |
| Approval | Issue/approve a drawing is a stored status, not an action. The watchlist's "Open review" button is **visual-only**. | **[BACKEND]** |
| Storage | "manual" chip = no file detected on Drive yet; upload not possible. | **[INTEGRATION]** |
| Reporting | Drawing-revision-rate KPI (`Σ revisionCount / total`, "×"); issued/approved %; completeness = share with a `fileRef`. | **[MOCK]** |
| Follow-up | High-churn watchlist surfaces rework risk; deep-links to project. | **[MOCK]** |

---

# 7. Consultant coordination

**Modules:** Project Detail (Team, Decisions), Calendar (authority/meeting events), Activity Log.

| Stage | What happens | Status |
|---|---|---|
| Input | Consultant interaction is captured indirectly: decisions with channel `email`/`call`/`meeting`, meetings of `type: "authority"` or `"internal"`, and Gmail-feed decisions (mock). There is no dedicated consultant register. | **[MOCK]**; register **[PLANNED]** |
| Validation | None. | **[BACKEND]** |
| Processing | Meetings (10 mock) plot on the Calendar as sage chips; attendees are name strings. | **[IMPLEMENTED]** render over **[MOCK]** |
| Approval | n/a | — |
| Storage | — | **[BACKEND]** |
| Reporting | Activity Log shows consultant-relevant captures/syncs; decisions list per project. | **[MOCK]** |
| Follow-up | Manual capture (channel = email/call) is the intended path to record a consultant decision. | Capture UI **[IMPLEMENTED]**; persistence **[BACKEND]** |

---

# 8. Task & milestone management

**Modules:** Project Detail (Schedule & Approvals), Delivery, Calendar.

**Milestone statuses:** done / due_soon / overdue / upcoming / blocked. **Task statuses:** todo / in_progress / review / done / blocked.

| Stage | What happens | Status |
|---|---|---|
| Input | 10 milestones, 8 tasks (mock). Tasks carry `source` strings (e.g. "Trello"). No task-creation form. | **[MOCK]** / **[INTEGRATION]** (Trello, syncing) |
| Validation | None. | **[BACKEND]** |
| Processing | Delivery "Milestones — due & overdue" feed = not-done milestones that are overdue or due within 14 days, sorted by date; per-row "N days late / today / in N days." Overdue-milestones KPI counts `status === "overdue"`. | **[IMPLEMENTED]** compute over **[MOCK]** |
| Approval | Marking a task/milestone done is not an action. | **[BACKEND]** |
| Storage | — | **[BACKEND]** |
| Reporting | Calendar agenda; Delivery scorecard; Dashboard watchlist. | **[MOCK]** |
| Follow-up | Overdue items flag red; no notification fires. | **[MOCK]** |

---

# 9. Meeting & minutes-of-meeting (MOM) management

**Modules:** Calendar, Manual Capture, Activity Log.

| Stage | What happens | Status |
|---|---|---|
| Input | Meetings (10 mock `Meeting` records: title, project, datetime, duration, type, attendees, location) come from a Google Calendar feed (mock). MOM itself would be captured as a Decision (channel `meeting`). | **[MOCK]** / **[INTEGRATION]** (Google Calendar) |
| Validation | Capture form `ready` gate: project + a non-empty note for a decision-type capture. | **[IMPLEMENTED]** |
| Processing | Meetings render as Calendar chips (sage) and agenda items. Decisions from meetings list on Project Detail. | **[IMPLEMENTED]** render over **[MOCK]** |
| Approval | A captured meeting decision is "Unverified" until promoted via Review Queue (local state only). | **[IMPLEMENTED]** (local) / **[BACKEND]** |
| Storage | Capture submit shows success but does **not** persist; nothing joins the recent-captures feed. | **[BACKEND]** |
| Reporting | Calendar; Decisions tab; Activity Log. | **[MOCK]** |
| Follow-up | — | **[BACKEND]** |

---

# 10. Decision tracking

**Modules:** Manual Capture (`/capture`), Project Detail (Decisions tab), Review Queue, AI Assistant.

This is the conceptual heart of the product: high-value decisions have no API, so they are captured manually, cited to a person, and promoted to a "verified" record. 5 mock `Decision` records exist (dec1–dec5), each with a `channel` (meeting/whatsapp/email/call/site), a `promoted` flag, and a `Provenance` source.

| Stage | What happens | Status |
|---|---|---|
| Input | Capture → "Decision" type: summary, decided-by, channel; or "Promote WhatsApp": paste a thread. | Form **[IMPLEMENTED]** |
| Validation | `ready` gate: project required; decision needs a non-empty note; WhatsApp needs non-empty paste. The WhatsApp "Extracted draft" preview is **pure string slicing** (last pasted line, 120 chars) — **no real extraction/NLP**. | **[IMPLEMENTED]** (gate); extraction **[PLANNED]** |
| Processing | On submit: inline success panel ("Captured — Decision added to {project}", "cited to you"/"uncredited", badges Captured + Unverified). | **[IMPLEMENTED]** (local) |
| Approval | A decision becomes citable when promoted. Review Queue shows pending captures with **"Verify & promote"** → flips local status. `promoted: true` renders a sage "Verified" badge. | Promote toggles **[IMPLEMENTED]** (local) / **[BACKEND]** |
| Storage | **Not persisted.** The success panel is cosmetic; refresh loses it. Recent-captures feed reads the mock `decisions` array, unaffected by your capture. | **[BACKEND]** |
| Reporting | Decisions tab shows Verified/Unverified per project; the AI assistant cites decisions in answers. | **[MOCK]** |
| Follow-up | AI answers ground on captured decisions (e.g. the Meghna stone change order is cited). | **[MOCK]** (canned) |

---

# 11. Approval workflows (internal review & sign-off gate)

**Modules:** Review Queue (`/review`), Scheduled Reports, AI Reports.

Distinct from *authority* approvals (§13), this is the **maker–checker** control: a human approves captures, AI reports, project matches, and discrepancies before they count.

| Stage | What happens | Status |
|---|---|---|
| Input | 6 mock `ReviewItem` records, kinds: report / capture / match / discrepancy, each `status: pending`. | **[MOCK]** |
| Validation | Each item carries source + confidence; you "approve evidence, not guesses." | **[MOCK]** display |
| Processing | Filter by kind; Pending/Resolved tabs with live counts. | **[IMPLEMENTED]** |
| Approval | **Approve & send** (reports) / **Verify & promote** (captures/matches) / **Reject** → `resolveItem(id, status)` mutates the **local** `items` array; row moves to Resolved with a Signed off / Verified / Rejected badge. | **[IMPLEMENTED]** (local state only) |
| Storage | No backend write; refresh re-seeds from mock. | **[BACKEND]** |
| Reporting | KPIs: pending review, reports awaiting sign-off, captures to verify, discrepancies. | **[IMPLEMENTED]** compute over local state |
| Follow-up | Client-facing reports "never send automatically" — they pass through this gate (conceptually). The send itself is visual-only. | Gate **[IMPLEMENTED]**; send **[BACKEND]** / **[INTEGRATION]** |

---

# 12. Design revision management

**Modules:** Document Control, Project Detail (Deliverables tab).

| Stage | What happens | Status |
|---|---|---|
| Input | `revisionCount` per deliverable (mock). | **[MOCK]** |
| Validation | None. | **[BACKEND]** |
| Processing | High churn = `revisionCount > 3`. Stacked "revision load" chart (top 12) splits normal vs high-churn (sienna). Project Detail Deliverables table appends a ⚠ tooltip when count > 3. | **[IMPLEMENTED]** compute over **[MOCK]** |
| Approval | Issuing a new revision is not an action. | **[BACKEND]** |
| Storage | Revisions tracked by Drive file presence; uploads not possible. | **[INTEGRATION]** |
| Reporting | Drawing-revision-rate KPI; high-churn watchlist. | **[MOCK]** |
| Follow-up | Watchlist flags rework risk; "Open review" button is visual-only. | **[MOCK]** / **[BACKEND]** |

---

# 13. Submission / authority tracking

**Modules:** Authority Approvals (`/approvals`), Project Detail (Schedule & Approvals), Calendar, Manual Capture (approval type).

The most domain-specific workflow. Honest premise: RAJUK, FSCD, CAAB, DoE, City Corporation **expose no API**; status is tracked manually from the RAJUK ECPS portal and liaison capture. Overdue is measured against each form's **statutory decision window**.

**Approval fields (8 mock records):** authority, title, status (not_started → preparing → submitted → in_review → query_raised → approved/rejected), `submittedDate`/`expectedDate`/`approvedDate`, `daysInStage`, `statutoryDays`, `blocking`, `owner`, `source`.

| Stage | What happens | Status |
|---|---|---|
| Input | Approvals read from mock; new status changes captured via Capture → "Approval update" (authority + new status + what-changed note). | Read **[MOCK]**; capture **[IMPLEMENTED]** UI / **[BACKEND]** persist; live status **[INTEGRATION]** |
| Validation | `isOverdue` = `statutoryDays !== null && daysInStage > statutoryDays && status not approved/rejected`. | **[IMPLEMENTED]** compute |
| Processing | Group by authority or status; within-group sort: blocking → overdue → days-in-stage desc. No-API authorities get a "No API · manual" badge. | **[IMPLEMENTED]** over **[MOCK]** |
| Approval | The approval *event* is recorded, not granted. RAJUK actually grants it; the app tracks the external state. | **[INTEGRATION]** |
| Storage | Manually maintained "from RAJUK ECPS + liaison capture." Capture not persisted. | **[BACKEND]** / **[INTEGRATION]** |
| Reporting | KPIs: in-flight, overdue-vs-statutory, cleared last 12 mo, avg cycle time. Critical banner for a blocking, overdue, statutory-breaching permit. | **[MOCK]** / **[IMPLEMENTED]** compute |
| Follow-up | "Next expected decisions" side rail (in-flight items with `expectedDate`, "N days past est." in red). "Open ECPS"/"Ask liaison" buttons are visual-only. | **[MOCK]** display; actions **[BACKEND]** |

---

# 14. Site progress tracking

**Modules:** Manual Capture (Site report type), Project Detail, Activity Log.

| Stage | What happens | Status |
|---|---|---|
| Input | Capture → "Site report": single "Site note" textarea + project + date. | **[IMPLEMENTED]** UI |
| Validation | `ready` = project + non-empty note. | **[IMPLEMENTED]** |
| Processing | Submit → inline success only. | **[IMPLEMENTED]** (local) |
| Approval | A site report could be promoted via Review (capture kind). | **[IMPLEMENTED]** (local) / **[BACKEND]** |
| Storage | Not persisted. | **[BACKEND]** |
| Reporting | Would appear in Activity Log (capture type) once persisted; today only mock activity events show. | **[MOCK]** |
| Follow-up | — | **[BACKEND]** |

---

# 15. Issue / risk management

**Modules:** Risks (`/risks`), Project Detail (Risks tab), Dashboard (top alerts).

**Risk fields (8 mock):** title, category (schedule/financial/approval/scope/resource/client), likelihood, impact, status (open/mitigating/closed), owner, raisedDate. `exposure = SCORE[likelihood] × SCORE[impact]`.

| Stage | What happens | Status |
|---|---|---|
| Input | Risks read from mock; no risk-entry form. AI-detected anomalies = mock `Alert` records (8). | **[MOCK]**; risk entry **[BACKEND]** |
| Validation | None at entry. | **[BACKEND]** |
| Processing | 3×3 likelihood×impact matrix; cells tinted by score; **click a cell to filter** the register. By-category bars are clickable filters. Register sorted by exposure desc. | **[IMPLEMENTED]** (interactive filtering) over **[MOCK]** |
| Approval | Mitigating/closing a risk is a stored status, not an action. | **[BACKEND]** |
| Storage | — | **[BACKEND]** |
| Reporting | KPIs: open risks, high/high, critical alerts (severity critical), top category. AI-detected anomalies render via `AlertRow`. | **[MOCK]** / **[IMPLEMENTED]** compute |
| Follow-up | Alerts deep-link to projects; no escalation fires automatically. | **[MOCK]** |

---

# 16. Resource allocation

**Modules:** Resourcing (`/resourcing`), Project Detail (Team tab).

**Employee fields (10 mock, but `firm.staff = 22` — a deliberate coverage gap):** name, role, title, `utilization` (a nullable `Metric`), `capacityHours`, `allocatedHours`, `activeProjects`, `timesheetCompliance`.

| Stage | What happens | Status |
|---|---|---|
| Input | Employees read from mock; allocation is implied by `allocatedHours` vs `capacityHours`. No assignment UI. | **[MOCK]**; allocation editing **[BACKEND]** |
| Validation | Utilization is gated on timesheet coverage; people without timesheets read as **"No time logged," never idle** (`utilization.value === null`). | **[IMPLEMENTED]** compute |
| Processing | `utilizationSummary()`: mean util over staff who log time; coverage = mean `timesheetCompliance`; overloaded = util > 90; underloaded = < 70; unknown = null. Load split + per-person table. | **[IMPLEMENTED]** over **[MOCK]** |
| Approval | Reassigning load is not an action. | **[BACKEND]** |
| Storage | — | **[BACKEND]** |
| Reporting | KPIs: mean billable util, coverage, overloaded; **spare capacity is forced "insufficient"** (`value: null`) because coverage is too low to trust. Overload warning card for Arif Chowdhury (>90% six weeks). | **[MOCK]** / **[IMPLEMENTED]** compute |
| Follow-up | "Set up time capture" → links to `/capture` (the header link is functional; the callout button is visual-only). | Link **[IMPLEMENTED]**; setup **[BACKEND]** |

---

# 17. Time tracking

**Modules:** Manual Capture (Quick timesheet), Resourcing, Profitability (coverage gating).

Timesheet coverage (~64%) is the product's recurring honesty theme — it gates capacity and margin confidence everywhere.

| Stage | What happens | Status |
|---|---|---|
| Input | Capture → "Quick timesheet": team member + hours + optional note. | **[IMPLEMENTED]** UI |
| Validation | `ready` = project + employee + hours. | **[IMPLEMENTED]** |
| Processing | Submit → inline success only. A static note: "every entry here lifts the confidence on capacity and margin answers." | **[IMPLEMENTED]** (local) |
| Approval | n/a | — |
| Storage | **Not persisted** — so coverage never actually rises. | **[BACKEND]** |
| Reporting | Resourcing KPIs, Profitability coverage per project (`TIMESHEET_COVERAGE` is a hardcoded map), Capture's "Timesheet coverage 64%" KPI (hardcoded literal). | **[MOCK]** |
| Follow-up | Clockify is listed as an available (not-connected) connector for automated time tracking. | **[INTEGRATION]** (planned) |

---

# 18. Budget / cost monitoring

**Modules:** Profitability (`/profitability`), Project Detail (Financials), Dashboard.

| Stage | What happens | Status |
|---|---|---|
| Input | `budgetCost`, `costToDate`, `feeContract` per project (mock). | **[MOCK]** |
| Validation | Cost is "partial labour" — understated where timesheets lag; figures stay low-confidence below 65% coverage. | **[IMPLEMENTED]** flagging |
| Processing | `blendedMargin = (revenue − costToDate) / revenue × 100`; planned-vs-actual cost bars; forecast-margin bars (insufficient projects shown at 0%). | **[IMPLEMENTED]** over **[MOCK]** |
| Approval | n/a | — |
| Storage | — | **[BACKEND]** |
| Reporting | KPIs: portfolio revenue, cost-to-date, blended margin (fee-based, low confidence), realization. `InsufficientData` for "True firm-wide margin." | **[MOCK]** / **[IMPLEMENTED]** compute |
| Follow-up | Cross-links to Resourcing and Capture to improve coverage. | **[IMPLEMENTED]** links |

**Crucial honesty note (stated in-product):** these are **fee-based proxies, not true margin.** True margin needs full labour cost, which requires timesheet coverage to clear 80%.

---

# 19. Invoice / payment tracking (billing & collections)

**Modules:** Financials (`/financials`), Project Detail (Financials), Clients, Dashboard.

The most numerically rigorous workflow because of **Bangladesh withholding tax modelling**. Invoices are net of 15% VAT, VDS (60% of the VAT figure), and ~10% AIT.

**Invoice computation (`inv()` factory):**

| Field | Formula |
|---|---|
| `vat` | `round(grossFee × 0.15)` |
| `vdsWithheld` | `round(vat × 0.6)` |
| `aitWithheld` | `round(grossFee × 0.1)` |
| `netReceivable` | `grossFee + vat − vds − ait` |
| `amountReceived` | paid → net; part_paid → 50%; else 0 |
| `agingDays` | days past `dueDate` vs the 2026-06-17 anchor (paid → 0) |

| Stage | What happens | Status |
|---|---|---|
| Input | 10 mock invoices, 4 payments (payments are hand-authored, **not** reconciled against invoice `amountReceived`). | **[MOCK]** / **[INTEGRATION]** (TallyPrime, stale) |
| Validation | Tax math computed deterministically client-side; aging derived. | **[IMPLEMENTED]** compute |
| Processing | `agingBuckets()` (Current / 1–30 / 31–60 / 61–90 / 90+); status filter; invoice ledger; outstanding-by-client bars. | **[IMPLEMENTED]** over **[MOCK]** |
| Approval | Issuing/sending an invoice is not an action; "Export" is visual-only. | **[BACKEND]** |
| Storage | Source of truth is TallyPrime via weekly CSV export (mock, marked stale). | **[INTEGRATION]** |
| Reporting | KPIs: billed, collected (net), collection rate, WIP. Aging chart + 90+ callout. The Dashboard "Money" chart (`moneyTrend`) is **hardcoded**, not from the ledger. | **[MOCK]** |
| Follow-up | Overdue invoices flag red and feed alerts/risks. | **[MOCK]** |

---

# 20. Procurement / vendor management

**Modules:** (none dedicated).

| Stage | What happens | Status |
|---|---|---|
| Input → Follow-up | **There is no procurement or vendor module.** Vendors appear only as `source.vendor` strings on data-source connectors (e.g. "Tally Solutions," "Autodesk"). No purchase orders, no vendor register, no procurement tracking exists. | **[PLANNED]** (entire workflow) |

This workflow is documented for completeness only; it is **not built** and should not be described as present.

---

# 21. Change request management

**Modules:** Manual Capture (Scope change), Project Detail (Decisions), AI Assistant, Review Queue.

| Stage | What happens | Status |
|---|---|---|
| Input | Capture → "Scope change": variation description + optional est. cost impact (BDT) + requested-by. | **[IMPLEMENTED]** UI |
| Validation | `ready` = project + non-empty note. Cost impact is optional, numeric input. | **[IMPLEMENTED]** |
| Processing | Submit → inline success only. | **[IMPLEMENTED]** (local) |
| Approval | Could be promoted via Review (capture kind). | **[IMPLEMENTED]** (local) / **[BACKEND]** |
| Storage | **Not persisted.** | **[BACKEND]** |
| Reporting | Unbilled change orders are referenced in the AI "losing money?" answer (e.g. "~৳1.4L unbilled change orders captured from WhatsApp 9 Jun") — but that is a **canned answer**, not computed from a captured change. | **[MOCK]** (canned) |
| Follow-up | — | **[BACKEND]** |

---

# 22. Client communication

**Modules:** Client Detail (contacts), Manual Capture (channels), AI Reports, Scheduled Reports, Review Queue.

| Stage | What happens | Status |
|---|---|---|
| Input | Communication enters as Decisions (channel email/whatsapp/call/meeting) or as Gmail-feed records (mock). Contact `mailto:`/`tel:` links are real anchors. | Capture/links **[IMPLEMENTED]**; Gmail feed **[INTEGRATION]** |
| Validation | Capture `ready` gate. | **[IMPLEMENTED]** |
| Processing | WhatsApp is paste-only by design (no history API). | **[IMPLEMENTED]** UI / **[INTEGRATION]** |
| Approval | Client-facing AI reports require Review sign-off before sending. | **[IMPLEMENTED]** (local gate) |
| Storage | Not persisted. | **[BACKEND]** |
| Reporting | AI Reports (audience internal/external); Scheduled Reports route external reports through `/review`. | **[MOCK]** |
| Follow-up | "Approve & send," "Export," email delivery are all **visual-only / [INTEGRATION]**. | **[INTEGRATION]** (email/WhatsApp send) |

---

# 23. Project reporting

**Modules:** AI Reports (`/reports`), Scheduled Reports, Review Queue, Dashboard, AI Assistant.

3 mock `AIReport` records (daily brief, weekly project, cash warning) + 6 mock `ScheduledReport` records.

| Stage | What happens | Status |
|---|---|---|
| Input | Reports read from mock (with mock fallback). Blocks carry citations and confidence. | **[MOCK]** |
| Validation | "Every figure traces to a cited record. The narrative is generated; the numbers are not." Insufficient blocks render `InsufficientData` rather than a fabricated figure. | **[MOCK]** display |
| Processing | Report library (clickable list selects a report); reader renders blocks, confidence badges, source chips. | **[IMPLEMENTED]** selection over **[MOCK]** |
| Approval | External + needs_review reports show "Approve & send" — **visual-only**; the real gate is Review Queue (local). | Gate **[IMPLEMENTED]** (local); send **[BACKEND]** |
| Storage | "New report," "Regenerate," "Export," "Generate brief" are all **visual-only** — no report is actually generated. | **[BACKEND]** |
| Reporting | Scheduled Reports table (cadence, recipients, channel, audience, next/last run). | **[MOCK]** |
| Follow-up | Schedule active toggle flips **local** state only (does not change delivery); "Edit"/"New schedule" visual-only. | Toggle **[IMPLEMENTED]** (local); delivery **[BACKEND]** / **[INTEGRATION]** |

---

# 24. Project closing / archiving

**Modules:** Portfolio, Project Detail, Goals.

| Stage | What happens | Status |
|---|---|---|
| Input | `ProjectStage` includes `closed` and `on_hold`, but **all 8 mock projects are active** — none is closed. `computePortfolio()` filters `stage !== "closed"`. | **[MOCK]** |
| Validation | None. | **[BACKEND]** |
| Processing | A closed project would drop out of active counts; the logic exists, but no project exercises it. | **[IMPLEMENTED]** logic, **[MOCK]** data |
| Approval | Closing a project is not an action — there is no "Close project" or "Archive" control anywhere. | **[BACKEND]** |
| Storage | No archival store. | **[BACKEND]** |
| Reporting | Goals/Portfolio would reflect closure; final-margin reporting needs full labour cost (still gated). | **[MOCK]** |
| Follow-up | — | **[PLANNED]** |

---

# Worked examples

These trace four real, end-to-end journeys through the prototype, naming exactly what is interactive versus simulated. They use the actual mock records.

## Example A — Capture a WhatsApp decision (Meghna reception stone)

**Scenario:** A client (Mr. Sohel of Meghna Textiles) approves an upgraded reception stone over WhatsApp; the cost impact is still pending. This corresponds to mock decision `dec1`.

| Step | Action | Status |
|---|---|---|
| 1. Open capture | Click "Manual Capture" or use the command palette (Ctrl/Cmd+K → "New capture"). | **[IMPLEMENTED]** |
| 2. Choose type | Click "Promote WhatsApp." Form switches; `type = whatsapp`. | **[IMPLEMENTED]** |
| 3. Select project | Pick "Meghna Textiles HQ Interior" (p4) in the Project select. | **[IMPLEMENTED]** |
| 4. Paste thread | Paste the chat. An "Extracted draft" preview appears = **last line sliced to 120 chars** with a low-confidence badge. This is string-slicing, **not** real NLP extraction. | **[IMPLEMENTED]** UI / **[PLANNED]** extraction |
| 5. Validate | Submit "Capture" enables once project + non-empty paste exist (`ready`). | **[IMPLEMENTED]** |
| 6. Submit | Inline success: "Captured — Promote WhatsApp added to Meghna…", badges Captured + Unverified, cited to you. | **[IMPLEMENTED]** (local) |
| 7. Persist | **Nothing is saved.** It does not join the recent-captures feed (which reads mock `decisions`). Refresh loses it. | **[BACKEND]** |
| 8. Promote | In Review Queue, a capture item could be "Verify & promote" → flips to Verified (sage) in **local** state. The real dec1 already shows `promoted: true`. | **[IMPLEMENTED]** (local) / **[BACKEND]** |
| 9. Surface | Asking the AI "Which projects are losing money?" returns the canned answer citing this change order ("~৳1.4L unbilled change orders captured from WhatsApp 9 Jun"). | **[MOCK]** (canned) |

## Example B — Track a RAJUK permit to approval (Bashati Form 301)

**Scenario:** Bashati Corporate Tower's RAJUK Construction Permit (Form 301) has been in review 61 days against a 30-day statutory window, and it is blocking. This is mock approval `ap1` (project p2, owner Shahed Alam, source ECPS-2024-88213).

| Step | Action | Status |
|---|---|---|
| 1. Triage | Dashboard "Authority approvals" card shows it stuck; or open `/approvals`. | **[MOCK]** |
| 2. Critical banner | Approvals detects the blocking, overdue, statutory-breaching RAJUK "301" permit and renders a `CriticalBanner`: "RAJUK Construction Permit (Form 301) is 31 days past the statutory window," with an "Open project" link. | **[IMPLEMENTED]** compute over **[MOCK]** |
| 3. Group/sort | Group by authority → RAJUK group floats to top (overdue); "No API · manual" badge shown. | **[IMPLEMENTED]** |
| 4. Capture an update | Capture → "Approval update": authority RAJUK, new status, "what changed" note (e.g. FSCD refuge-floor query, resubmission 20 Jun). | **[IMPLEMENTED]** UI |
| 5. Persist | Not saved. | **[BACKEND]** |
| 6. External action | "Open ECPS" / "Ask liaison" buttons are **visual-only**. The actual permit is granted by RAJUK, not the app. | **[BACKEND]** / **[INTEGRATION]** |
| 7. Next decision | Side rail "Next expected decisions" lists in-flight items by `expectedDate` ("N days past est." in red). | **[MOCK]** |
| 8. AI | "Where are we stuck on authority approvals?" returns a high-confidence canned answer naming this blocker and the health-score cap (49). | **[MOCK]** (canned) |

## Example C — Flag and act on a 90-day overdue invoice (Meghna INV-2026-019)

**Scenario:** Invoice INV-2026-019 (Meghna Textiles, project p4, gross ৳22L, due 2026-03-12) is overdue ~97 days. Meghna's relationship is `at_risk` with ৳39L outstanding.

| Step | Action | Status |
|---|---|---|
| 1. Triage | Dashboard "Overdue receivable" KPI = `Σ (netReceivable − amountReceived)` on overdue invoices. | **[IMPLEMENTED]** compute over **[MOCK]** |
| 2. Aging | Financials → invoice aging bar; the **90+** bucket callout shows the rust figure (`agingBuckets()`). | **[IMPLEMENTED]** |
| 3. Tax-aware cash | Each invoice shows net receivable = gross + 15% VAT − VDS − ~10% AIT, so "billed never equals cash." The withholding explainer chips are hardcoded illustration. | **[IMPLEMENTED]** compute (per-invoice) / **[MOCK]** (explainer) |
| 4. Client view | Client Detail (Meghna) flags the at-risk receivable red; invoice ledger lists "97d overdue." | **[MOCK]** |
| 5. Risk link | Risk `r3` ("Meghna receivable ৳39L aged 90+ days," high/high) sits top-right of the risk matrix. | **[MOCK]** |
| 6. Act | "Export" is visual-only; there is no "send reminder" / "chase" action. | **[BACKEND]** |
| 7. AI | "What's overdue in collections right now?" returns a high-confidence canned answer (৳58L across three invoices, ~৳49L net cash at risk after VAT/VDS/AIT). | **[MOCK]** (canned) |
| 8. Source of truth | Underlying ledger is TallyPrime via weekly CSV (marked **stale** — finance KPIs may lag). | **[INTEGRATION]** |

## Example D — Review & send a client weekly report

**Scenario:** A client-facing weekly project report needs sign-off before delivery. Mock report `rep_weekly_p1` (project p1, published) and the maker–checker gate model this.

| Step | Action | Status |
|---|---|---|
| 1. Open report | AI Reports → select from the library (clicking sets local selection). Reader shows blocks, confidence badges, citations. | **[IMPLEMENTED]** selection over **[MOCK]** |
| 2. Honesty check | An insufficient block renders `InsufficientData` ("four of eight projects have timesheet coverage below 65%…") instead of a fabricated number. | **[MOCK]** |
| 3. Gate | A client-facing report that `needs_review` shows "Approve & send" in the reader — **visual-only**. The real control is the Review Queue. | **[BACKEND]** (reader buttons) |
| 4. Review queue | In `/review`, the report item offers **"Approve & send"** (primary) or **"Reject."** Clicking flips **local** status → "Signed off" (sage) or "Rejected" (rust). | **[IMPLEMENTED]** (local state only) |
| 5. Persist | No backend write; refresh re-seeds the queue from mock. | **[BACKEND]** |
| 6. Schedule | Scheduled Reports shows the cadence/recipients/channel; external reports route through `/review` (functional cross-link). The active toggle flips **local** state and does not change real delivery. | Toggle **[IMPLEMENTED]** (local); delivery **[BACKEND]** / **[INTEGRATION]** |
| 7. Send | Actual email/WhatsApp delivery to the client. | **[INTEGRATION]** |
| 8. Audit | Conceptually the approval lands in the Activity Log (report type); today the log shows mock events only. | **[MOCK]** |

---

# Cross-cutting reality check

Apply these truths when reading any workflow above:

- **No persistence anywhere.** Every "Save," "Confirm match," "Connect," "Sync now," "Disconnect," "Generate brief," "Export," "New report/schedule," "Invite member," and "Approve & send" (beyond local state) is **visual-only**. Capture submit, Review approve/reject, Schedules toggle, and Settings weight inputs change **local state only** and reset on refresh.
- **No live integrations.** TallyPrime, Google Drive/Gmail/Calendar, Trello, RAJUK ECPS, WhatsApp, AutoCAD-via-Drive are **mock** connectors; QuickBooks, Xero, Autodesk Construction Cloud, SharePoint, Procore, Clockify, Dropbox are listed as available/not-connected. All read/sync is simulated.
- **No real AI inference.** The assistant uses a fixed answer map plus a `genericAnswer` refusal; AI report narratives are mock text with mock citations. The product's discipline — cite sources, show confidence, refuse when data is missing — is genuine *as a design pattern*, but the answers are pre-written.
- **The 2026-06-17 anchor** ("today") and `firm.staff = 22` vs 10 employee records are deliberate fixtures; coverage gaps (e.g. 64% timesheet coverage) are intentional storytelling, not bugs.
- **What is genuinely interactive and worth demoing:** command palette, AI assistant panel, all capture forms (entry + inline success), Review approve/reject, Schedules active toggle, every filter/search/sort/tab/grid-table/group-collapse control, the risk-matrix cell and category filters, "Why this number?" provenance popovers, language label toggle (label only — no translation), and all router cross-links.
