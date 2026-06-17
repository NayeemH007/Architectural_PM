# Dashboards & KPI Calculation Logic

> **Scope of this document.** SPACE ESSE · Practice Intelligence is a **frontend-only, high-fidelity interactive prototype** (Vite + React + TypeScript + Tailwind v4, React Router, TanStack Query, Recharts, Radix UI). Every dashboard described here renders from **mock data** held in `src/lib/mock/{data,ops,insights,integrations}.ts`, served through `src/lib/api.ts` `resolve()` — a function that deep-clones the mock arrays (`JSON.parse(JSON.stringify(...))`) and resolves after a simulated `LATENCY = 280ms`, then consumed by React Query hooks.
>
> **There is no backend, database, real authentication, persistence, network, or AI inference.** Every KPI value is either (a) computed **client-side** from the mock arrays by a derived function in `api.ts`, or (b) a **hardcoded `Metric` object** written directly into a page (each `Metric` carries a `formula` string surfaced in the "Why this number?" provenance popover). Unless a number runs through one of the four `api.ts` derived functions, treat it as a literal authored into the page.
>
> **Status legend** — each feature is tagged: **[IMPLEMENTED]** working in the frontend (client-side only) · **[MOCK]** renders from mock data, the underlying read/sync/calc is simulated · **[BACKEND]** designed in UI, needs an API/DB/persistence to truly function · **[INTEGRATION]** needs a third-party connector · **[PLANNED]/[RECOMMENDED]** not built.
>
> **Anchor date.** "Today" is hardcoded to **2026-06-17** in three places: `format.ts` `daysFromNow()`, `mock/data.ts` `TODAY`, and `mock/ops.ts` `TODAY`. Aging and "days from now" math is measured against this fixed date, not the real clock. (One exception: `relative()` uses the real system clock, so "x ago" strings drift.)

---

## How a KPI Reaches the Screen

Every dashboard KPI follows the same path. Knowing it once explains all ten dashboards below.

| Stage | What happens | Status |
|---|---|---|
| **1. Source** | A mock array (`projects`, `invoices`, `employees`, `opportunities`, `targets`, `dataSources`, etc.) is the only "database". | [MOCK] |
| **2. Read** | A React Query hook (`usePortfolio`, `useProjects`, …) calls `resolve(data)` → deep-clones and resolves after ~280ms. | [MOCK] |
| **3. Compute** | Either an `api.ts` derived function runs (`computePortfolio`, `agingBuckets`, `pipelineByStage`, `utilizationSummary`) **or** the page maps the array inline **or** the value is a hardcoded literal in a `Metric`. | [IMPLEMENTED] (client-side) |
| **4. Render** | A `KpiCard` formats by unit (`bdt`/`pct`/`score`/`days`/`hours`/`ratio`/`count`) and shows confidence + completeness + a "Why this number?" popover with the `formula`. | [IMPLEMENTED] |
| **5. Refresh** | Nothing persists. A page refresh resets all client state. | n/a |

**The four derived functions (the only real "calculation engine"), all in `api.ts`:**

- `computePortfolio()` — portfolio money + health roll-ups (feeds the Executive, Delivery, Portfolio summary, Financials, Pipeline weighted, Data Quality).
- `agingBuckets()` — receivables aging (feeds Financials).
- `pipelineByStage()` — opportunity counts/value by stage (feeds Pipeline).
- `utilizationSummary()` — staff utilization + timesheet coverage (feeds Resourcing).

Helpers: `sum = a => a.reduce((x,y)=>x+y,0)`; `avg = a => a.length ? sum(a)/a.length : 0`.

**`KpiCard` unit formatting (from `formatMetric(m)`):** `bdt` → `bdt(value,{compact:true})`; `pct` → `pct(value)`; `score` → `value.toFixed(0)`; `days` → signed `+Nd`; `hours` → `Nh`; `ratio` → `N.NN×`; default → `num(value)`. If `metric.value === null` **or** `confidence === "insufficient"`, the card renders **"— —"** + "Insufficient data" (plus the note) instead of a fabricated figure. A sparkline shows only if `metric.trend.length > 1`.

