# Module Documentation: Executive Dashboard & Projects

> **Read this first.** SPACE ESSE · Practice Intelligence is a **frontend-only, high-fidelity interactive prototype** (Vite + React + TypeScript + Tailwind v4, React Router, TanStack Query, Recharts, Radix UI). There is **no backend, no database, no authentication, and no persistence**. Every figure on every screen is computed client-side from mock data in `src/lib/mock/*` and served through `src/lib/api.ts` `resolve()`, which deep-clones the mock and resolves after a simulated ~280 ms delay. Refreshing the browser resets all interaction. The "today" anchor is hard-coded to **17 June 2026**.
>
> Throughout this document each feature is tagged with one status:
>
> | Tag | Meaning |
> |---|---|
> | **[IMPLEMENTED]** | Interactive and working in the frontend (client-side only; not saved). |
> | **[MOCK]** | Renders from mock data; the underlying read / sync / calculation is simulated, not live. |
> | **[BACKEND]** | Designed in the UI but needs an API / database / persistence to actually function. |
> | **[INTEGRATION]** | Needs a third-party connector (accounting, Drive, email, authority portal) to function. |
> | **[PLANNED] / [RECOMMENDED]** | Not built; a future enhancement. |

This file covers the Executive Dashboard and the Projects group of modules:

1. Executive Dashboard — `/`
2. Delivery & Operations — `/delivery`
3. Portfolio — `/portfolio`
4. Project Detail — `/projects/:id` (Overview, Schedule & Approvals, Deliverables, Financials, Team, Decisions, Risks tabs)
5. Authority Approvals — `/approvals`
6. Document Control — `/deliverables`
7. Risks & Issues — `/risks`
8. Calendar — `/calendar`

---

## Conventions used in every module section

Each module is documented against the same 25 points, grouped under these headings: **Overview**, **What it shows**, **Actions** (each tagged), **End-to-end workflow**, **Connections**, **Data fields** (with source and entry/calculation), **Statuses / filters / sorts**, **KPIs / charts / formulas**, **Notifications / approvals / automation**, **Roles**, **Audit / attachments / comments**, **States** (empty / loading / insufficient / error), **Mock vs. future backend behaviour**, **External sources**, **Dependencies**, and **Business value**.

A few facts are true of *every* module here and are not repeated each time:

- **Reads are simulated.** All data arrives through React Query hooks (`useProjects`, `usePortfolio`, etc.) that call `resolve()` (280 ms fake latency, deep-cloned mock). There are **no mutation hooks** anywhere — no `useMutation`, no POST/PATCH. **[MOCK]**
- **No real authentication or roles.** A hard-coded user "Tahmid Karim — Owner / Principal" appears in the top bar; the role-switch and sign-out controls have no handlers. Role-based visibility described below is **[PLANNED]/[BACKEND]**.
- **No audit trail writes, attachments, or comment threads** exist on these modules. A read-only Activity Log page exists separately; provenance ("Why this number?") popovers are display-only. **[BACKEND]**
- **No error / failure UI** (no error boundaries, no "failed to load" states) exists on any module below.

---

# 1. Executive Dashboard — `/`

### Overview
- **Route:** `/` (component `Dashboard`).
- **Purpose:** A morning executive overview that surfaces the two or three things the owner must act on today — money, alerts, stuck authority approvals, portfolio health, and the lowest-health projects.
- **Primary users:** Founders, partners, the principal/owner. Secondary: PMs scanning the firm's state.
- **Data hooks:** `usePortfolio`, `useProjects`, `useAlerts`, `useApprovals`, `useAIReports`. **[MOCK]**

### What it shows
1. A hard-coded greeting header ("Good morning, Tahmid") and a hard-coded date kicker ("Executive overview · Tuesday, 17 June 2026"). **[MOCK]** — the date and name do not come from a clock or a user record.
2. An **AI daily-briefing card** drawn from the `daily_brief` mock report. **[MOCK]**
3. Four **KPI cards** (collected, collection rate, overdue receivable, portfolio margin). **[MOCK]**
4. Two **charts** (billed-vs-collected area trend; health-mix donut). **[MOCK]**
5. A **Top alerts** card, an **Authority approvals** card, and a **Project watchlist**. **[MOCK]**

### Actions
| Control | Behaviour | Status |
|---|---|---|
| "This week" header button | No `onClick`. | **[BACKEND]** (visual-only) |
| "Generate brief" header button | No `onClick`. | **[BACKEND]** (would trigger AI report generation) |
| "Read full briefing" link | Navigates to `/reports`. | **[IMPLEMENTED]** |
| "All" link (Top alerts) | Navigates to `/risks`. | **[IMPLEMENTED]** |
| "View tracker" link (Approvals) | Navigates to `/approvals`. | **[IMPLEMENTED]** |
| "All projects →" link (Watchlist) | Navigates to `/portfolio`. | **[IMPLEMENTED]** |
| ProjectCard click (watchlist) | Navigates to `/projects/:id`. | **[IMPLEMENTED]** |
| KPI "Why this number?" popovers | Open provenance popover (formula + sources). | **[IMPLEMENTED]** (display-only content) |

