# KPI Dictionary

> **What this is.** The authoritative definition of every metric PracticeLens computes — the single source of truth that the dashboards (`05`), the AI reporting layer (`06`) and the semantic layer all reference. PracticeLens is an AI-powered analytics **layer** over a Dhaka architecture firm's mostly-informal tools, not an ERP. Every KPI here is computed by a **deterministic, versioned semantic-layer function** (never by the LLM — see `06`), and every value it returns carries provenance (`DataSource` / `IntegrationRecord` IDs, observed-at date, calculation version) and a confidence band.
>
> **Canonical names only.** Entities, KPI names and role names follow the shared canon. Currency is **BDT** with multi-currency support (FX captured at invoice and at settlement). Where a foreign-client figure is involved, USD is shown with the FX rate and date.

---

## The honesty mandate — read before any formula

A small Dhaka firm has **no timesheets, no fee baseline, verbal approvals, and WhatsApp scope changes**. That is not an edge case; it is the default state at pilot go-live. So the governing rule of this dictionary is:

> **Every KPI degrades gracefully and never lets "no data" masquerade as "good data."**

Three mechanisms enforce this on **every** KPI:

1. **Each KPI declares its `inputCompleteness`** — the fraction of records it *needed* that actually exist, for the period/project in scope. A `Forecast Project Margin` computed with zero `Timesheet` rows has `inputCompleteness ≈ 0.2` (fee side present, cost side absent) and is rendered with a hard "labour cost not captured" caveat — never as a clean number.
2. **Each KPI emits a confidence band** — `High / Medium / Low / Insufficient-Data` — derived from `inputCompleteness`, source freshness, and (for predictive KPIs) variance of the estimate. Below a per-KPI floor the function **refuses to return a value** and returns a `capture-this` payload instead (which form to fill, which connector to attach).
3. **The 26th KPI, `Data Completeness Score`, is omnipresent** — surfaced in every dashboard header and rolled into the `Project Health Score`. It is the meta-metric that makes the other 25 trustworthy. A firm that sees "Margin: insufficient data (completeness 18%)" is being told the truth; a firm shown "Margin: 31%" off no cost data is being lied to.

**Direct vs predictive.** Most KPIs are **direct** (a deterministic calculation over present records — wrong only if inputs are wrong/missing). A small set are **predictive** (`Estimate at Completion`, `Forecast Project Margin`, `Forecast Cash Collection`, `Approval Delay Forecast`, and the forward portion of `Schedule Variance`) — these project beyond present data and therefore carry an explicit method, assumptions, and a confidence interval, never a bare point estimate.

---

## Master table — all 26 canonical KPIs + 5 additions

Frequency legend: **RT** = recomputed on ingest, **D** = daily batch, **W** = weekly, **M** = monthly, **OD** = on-demand. Type: **Direct** = deterministic over present data; **Predictive** = projects beyond present data.