**Currency formatting (`bdt`, compact mode):** ≥1 Cr → `৳x.xx Cr`; ≥1 L → `৳x.xx L`; ≥1k → `৳x.xk`; else `৳x`. Uses the Taka glyph throughout.

---

## 1. Executive Dashboard (`/`)

**What it communicates.** The one-screen morning read for the principal: cash position, the two or three items that need a human today, authority-approval blockers, portfolio health mix, and the lowest-health projects. [MOCK]

**Target user.** Owner / Principal (the header greets "Tahmid"). Also partners and the director.

**Data source.** `usePortfolio`, `useProjects`, `useAlerts`, `useApprovals`, `useAIReports` (all [MOCK]). The header greeting, date kicker ("Tuesday, 17 June 2026"), and the AI-brief `ConfidenceBadge level="medium"` are **hardcoded**.

**Business decisions supported.** Where to spend attention first today; whether to chase a receivable; whether an approval blocker needs escalation; which project file to open next.

### KPIs

All four are **hardcoded `Metric` objects**; only the displayed `value` is pulled from `portfolio?.*` (which is itself `computePortfolio()` output). [MOCK]

| KPI | Displayed value (source) | Exact formula (verbatim from the `Metric.formula`) | Confidence | Completeness | Delta |
|---|---|---|---|---|---|
| Collected (active) | `portfolio.totalCollected` | "Σ payments received (net of VAT, VDS, AIT) across active projects" | high | 88 | −7% (good-when-up) |
| Collection rate | `portfolio.collectionRate` | "Collected ÷ Billed × 100" | high | 88 | −4% |
| Overdue receivable | `portfolio.overdueTotal` | "Σ net receivable on invoices past due date" | high | 90 | +12% (good-when-up = false) |
| Portfolio margin (fee-based) | hardcoded `18` | "Fee-based proxy. True margin needs labour cost — timesheet coverage 62%." | low | 62 | −3% |

> The Portfolio-margin value `18` is **not computed** — it is a literal in the page. Its low confidence and the note ("Labour cost is partial across 4 of 8 projects — margin is indicative, not final.") are the honest signal that real margin needs labour-cost data the prototype does not have. [BACKEND] for a true figure.

**Underlying `computePortfolio()` math (the real client-side calculation):**

```
active        = projects.filter(p => p.stage !== "closed")   // all 8 are active
totalCollected= Σ active.feeCollected
totalBilled   = Σ active.feeBilled
collectionRate= totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0
overdue       = invoices.filter(i => i.status === "overdue")
overdueTotal  = Σ (overdue.netReceivable − overdue.amountReceived)
```

**Loading / empty states.** If `portfolio` is falsy → four `Skeleton h-40` cards. [IMPLEMENTED]

### Supporting panels

| Panel | Content | Calculation / source | Status |
|---|---|---|---|
| AI daily briefing | Shows `brief.summary` + completeness; "Read full briefing" → `/reports` | Rendered only if a `daily_brief` report exists; confidence badge hardcoded "medium" | [MOCK] |
| Billed vs. collected (AreaTrend) | Jan–Jun two-series chart | **Hardcoded `moneyTrend` const** in-file, NOT from API | [MOCK] (visual) |
| Health mix (Donut) | Counts projects by `health` band; center = active project count | Derived inline from `projects` | [MOCK] |
| Top alerts | `alerts.filter(critical\|warning).slice(0,4)` as `AlertRow`; "All" → `/risks` | From `useAlerts` | [MOCK] |
| Authority approvals | `approvals.filter(status !== "approved").slice(0,4)`; overdue chip `{daysInStage}d / {statutoryDays}d` | From `useApprovals`; footer counts `portfolio.overdueApprovals` | [MOCK] |
| Project watchlist | Projects sorted ascending by `healthScore.value`, `.slice(0,4)` as `ProjectCard` | Derived from `projects` | [MOCK] |

**Header buttons "This week" and "Generate brief"** have **no onClick** — [BACKEND]/[PLANNED] (report generation needs an inference + persistence layer).

---

## 2. Delivery & Operations (`/delivery`)

**What it communicates.** Portfolio-wide delivery health on one screen: schedule slippage, stuck authority approvals, deliverable risk, and a per-project scorecard. [MOCK]

**Target user.** Project directors and PMs running the delivery book.