### End-to-end workflow
This is a **read / triage** screen, not a data-entry screen. Flow: **Read** (KPIs + alerts + approvals load from mock) → **Triage** (owner scans for the day's blockers) → **Follow-up** (owner clicks through to `/reports`, `/risks`, `/approvals`, or a project). There is no Input/Validation/Storage stage here because nothing is captured.

### Connections
Out-links to: `/reports`, `/risks`, `/approvals`, `/portfolio`, and individual `/projects/:id` pages (via ProjectCard).

### Data fields shown
| Field | Source | Entry / calculation |
|---|---|---|
| Greeting, date kicker, header description | Hard-coded strings | Authored in the page **[MOCK]** |
| Daily briefing body | `reports.find(kind==="daily_brief").summary` | From `mock/insights.ts` **[MOCK]** |
| Briefing completeness | `brief.completeness` | Mock field (e.g. 73) |
| Top alerts | `useAlerts()` filtered to `critical`/`warning`, first 4 | Mock array **[MOCK]** |
| Approvals list | `useApprovals()` filtered `status!=="approved"`, first 4 | Mock array; shows `{authority} · {title}`, project, `{daysInStage}d / {statutoryDays}d`, badge |
| Watchlist | `useProjects()` sorted ascending by `healthScore.value`, first 4 | Mock array **[MOCK]** |

### Statuses / filters / sorts
- No user-facing filters or sort controls on this page.
- Alerts are filtered in code to critical + warning. Approvals filtered to not-approved. Watchlist sorted ascending by health score (lowest first). All fixed in code.

### KPIs / charts / formulas
The four KPI cards are **hard-coded `Metric` objects** whose `value` reads from `portfolio?.*`; their confidence, completeness, deltas and sparkline trends are literals in the page (not computed). Each carries a `formula` string surfaced in the "Why this number?" popover.

| # | KPI | Value source | Formula (verbatim) | Confidence / completeness | Delta |
|---|---|---|---|---|---|
| 1 | Collected (active) | `portfolio.totalCollected` | "Σ payments received (net of VAT, VDS, AIT) across active projects" | high / 88 | −7% |
| 2 | Collection rate | `portfolio.collectionRate` | "Collected ÷ Billed × 100" | high / 88 | −4% |
| 3 | Overdue receivable | `portfolio.overdueTotal` | "Σ net receivable on invoices past due date" | high / 90 | +12% (good-when-up = false) |
| 4 | Portfolio margin (fee-based) | hard-coded `18` | "Fee-based proxy. True margin needs labour cost — timesheet coverage 62%." | **low** / 62 | −3% |

KPI 4 carries a note: "Labour cost is partial across 4 of 8 projects — margin is indicative, not final." This is a deliberate honesty signal — the prototype refuses to present an unverifiable margin at high confidence.

Underlying portfolio figures are computed client-side in `api.ts computePortfolio()`:
- `totalCollected = Σ active.feeCollected`; `collectionRate = totalCollected / totalBilled × 100`; `overdueTotal = Σ (netReceivable − amountReceived)` over invoices with `status === "overdue"`. **[MOCK]** (computed from mock arrays)

**Charts:**
| Chart | Data | Status |
|---|---|---|
| "Billed vs. collected" (AreaTrend, Jan–Jun) | Hard-coded `moneyTrend` const — **not from API** | **[MOCK]** |
| "Health mix" (Donut) | `projects` grouped by `health` band; center = `portfolio.activeProjects` | **[MOCK]** |

### Notifications / approvals / automation
- The Top alerts and Authority approvals cards **display** mock alerts/approvals. There is no acknowledge, snooze, or push. **[BACKEND]**
- An approvals footer line appears when `overdueApprovals > 0`: "{n} approval(s) past the statutory window — blocking downstream phases."
- "Generate brief" would, in a real build, run scheduled AI report generation. **[BACKEND]/[PLANNED]**

### Roles
No enforcement. In production the dashboard would be owner/partner-scoped, and finance KPIs (collected, overdue) would be gated to Owner / Finance roles. **[PLANNED]/[BACKEND]**

### Audit / attachments / comments
None. Provenance popovers are read-only. **[BACKEND]**

### States
- **Loading:** if `portfolio` is falsy → 4 × `Skeleton h-40` for the KPI row. **[IMPLEMENTED]**
- **Empty:** Top alerts has **no explicit empty state** (renders blank if the filtered array is empty).
- **Insufficient:** Surfaced via the low-confidence margin KPI and its note.
- **Error:** None. **[BACKEND]**

### Mock vs. future backend behaviour
- *Now:* All numbers come from a static mock; the greeting and money trend are literals; "Generate brief" does nothing.
- *Future:* `usePortfolio()` would call a real `/portfolio` endpoint; the daily brief would be generated server-side from reconciled records; "Generate brief" and "This week" would trigger real report jobs. **[BACKEND]**

### External sources
None directly. The data it surfaces *would* ultimately originate from accounting (TallyPrime/QuickBooks/Xero), Google Drive, and manual capture once connected. **[INTEGRATION]**

### Dependencies
`computePortfolio()`, mock projects/invoices/approvals/alerts/reports, the `KpiCard`, `AreaTrend`, `Donut`, `AlertRow`, `ProjectCard`, and `ProvenancePopover` shared components.

### Business value
Gives the owner a one-screen, evidence-cited "what needs me today" view. The deliberate low-confidence margin demonstrates the product's core promise: it would rather show a caveat than a fabricated number.

---

# 2. Delivery & Operations — `/delivery`

### Overview
- **Route:** `/delivery` (component `Delivery`).
- **Purpose:** A single operations screen for schedule slippage, authority approvals, and deliverable health across the whole portfolio.
- **Primary users:** PMs, project directors, the principal.
- **Data hooks:** `useProjects`, `useMilestones`, `useApprovals`, `useDeliverables`. **[MOCK]**

### What it shows
- Header with a "{n} active" badge (count of projects where `stage !== "closed"`) — display only.
- Four KPI cards derived live from mock data.
- Three charts: schedule variance by project (bar), deliverables by status (donut), approval status mix (bar).
- Two lists: milestones due & overdue; approvals needing action.
- A full delivery scorecard table.

### Actions
| Control | Behaviour | Status |
|---|---|---|
| Milestone row → project link | Navigates to `/projects/:id`. | **[IMPLEMENTED]** |
| Approval row → project link | Navigates to `/projects/:id`. | **[IMPLEMENTED]** |
| Scorecard project link / "All projects →" | Navigates to `/projects/:id` or `/portfolio`. | **[IMPLEMENTED]** |
| "{n} active" badge | Display only. | **[MOCK]** |

### End-to-end workflow
Read / triage screen. **Read** (four datasets load) → **Detect** (KPIs and the variance chart highlight the deepest slips and stuck approvals) → **Act** (click into the milestone, approval, or project). No capture here.

### Connections
Out-links to `/projects/:id` (milestones, approvals, scorecard) and `/portfolio`.

### Data fields shown (selected)
| Field | Source | Entry / calculation |
|---|---|---|
| On-time share | `useProjects()` | (active with `scheduleVarianceDays >= 0` ÷ active) × 100; null if no active |
| Overdue milestones | `useMilestones()` | count of `status === "overdue"` |
| Stuck approvals | `useApprovals()` | `daysInStage > statutoryDays` and not approved |
| At-risk deliverables | `useDeliverables()` | `status === "revise"` OR past due and not issued |
| Scorecard rows | `useProjects()` | active projects sorted by `STAGE_ORDER` then `scheduleVarianceDays` |

### Statuses / filters / sorts
- No user filters. Charts and lists use fixed in-code sorts:
  - Variance chart: active projects sorted ascending by `scheduleVarianceDays`.
  - Milestones list: not-done, all overdue + due within 14 days, sorted by date.
  - Approvals list: in-flight or stuck, sorted by overrun descending.
  - Scorecard: by stage order, tie-break schedule variance.
- Status enums referenced: `MilestoneStatus`, `ApprovalStatus`, `DeliverableStatus`, `ProjectStage` (see Appendix of enums in the Project Detail and Document Control sections).

### KPIs / charts / formulas
| # | KPI | Value | Formula (verbatim) | Conf. / compl. |
|---|---|---|---|---|
| 1 | On-time projects | `onTimeShare` | "Share of active projects with schedule variance ≥ 0 days" | medium / 78 |
| 2 | Overdue milestones | `overdueMilestones.length` | "Milestones with status = overdue across the portfolio" | high / 90 |
| 3 | Approvals stuck | `stuckApprovals.length` | "Days-in-stage > statutory window and not yet approved" | high / 86 |
| 4 | Deliverables at risk | `atRiskDeliverables.length` | "Status = revise, or past due date and not issued" | medium / 74 |

KPI `sources`, `asOf`, `deltaPct`, `trend`, and `completeness` are **hard-coded literals**, not computed.

| Chart | Data | Notes |
|---|---|---|
| Schedule variance by project (BarSeries, sienna) | active projects sorted by variance | Caption naming "Bashati" is hard-coded |
| By status (Donut) | deliverables counted per status, filtered > 0 | center = `deliverables.length` |
| Status mix (BarSeries, blue) | approvals counted per status, filtered > 0 | Header `SourceChip "RAJUK ECPS · 12 Jun"` is hard-coded |

### Notifications / approvals / automation
None. The page surfaces overdue/stuck items but cannot escalate, notify, or change status. **[BACKEND]**

### Roles
No enforcement. **[PLANNED]**

### Audit / attachments / comments
None. **[BACKEND]**

### States
- **Loading:** a single `loading` flag (any of the four hooks loading) gates KPIs (`Skeleton h-40`), all charts (`Skeleton` of their height), and lists (`Skeleton h-12`). **[IMPLEMENTED]**
- **Empty:** Milestones list → `EmptyState` "Nothing due"; Approvals list → `EmptyState` "Nothing in flight". Scorecard has no explicit empty state.
- **Insufficient:** None explicit (KPIs carry confidence levels only).
- **Error:** None.

### Mock vs. future backend behaviour
- *Now:* milestones, approvals, deliverables are static; the variance caption and the RAJUK source chip are hard-coded literals.
- *Future:* milestones/deliverables would sync from project management + Google Drive; approvals from manual capture + RAJUK ECPS; KPIs would compute server-side. **[BACKEND]/[INTEGRATION]**

### External sources
RAJUK ECPS (authority), Google Drive / AutoCAD (deliverable presence), project management tools (Trello/Procore). All **[INTEGRATION]**.

### Dependencies
`useProjects/Milestones/Approvals/Deliverables`, `KpiCard`, `BarSeries`, `Donut`, `MilestoneBadge`, `ApprovalBadge`, `SourceChip`, `EmptyState`, `Progress`, status meta maps.

### Business value
Concentrates the three external, opaque schedule drivers (programme slip, authority approvals, drawing churn) into one operational cockpit so PMs can act before a slip becomes a client problem.

---

# 3. Portfolio — `/portfolio`

### Overview
- **Route:** `/portfolio` (component `Portfolio`).
- **Purpose:** A filterable register of every active project, "matched" across accounting / files / capture into a single record, viewable as cards or a table.
- **Primary users:** Partners, PMs, the principal.
- **Data hook:** `useProjects`. **[MOCK]**

### What it shows
- A 4-card summary strip (active count, at-risk count, contract value, average health) — plain stat cards, no confidence meters.
- A portfolio-analytics section with three charts.
- A toolbar (search + three selects + grid/table toggle).
- The project list as a card grid or table.

### Actions
| Control | Behaviour | Status |
|---|---|---|
| Search input | Filters on name + client + code (case-insensitive). | **[IMPLEMENTED]** |
| Type / Stage / Health selects | Filter the list. | **[IMPLEMENTED]** |
| Grid / Table view toggle | Switches view; active gets blue tint. | **[IMPLEMENTED]** |
| ProjectCard (grid) | Navigates to `/projects/:id`. | **[IMPLEMENTED]** |
| Table row | `useNavigate()` → `/projects/:id`. | **[IMPLEMENTED]** |

### End-to-end workflow
Read / browse screen. **Read** → **Filter / search** (combine query + type + stage + health) → **Choose view** (grid vs table) → **Drill in** (open a project). No capture.

### Connections
Out-links to `/projects/:id` from both card and table views.

### Data fields shown
**Summary strip & table columns:**
| Field | Source | Entry / calculation |
|---|---|---|
| Active projects | `projects.length` | mock count |
| At risk / critical | count of `health ∈ {at_risk, critical}` | derived |
| Contract value | `Σ feeContract` (`bdt` compact) | derived |
| Avg health | round(mean `healthScore.value`) | derived |
| Stage | `STAGE_LABELS[stage]` | mock field |
| Health | `HealthBadge` band | mock field |
| Complete | `pctComplete` + Progress | mock field |
| Collected / Contract | `bdt(feeCollected) / bdt(feeContract)` | mock fields |
| Schedule | `±scheduleVarianceDays` (sienna if < 0) | mock field |

### Statuses / filters / sorts
- **Filters:** search (name/client/code), Type (`TYPE_LABELS`), Stage (`STAGE_LABELS`), Health (Healthy/Watch/At risk/Critical). All **[IMPLEMENTED]** as client state and combined in a `filtered` memo.
- **Sort:** none user-controlled; list renders in mock order.
- **View toggle:** grid / table client state.

### KPIs / charts / formulas
No `KpiCard`/confidence on the summary strip (plain stat cards).
| Chart | Data |
|---|---|
| Projects by health (Donut) | count per band, filtered > 0; center = `projects.length` |
| Fee by project type (BarSeries, blue, currency) | `Σ feeContract` per `type` |
| Collected vs. contract (BarSeries, slate + sage, currency) | projects sorted desc by `feeContract` |

### Notifications / approvals / automation
None. **[BACKEND]**

### Roles
No enforcement; fee/collected columns would be finance-gated in production. **[PLANNED]**

### Audit / attachments / comments
None.

### States
- **Empty:** if `filtered.length === 0 && !isLoading` → a Card with `EmptyState` "No projects match" / "Try clearing a filter or search term." **[IMPLEMENTED]**
- **Loading:** **no Skeleton branch** — `isLoading` is used only to suppress the empty state; the page relies on a `projects = []` default while loading.
- **Insufficient / Error:** None.

### Mock vs. future backend behaviour
- *Now:* one mock array; filters/search/view are real client state but reset on refresh.
- *Future:* server-side filtering/pagination; the "matched across tools" promise depends on real cross-reference reconciliation. **[BACKEND]/[INTEGRATION]**

### External sources
Accounting (fees/collected), Drive/CAD (completeness signals), capture — all **[INTEGRATION]**.

### Dependencies
`useProjects`, `ProjectCard`, `Donut`, `BarSeries`, `SearchInput`, `Select`, `HealthBadge`, `Progress`, `EmptyState`, `TYPE_LABELS`/`STAGE_LABELS`.

### Business value
A single, filterable book-of-work where each project carries a data-completeness signal, reinforcing that health and money figures are only as trustworthy as the data behind them.

---

# 4. Project Detail — `/projects/:id`

### Overview
- **Route:** `/projects/:id` (component `ProjectDetail`; reads `useParams().id`). Not in the sidebar nav (a detail route).
- **Purpose:** The single project "file": header, phase stepper, a four-KPI strip, and seven tabs covering every facet of the project.
- **Primary users:** PMs, project architects, directors; partners reviewing a specific job.
- **Data hooks:** `useProjectBundle(id)` (returns `{ project, approvals, milestones, tasks, deliverables, invoices, risks, decisions }`, each from a `*ByProject(id)` helper; gated `enabled: !!id`); team resolved via `employeeById`. **[MOCK]**

### What it shows
- Header: code, name, optional Bangla name (`nameBn`), type/stage/health badges, client · city.
- A **phase stepper** rendering `STAGE_ORDER` with done / current / future states (visual only).
- A four-card KPI strip.
- Seven tabs (see below).

### Actions
| Control | Behaviour | Status |
|---|---|---|
| "Portfolio" back link | Navigates to `/portfolio`. | **[IMPLEMENTED]** |
| Tab switching (7 tabs) | Client state (`Tabs`, default "overview"). | **[IMPLEMENTED]** |
| Health-score "ⓘ" popover | Opens provenance popover. | **[IMPLEMENTED]** |
| "Capture" button | No `onClick`. | **[BACKEND]** (visual-only) |
| "Weekly report" button | No `onClick`. | **[BACKEND]** (visual-only) |
| "Ask about this project" button | No `onClick`. | **[BACKEND]** (visual-only) |
| Phase stepper steps | Not clickable. | **[MOCK]** (visual-only) |

### End-to-end workflow
Read / drill-down screen. **Read** (bundle loads) → **Navigate tabs** → **Inspect provenance** (health popover) → **Follow links** (milestone/approval/invoice rows cross-link out). The three header buttons *suggest* capture/report/ask actions but are not wired. **[BACKEND]**

### Connections
Back to `/portfolio`. Inbound from Dashboard watchlist, Delivery lists/scorecard, Portfolio, Approvals, Document Control, Risks, Calendar, Review Queue, Activity Log, and Search — all of which deep-link to `/projects/:id`.

### KPI strip
| # | KPI | Value | Notes |
|---|---|---|---|
| 1 | Health score | `healthScore.value ?? "—"` + Progress (tone by health band) | "Why this number?" popover; optional `healthScore.note` |
| 2 | Complete | `pctComplete%` + Progress (blue) | subtext "Schedule ±n d vs plan" |
| 3 | Forecast margin | `pct(value)` + ConfidenceBadge, **or "Insufficient data"** if `forecastMargin.value === null` | honest refusal state |
| 4 | Collected / contract | `bdt(feeCollected)` of `bdt(feeContract)` + Progress | derived |

### The seven tabs

#### Tab triggers (verbatim)
`Overview` · `Schedule & Approvals` · `Deliverables` · `Financials` · `Team` · `Decisions` · `Risks`.

#### 4.1 Overview
- **"Where this project's data comes from"** card — lists `p.crossRefs`: a `StatusDot` (connected if `matched`, else manual), the source name, the alias, and a "Matched"/"Needs match" badge; footer shows `DataCompleteness` and the canonical id. **[MOCK]**
- **"Recent decisions"** card — `data.decisions.slice(0,4)` with summary, decided-by, date, channel badge. **Empty:** "No decisions captured yet."

#### 4.2 Schedule & Approvals
- **Milestones** card — each row: name, due date, overdue/left chip, `MilestoneBadge`. **Empty:** "No milestones."
- **Authority approvals** card — `{authority} · {title}`, `ApprovalBadge`, submitted/"Not submitted", overdue line `· {daysInStage}d / {statutoryDays}d statutory`, a `Blocking` badge if `a.blocking`, and a `SourceChip`. **Empty:** "No approvals tracked." **[MOCK]/[INTEGRATION]** (approval data would come from RAJUK ECPS + capture).

#### 4.3 Deliverables (table)
| Column | Source / rule |
|---|---|
| Deliverable | `d.name` |
| Discipline | `d.discipline` |
| Rev | `d.revision`; ⚠ (sienna, "High revision count") if `revisionCount > 3` |
| Status | `DeliverableBadge` |
| Due | `shortDate(dueDate)` |
| Source | `SourceChip` (connected if `fileRef`, else manual) |

No empty-state branch on this table.

#### 4.4 Financials
- **"Fee & cash"** card — rows: Contract fee, Billed, Collected (net), Work-in-progress; then a **"Withholding (NBR)"** block: Gross billed, + VAT 15%, − VDS withheld, − AIT/TDS ~10%, Expected net cash (`taxTotals.net`). Tax totals are summed from `data.invoices`. **[MOCK]**
- **"Invoices"** table:
  | Column | Source / rule |
  |---|---|
  | Invoice | `i.number` |
  | Issued | `shortDate(issueDate)` |
  | Net receivable | `bdt(netReceivable)` |
  | Received | `bdt(amountReceived)` |
  | Status | overdue → "{agingDays}d overdue" (rust); paid → sage; part_paid → ochre; else neutral |
  - **Empty:** "No invoices for this project yet."

**Invoice tax model** (computed in `data.ts inv()` from `grossFee`): `vat = round(gross × 0.15)`; `vdsWithheld = round(vat × 0.6)`; `aitWithheld = round(gross × 0.1)`; `netReceivable = gross + vat − vds − ait`. `amountReceived`: paid → full net; part_paid → 50%; else 0. **[MOCK]** This reflects real Bangladesh NBR withholding (VAT, VDS at source, ~10% AIT/TDS).

#### 4.5 Team
- Lists `p.teamIds` via `employeeById`: avatar, name, title; utilization shown as `pct(value) + "utilization"`, or "No time logged" when `utilization.value === null`. Null employees are skipped. No explicit empty message. **[MOCK]** The "No time logged" path is an honest signal that timesheet coverage is incomplete.

#### 4.6 Decisions
- Lists `data.decisions`: summary, decided-by, date, channel badge, `SourceChip`, plus a "Verified" (sage) badge if `promoted` else "Unverified" (ochre). **Empty:** `InsufficientData` "Decision history" / "nothing has been captured for this project yet." **[MOCK]**

#### 4.7 Risks
- Lists `data.risks`: title, category badge, "Owner: {owner}", raised date; right-side badge `{likelihood}/{impact}` (rust if high/high, sienna if impact high, else ochre). **Empty:** "No open risks." **[MOCK]**

### Statuses / filters / sorts
- No filters/sorts inside tabs (rows render in mock order). Tab selection is the only interactive state.
- Status enums used: `STAGE_LABELS`/`STAGE_ORDER`, `MilestoneStatus`, `ApprovalStatus`, `DeliverableStatus`, `InvoiceStatus`, risk likelihood/impact, decision channel.

### KPIs / charts / formulas
The KPI strip is described above. No charts on this page; the phase stepper is a visual progress indicator only.

### Notifications / approvals / automation
None. Decisions carry a `promoted` (Verified/Unverified) flag but cannot be promoted from here — that gate lives in the Review Queue, and even there it is local state only. **[BACKEND]**

### Roles
No enforcement. Financials tab would be finance-role-gated in production. **[PLANNED]**

### Audit / attachments / comments
Decision/approval/deliverable rows carry a `source`/`SourceChip` provenance reference (display-only). No file attachments, no comment threads. **[BACKEND]**

### States
- **Loading:** `isLoading || !data` → skeleton header (`h-8 w-64`) + 4 × `Skeleton h-28`. **[IMPLEMENTED]**
- **Not found:** if the project resolves to null (`!p`) → text "Project not found." **[IMPLEMENTED]** (this doubles as the closest thing to an error state)
- **Insufficient:** Forecast-margin KPI ("Insufficient data" when null); Decisions tab `InsufficientData` empty.
- **Error:** No network error UI.

### Mock vs. future backend behaviour
- *Now:* a single project bundle from mock; header action buttons and the phase stepper are non-functional; tax totals computed client-side.
- *Future:* the bundle would be one or several API calls; "Capture"/"Weekly report"/"Ask about this project" would open the capture form, generate a report, and query the AI; decision promotion would persist. **[BACKEND]**

### External sources
Accounting (invoices, fees), Drive/CAD (deliverables), RAJUK ECPS (approvals), WhatsApp/phone/email/meeting (decisions), timesheets (team utilization) — all **[INTEGRATION]**.

### Dependencies
`useProjectBundle`, `employeeById`, `KpiCard`, `Tabs`, `ProvenancePopover`, `MilestoneBadge`/`ApprovalBadge`/`DeliverableBadge`, `SourceChip`, `StatusDot`, `DataCompleteness`, `InsufficientData`, `Progress`, format helpers (`bdt`, `pct`, `shortDate`).

### Business value
The authoritative per-project record that ties money, schedule, approvals, drawings, people, decisions, and risks to their source records — and is honest (via the forecast-margin null state and Verified/Unverified decision badges) about what it cannot yet confirm.

---

# 5. Authority Approvals — `/approvals`

### Overview
- **Route:** `/approvals` (component `Approvals`; sidebar item carries an **"alert"** badge). Links out to `/projects/:id`.
- **Purpose:** Track external, opaque approval processes — RAJUK, FSCD, CAAB, DoE, City Corporation, utilities — that none expose an API for, measuring "overdue" against each form's statutory decision window.
- **Primary users:** Authority liaison, PMs, the principal.
- **Data hooks:** `useApprovals`, `useProjects`. Anchor `TODAY = "2026-06-17"`. **[MOCK]**

### What it shows
- Four KPI cards.
- A **critical banner** (when a blocking RAJUK/overdue item exists).
- A grouped card list (grouped by Authority or Status) — **there is no `<Table>` here.**
- A side rail: "Next expected decisions" + a "How we know this" explainer.

### Actions
| Control | Behaviour | Status |
|---|---|---|
| "Open ECPS" header button | No `onClick`. | **[INTEGRATION]** (would deep-link to RAJUK ECPS portal) |
| "Ask liaison" header button | No `onClick`. | **[BACKEND]** (visual-only) |
| Group-by select (Authority / Status) | Client state. | **[IMPLEMENTED]** |
| Row project link | Navigates to `/projects/:id`. | **[IMPLEMENTED]** |
| Banner "Open project" link | Navigates to `/projects/:id`. | **[IMPLEMENTED]** |

### End-to-end workflow (real-world target)
**Input** (liaison manually enters status from the RAJUK ECPS portal or a phone/WhatsApp note) → **Validation** (none in prototype) → **Processing** (`isOverdue()` computed) → **Approval** (authority decision, captured manually) → **Storage** (mock only) → **Reporting** (KPIs + critical banner) → **Follow-up** (open project). In the prototype only the read/compute/display steps exist. **[MOCK]/[INTEGRATION]**

### Connections
Out-links to `/projects/:id` (rows + banner). Inbound from Dashboard ("View tracker"), Delivery, and the sidebar.

### Data fields shown
| Field | Source | Entry / calculation |
|---|---|---|
| Authority | `a.authority` (`ApprovalAuthority` enum) | mock |
| Title | `a.title` | mock |
| Status | `ApprovalBadge` from `a.status` | mock |
| Submitted / Expected / Approved dates | `a.submittedDate`/`expectedDate`/`approvedDate` | mock (nullable) |
| Days in stage / statutory | `a.daysInStage` / `a.statutoryDays` | mock |
| Blocking | `a.blocking` | mock; drives banner + badge |
| Owner | `a.owner` | mock |
| Source | `a.source.sourceName` via `SourceChip` (status "manual") | mock provenance |

### Statuses / filters / sorts
- **Status enum / labels (`STATUS_LABEL`):** not_started→"Not started", preparing→"Preparing", submitted→"Submitted", in_review→"In review", query_raised→"Query raised", approved→"Approved", rejected→"Rejected".
- **In-flight set:** not_started, preparing, submitted, in_review, query_raised.
- **Overdue rule (verbatim logic):** `statutoryDays !== null && daysInStage > statutoryDays && status !== "approved" && status !== "rejected"`.
- **Group-by filter:** Authority or Status (client state).
- **Within-group sort (fixed):** blocking first → overdue first → `daysInStage` desc.
- **Group ordering:** Status mode uses `STATUS_ORDER` (query_raised → in_review → submitted → preparing → not_started → approved → rejected); Authority mode floats overdue > blocking > in-flight > else, tie-break by row count.
- Authorities with **no API** (`RAJUK, FSCD, CAAB, DoE, City Corporation`) get a verbatim "No API · manual" badge on their group header. **[INTEGRATION]**

### KPIs / charts / formulas
No charts. Four KPI cards (metrics built inline; sources use `ecpsSrc()` → "RAJUK ECPS + capture", observed 2026-06-12):
| # | KPI | Value | Formula (verbatim) | Conf. / compl. |
|---|---|---|---|---|
| 1 | In flight | `stats.inFlight.length` | "Count of approvals not in a terminal state (approved / rejected)." | high / 90 |
| 2 | Overdue vs. statutory | `stats.overdue.length` | "daysInStage > statutoryDays, excluding approved/rejected." | high / 88 |
| 3 | Cleared (last 12 months) | `stats.approvedLast12mo.length` | "Approvals with an approvedDate within 365 days of today." | medium / 70 |
| 4 | Avg cycle time | `stats.avgCycle` (days or null) | "Mean of (approvedDate − submittedDate) over completed approvals." | medium / 55 |

KPI 4's note flags the small sample ("Only N completed cycles on record — directional, not statistical.") — another deliberate honesty signal.

**Critical banner:** appears when a blocking, overdue RAJUK Form 301 item exists (else any blocking overdue item). Shows "Critical · blocking delivery", a Blocking badge, the headline "{authority} {title} is {N days} past the statutory window", `ApprovalBadge`, the `{daysInStage}d / {statutoryDays}d statutory` line, a manual `SourceChip`, and an "Open project" link.

### Notifications / approvals / automation
The page detects and ranks overdue/blocking items but cannot notify, escalate, or change status. "Ask liaison" and "Open ECPS" are non-functional. **[BACKEND]/[INTEGRATION]**

### Roles
"How we know this" explainer names the liaison ("Shahed Alam"). No enforcement. **[PLANNED]**

### Audit / attachments / comments
Each row carries a manual `SourceChip` and a "Updated {relative(lastUpdate)}" stamp (display-only). No attachments/comments. **[BACKEND]**

### States
- **Loading:** full-page skeleton layout when `isLoading || projectsLoading`. **[IMPLEMENTED]**
- **Empty:** `EmptyState` (Landmark icon) "No approvals tracked" / "Nothing has been logged from ECPS or capture yet." Side-rail empty text: "No expected dates on the in-flight items."
- **Insufficient:** Surfaced via KPI notes (low sample) and medium confidence; no dedicated component.
- **Error:** None.

### Mock vs. future backend behaviour
- *Now:* approvals are a static mock; overdue/cycle metrics computed client-side; portal/liaison buttons inert.
- *Future:* a RAJUK ECPS connector (or assisted manual capture) would feed statuses; "Open ECPS" would deep-link; alerts would fire when an item passes its statutory window. **[INTEGRATION]/[BACKEND]**

### External sources
RAJUK ECPS portal and other authorities (FSCD, CAAB, DoE, City Corporation, DPDC/DESCO/WASA/Titas/Land Mutation), plus phone/WhatsApp liaison notes — **none expose an API**; all are **[INTEGRATION]**/manual capture.

### Dependencies
`useApprovals`, `useProjects`, `KpiCard`, `ApprovalBadge`, `SourceChip`, `EmptyState`, `Select`, `CriticalBanner` (page-local), `CHART` palette tokens (sparkline colors), format helpers.

### Business value
Makes the single biggest external schedule risk for a Dhaka architecture practice — opaque, statutory authority approvals — visible and quantified against the legal decision windows, with explicit honesty that the data is manually maintained.

---

# 6. Document Control — `/deliverables`

### Overview
- **Route:** `/deliverables` (component `Deliverables`; sidebar label "Document Control"). Links to `/projects/:id`.
- **Purpose:** A drawing register matched across projects. CAD apps (AutoCAD, SketchUp, D5) expose no data API, so entries are **file-presence signals harvested from Google Drive**, not read from the CAD tools.
- **Primary users:** Document controllers, project architects, PMs.
- **Data hooks:** `useDeliverables`, `useProjects`. **[MOCK]**

### What it shows
- Four KPI cards.
- Three charts (status donut, discipline bar, revision-load stacked bar).
- A filter toolbar (search + three selects).
- A register table.
- A "High-churn watchlist" sidebar.

### Actions
| Control | Behaviour | Status |
|---|---|---|
| Search input | Matches `name + revision + source`. | **[IMPLEMENTED]** |
| Discipline / Status / Project selects | Filter the table. | **[IMPLEMENTED]** |
| Register row project link | Navigates to `/projects/:id`. | **[IMPLEMENTED]** |
| Watchlist row project link | Navigates to `/projects/:id`. | **[IMPLEMENTED]** |
| Rev ⚠ tooltip | Hover tooltip "{n} revisions — high churn". | **[IMPLEMENTED]** |
| "Open review" sidebar button | No `onClick`. | **[BACKEND]** (visual-only) |

### End-to-end workflow
Read / monitor screen. **Read** (deliverables load) → **Filter / search** → **Spot rework risk** (revision-load chart + watchlist flag `revisionCount > 3`) → **Drill in** (open the project). File upload / issue is not implemented. **[BACKEND]/[INTEGRATION]**

### Connections
Out-links to `/projects/:id` (register + watchlist).

### Data fields / register columns
| Column | Source | Rule |
|---|---|---|
| Deliverable | `d.name` | mock |
| Project | `proj.code` link to `/projects/:id` | else "—" |
| Discipline | `d.discipline` (Architecture/Structure/MEP/Interior/Landscape) | mock |
| Rev | `d.revisionCount`; ⚠ tooltip if `> 3` | mock |
| Status | `DeliverableBadge` | mock |
| Due | `shortDate(dueDate)`; red + "overdue" if past due and not closed | derived |
| Source | `SourceChip name={d.source}` (connected if `fileRef`, else manual) | mock |

Register footer: `DataCompleteness` + "{missingFiles} drawing(s) with no file detected on Drive".

### Statuses / filters / sorts
- **Status enum / labels (`STATUS_LABELS`):** not_started, in_progress, internal_review, issued, approved, revise. `isClosed = issued || approved`.
- **Filters:** search, Discipline, Status, Project (all client state).
- **Sort:** register renders in `rows` order (no user sort); charts/watchlist have internal sorts (e.g., revision load = top 12 by `revisionCount` desc).

### KPIs / charts / formulas
| # | KPI | Value | Notes |
|---|---|---|---|
| 1 | Total deliverables | `num(total)` | completeness = round(rows-with-fileRef ÷ total × 100) |
| 2 | Issued / approved | round(closed ÷ total × 100)% | good-when-up |
| 3 | In revision | `num(inRevision)` (`status === "revise"`) | footnote "{missingFiles} awaiting a file" |
| 4 | Drawing revision rate | `avgRevRate.toFixed(2)×` (`Σ revisionCount ÷ total`) | good-when-up = false |

| Chart | Data |
|---|---|
| By status (Donut) | counts per status, ordered/filtered > 0; colors per `STATUS_COLOR` |
| By discipline (BarSeries, blue) | counts per discipline, filtered > 0 |
| Revision load (BarSeries, stacked) | top 12 by `revisionCount`; "High churn (>3)" highlighted in sienna |

### Notifications / approvals / automation
None. The watchlist flags churn but cannot open a review or notify. "Open review" is inert. **[BACKEND]**

### Roles
No enforcement. **[PLANNED]**

### Audit / attachments / comments
Each row carries a `SourceChip` (Drive presence) — display-only. No real file links, attachments, or comments. **[INTEGRATION]/[BACKEND]**

### States
- **Loading:** 5 `Skeleton` rows in the table area. **[IMPLEMENTED]**
- **Empty (filtered):** `EmptyState` (FolderSearch) "No deliverables match" / "Try clearing a discipline, status or project filter." Charts and watchlist have their own "No deliverables."/"No high-revision deliverables." text.
- **Insufficient:** Surfaced via completeness % and a `ConfidenceBadge level="medium"` on the watchlist.
- **Error:** None.

### Mock vs. future backend behaviour
- *Now:* a static register; the "Source of truth is Drive presence" claim is illustrated, not connected; a "manual" chip just means no `fileRef` in the mock.
- *Future:* a Google Drive (and AutoCAD-via-Drive) connector would harvest real file-presence and revision signals; "Open review" would route the drawing to the review queue. **[INTEGRATION]/[BACKEND]**

### External sources
Google Drive (file presence), AutoCAD via Drive, SketchUp/D5 (no API) — all **[INTEGRATION]**.

### Dependencies
`useDeliverables`, `useProjects`, `KpiCard`, `Donut`, `BarSeries`, `DeliverableBadge`, `SourceChip`, `StatusDot`, `SearchInput`, `Select`, `Tooltip`, `EmptyState`, `DataCompleteness`, `STATUS_LABELS`/`STATUS_COLOR`.

### Business value
Turns scattered CAD files into a single drawing register with a rework-risk lens (revision churn), while being explicit that the signal is file-presence on Drive — not a true CAD/BIM integration.

---

# 7. Risks & Issues — `/risks`

### Overview
- **Route:** `/risks` (component `Risks`). Links to `/projects/:id`.
- **Purpose:** Logged project risks alongside AI-detected anomalies, each carrying source and confidence so the team acts on signal, not noise.
- **Primary users:** PMs, directors, the principal.
- **Data hooks:** `useRisks`, `useAlerts`, `useProjects`. **[MOCK]**

### What it shows
- A header action badge "{highHigh} at high / high".
- Four KPI cards.
- An interactive likelihood × impact **risk matrix**.
- A clickable "By category" panel.
- A risk register table.
- An "AI-detected anomalies" section (rendered from alerts).

### Actions
| Control | Behaviour | Status |
|---|---|---|
| Matrix cell click | Toggles a cell filter on the table (blue ring on active). | **[IMPLEMENTED]** |
| "Clear cell filter" | Clears the matrix filter. | **[IMPLEMENTED]** |
| Category bar click | Toggles a category filter. | **[IMPLEMENTED]** |
| Category / Status selects | Filter the register. | **[IMPLEMENTED]** |
| Register row project link | Navigates to `/projects/:id`. | **[IMPLEMENTED]** |
| AlertRow "View project →" | Navigates to `/projects/:id` (when `projectId`). | **[IMPLEMENTED]** |
| Header badge / "Space Esse AI" label | Decorative. | **[MOCK]** |

### End-to-end workflow
Read / triage screen. **Read** → **Filter** (matrix cell, category bar, or selects) → **Prioritise** (register sorted by exposure) → **Act** (open the project). Risk creation/editing is not implemented. **[BACKEND]**

### Connections
Out-links to `/projects/:id` (register rows + AlertRows). Inbound from Dashboard ("All" → `/risks`).

### Data fields / register columns
| Column | Source | Rule |
|---|---|---|
| Risk | `r.title` | mock |
| Project | name link (or "Portfolio" when `projectId` null) | derived |
| Category | `CAT_TONE` badge | schedule/financial/approval/scope/resource/client |
| Likelihood / impact | `{likelihood}/{impact}` badge | severity tone |
| Owner | `r.owner` | mock |
| Status | open/mitigating/closed badge | mock |
| Raised | `shortDate(raisedDate)` | mock |

### Statuses / filters / sorts
- **Scoring:** `SCORE = {low:1, medium:2, high:3}`; `exposure = SCORE[likelihood] × SCORE[impact]`.
- **Category labels/tones:** schedule(blue), financial(rust), approval(sienna), scope(ochre), resource(sage), client(neutral).
- **Status:** open(ochre), mitigating(blue), closed(sage); `open = status !== "closed"`.
- **Filters:** Category select, Status select, matrix cell, category bar — all client state and combined.
- **Sort:** register fixed by `exposure` desc then `title` asc.

### KPIs / charts / formulas
| # | KPI | Value | Notes |
|---|---|---|---|
| 1 | Open risks | `open.length` | completeness 100; "excludes closed" |
| 2 | High / high | `highHigh` | footnote "Escalate" (red) when > 0 |
| 3 | Critical alerts | count of alerts `severity === "critical"` | source "Space Esse AI · Anomaly stream" |
| 4 | Top category | `CAT_LABEL[topCat]` | footnote "{n} open" |

**Risk matrix:** rows = likelihood (high→low), cols = impact (low→high); each cell = count of open risks at that combination; tint by score (`≥9` rust "Severe", `≥6` sienna "High", `≥3` ochre "Moderate", else sage "Low"); zero-count cells dimmed; click filters the table. **[IMPLEMENTED]**

**AI-detected anomalies:** `alerts` with severity in critical/warning/info rendered via `AlertRow`. **Empty:** `EmptyState` "No anomalies right now". **[MOCK]** — there is no live anomaly detection; these are static mock alerts.

### Notifications / approvals / automation
The "AI-detected anomalies" framing implies automated detection, but it is **static mock data** — no inference runs. No notifications/escalation. **[MOCK]/[BACKEND]**

### Roles
No enforcement. **[PLANNED]**

### Audit / attachments / comments
AlertRows carry a `SourceChip` + `ConfidenceBadge` (display-only). No attachments/comments. **[BACKEND]**

### States
- **Loading:** KPI row → 4 `Skeleton`; register → 4 `Skeleton` rows. **[IMPLEMENTED]**
- **Empty:** register → `EmptyState` (ShieldAlert) "No matching risks"; by-category → "No open risks."; anomalies → `EmptyState` (Sparkles) "No anomalies right now".
- **Insufficient:** Surfaced via `ConfidenceBadge` on AlertRows.
- **Error:** None.

### Mock vs. future backend behaviour
- *Now:* risks and "AI anomalies" are static; the matrix/filter interactions are real client state.
- *Future:* anomalies would be produced by a real detection layer over connected sources; risks would be CRUD-backed; high/high items could trigger alerts. **[BACKEND]**

### External sources
Anomalies would derive from accounting, schedule, and capture data once connected. **[INTEGRATION]**

### Dependencies
`useRisks`, `useAlerts`, `useProjects`, `KpiCard`, `AlertRow`, `Select`, `EmptyState`, `Badge`/category & status tone maps, `ConfidenceBadge`, `SourceChip`, format helpers.

### Business value
A prioritised risk picture (exposure matrix + AI anomaly stream) that keeps the team focused on the top-right of the matrix, with the prototype's signal-vs-noise honesty (confidence + source on every anomaly).

---

# 8. Calendar — `/calendar`

### Overview
- **Route:** `/calendar` (component `Calendar`). Agenda items link to `/projects/:id`.
- **Purpose:** A single month view combining milestones, authority-approval deadlines, and meetings across every project.
- **Primary users:** PMs, the principal, anyone coordinating deadlines.
- **Data hooks:** `useMilestones`, `useApprovals`, `useMeetings`. Anchors: `TODAY = 2026-06-17`, default month June 2026. **[MOCK]**

### What it shows
- A six-week month grid (Sun→Sat) with up to 3 event chips per day + "+N more".
- A right-hand **agenda** of the next 14 days.
- A legend (Milestone / Approval / Meeting).

### Actions
| Control | Behaviour | Status |
|---|---|---|
| "< Previous month" | `subMonths` (client state). | **[IMPLEMENTED]** |
| "Today" | Resets to default month (June 2026). | **[IMPLEMENTED]** |
| "> Next month" | `addMonths` (client state). | **[IMPLEMENTED]** |
| Agenda item project link | Navigates to `/projects/:id` (when name/id present). | **[IMPLEMENTED]** |

### End-to-end workflow
Read / coordinate screen. **Read** (three datasets merge into dated events) → **Navigate months** → **Scan agenda** → **Drill in** (open the related project). No event creation here (that would belong to a calendar connector). **[INTEGRATION]**

### Connections
Out-links to `/projects/:id` (agenda items). No KPI cards, tables, or charts on this page.

### Data fields / event sources (`KIND_META`)
| Event kind | Source | Dot / chip color | Built from |
|---|---|---|---|
| Milestone | `useMilestones()` | blue | `dueDate` / `name` |
| Approval | `useApprovals()` — **only those with an `expectedDate`** | sienna | `expectedDate`; title `{authority} · {title}` |
| Meeting | `useMeetings()` | sage | `date` / `title` |

### Statuses / filters / sorts
- No filters. Events keyed `yyyy-MM-dd` (`eventsByDay`), sorted within a day by timestamp.
- Agenda = events with `differenceInCalendarDays(date, TODAY)` between 0 and 14, sorted ascending.
- Month grid: today cell ringed blue; out-of-month days dimmed; `MAX_CHIPS = 3`.

### KPIs / charts / formulas
None on this page.

### Notifications / approvals / automation
None. The calendar surfaces approval deadlines but cannot remind or sync to a real calendar. **[INTEGRATION]/[BACKEND]**

### Roles
No enforcement. **[PLANNED]**

### Audit / attachments / comments
None.

### States
- **Loading:** grid → 42 `Skeleton` cells; agenda → 6 `Skeleton`. **[IMPLEMENTED]**
- **Empty:** agenda → `EmptyState` "Nothing scheduled" / "No deadlines or meetings fall within the next two weeks from today."
- **Insufficient / Error:** None.

### Mock vs. future backend behaviour
- *Now:* events come from three static mock arrays; month navigation is real client state.
- *Future:* meetings would sync from Google Calendar; approvals from the approvals pipeline; the view could become two-way (create/edit events). **[INTEGRATION]/[BACKEND]**

### External sources
Google Calendar (meetings), the approvals pipeline (RAJUK ECPS deadlines) — **[INTEGRATION]**.

### Dependencies
`useMilestones`, `useApprovals`, `useMeetings`, `date-fns` (`startOfWeek`/`addMonths`/`eachDayOfInterval`/`differenceInCalendarDays`), `StatusDot`, `Badge`, `EmptyState`, format helpers (`compactDate`, `daysFromNow`).

### Business value
A single coordination surface that puts statutory approval deadlines, delivery milestones, and meetings side by side — so a RAJUK decision date or a milestone is never lost between three separate tools.

---

## Cross-module summary

### Shared honesty mechanisms (the product's differentiator)
- **Provenance everywhere:** `SourceChip` and the "Why this number?" `ProvenancePopover` (formula + sources + completeness + as-of date) appear across these modules — all display-only. **[MOCK]/[BACKEND]**
- **Confidence + completeness:** KPIs carry a `ConfidenceBadge`/meter and a `DataCompleteness` bar; low coverage is shown, not hidden.
- **Refusal states:** Forecast margin (`null` → "Insufficient data"), the dashboard low-confidence margin, the Decisions tab `InsufficientData`, and the Approvals "directional, not statistical" note all demonstrate the system refusing to fabricate.

### What is genuinely interactive across these modules (client state only, resets on refresh)
Portfolio filters/search/view toggle; Project Detail tabs and the health popover; Approvals group-by; Document Control filters/search/tooltips; Risks matrix/category/select filters; Calendar month navigation; all "Why this number?" popovers; all cross-navigation links.

### What is visual-only / not built across these modules
All header action buttons that imply writes or external jumps — "This week", "Generate brief", "Capture", "Weekly report", "Ask about this project", "Open ECPS", "Ask liaison", "Open review", "Add a source" — plus the phase stepper, and the hard-coded greeting / money trend / source chips noted above. None persist or call out to a real system. **[BACKEND]/[INTEGRATION]**

### What every module needs to become real
A backend with persistence and mutations; real authentication and role enforcement (especially finance gating); connectors for accounting (TallyPrime/QuickBooks/Xero), Google Drive/Calendar/Gmail, project management (Trello/Procore), time tracking, and — critically for a Dhaka practice — assisted capture from the RAJUK ECPS portal and WhatsApp, none of which expose usable APIs today. **[BACKEND]/[INTEGRATION]**