| # | KPI | One-line meaning | Core formula (concise) | Key entities / fields | Source systems | Freq | Type |
|---|---|---|---|---|---|---|---|
| 1 | **Project Health Score** | Single 0–100 RAG composite of a project's wellbeing | Weighted blend of 5 sub-scores (see §Composite) | `Project`, all below | All | D | Direct (of inputs) |
| 2 | **Schedule Variance** | Days ahead/behind baseline | Σ(actual/forecast milestone date − baseline date), weighted | `Milestone`, `ProjectPhase`, `Approval` | Manual-capture, task tools | D | Direct + forward part Predictive |
| 3 | **Milestone Completion Rate** | % of due milestones actually done | completed milestones ÷ milestones due-to-date | `Milestone`, `Approval` | Manual-capture | D | Direct |
| 4 | **Task Overdue Rate** | % of open tasks past due | overdue tasks ÷ all open tasks | `Task` | Trello/Asana/ClickUp/monday, manual | D | Direct |
| 5 | **Deliverable Completion Rate** | % of planned deliverables issued | issued deliverables ÷ planned deliverables | `Deliverable`, `Drawing`, `Revision` | File-store, manual-capture | D | Direct |
| 6 | **Drawing Revision Rate** | Rework intensity per drawing | total revisions ÷ distinct drawings (per phase) | `Drawing`, `Revision` | File-store (filename/version), manual | W | Direct |
| 7 | **Consultant Response Time** | How fast consultants reply | median(response date − request date) | `Consultant`, `RFI`, `Meeting`, `Decision` | Email/WhatsApp capture, manual | M | Direct |
| 8 | **Client Approval Time** | How long clients take to decide | median(decision date − request date) | `Client`, `Decision`, `Approval` | Manual-capture (WhatsApp/meeting log) | W | Direct |
| 9 | **Fee Burn Rate** | Cost consumed vs fee | cost incurred ÷ Contract `Fee` | `Fee`, `Expense`, `Timesheet`, `Budget` | Accounting, Timesheet | D | Direct |
| 10 | **Planned vs Actual Hours** | Effort vs plan | actual hours − planned hours (and ratio) | `Timesheet`, `ResourceAssignment`, `Budget` | Timesheet | W | Direct |
| 11 | **Estimate at Completion (EAC)** | Forecast total cost at finish | actual cost + (remaining work ÷ performance factor) | `Timesheet`, `Expense`, `Budget`, `ProjectPhase` | Timesheet, accounting | D | **Predictive** |
| 12 | **Forecast Project Margin** | Projected profit % at finish | (Contract `Fee` − EAC) ÷ Contract `Fee` | `Fee`, EAC inputs | Accounting, Timesheet | D | **Predictive** |
| 13 | **Utilization Rate** | Share of available time on any project work | project hours ÷ available hours | `Timesheet`, `Employee` | Timesheet | W | Direct |
| 14 | **Billable Utilization** | Share of time on billable work | billable hours ÷ available hours | `Timesheet`, `Service`, `Fee` | Timesheet | W | Direct |
| 15 | **Work in Progress (WIP)** | Earned-but-uninvoiced fee value | earned fee − invoiced fee | `Fee`, `ProjectPhase`, `Invoice` | Accounting, manual-capture | D | Direct |
| 16 | **Unbilled Revenue** | Delivered value not yet billed | Σ WIP across active projects | `Fee`, `Invoice`, `ProjectPhase` | Accounting, manual-capture | D | Direct |
| 17 | **Invoice Aging** | Receivables by overdue bucket | bucket(today − due date) on unpaid `Invoice` | `Invoice`, `Payment`, `Client` | Accounting (Tally/QBO/Xero), register | D | Direct |
| 18 | **Collection Rate** | Cash collected vs invoiced | payments received ÷ invoiced (period) | `Invoice`, `Payment` | Accounting | D | Direct |
| 19 | **Pipeline Value** | Raw value of open opportunities | Σ estimated `Fee` of open `Opportunity` | `Opportunity`, `Proposal` | Manual-capture, CRM (later) | W | Direct |
| 20 | **Weighted Pipeline** | Probability-adjusted pipeline | Σ(opportunity value × win probability) | `Opportunity`, `Proposal` | Manual-capture | W | Direct (prob. assumption) |
| 21 | **Proposal Win Rate** | % of proposals won | won `Proposal` ÷ decided `Proposal` | `Proposal`, `Opportunity`, `Contract` | Manual-capture | M | Direct |
| 22 | **Resource Capacity** | Free vs committed hours ahead | available hours − assigned hours (forward) | `Employee`, `ResourceAssignment` | Manual-capture, Timesheet | W | Direct + forward Predictive |
| 23 | **RFI Aging** | Open RFIs by age | bucket(today − raised date) on open `RFI` | `RFI` | Procore/Newforma (later), manual | W | Direct |
| 24 | **Submittal Aging** | Open submittals by age | bucket(today − submitted date) on open `Submittal` | `Submittal` | Procore/Newforma (later), manual | W | Direct |
| 25 | **Change Exposure** | Estimated unbilled scope-change value | Σ BDT of `Change` flagged billable-not-yet-billed | `Change`, `Contract`, `Decision` | Manual-capture, WhatsApp/email | RT/W | Direct (estimate) |
| 26 | **Data Completeness Score** | How much of the needed data actually exists | weighted coverage of required records present | All entities, `DataSource` | All connectors | D | Direct (meta) |
| +27 | **Forecast Cash Collection** | Expected BDT cash next 30/60/90 days | Σ(invoice net of AIT × collection-probability by age) | `Invoice`, `Payment`, `Client` | Accounting | D | **Predictive** |
| +28 | **Net Cash Realisation Rate** | Cash kept after VAT/VDS/AIT withholding | net cash received ÷ gross fee invoiced | `Invoice`, `Payment`, `Fee` | Accounting, manual | M | Direct |
| +29 | **Approval Delay Forecast** | Predicted authority-approval finish date | submission date + modelled cycle time + query rounds | `Approval`, `Milestone` | Manual-capture (ECPS/liaison) | W | **Predictive** |
| +30 | **Realization Rate** | Billed value vs cost of effort | billed fee ÷ (actual hours × cost rate) | `Invoice`, `Timesheet`, `Fee` | Accounting, Timesheet | M | Direct |
| +31 | **Backlog Months** | Months of signed work remaining | remaining signed `Fee` ÷ trailing-3-mo cost burn | `Contract`, `Fee`, `Expense`, `Timesheet` | Accounting, Timesheet | W | Direct + Predictive denominator |