**Data source.** `useProjects`, `useMilestones`, `useApprovals`, `useDeliverables` (all [MOCK]). The KPI `Metric` envelopes (sources, `asOf`, `deltaPct`, `trend`, `completeness`) are **hardcoded literals**; only each KPI's *value* is computed live from the arrays.

**Business decisions supported.** Which project is slipping most and why; which approval has blown its statutory window; whether deliverables are churning; where to reallocate attention.

### KPIs — values derived live from data

| KPI | Value calculation | Formula (verbatim) | Confidence | Completeness | Delta |
|---|---|---|---|---|---|
| On-time projects | `(active with scheduleVarianceDays ≥ 0 ÷ active) × 100`, `null` if no active | "Share of active projects with schedule variance ≥ 0 days" | medium | 78 | −6% |
| Overdue milestones | `milestones.filter(status === "overdue").length` | "Milestones with status = overdue across the portfolio" | high | 90 | +50% (good = false) |
| Approvals stuck | `stuckApprovals.length` | "Days-in-stage > statutory window and not yet approved" | high | 86 | +100% (good = false) |
| Deliverables at risk | `atRiskDeliverables.length` | "Status = revise, or past due date and not issued" | medium | 74 | +33% (good = false) |

**Loading state.** A single `loading` flag (all four hooks) gates the KPI row, charts, lists, and scorecard with Skeletons. [IMPLEMENTED]

### Supporting analytics

| Element | Content / calculation | Status |
|---|---|---|
| Schedule variance by project (BarSeries) | Active projects sorted ascending by `scheduleVarianceDays`, x = `code`. Caption naming "Bashati" is **hardcoded** | [MOCK] |
| Deliverables by status (Donut) | Count per status, filtered >0; center = total deliverables | [MOCK] |
| Approvals status mix (BarSeries) | Count per approval status; header `SourceChip "RAJUK ECPS · 12 Jun"` is **hardcoded** | [MOCK] |
| Milestones — due & overdue | Milestones not done, overdue + due within 14 days, sorted by date; project links → `/projects/{id}`. Empty: "Nothing due" | [MOCK] / [IMPLEMENTED] links |
| Approvals needing action | In-flight or stuck approvals sorted by overrun desc. Empty: "Nothing in flight" | [MOCK] |

### Delivery scorecard (table)

Active projects sorted by `STAGE_ORDER` index, tiebreak `scheduleVarianceDays`. Columns: Project (link) · Stage · Schedule var · Open approvals · Open risks · % complete.

- **Open approvals** cell = count of approvals where `projectId` matches and status is not approved/rejected (computed per row). **Open risks** = `p.openRisks` (red when ≥4). **% complete** = a `Progress` bar toned sage ≥75 / blue ≥40 / else ochre. [MOCK]

---

## 3. Portfolio Analytics (`/portfolio`)

**What it communicates.** Every active project matched into one filterable record set, with a summary strip and three analytics charts. [MOCK]

**Target user.** Principals and directors scanning the whole book; PMs filtering to their slice.

**Data source.** `useProjects` only ([MOCK]).

**Business decisions supported.** Spot the at-risk cluster; see fee concentration by project type; judge realisation (collected vs. contract); drill into any project.

### Summary strip (4 stat cards — plain values, NO confidence/`Metric`)

| Stat | Calculation | Status |
|---|---|---|
| Active projects | `projects.length` | [MOCK] |
| At risk / critical | count `health === "at_risk" \|\| "critical"` | [MOCK] |
| Contract value | `bdt(Σ feeContract, {compact})` | [MOCK] |
| Avg health | `round(mean(healthScore.value))` | [MOCK] |

### Analytics charts

| Chart | Calculation | Status |
|---|---|---|
| Projects by health (Donut) | Count per band, filtered >0; center = `projects.length` | [MOCK] |
| Fee by project type (BarSeries, currency) | `Σ feeContract` per `type`, labelled via `TYPE_LABELS` | [MOCK] |
| Collected vs. contract (BarSeries, currency) | Projects sorted desc by `feeContract`; bars Contract + Collected | [MOCK] |

### Filtering & view (all client-side)

Search (`name + client + code`), Type Select, Stage Select, Health Select, and a grid/table view toggle — all **[IMPLEMENTED]** (client state, not persisted). Combined via a `filtered` memo. Empty: "No projects match". Table rows navigate to `/projects/{id}`. Footer: "Showing {filtered} of {projects} projects · {pct} average data completeness" (mean of `completeness`).

> No Skeleton branch here; `isLoading` only suppresses the empty state. Relies on the `projects = []` default.

---

## 4. Financials (`/financials`)

**What it communicates.** Cash, not invoice face value. Every figure is net of 15% VAT, VDS, and ~10% AIT withholding. Billing, collections, WIP, aging, and a Bangladesh withholding explainer. [MOCK]

**Target user.** Owner / Finance-Admin role (finance is the restricted domain per the Settings model). [BACKEND] for real role-gating.

**Data source.** `usePortfolio`, `useInvoices`, `useClients` ([MOCK]). The 6-month `moneyTrend` and the tax-explainer chip values are **hardcoded literals**.

**Business decisions supported.** How much cash is actually collectable after tax; which receivables are aging into the danger band; which clients owe most; why "billed" ≠ "cash".

### KPIs (4 `KpiCard`s)

| KPI | Value source | Formula (verbatim) | Confidence | Completeness | Delta |
|---|---|---|---|---|---|
| Billed | `portfolio.totalBilled ?? null` | "Σ gross fee invoiced across active projects" | high | 90 | +5% |
| Collected (net) | `portfolio.totalCollected ?? null` | "Σ payments received (net of VAT/VDS/AIT)" | high | 90 | −7% |
| Collection rate | `portfolio.collectionRate ?? null` | "Collected ÷ Billed × 100" | high | 90 | −4% |
| Work-in-progress | `portfolio.totalWip ?? null` | "Earned (by % complete) − billed" | medium | 70 | +3% |

WIP note: "Depends on % complete, which is partly manual." Sources use `observedAt: "2026-06-12"` (TallyPrime / Manual capture). The collection-rate sparkline trend is the inline literal `[82, 84, 76, 95, 75, 74]`.

### The tax / aging engine

**Invoice aging (`agingBuckets()` in `api.ts`)** — the receivables chart and the "90+ days" callout draw from this. [MOCK]

```
open      = invoices.filter(i => i.status !== "paid" && i.status !== "draft")
bucket(lo,hi) = Σ (open where agingDays ≥ lo and < hi) of (netReceivable − amountReceived)
buckets:  Current  = bucket(-9999, 1)     (sage)
          1–30     = bucket(1, 31)        (ochre)
          31–60    = bucket(31, 61)       (ochre)
          61–90    = bucket(61, 91)       (sienna)
          90+      = bucket(91, 9999)     (rust)
```

**Withholding model (`inv()` factory in `data.ts`)** — this is how each mock invoice's tax fields are produced (it is real arithmetic on mock inputs):

```
vat            = round(grossFee × 0.15)        // 15% NBR VAT
vdsWithheld    = round(vat × 0.6)              // VDS = 60% of the VAT figure (≈9% of gross)
aitWithheld    = round(grossFee × 0.1)         // ~10% AIT/TDS
netReceivable  = grossFee + vat − vdsWithheld − aitWithheld
amountReceived = paid → netReceivable; part_paid → round(net × 0.5); else 0
agingDays      = paid → 0; else max(0, round((TODAY − dueDate) / 86400000))
```

> The standalone `payments` array is **hand-authored** and is NOT reconciled against invoice `amountReceived`. Real reconciliation is [BACKEND].

### The Bangladesh withholding explainer

A **fully hardcoded** chip sequence (visual only, NOT computed): Gross fee `৳10.0L` → `+ VAT 15% ৳1.5L` → `− VDS −৳0.9L` → `− AIT ~10% −৳1.0L` → `= Net cash ৳9.6L`. It illustrates the model above so a reader understands why collection KPIs sit below billed. [MOCK]

### Tables & controls

- **Invoices table** — rows = `filtered` invoices; Project cell links to `/projects/{projectId}`. Status badge: overdue → `{agingDays}d overdue` (rust), paid → sage, part_paid → ochre. Header `SourceChip "TallyPrime · export 12 Jun" status="stale"` is **hardcoded**.
- **Outstanding by client** — a horizontal bar list (not a table); filters `outstanding > 0`, sorts desc; bar rust if `relationship === "at_risk"` else sienna.
- **Status filter Select** — [IMPLEMENTED] (client state). **Export button** — visual-only, no handler → [BACKEND].