**Why these five additions.** `Forecast Cash Collection` is the owner's #1 priority-1 question ("how much money is actually arriving, and when") and must net out AIT/TDS so the forecast is *cash*, not invoice face value. `Net Cash Realisation Rate` makes the Bangladesh withholding reality (15% VAT, VDS, ~10% AIT) a first-class number rather than a footnote. `Approval Delay Forecast` operationalises the owner's top *delivery* concern — RAJUK/FSCD/CAAB cycle time, which today lives only in the liaison's head. `Realization Rate` is the standard A&E "are we charging enough for the effort" metric and the bridge between MONEY and PEOPLE. `Backlog Months` answers "how long until we run out of work," which the principal currently estimates by gut.

---

## The composite — Project Health Score (explicit)

`Project Health Score` is a 0–100 weighted blend of five normalised sub-scores. It is the headline tile and the one number most likely to be over-trusted, so its construction is deliberately conservative.

```
ProjectHealthScore =
      0.25 * ScheduleSub
    + 0.30 * BudgetSub
    + 0.20 * DeliverableSub
    + 0.15 * ApprovalSub
    + 0.10 * DataCompletenessSub      (all sub-scores 0–100)
```

| Sub-score | Weight | Built from | 0–100 mapping (higher = healthier) |
|---|---|---|---|
| **ScheduleSub** | 0.25 | `Schedule Variance` (days) vs phase duration | 100 at on/ahead; linear down; 0 at variance ≥ 25% of remaining phase duration |
| **BudgetSub** | 0.30 | `Forecast Project Margin` vs target margin band | 100 at ≥ target (e.g. 20%); 50 at break-even; 0 at projected loss |
| **DeliverableSub** | 0.20 | `Deliverable Completion Rate` vs phase plan + `Drawing Revision Rate` penalty | 100 at on-plan, low rework; penalised for excess revisions |
| **ApprovalSub** | 0.15 | `Milestone Completion Rate` of authority `Approval`s + `Approval Delay Forecast` | 100 if approvals on/ahead of schedule; 0 if a gating approval (RAJUK CP/LUC, CAAB) is overdue and blocking |
| **DataCompletenessSub** | 0.10 | `Data Completeness Score` for this project | direct pass-through of completeness % |

**Three non-negotiable rules on the composite:**

1. **MONEY is weighted highest (0.30)** — consistent with the owner's priority-1 (profitability), and because the budget sub-score is the one most often hidden in a no-timesheet firm.
2. **The score is *capped by its own completeness*.** If `DataCompletenessSub < 40`, the composite is rendered as a **range, not a point** (e.g. "55–78, low confidence"), and the badge is forced to `Low`/`Insufficient-Data`. A pretty 82 built on no cost and no timesheet data is exactly the lie this system exists to prevent.
3. **Gating override.** Any *overdue, blocking* authority approval (RAJUK LUC/CP, CAAB where required, FSCD design NOC where required) **hard-caps the total at 49 (red)** regardless of the weighted sum — in Dhaka a stalled RAJUK permit means the project is not healthy, full stop, however good the other metrics look.