> No loading/empty/error states on this page; empty arrays render silently.

---

## 5. Profitability (`/profitability`)

**What it communicates.** Margin by project and phase — explicitly **fee-based, not true margin**, because timesheet coverage is ~64% and labour cost is partial. The page is built to be honest about that gap. [MOCK]

**Target user.** Owner / director assessing which projects earn and which leak, with a clear caveat.

**Data source.** `useProjects` ([MOCK]). `TIMESHEET_COVERAGE` is a **hardcoded per-project map** (`p1:61, p2:58, p3:88, p4:60, p5:64, p6:30, p7:76, p8:25`); `AS_OF = "2026-06-17"`.

**Business decisions supported.** Which projects look unprofitable; where labour capture must improve before trusting margin; planned-vs-actual cost discipline.

### Derived figures (computed client-side)

```
active           = projects.filter(p => p.stage !== "closed")
portfolioRevenue = Σ active.feeContract
costToDate       = Σ active.costToDate
collected        = Σ active.feeCollected
blendedMargin    = ((portfolioRevenue − costToDate) / portfolioRevenue) × 100   // 0 if revenue ≤ 0
realization      = (collected / portfolioRevenue) × 100
avgCoverage      = mean(TIMESHEET_COVERAGE over active)
lowCoverage      = active with coverage < 65
```

### KPIs (Skeleton-gated)

| KPI | Value | Formula (verbatim) | Confidence | Completeness |
|---|---|---|---|---|
| Portfolio revenue (contracted) | `portfolioRevenue` | "Σ contracted fee across active projects" | high | 92 |
| Cost-to-date (partial labour) | `costToDate` | "Σ incurred cost (mostly labour) — captured where timesheets exist" | medium | 64 |
| Blended margin (fee-based) | `round(blendedMargin)` | "(Contracted fee − cost-to-date) ÷ contracted fee × 100. Fee-based proxy, not true margin." | low | 62 |
| Realization | `round(realization)` | "Collected (net of VAT/VDS/AIT) ÷ contracted fee × 100" | medium | 88 |

### Honesty mechanics

- **Honest-margin callout** computes inline "{lowCoverage} of {active} projects below 65% coverage" and renders `<InsufficientData metric="True firm-wide margin" hint="… coverage is only ~{avgCoverage}%" />`. Cross-links to `/resourcing` and `/capture`. [IMPLEMENTED]
- **Forecast-margin chart** maps `forecastMargin.value ?? 0`, flagging `insufficient` when null; caption counts insufficient projects. **Planned-vs-actual cost** chart pairs `budgetCost` (slate) and `costToDate` (blue).
- **Profitability table** — per-row forecast-margin cell shows `<ConfidenceBadge level="insufficient" />` + "Insufficient data" when the metric is null, else `pct(value)` toned rust (<10) / ochre (<20) / ink. Coverage sub-line appends "· labour partial" (sienna) when <65.

**Export button** — visual-only → [BACKEND]. Footer: "Fee-based margins as of {date}. True margin unlocks when timesheet coverage clears 80% firm-wide."

---

## 6. Resourcing & Capacity (`/resourcing`)

**What it communicates.** Utilization is only as honest as timesheet coverage. People without timesheets read as "no time logged", never as idle. Mean utilization, coverage, overload, and (deliberately blocked) spare capacity. [MOCK]

**Target user.** Principals/directors deciding whether the firm can take more work and who is at burnout risk.

**Data source.** `useEmployees` (fallback to `employeesSeed`) and `utilizationSummary()` ([MOCK]). Constants: healthy band 75–90%; `OVERLOADED_ID = "e3"` (Arif Chowdhury); `ASOF = "2026-06-17"`.

**Business decisions supported.** Whether there is real slack to take on a project; who is overloaded for six-plus weeks; how much timesheet coverage must rise before capacity answers are trustworthy.

### The calculation engine (`utilizationSummary()` in `api.ts`)

```
billable  = employees.filter(e => e.utilization.value !== null)
coverage  = mean(employees.timesheetCompliance)           // over ALL staff
meanUtil  = mean(billable.utilization.value)
overloaded = count(utilization.value > 90)
underloaded= count(value !== null && value < 70)
unknown    = count(value === null)
confidence = coverage > 80 ? "high" : coverage > 60 ? "medium" : "low"
```

### KPIs (Skeleton-gated; all completeness = `round(coverage)`)

| KPI | Value | Formula (verbatim) | Confidence |
|---|---|---|---|
| Mean billable utilization | `round(meanUtil)` | "mean(utilization) over staff who log time" | medium |
| Timesheet coverage | `round(coverage)` | "mean(timesheet weeks submitted) across all staff" | `u.confidence` (derived) |
| Overloaded (>90%) | `u.overloaded` | "count(utilization > 90%) among people who log time" | medium |
| Spare capacity | **`null` (forced)** | (no formula) | **insufficient** |

> **Spare capacity is deliberately suppressed.** Although `spareHours = Σ max(0, capacityHours − allocatedHours)` over logged staff is computed, it is NOT shown as the KPI value — the card is forced to `null` / `insufficient` with the note "Coverage only {x}% — firm-wide spare capacity isn't reliable." The figure surfaces only in the table footer as "nominal slack (partial)". This is the prototype's clearest "refuse rather than fabricate" behaviour. [IMPLEMENTED]

### Honest handling of missing time

- **Mean util excludes** unlogged staff (not counted as zero). The chart includes only logged staff; the caption states "{n} don't log time and are omitted — unknown, not idle."
- **Load split** (4 `Progress` rows, not a chart): Overloaded / Healthy (75–90%) / Slack (<75%) / No time logged (`u.unknown`). Denominator = `employees.length`.
- **Overload warning card** (Arif Chowdhury, id `e3`): renders only if the employee exists and util is non-null; states the signal "is trustworthy" because his timesheets are X% complete.
- **Coverage callout** renders `<InsufficientData metric="Firm spare capacity" … />`; the "Set up time capture" Button here is **visual-only** (the header action and footer "Improve coverage" are real Links to `/capture`).

---

## 7. Clients (`/clients`)

**What it communicates.** Every account at a glance — lifetime fees, outstanding cash, and relationship health. [MOCK]

**Target user.** Owner / director managing the book of business and receivables risk.

**Data source.** `useClients` ([MOCK]).

**Business decisions supported.** Which accounts drive revenue; which owe and are also at-risk relationships; where to intervene.

### KPIs (plain values — no `Metric` object, no confidence)

| KPI | Calculation | Status |
|---|---|---|
| Clients | `num(clients.length)` | [MOCK] |
| Lifetime fee | `bdt(Σ lifetimeFee, {compact})` | [MOCK] |
| Outstanding | `bdt(Σ outstanding, {compact})`; footnote "across N accounts" | [MOCK] |
| At-risk relationships | count `relationship === "at_risk"`; footnote "needs attention" / "all healthy" | [MOCK] |

### Charts & table

| Element | Calculation | Status |
|---|---|---|
| Revenue by client (BarSeries, currency) | `sorted` by `lifetimeFee` desc; label truncated >16 chars | [MOCK] |
| Relationship health (Donut) | Counts over strong/neutral/at_risk, filtered >0 | [MOCK] |
| Outstanding by client (BarSeries, currency) | Clients with `outstanding > 0`; empty: "No outstanding balances…" | [MOCK] |
| All clients table | Sorted by `lifetimeFee` desc; Client cell links `/clients/{id}`; Outstanding red+bold when `outstanding > 0 && relationship === "at_risk"` | [MOCK] / [IMPLEMENTED] links + search |

Search filters name/city/type ([IMPLEMENTED], client state). Loading: Skeletons for KPIs, charts, and 5 table rows. Empty: "No clients match".

---

## 8. Document Control (`/deliverables`)

**What it communicates.** The drawing register matched across projects. CAD apps (AutoCAD, SketchUp, D5) expose no data API — these are **file-presence signals harvested from Google Drive**, not read from the CAD tools. [MOCK] / [INTEGRATION] for live file watching.

**Target user.** PMs and document controllers tracking issue status and revision churn.