Weights are stored in config (per-tenant tunable), versioned, and shown in the "Why this number?" panel so the score is never a black box.

---

## Data Completeness Score (the meta-KPI) — explicit

```
DataCompletenessScore (per scope: project | domain | firm) =
    Σ ( weightᵢ * coverageᵢ )  over required record-classes i,  normalised to 0–100

coverageᵢ = present_required_records / expected_required_records   (clamped 0–1)
```

Each KPI registers which record-classes it depends on and their weights; the score is the weighted coverage of those classes for the scope in view. Example domain weights for **profitability** (the highest-stakes domain):

| Record class | Weight | Why |
|---|---|---|
| `Timesheet` hours for the period | 0.40 | No labour cost ⇒ no real margin — the dominant gap |
| `Fee` / `Contract` value with phase split | 0.20 | Revenue side; usually exists but fee *basis* may not |
| `Expense` (reimbursables, authority fees) | 0.15 | Off-book "facilitation" costs distort margin |
| `Invoice` + `Payment` with VAT/AIT lines | 0.15 | Cash realisation needs the withholding breakdown |
| `Budget` baseline (planned hours/cost) | 0.10 | Without baseline there is no variance to measure |

The score is **never** "100% = good firm" — it is "100% = we have what we need to tell you the truth." It is displayed everywhere, drives the confidence bands, and links directly to the relevant manual-capture form or connector so improving it is one click.

---

## Expanded entries — the 8 most important KPIs

These eight carry the owner's priority order (MONEY → DELIVERY → PEOPLE) and the Dhaka-specific realities (withholding, RAJUK approvals, no timesheets).

### 1. Project Health Score — *the headline composite*

- **Business meaning.** Replaces "the principal's gut" with one defensible 0–100 RAG number per project, blending money, schedule, deliverables, approvals and data trust. The triage primitive for the portfolio dashboard.
- **Formula / fields.** See §Composite. Entities: `Project`, `ProjectPhase`, `Milestone`, `Approval`, `Deliverable`, `Fee`, `Timesheet`, `Expense`, `Data Completeness Score`.
- **Source systems.** Aggregate of all connectors + manual-capture.
- **Frequency.** Daily; RT bump on a captured `Approval`/`Change`/`Decision`.
- **Type.** Direct composite of (mostly direct, one predictive) sub-scores.
- **Confidence & degradation.** Capped to a range when `DataCompletenessSub < 40`; hard-capped at 49 by any blocking overdue authority approval. Never shown without its completeness badge.

### 2. Forecast Project Margin — *priority-1 MONEY, predictive*