**Data source.** `useDeliverables`, `useProjects` ([MOCK]).

**Business decisions supported.** What is issued vs. in rework; which drawings churn (rework risk); which sheets have no file detected on Drive.

### KPIs

| KPI | Calculation | Confidence | Notes |
|---|---|---|---|
| Total deliverables | `num(rows.length)` | high | completeness = `round(with-fileRef ÷ total × 100)`; note "File-presence signals harvested from Google Drive." |
| Issued / approved | `round(closed ÷ total × 100)` pct, where `closed = issued \|\| approved` | high | good-when-up |
| In revision | `num(count(status === "revise"))` | — | footnote "{missingFiles} awaiting a file" |
| Drawing revision rate | `(Σ revisionCount ÷ total).toFixed(2)×` | medium | good-when-up = false; "High values signal churn." |

### Charts, register & watchlist

- **By status (Donut)**, **By discipline (BarSeries)**, **Revision load (stacked BarSeries)** — top 12 by `revisionCount`, "High churn (>3)" highlighted. [MOCK]
- **Register table** — Project cell links `/projects/{id}`; `Rev > 3` shows a high-churn tooltip; Source `SourceChip` is "connected" when `fileRef` exists else "manual". Filters: search + discipline + status + project ([IMPLEMENTED]). Footer: "{missingFiles} drawing(s) with no file detected on Drive".
- **High-churn watchlist** (`revisionCount ≥ 3` desc) — "Open review" button is **visual-only** → [BACKEND].

---

## 9. Data Quality & Integration Health (`/data-quality`)

**What it communicates.** The trust backbone — freshness, matching, and completeness — so no KPI is shown as confident when its data isn't. [MOCK]

**Target user.** Owner / admin responsible for data trustworthiness; anyone questioning a number's provenance.

**Data source.** `useDataSources` (default `dataSources` mock), `useProjects`. (`usePortfolio` is fetched but **unused**.) [MOCK]

**Business decisions supported.** Which sources are stale and which KPIs to therefore distrust; how many source aliases still need matching; which data domain is the weak link.

### KPIs (real `Metric` objects with formulas)

| KPI | Calculation | Formula (verbatim) | Confidence rule |
|---|---|---|---|
| Firm data completeness | `mean(project.completeness)` | "mean(project.completeness) across the active portfolio" | high ≥75 / medium ≥60 / else low; trend `[62,64,66,67,68,…]` |
| Live sources | count(status ∈ connected, syncing) | "count(status ∈ {connected, syncing})" | high |
| Stale / error sources | count(status ∈ stale, error) | "count(status ∈ {stale, error})" | high if 0 else medium; note "TallyPrime export is 5 days old…" |
| Unmatched aliases | count(crossRefs where matched = false) | "count(crossRefs where matched = false)" | high if 0 else low |

### Freshness & matching

- **Source freshness table** — active sources (status ≠ not_connected). Freshness `{fh}h` colored rust if stale (`STALE_HOURS = 48`), ochre if >12, else neutral; Health `Progress` (sage >80 / ochre >55 / rust). [MOCK]
- **Completeness by domain** — a **static `DOMAINS` array (NOT data-derived)**: Money 85% (high), Delivery 70% (medium), People 40% (low, flagged weak), Approvals 65% (medium), plus a rust callout "People & timesheets is the weak domain" (40% hardcoded). [MOCK]
- **Project matching queue** — `unmatched` = all `crossRefs` where `!matched`; each row's "Confirm match" button is **visual-only** → [BACKEND]. Empty: "Every alias is matched".
- **Known data-health limits** — two static cards: WhatsApp "No backfill API" [INTEGRATION], TallyPrime "Export is 5 days stale" [INTEGRATION].

---

## 10. Goals & Targets (`/goals`)

**What it communicates.** Firm and project targets tracked against actuals — the director's scorecard for growth, cash, and delivery. [MOCK]

**Target user.** Owner / director tracking the annual plan.

**Data source.** `useTargets` ([MOCK]); `TODAY = "2026-06-17"`. Split into firm-scope vs. project-scope targets.

**Business decisions supported.** What is on track vs. behind; overall attainment; which project targets are slipping (each links to its project).

### The attainment engine (per target `t`)

```
isLowerBetter(t) = t.unit === "days"
attainment(t):
  lower-is-better → 100 if actual ≤ target, else max(0, min(100, 100 − over×10))
  else if target === 0 → 100 if actual ≤ 0 else 0
  else → min(100, (actual / target) × 100)   // clamped
gap = actual − target   // shown in the metric's own unit; gapGoodWhenUp = !lowerBetter
```

`formatValue` switches by unit (`bdt` compact / `pct` / `Nd` / `N×` ratio / `num`). The `GoalRow` reuses the **attainment %** as the `DataCompleteness` value (note: it is not a separate completeness field).

### KPIs

| KPI | Calculation | Confidence | Completeness |
|---|---|---|---|
| On track | count(status ahead \| on_track) | high | 100 |
| Behind / at risk | count(status behind \| at_risk) | high | 100 (good = false) |
| Overall attainment | `round(mean(attainment over all targets))` | medium | 100 |
| Tracked goals | `targets.length` (plain value, **no `Metric`**) | n/a | footnote "{firm} firm · {project} project" |

> KPI metrics here carry empty `sources: []`. The "Tracked goals" card has no Metric/confidence object at all.

### Sections, chart, states

- **Firm goals** and **Project goals** sections render `GoalRow`s; each empty case shows a tailored `EmptyState`. Project-scope rows link to `/projects/{id}`.
- **Attainment vs. target (grouped BarSeries)** — Target series = attainment of a synthetic `{…t, actual: t.target}` (always 100 baseline); Actual = `attainment(t)`. [MOCK]
- **Loading:** full-page Skeleton (4 KPI + 5 row skeletons) with a different header description. No error/insufficient state on this page. No filters or sort controls.

---

## Cross-Dashboard Notes

**What is genuinely computed vs. hardcoded.** Only values flowing through `computePortfolio`, `agingBuckets`, `pipelineByStage`, `utilizationSummary`, the `inv()` tax factory, the Goals `attainment()` function, and per-page inline derivations (e.g. Profitability's `blendedMargin`, Delivery's counts, Data Quality's `mean(completeness)`) are calculated. **Hardcoded literals** include: the Executive portfolio-margin `18`, every `moneyTrend`/`TIMESHEET_COVERAGE`/threshold/trend array, the Bangladesh tax-explainer chips, the Data Quality `DOMAINS` array, the sidebar "68%" data-health bar, and most `Metric` envelope fields (sources, `asOf`, `deltaPct`).

**The "honesty" pattern is the product's signature.** Across Executive (low-confidence margin), Profitability (`InsufficientData` callout + insufficient per-row badges), Resourcing (forced-null spare capacity), Data Quality (weak-domain flag), and the AI assistant's refusals, the system consistently **shows nothing or a refusal rather than a fabricated number** when coverage is low. This is implemented client-side via `Metric.value = null`, `confidence = "insufficient"`, the `InsufficientData` component, and the `KpiCard` "— —" branch. [IMPLEMENTED]

**What every dashboard would need to become real:**

| Need | Affected dashboards | Status |
|---|---|---|
| Accounting connector (invoices, payments, expenses) | Financials, Executive, Profitability, Clients, Data Quality | [INTEGRATION] TallyPrime/QuickBooks/Xero |
| Timesheet/time-tracking feed | Resourcing, Profitability (true margin) | [INTEGRATION] Clockify + Manual Capture coverage |
| Authority-portal status (no APIs exist) | Delivery, Executive approvals | [INTEGRATION]/manual — RAJUK ECPS is manual entry |
| File/document watch | Document Control, Data Quality freshness | [INTEGRATION] Google Drive / SharePoint |
| Persistence + write API | All "Save"/"Confirm"/"Connect"/"Generate brief"/"Export" actions | [BACKEND] |
| Real AI inference | AI briefings, anomaly detection, "Generate brief" | [BACKEND] — answers are currently a fixed canned map |

**No error/failure UI exists** on any dashboard. Loading Skeletons are present on Executive, Delivery, Profitability (KPI row), Resourcing (KPI row), Clients, Document Control, and Goals (full page); Financials, Portfolio, Pipeline, and Data Quality render without Skeletons and rely on empty defaults.