- **Business meaning.** "Will this project make or lose money by the end?" — the question a small firm structurally cannot answer today because labour cost is uncaptured.
- **Formula.** `Forecast Project Margin = (Contract Fee − EAC) ÷ Contract Fee`, where `Contract Fee` is gross of VAT and net of expected unbilled `Change Exposure` adjustments if billable.
- **Required fields/entities.** `Fee` (contract value, phase split), all EAC inputs (`Timesheet`, `Expense`, `Budget`, `ProjectPhase` % complete).
- **Source systems.** Accounting connector (Tally/QBO/Xero/register) for fee & expense; Timesheet for cost.
- **Frequency.** Daily.
- **Type. Predictive** (inherits EAC's forecast).
- **Method & confidence caveats.** Confidence band is a function of (a) EAC confidence and (b) fee-base certainty. **Hard rule:** with **zero `Timesheet` data the cost side is unknown**, so the function returns `Insufficient-Data` and a captured-cost-required message — it does **not** substitute headcount × calendar-days as if it were fact. When partial timesheets exist, output is a **margin interval** (e.g. "8%–22%, medium") with the cost-coverage % stated. Negative-margin projections trigger the fee-overrun AI alert (`06` capability 6).

### 3. Estimate at Completion (EAC) — *predictive engine behind margin*

- **Business meaning.** Projected total *cost* to finish the project — the input that turns a fee into a margin.
- **Formula.** `EAC = ActualCost + (RemainingWork ÷ PerformanceFactor)`, where `RemainingWork = BudgetedCost × (1 − %complete)` and `PerformanceFactor = earned value ÷ actual cost` (CPI). Where no `Budget` baseline exists, remaining work is estimated from phase-level effort norms (IAB phase-weighting defaults) flagged explicitly as a **proxy**.
- **Required fields/entities.** `Timesheet` (actual hours × cost rate), `Expense`, `Budget` (planned), `ProjectPhase` (% complete from manual-capture).
- **Source systems.** Timesheet, accounting; manual-capture for % complete.
- **Frequency.** Daily.
- **Type. Predictive.**
- **Method & confidence caveats.** Three methods, auto-selected by data availability: **(M1)** full CPI-based EAC when timesheets + baseline exist (`High`); **(M2)** straight-line burn extrapolation when timesheets exist but no baseline (`Medium`); **(M3)** phase-norm proxy when neither exists (`Low`, labelled "estimate from typical phase effort, not your data"). The method used is always disclosed. Performance factor is floored/capped (e.g. 0.5–1.5) to prevent early-phase noise from producing absurd projections.

### 4. Collection Rate & Invoice Aging — *priority-1 MONEY, cash reality*

- **Business meaning.** Of what we invoiced, how much cash actually arrived, and how old is what hasn't — the strongest small-firm pain (cash, not accrual).
- **Formula.** `Collection Rate = payments received (period) ÷ invoiced (period)`. `Invoice Aging` = buckets {current, 1–30, 31–60, 61–90, 90+} of unpaid `Invoice` balances by `(today − due date)`.
- **Required fields/entities.** `Invoice` (face, due date, VAT line, AIT/VDS withheld line), `Payment` (date, amount, FX if USD), `Client`.
- **Source systems.** Accounting connector or manual finance-register import (the common Dhaka case).
- **Frequency.** Daily.
- **Type.** Direct.
- **Confidence & Dhaka specifics.** Must model that **the client withholds ~10% AIT and may deduct 15% VAT at source (VDS)** — so "collected" is compared against the **net-of-AIT expected cash**, not the gross invoice, otherwise Collection Rate looks permanently broken. Withheld AIT is tracked as a recoverable tax asset, not a bad debt. FX-settled USD invoices reconcile at settlement rate.

### 5. Schedule Variance — *priority-2 DELIVERY*

- **Business meaning.** Are we ahead or behind plan, in days, with authority approvals as the dominant driver in Dhaka.
- **Formula.** Weighted Σ over tracked `Milestone`/`Approval`: `(actual or forecast date − baseline date)`; reported as net days and worst-single-slip. Authority milestones carry higher weight.
- **Required fields/entities.** `Milestone`, `Approval` (RAJUK LUC/CP, FSCD, DoE, CAAB, utilities), `ProjectPhase` baseline dates.
- **Source systems.** Manual-capture (primary), task tools where connected.
- **Frequency.** Daily.
- **Type.** Direct for completed milestones; **Predictive** for the forecast date of open authority approvals (via `Approval Delay Forecast`).
- **Confidence & degradation.** Requires a baseline to mean anything — if no baseline dates were captured at project setup, the KPI returns `Insufficient-Data` and prompts baseline capture rather than inventing a plan. A slipped *gating* approval is flagged as schedule-critical (blocks downstream phases).

### 6. Approval Delay Forecast (+addition) — *Dhaka's signature delivery metric, predictive*

- **Business meaning.** Predicts when a RAJUK/FSCD/CAAB/DoE approval will actually clear — the owner's top schedule anxiety, today opaque ("stuck somewhere at RAJUK").
- **Formula.** `Forecast finish = submission date + base cycle time(authority, project type) + (expected query rounds × round latency)`. Base cycle times seeded from research defaults (RAJUK statutory 30 days/stage but realistically weeks–months; design-committee ~45 days) and **re-fit per firm** as real ECPS/liaison capture accumulates.
- **Required fields/entities.** `Approval` (type, submission date, query/resubmission events), `Milestone`.
- **Source systems.** Manual-capture from the liaison/ECPS status; later any official portal signal.
- **Frequency.** Weekly + RT on a captured status change.
- **Type. Predictive.**
- **Method & confidence caveats.** Until the firm has its own history, this is a **prior-based estimate** (seeded defaults) explicitly labelled "industry typical, not your firm's history" at `Low` confidence. Confidence rises to `Medium`/`High` only after enough captured approval cycles to fit firm-specific distributions. Always shown as a date *range*, never a single deadline, because external authority timelines are genuinely uncertain.

### 7. Utilization Rate / Billable Utilization — *priority-3 PEOPLE, the bootstrap problem*

- **Business meaning.** What share of staff time is spent on (billable) project work — the standard capacity/profit-of-people metric. Industry benchmark ~75–90% (median ~82%).
- **Formula.** `Utilization = project hours ÷ available hours`; `Billable Utilization = billable hours ÷ available hours`. Available hours = working days × standard hours − approved leave.
- **Required fields/entities.** `Timesheet` (hours, project, billable flag), `Employee` (capacity, cost rate), `Service` (billable mapping).
- **Source systems.** Timesheet — **which does not yet exist** at most pilot firms.
- **Frequency.** Weekly.
- **Type.** Direct.
- **Confidence & degradation.** This KPI is **gated on timesheet existence**, so the platform's job is first to *create* the data: until adoption, Utilization is shown as `Insufficient-Data` with an `ResourceAssignment`-count proxy clearly labelled "assignment-based estimate, not measured hours." We deliberately do not fabricate a utilization % from attendance, because attendance ≠ project time. Reaching `Medium` confidence requires a configurable minimum timesheet-coverage threshold (e.g. ≥70% of staff-weeks logged).

### 8. Change Exposure — *the silent margin leak, cross-cutting*

- **Business meaning.** Estimated BDT value of scope changes that are billable but not yet billed (or not yet agreed) — research flags uncaptured changes as the single largest small-firm margin leak, living in WhatsApp.
- **Formula.** `Change Exposure = Σ estimated BDT value of Change records where (in-scope-baseline = false AND billed = false)`. Estimated value from fee-per-unit or effort estimate on the `Change`.
- **Required fields/entities.** `Change` (description, estimated value, billable flag, source record), `Contract` (scope baseline), `Decision`, source `IntegrationRecord` (the WhatsApp/email quote).
- **Source systems.** Manual-capture + AI scope-creep detector over captured WhatsApp/email (`06` capability 9).
- **Frequency.** RT on a captured change; weekly sweep.
- **Type.** Direct (over an inherently estimated value).
- **Confidence & caveats.** Depends entirely on a captured **scope baseline** in the `Contract`; with no baseline, change-vs-scope cannot be judged and the KPI returns `Insufficient-Data` + a prompt to capture the baseline. AI-detected (unconfirmed) changes are shown at `Low` confidence with the source quote and require human confirmation before they harden into a billable figure — anti-hallucination is mandatory here because the number directly implies "go invoice the client."

---

## Cross-cutting calculation rules

- **Currency.** All money KPIs compute in BDT; foreign-client `Fee`/`Invoice`/`Payment` store original currency + FX rate at invoice and at settlement, and `Net Cash Realisation Rate` / `Forecast Cash Collection` reconcile on the settlement rate.
- **Withholding model.** Every fee flows `gross fee → +15% VAT → −VDS (if withholding entity) → −~10% AIT → net cash`. KPIs that say "cash" use the net line; KPIs that say "revenue/fee" use gross. The two are never conflated.
- **Provenance.** Every KPI value returned by the semantic layer carries `{sourceRecordIds[], dataSourceIds[], observedAt, calcVersion, inputCompleteness, confidence}`. The dashboards' "Why this number?" panel renders these verbatim.
- **Refusal over fabrication.** Below its confidence floor, a KPI returns a structured `Insufficient-Data` payload (gap description + capture CTA), never an estimated value styled as fact. This is enforced in the function layer, not in the UI.
- **Versioning.** Formulas, weights and benchmark thresholds are config-versioned per tenant; changing a weight does not silently rewrite history — prior values retain the `calcVersion` they were computed under.
