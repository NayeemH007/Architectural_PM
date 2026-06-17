# Module Documentation: Finance, Clients, Growth & People

> **Scope.** This file documents six modules of the SPACE ESSE · Practice Intelligence system: **Financials**, **Profitability**, **Clients** (+ Client Detail), **Pipeline**, **Goals & Targets**, and **Resourcing**. Each is described with the same 25-point structure.
>
> **Ground truth.** SPACE ESSE is a **frontend-only, high-fidelity interactive prototype** (Vite + React + TypeScript + Tailwind v4, React Router, TanStack Query, Recharts, Radix UI). Every figure on these six pages is computed **client-side** from **mock data** (`src/lib/mock/{data,ops,insights}.ts`) served through `src/lib/api.ts → resolve()`, which deep-clones the data and resolves after a simulated ~280 ms latency. There is **no backend, no database, no authentication, no persistence, and no third-party/AI inference**. Read hooks only — there are **no mutation hooks** anywhere in `api.ts`. Nothing typed, toggled, filtered, or "saved" on these pages survives a page refresh.

## Status legend

| Tag | Meaning |
|---|---|
| **[IMPLEMENTED]** | Interactive and working in the frontend (client-side state only). |
| **[MOCK]** | Renders from mock data; the underlying read/calc is simulated, not live. |
| **[BACKEND]** | Designed in the UI; needs an API / database / persistence to function. |
| **[INTEGRATION]** | Needs a third-party connector (accounting, Drive, email, time-tracking) to function. |
| **[PLANNED] / [RECOMMENDED]** | Not built; a future enhancement. |

**Anchor date for all modules:** "today" is hard-coded as **2026-06-17** (`mock/data.ts` `TODAY`; `format.ts` `daysFromNow()`). Currency glyph is the Taka **৳** throughout.

---

## Three cross-cutting themes to read first

These three ideas recur across the six modules and are the reason the product feels honest rather than dashboard-glossy. They are summarised once here and referenced by each module.

### A. The Bangladesh net-cash tax chain (Financials, Profitability, Project Financials)

In Bangladesh, corporate and government clients deduct tax **at source** before paying an architect. SPACE ESSE models this so that "collected" reflects **real cash**, not invoice face value. The invoice factory (`inv()` in `mock/data.ts`) computes, from a single `grossFee`:

| Step | Formula (verbatim from `inv()`) | Meaning |
|---|---|---|
| VAT | `vat = round(grossFee × 0.15)` | 15% NBR VAT added on top of the fee. |
| VDS withheld | `vdsWithheld = round(vat × 0.6)` | VAT Deducted at Source = **60% of the VAT figure** (≈ 9% of gross), withheld by the client. |
| AIT/TDS withheld | `aitWithheld = round(grossFee × 0.1)` | ≈10% Advance Income Tax / Tax Deducted at Source. |
| **Net receivable** | `netReceivable = grossFee + vat − vdsWithheld − aitWithheld` | What actually lands in the bank if paid in full. |
| Amount received | `paid → netReceivable`; `part_paid → round(netReceivable × 0.5)`; else `0` | Cash recognised so far. |

> **Worked example used in the UI (Financials tax explainer, hardcoded):** Gross fee ৳10.0L → +VAT ৳1.5L → −VDS ৳0.9L → −AIT ৳1.0L → **= Net cash ৳9.6L**. This chip strip is a **[MOCK]** illustration, not computed from any specific invoice.

This chain is why **"billed" never equals "cash"**, and every collection KPI on these pages is described as "net of VAT/VDS/AIT".

### B. Timesheet-coverage gating (Resourcing & Profitability)

The firm logs time for only some staff. Wherever a number depends on labour cost or capacity, the product **gates the confidence on timesheet coverage** and refuses to fabricate a figure when coverage is too thin:

- Three of ten employees (`e1` Tahmid Karim, `e8` Maya Das, `e10` Shahed Alam) have `utilization.value: null` / `confidence: "insufficient"`. They render as **"No time logged"** — never as idle or zero.
- Two projects (`p6` Rafiq Duplex, `p8` GreenRoot) have `forecastMargin.value: null` / `confidence: "insufficient"`.
- Profitability hard-codes a per-project `TIMESHEET_COVERAGE` map; Resourcing computes `utilizationSummary()` whose confidence is `coverage > 80 → high`, `> 60 → medium`, else `low`.

### C. Win-rate / pipeline honesty caveats (Pipeline)

The pipeline is described in-product as "part CRM, part the owner's memory." Win rate is computed only over **closed** deals on record (`won / (won + lost)`), and because lost bids are rarely logged, the page surfaces a low-confidence caveat by name. Pipeline is treated as a working view, not a forecast.

---

# Module 1 — Financials (`/financials`)

| # | Aspect | Detail |
|---|---|---|
| 1 | **Route / component** | `/financials` (inferred) → `Financials.tsx`. |
| 2 | **Status** | **[MOCK]** read layer; two interactive controls; one hardcoded explainer; export is **[BACKEND]**. |
| 3 | **Purpose** | Show **cash, not invoice face value**. Header: *"Fees, billing & collections — Cash, not invoice face value. Every figure is net of 15% VAT, VDS and ~10% AIT withholding."* |
| 4 | **Primary audience** | Owner/Principal, Finance/Admin, partners reviewing collections. |
| 5 | **Data sources (hooks)** | `usePortfolio()`, `useInvoices()`, `useClients()` — all **[MOCK]** via `resolve()`. `moneyTrend` (6 rows, Jan–Jun) is a **hardcoded in-file constant** **[MOCK]**, not from the API. |

### 6. KPI cards (4 × `KpiCard`) — [MOCK]

Each KPI is a hardcoded `Metric` object whose `value` reads a `portfolio?.*` field. Each carries a `formula` string surfaced in the **"Why this number?"** provenance popover **[IMPLEMENTED]**.

| Kicker / label | Value source | Formula (verbatim) | Confidence | Completeness | Δ% |
|---|---|---|---|---|---|
| Billed | `portfolio?.totalBilled` | `Σ gross fee invoiced across active projects` | high | 90 | +5 |
| Collected (net) | `portfolio?.totalCollected` | `Σ payments received (net of VAT/VDS/AIT)` | high | 90 | −7 |
| Collection rate | `portfolio?.collectionRate` | `Collected ÷ Billed × 100` | high | 90 | −4 |
| Work-in-progress | `portfolio?.totalWip` | `Earned (by % complete) − billed` | medium | 70 | +3 |

WIP note: *"Depends on % complete, which is partly manual."* The Collection-rate sparkline trend is the inline literal `[82, 84, 76, 95, 75, 74]`; WIP has no trend. All `sources` use `observedAt: "2026-06-12"` and name **TallyPrime** and **Manual capture**.

> **How `portfolio` is computed** (`computePortfolio()`, runs client-side then is cloned): `totalBilled = Σ feeBilled` over active projects; `totalCollected = Σ feeCollected`; `collectionRate = totalBilled > 0 ? collected/billed×100 : 0`; `totalWip = Σ feeWip`. "Active" = `stage !== "closed"` (all 8 mock projects qualify).

### 7. Charts (2) — [MOCK]

| Chart | Kicker / title | Detail |
|---|---|---|
| `AreaTrend` | Cash flow · 6 months / Billed vs. collected | `xKey="m"`, `currency`, series **Billed** (blue) + **Collected** (sage), `BDT` badge. **Fed from the hardcoded `moneyTrend`, not from `portfolio`.** |
| `BarSeries` | Receivables / Invoice aging | `xKey="label"`, single bar **Outstanding** (sienna), height 210. Data = `agingBuckets()`. Below it a rust callout shows `90+ days overdue` = `bdt(aging[4]?.amount)`. |

> **Aging buckets** (`agingBuckets()`): open invoices = `status ∉ {paid, draft}`. Each bucket sums `netReceivable − amountReceived` by `agingDays`: **Current** `[−∞,1)` sage, **1–30** ochre, **31–60** ochre, **61–90** sienna, **90+** rust.

### 8. Bangladesh tax explainer card — [MOCK] (visual-only, fully hardcoded)

Header *"Why 'billed' never equals 'cash'."* A fixed chip sequence joined by `→` arrows: **Gross fee ৳10.0L** → **+ VAT 15% ৳1.5L** → **− VDS −৳0.9L** → **− AIT ~10% −৳1.0L** → **= Net cash ৳9.6L**. This is illustrative copy; it is **not** computed from any invoice (see Theme A for the real `inv()` formula).

### 9–12. Tables

**Invoices table (Ledger)** — [MOCK]. Header carries `SourceChip "TallyPrime · export 12 Jun"` with status **stale** (visual-only).

| Column | Content | Notes |
|---|---|---|
| Invoice | `i.number` | |
| Project | `proj?.name ?? i.client` | **Link → `/projects/:id`** [IMPLEMENTED] |
| Gross (right) | gross fee | |
| Net receivable (right) | `i.netReceivable` | Header has a **Tooltip** *"Gross + VAT − VDS − AIT"* (dotted underline, cursor-help) [IMPLEMENTED] |
| Received (right) | `i.amountReceived` | |
| Due | due date | |
| Status | Badge | overdue→rust (`{agingDays}d overdue`), paid→sage, part_paid→ochre, else neutral; non-overdue label = `status.replace("_"," ")` |

**Outstanding by client** — [MOCK]. Not a `<Table>` — a list of horizontal bars. Filters `c.outstanding > 0`, sorts descending. Bar width = `(outstanding / maxO) × 100%`; bar colour **rust** if `relationship === "at_risk"` else **sienna**. (`maxO` is recomputed inside each map iteration — a minor inefficiency, not a behavioural issue.)

### 13. Filters / sorts

| Control | Behaviour | Status |
|---|---|---|
| Invoice status `Select` (sm) | Options **All / Overdue / Sent / Part paid / Paid**; `useState("all")`; filters the invoice table | **[IMPLEMENTED]** (client state) |
| Sort | None | — |

### 14–17. Input → Validation → Processing → Approval → Storage → Reporting → Follow-up

Financials is **read-only**; there is no capture form here. The flow is therefore a *consumption* flow:

| Stage | What happens | Status |
|---|---|---|
| Input | Invoices/payments originate in accounting (TallyPrime) | **[INTEGRATION]** — currently a stale CSV export in mock |
| Validation | None on this page | — |
| Processing | `computePortfolio()` + `agingBuckets()` run client-side on cloned mock | **[MOCK]** |
| Approval | n/a | — |
| Storage | None — nothing is written | **[BACKEND]** |
| Reporting | KPIs, AreaTrend, aging bar, ledger, outstanding-by-client | **[MOCK]** |
| Follow-up | Drill into a project via the Project link | **[IMPLEMENTED]** |

### 18. Actions / interactive elements

| Element | Behaviour | Status |
|---|---|---|
| Invoice → Project links | Router navigation | **[IMPLEMENTED]** |
| Invoice status Select | Filters table | **[IMPLEMENTED]** |
| **Export** button (Download icon) | No `onClick` | **[BACKEND]** (needs a render/export service) |
| `SourceChip` "TallyPrime · export 12 Jun" | Decorative | **[MOCK]** |

### 19. States

No loading/Skeleton, **no empty state**, no error state. If invoices/clients are empty, tables render silently empty. `pct` is imported but unused.

### 20–25. Edge cases, dependencies, limitations, recommendations

- **Edge case:** an empty ledger shows blank tables with no "no invoices" message — a gap a real build should fill.
- **Key dependency:** truthful collections require a live **TallyPrime/QuickBooks/Xero** feed (the current source is a weekly CSV that the UI itself labels *stale*) **[INTEGRATION]**.
- **Limitation:** standalone `payments` amounts are hand-authored and **not reconciled** against invoice `amountReceived`.
- **[RECOMMENDED]:** wire Export to a PDF/CSV generator; add an empty state; persist the status filter; replace the hardcoded `moneyTrend` with a real monthly billed/collected series once an accounting API exists.

---

# Module 2 — Profitability (`/profitability`)

| # | Aspect | Detail |
|---|---|---|
| 1 | **Route / component** | `/profitability` (inferred) → `Profitability.tsx`. |
| 2 | **Status** | **[MOCK]** read + derived; one filter [IMPLEMENTED]; honest **InsufficientData** refusal; export **[BACKEND]**. |
| 3 | **Purpose** | Margin by project and phase, **fee-based not true margin**, gated on timesheet coverage. |
| 4 | **Audience** | Owner/Principal, Finance/Admin, project directors. |
| 5 | **Data sources** | `useProjects()` **[MOCK]**. Constants: per-project `TIMESHEET_COVERAGE` map (`p1:61, p2:58, p3:88, p4:60, p5:64, p6:30, p7:76, p8:25`), `AS_OF = "2026-06-17"`. `active = stage !== "closed"`; `lowCoverage = active with coverage < 65`. |

### 6. Derived figures (computed client-side) — [MOCK]

| Figure | Formula |
|---|---|
| `portfolioRevenue` | `Σ feeContract` (active) |
| `costToDate` | `Σ costToDate` |
| `collected` | `Σ feeCollected` |
| `blendedMargin` | `(portfolioRevenue − costToDate) / portfolioRevenue × 100` (0 if revenue ≤ 0) |
| `realization` | `collected / portfolioRevenue × 100` |
| `avgCoverage` | mean of `TIMESHEET_COVERAGE` across active |

### 7. KPI cards (4, Skeleton-gated) — [MOCK]

| Kicker / label | Value | Formula (verbatim) | Confidence / completeness |
|---|---|---|---|
| Portfolio revenue (contracted) | `portfolioRevenue` | `Σ contracted fee across active projects` | high / 92 |
| Cost-to-date (partial labour) | `costToDate` | `Σ incurred cost (mostly labour) — captured where timesheets exist` | medium / 64 |
| Blended margin (fee-based) | `round(blendedMargin)` | `(Contracted fee − cost-to-date) ÷ contracted fee × 100. Fee-based proxy, not true margin.` | low / 62 |
| Realization | `round(realization)` | `Collected (net of VAT/VDS/AIT) ÷ contracted fee × 100` | medium / 88 |

Notes (verbatim): Cost — *"Labour cost is under-captured; figure understates true cost on low-coverage projects."* Margin — *"Indicative only. True margin needs full labour cost; timesheet coverage is ~64% across the portfolio."* Realization — *"Cash realized against contract value — billing still trails delivery on several projects."*

### 8. Honest-margin callout (`Card drafting`, sienna) — [IMPLEMENTED] refusal

Header *"Margin here is fee-based, not true margin"* + `ConfidenceBadge level="low"`. Body computes inline: *"{lowCoverage.length} of {active.length} projects"* have coverage below 65%. Cross-links to **Resourcing** (`/resourcing`) and **Capture** (`/capture`). Contains an `InsufficientData` block: `metric="True firm-wide margin"`, hint *"it requires full labour cost, but portfolio timesheet coverage is only ~{round(avgCoverage)}%"* — i.e. the product **refuses** to print a firm-wide true margin (Theme B).

### 9. Charts (2) — [MOCK]

| Chart | Detail |
|---|---|
| Forecast margin by project (`BarSeries`, sienna, badge `fee-based %`) | `xKey="name"` (= `p.code`); `marginData` maps `forecastMargin.value ?? 0`, flags `insufficient` when null. Caption switches: if `insufficientMargins > 0` → *"{n} project(s) shown at 0% — forecast margin is insufficient (no reliable cost/timesheet data)"*; else *"All active projects have a forecastable margin."* |
| Planned vs. actual cost (`BarSeries`, badge `BDT`) | Grouped bars **Budget cost** (slate) + **Cost-to-date** (blue), `currency`. Caption: *"Actuals are partial where timesheets lag — a low bar can mean low cost or low capture, not certainty."* |

### 10. Table — "Profitability by project" — [MOCK]

Description: *"Contract fee against captured cost. Confidence reflects labour-cost completeness, not optimism."*

| Column | Content |
|---|---|
| Project | **Link → `/projects/:id`** (name + `p.code`); sub-line *"Timesheet coverage {coverage}%"* with *"· labour partial"* (sienna) appended when `coverage < 65` |
| Stage | `STAGE_LABELS` |
| Contract fee (right) | `bdt` |
| Cost-to-date (right) | `bdt` |
| Forecast margin | `value === null` → `ConfidenceBadge insufficient` + "Insufficient data"; else `pct(value)` coloured rust (`<10`) / ochre (`<20`) / ink + `ConfidenceBadge level={m.confidence}` |
| Data completeness | `DataCompleteness value={p.completeness}` |

### 11. Filters / sorts

| Control | Behaviour | Status |
|---|---|---|
| Stage `Select` (sm) | "All stages" + dynamic from active project stages; filters table rows only | **[IMPLEMENTED]** |
| Sort | None (fixed) | — |

### 12. Actions

| Element | Status |
|---|---|
| **Export** button | **[BACKEND]** (no handler) |
| `SourceChip "TallyPrime · export 12 Jun"` (stale) | **[MOCK]** decorative |
| Resourcing / Capture cross-links | **[IMPLEMENTED]** |

### 13. States

- **Loading:** `isLoading` → 4 × `Skeleton h-44` (KPI row only; charts/table not skeletoned).
- **Insufficient data:** the callout `InsufficientData` + per-row insufficient badges + chart caption (Theme B).
- No empty/error state. Footer: *"Fee-based margins as of {shortDate(AS_OF)}. True margin unlocks when timesheet coverage clears 80% firm-wide."*

### 14–25. Flow, dependencies, recommendations

| Stage | What happens | Status |
|---|---|---|
| Input | `costToDate` should come from timesheets + expenses | **[INTEGRATION]** (Clockify / TallyPrime) + **[BACKEND]** persistence |
| Processing | margin/realization derived client-side | **[MOCK]** |
| Reporting | KPIs + 2 charts + table | **[MOCK]** |
| Follow-up | drill to project; route to Resourcing/Capture | **[IMPLEMENTED]** |

- **Core limitation (by design):** every margin is **fee-based**, explicitly *not* true margin, because labour cost capture is partial. The product is unusually honest about this — it would rather refuse than fabricate.
- **[RECOMMENDED]:** integrate a time-tracking source so coverage clears 80% and the firm-wide true-margin refusal can be lifted; persist the stage filter; wire Export.

---

# Module 3 — Clients (`/clients`) + Client Detail (`/clients/:id`)

| # | Aspect | Detail |
|---|---|---|
| 1 | **Routes / components** | `/clients` → `Clients.tsx`; `/clients/:id` → `ClientDetail.tsx` (uses `useParams().id`). |
| 2 | **Status** | List = **[MOCK]** with search [IMPLEMENTED]; Detail = **[MOCK]** synchronous reads (no hook → no loading state) with real `mailto:`/`tel:` links. |
| 3 | **Purpose** | Every account at a glance — lifetime fees, outstanding cash, relationship health. |
| 4 | **Audience** | Owner, partners, BD/growth leads. |
| 5 | **Data** | List: `useClients()` **[MOCK]**. Detail: `clientById`, `invoices`, `projects`, `contactsByClient` imported **directly from mock** (no API hook). |

### Clients list

#### 6. KPI cards (4, plain values — no `Metric` object) — [MOCK]

| Card | Value |
|---|---|
| Clients | `num(clients.length)` |
| Lifetime fee | `bdt(Σ lifetimeFee, compact)` |
| Outstanding | `bdt(Σ outstanding, compact)`; footnote *"across {n} accounts"* |
| At-risk relationships | `num(count relationship === "at_risk")`; footnote *"needs attention"* (red) when `>0`, else *"all healthy"* |

#### 7. Charts (3) — [MOCK]

| Chart | Detail |
|---|---|
| Revenue by client (`BarSeries`, BDT) | `revenueData` from `sorted` (by `lifetimeFee` desc); `shortName` truncates >16 chars; bar `lifetimeFee` blue |
| Relationship health (`Donut`) | over `strong / neutral / at_risk`, filtered `>0`; centre = `num(clients.length)` / "clients" |
| Outstanding by client (`BarSeries`, sienna, h210) | clients with `outstanding > 0`. Empty: *"No outstanding balances. Every account is current."* |

#### 8. Table — "All clients" — [MOCK]

Description: *"Sorted by lifetime fee. Click a name to open the account."* Base sort fixed by `lifetimeFee` desc.

| Column | Content |
|---|---|
| Client | **Link → `/clients/:id`** (name + hover `ArrowUpRight` + city) [IMPLEMENTED] |
| Type | Badge (`developer`/`private`/`corporate`/`government`/`institution`) |
| Active projects (right) | `num` |
| Lifetime fee (right) | `bdt` compact |
| Outstanding (right) | `bdt` or "—" when 0; **red + bold** when `flagged` (`outstanding > 0 && relationship === "at_risk"`) |
| Relationship | Badge with dot |

#### 9. Filters / sorts

| Control | Behaviour | Status |
|---|---|---|
| `SearchInput` "Search clients…" | matches name / city / type label | **[IMPLEMENTED]** |
| Column sort | none | — |

#### 10. States (list)

Loading → 4 KPI skeletons + per-chart skeletons + 5 table-row skeletons. Empty (filtered): `EmptyState` *"No clients match"*. No error state.

### Client Detail (`/clients/:id`)

#### 11. Header & not-found

No `PageHeader`. Custom header: *"{type.label} · {city}"*, client name, type badge, relationship badge, *"· {n} active project(s)"*. **Not-found state [IMPLEMENTED]:** when `clientById(id)` is undefined → card *"Client not found"* + prose + "Back to all clients" link. This doubles as the page's error/empty resolution.

#### 12. KPI row (4 plain values) — [MOCK]

| Card | Value |
|---|---|
| Lifetime fee | `bdt(lifetimeFee, compact)` |
| Outstanding | `bdt(outstanding, compact)` or "৳0"; footnote *"at-risk receivable"* (red) when `outstanding>0 && at_risk` |
| Active projects | `num(activeProjects)` |
| Relationship | `rel.label` |

#### 13. Contacts card — [IMPLEMENTED] links over [MOCK] data

`contactsByClient(client.id)`. Each row: Avatar (tone cycles blue/sienna/sage/ochre), name, `Primary` badge when `ct.primary`, role, and **real `mailto:` + `tel:` anchors** (interactive). Empty: *"No contacts recorded for this client yet."*

#### 14. Projects section

`projects.filter(p => p.clientId === client.id)` rendered as `ProjectCard` grid (each card links to its project). Empty: *"No projects linked to this client."*

#### 15. Invoices card — [MOCK]

`invoices.filter(i => i.client === client.name)`. Columns: Invoice (`i.number`, mono) · Issued · Net receivable (right) · Received (right) · Status (overdue→rust `{agingDays}d overdue`, paid→sage, part_paid→ochre, else neutral). Empty: *"No invoices for this client yet."*

#### 16–25. Flow, states, dependencies, recommendations

| Stage | Detail | Status |
|---|---|---|
| Input | Client master + invoices originate in CRM/accounting | **[INTEGRATION]** / **[BACKEND]** |
| Processing | totals summed client-side | **[MOCK]** |
| Reporting | KPIs, 3 charts (list), contacts/projects/invoices (detail) | **[MOCK]** |
| Follow-up | open account, email/call a contact, open a project | **[IMPLEMENTED]** |

- **Notable detail:** Client Detail reads mock **synchronously** (no React Query hook), so it has **no loading/Skeleton state** — only the not-found card.
- **Edge case:** invoices are matched to a client by **name string** (`i.client === client.name`), not by id; a renamed client would orphan its invoices in a real system. **[RECOMMENDED]** match by `clientId`.
- **[RECOMMENDED]:** persist clients to a backend; add CRM integration so contacts/relationship health are live.

---

# Module 4 — Pipeline (`/pipeline`)

| # | Aspect | Detail |
|---|---|---|
| 1 | **Route / component** | `/pipeline` (inferred) → `Pipeline.tsx`. |
| 2 | **Status** | **[MOCK]** read/derived; owner filter [IMPLEMENTED]; static kanban (no drag-drop); honest win-rate caveat. |
| 3 | **Purpose** | The new-work pipeline — *"part CRM, part the owner's memory. We track what's written down and stay honest about what isn't."* |
| 4 | **Audience** | Owner/Principal, BD leads, partners, investors gauging future revenue. |
| 5 | **Data** | `usePortfolio()`, `useOpportunities()`, `pipelineByStage()` **[MOCK]**. `BOARD_STAGES`: lead (neutral), qualified (blue), proposal (ochre), negotiation (sienna), won (sage) — **`lost` excluded from the board**. `weighted(o) = estFee × probability / 100`. |

### 6. Derived figures — [MOCK]

| Figure | Formula |
|---|---|
| `open` | stage ∉ {won, lost}; `openValue = Σ estFee` of open |
| `won` / `lost` | counts; `closed = won + lost` |
| `winRate` | `closed > 0 ? won/closed×100 : null` |
| `avgDeal` | `open.length ? openValue/open.length : 0` |

### 7. KPI cards (4) — [MOCK]

| Kicker / label | Value | Formula (verbatim) | Confidence / completeness |
|---|---|---|---|
| Weighted pipeline | `portfolio?.pipelineWeighted` | `Σ (est. fee × win probability) across open opportunities` | medium / 60 |
| Open pipeline value | `openValue` | `Σ est. fee for stages lead → negotiation` | low / 52 |
| Win rate | `winRate` (nullable) | `Won ÷ (Won + Lost) × 100` | low / 20; footnote `ConfidenceBadge low` |
| Avg expected deal size | `open.length ? avgDeal : null` | `Open pipeline value ÷ open opportunity count` | medium / 55 |

Notes (verbatim): Weighted — *"Probabilities are the owner's judgement, not a fitted model."* Open — *"Face value if every open deal closed at full fee — not a forecast."* **Win-rate caveat** — *"Only {closed} closed {deal/deals} on record — too few to trust. Most lost bids never get logged."* (Theme C.)

> Note: `pipelineWeighted` (from `computePortfolio()`) is probability-weighted; `pipelineByStage()` uses **raw `estFee`** (not weighted) and **excludes `lost`**.

### 8. Honesty note (ochre callout) — [MOCK]

*"Pipeline is the least-instrumented part of the practice — much of it still lives in the principal's head and WhatsApp threads. Win probabilities are manual estimates, and with only {closed} closed {deal/deals} logged, win rate is low-confidence. Treat these figures as a working view, not a forecast."*

### 9. Kanban board — [MOCK] (static, not interactive)

5 columns from `BOARD_STAGES`. Per column: stage Badge + count + `colValue` (`bdt` compact). `colValue` = firm-wide `byStage.value` when owner filter is "all", else `Σ estFee` of visible owner cards. Cards sorted by `probability` desc; show name, client, type badge, `estFee`, `pct(probability)`, a toned `Progress` (sage ≥60 / ochre ≥35 / sienna), decision date + owner. **Cards have hover-shadow only — no click handler, no drag-and-drop.** Empty column text: `owner === "all" ? "No opportunities" : "None for this owner"`.

### 10. Weighted-by-stage chart — [MOCK]

`BarSeries` (badge `Est. fee × prob.`), `xKey="label"`, `currency`, bar **Weighted value** (blue). `stageWeighted` = per BOARD_STAGE `Σ weighted(o)` (includes won). It is a bar chart by stage, not a literal funnel.

### 11. Table — "Pipeline detail" — [MOCK]

Columns: Opportunity (name + capitalised stage) · Client · Type · Est. fee (right) · Prob. (right, `pct` + mini `Progress`) · Weighted (right, `bdt(weighted)`) · Decision · Owner. Rows = `visible` sorted by `expectedDecision` **ascending**; closed rows (`won`/`lost`) greyed. Footer: *"Showing {n} of {total} opportunities · sorted by expected decision · est. fees are pre-tax contract values."*

### 12. Filters / sorts

| Control | Behaviour | Status |
|---|---|---|
| Owner `Select` (sm) | "All owners" + dynamic owners; filters **both** board cards and table | **[IMPLEMENTED]** |
| Sort | Board fixed by probability desc; table fixed by decision asc | — |

### 13. Actions / states

- No Export button; **no outbound links** (cards are not links). Only the owner Select is interactive.
- **Empty:** table `EmptyState` *"No opportunities / No pipeline entries match this owner"* when `sortedTable.length === 0 && !isLoading`.
- **Loading:** `isLoading` only suppresses the empty state; **no Skeleton** (KPIs/board render with defaults). No error state.

### 14–25. Flow, dependencies, recommendations

| Stage | Detail | Status |
|---|---|---|
| Input | Opportunities live in the owner's head + WhatsApp; manual probabilities | **[BACKEND]** capture + **[INTEGRATION]** (CRM) |
| Processing | weighted/win-rate derived client-side | **[MOCK]** |
| Reporting | KPIs, kanban, weighted-by-stage bar, detail table | **[MOCK]** |
| Follow-up | filter by owner | **[IMPLEMENTED]** |

- **Core limitation (by design):** win rate is statistically untrustworthy because lost bids are rarely logged — the page says so explicitly.
- **[RECOMMENDED]:** make the board interactive (drag-drop stage moves) **[BACKEND]**; capture lost bids to make win rate meaningful; persist the owner filter; consider linking opportunities to clients.

---

# Module 5 — Goals & Targets (`/goals`)

| # | Aspect | Detail |
|---|---|---|
| 1 | **Route / component** | `/goals` (inferred) → `Goals.tsx`. |
| 2 | **Status** | **[MOCK]** read/derived; **no filters, no actions** beyond project links; full-page Skeleton. |
| 3 | **Purpose** | *"Firm and project targets tracked against actuals — the director's scorecard for growth, cash and delivery."* |
| 4 | **Audience** | Owner/Director, partners, investors. |
| 5 | **Data** | `useTargets()` **[MOCK]** (8 targets). `TODAY = "2026-06-17"`. Split `scope === "firm"` vs `"project"`. |

### 6. Status enums & attainment logic — [MOCK]

`STATUS_TONE`: ahead → sage, on_track → sage, behind → ochre, at_risk → rust. `STATUS_LABEL`: Ahead / On track / Behind / At risk.

| Concept | Formula |
|---|---|
| `isLowerBetter(t)` | `t.unit === "days"` |
| `attainment(t)` (lower-is-better) | `100` if `actual ≤ target`, else `max(0, min(100, 100 − over×10))` |
| `attainment(t)` (else) | `target === 0` → 100 if `actual ≤ 0` else 0; else `min(100, actual/target×100)` clamped |
| `gap` | `actual − target` in the metric's own unit; `gapGoodWhenUp = !lowerBetter` |

`formatValue`: bdt compact / `pct` / `{value}d` / `{value}×` (ratio) / `num` default.

### 7. KPI cards (4) — [MOCK]

| Kicker / label | Value | Confidence / completeness |
|---|---|---|
| On track | count(ahead \| on_track) | high / 100 |
| Behind / at risk | count(behind \| at_risk) | high / 100; `deltaGoodWhenUp=false` |
| Overall attainment | `round(mean attainment over all targets)` | medium / 100 |
| Tracked goals | `targets.length`; footnote *"{firm} firm · {project} project"* | **no Metric / no confidence** (plain value only) |

KPI metrics carry empty `sources: []`.

### 8. GoalRow (target vs actual) — [MOCK]

Shows `formatValue(actual)` / `formatValue(target)` + `round(attainment)%`, a `Progress` toned by status, period, and `DataCompleteness value={round(attainment)}` (note: this **reuses attainment as completeness**, not a separate field). **Gap** rendering: `gap === 0` → "On target"; unit `bdt` → ±`bdt(abs(gap))` coloured by direction; else `Delta` with unit suffix (`pp` / `d` / `×`). Project-scope rows render a **Link → `/projects/:id`** (code + name) via `projectById` [IMPLEMENTED].

### 9. Sections & chart — [MOCK]

- **Firm goals** section, else `EmptyState` *"No firm goals set"*.
- **Project goals** section, else `EmptyState` *"No project goals set"*.
- **Chart "Attainment vs. target"** (grouped `BarSeries`, badge `% of target`): bars **Target** (taupe, always 100 baseline via a synthetic `{...t, actual: t.target}`) + **Actual** (blue, real attainment). `name` = project code or label truncated to 13 chars.

### 10. Filters / sorts / actions

**None.** No Select, no sort, no Export. Only project `Link`s are interactive.

### 11. States

- **Loading:** full-page Skeleton (`isLoading || !targets`) — 4 KPI (`h-32`) + 5 row (`h-20`) skeletons, plus a **different loading-variant description** (*"…owned by the director."*).
- **Empty:** per-section `EmptyState`. No error, no insufficient-data state.

### 12–25. Flow, dependencies, recommendations

| Stage | Detail | Status |
|---|---|---|
| Input | Targets are authored data; actuals would come from finance/delivery feeds | **[BACKEND]** authoring + **[INTEGRATION]** actuals |
| Processing | attainment/gap computed client-side | **[MOCK]** |
| Reporting | KPIs, two goal lists, attainment chart | **[MOCK]** |
| Follow-up | open the project behind a project-scope target | **[IMPLEMENTED]** |

- **Quirk:** the GoalRow progress bar conflates **attainment** with **data completeness** (`DataCompleteness value={round(value)}`); they are not the same concept. **[RECOMMENDED]** drive completeness from a real field.
- **[RECOMMENDED]:** add a target-editing form **[BACKEND]**; connect actuals to live finance/delivery data; add period filtering.

---

# Module 6 — Resourcing (`/resourcing`)

| # | Aspect | Detail |
|---|---|---|
| 1 | **Route / component** | `/resourcing` → `Resourcing.tsx`. |
| 2 | **Status** | **[MOCK]** read/derived; **InsufficientData** refusal on spare capacity; one functional cross-link, one visual-only button. |
| 3 | **Purpose** | *"Utilization is only as honest as timesheet coverage. Where time isn't logged we say so — people without timesheets read as 'no time logged', never as idle."* |
| 4 | **Audience** | Owner/Principal, project directors, people/ops leads. |
| 5 | **Data** | `useEmployees()` (fallback `employeesSeed`), `utilizationSummary()` (`u`) **[MOCK]**. Constants: `BAND = {healthyLow:75, healthyHigh:90}`, `OVERLOADED_ID = "e3"` (Arif Chowdhury), `ASOF = "2026-06-17"`. |

### 6. Null / "No time logged" handling — [IMPLEMENTED] honesty model (Theme B)

| Rule | Behaviour |
|---|---|
| `logged` / `unlogged` | split on `utilization.value !== null` / `=== null` |
| Mean utilisation | **excludes** unlogged staff (note: *"Averaged across {logged} of {employees} people — those without timesheets are excluded, not counted as zero"*) |
| Chart | includes only `logged`, sorted desc; caption: *"{n} {person/people} don't log time and are omitted here — that's unknown, not idle. Bars above 90% are overloaded."* |
| Team table | `value === null` → text **"No time logged"** (no badge, no zero) |
| `utilTone(v)` | `>90` rust, `≥75` sage, else ochre |

### 7. Timesheet-coverage gating — [IMPLEMENTED] refusal

- `kCoverage` formula = `mean(timesheet weeks submitted) across all staff`; note *"Every utilization number on this page is gated on this figure."* All KPI `completeness = round(u.coverage)`.
- **Spare capacity is forced insufficient:** `kSpare.value = null`, `confidence: "insufficient"`, note *"Coverage only {round(u.coverage)}% — firm-wide spare capacity isn't reliable."* `spareHours` **is** computed (`Σ max(0, capacityHours − allocatedHours)` over logged) but is **not** shown as the KPI value — only surfaced in the table footer as "nominal slack (partial)".

### 8. KPI cards (4, Skeleton-gated) — [MOCK]

| Kicker / label | Value | Formula (verbatim) | Confidence |
|---|---|---|---|
| Mean billable utilization | `round(u.meanUtil)` | `mean(utilization) over staff who log time` | medium |
| Timesheet coverage | `round(u.coverage)` | `mean(timesheet weeks submitted) across all staff` | `u.confidence` (coverage>80 high / >60 medium / else low) |
| Overloaded (>90%) | `u.overloaded` | `count(utilization > 90%) among people who log time` | medium; footnote *"burnout risk"* (rust) |
| Spare capacity | **`null`** | (no formula) | **insufficient** |

> `utilizationSummary()`: `billable = value !== null`; `coverage = avg(all timesheetCompliance)`; `meanUtil = avg(billable utilization)`; `overloaded = count(value > 90)`; `underloaded = count(value !== null && value < 70)`; `unknown = count(value === null)`.

### 9. Coverage callout (ochre) — [IMPLEMENTED] refusal

`InsufficientData metric="Firm spare capacity"`, hint *"only {round(u.coverage)}% of weeks are timesheeted, so unfilled hours can't be summed across the firm. {u.unknown} of {employees} people don't log time at all"*. Plus a **"Set up time capture"** button — **visual-only [BACKEND]** — and sub-text *"Bootstrap weekly timesheets and these numbers become trustworthy."*

### 10. Charts / distribution — [MOCK]

| Element | Detail |
|---|---|
| Utilization chart (`BarSeries`, blue, h230, badge `Healthy 75–90%`) | `xKey="name"` (first name), logged staff only |
| Load split (4 `Progress` rows, NOT a chart) | **Overloaded (>90%)** rust/Flame; **Healthy (75–90%)** sage; **Slack (<75%)** ochre/TrendingDown; **No time logged** neutral/ink. Each = `count/denom × 100`, `denom = employees.length`. Footer: `DataCompleteness value={round(u.coverage)}` + *"across {n} people"* |

### 11. Overload warning card (Arif Chowdhury, conditional) — [MOCK]

An IIFE finds `e.id === "e3"`; returns null if missing or util null. Rust card: header *"{name} is carrying too much"*, badge *"{pct(util)} · 6 weeks"*, body interpolating title, active projects, allocated/capacity hours, timesheet compliance; states the signal "is trustworthy" because timesheets are X% complete. Non-interactive.

### 12. Table — "Team load" — [MOCK]

Columns: Person · Projects (right) · Allocated / Capacity (right) · Utilization · Timesheet compliance.

| Cell | Behaviour |
|---|---|
| Sort | all employees by util desc, `null → -1` (unlogged sink to bottom) |
| Row highlight | `isOverloaded = v !== null && v > 90` → `bg-rust-tint/30` + "Overload" badge |
| Allocated/Capacity | `over = allocated > capacity` → sienna + sub-line *"+{n}h over"* |
| Utilization | null → "No time logged"; else `pct(v)` toned + `ConfidenceBadge level={e.utilization.confidence}` |
| Timesheet compliance | `Progress` toned sage(≥75)/ochre(≥50)/rust + `{n}%` |

Footer: *"{logged} of {employees} log time · {spareHours}h nominal slack among them (partial)"* + **"Improve coverage" Link → `/capture`** [IMPLEMENTED].

### 13. Actions / cross-links

| Element | Status |
|---|---|
| Header "Set up time capture" → `/capture` | **[IMPLEMENTED]** (navigation) |
| Callout "Set up time capture" button | **[BACKEND]** (visual-only) |
| Footer "Improve coverage" → `/capture` | **[IMPLEMENTED]** |

### 14. States

- **Loading:** `isLoading` → 4 × `Skeleton h-36` (KPI row only).
- **Insufficient:** callout + spare-capacity KPI (Theme B). No empty/error state (employees default to seed).

### 15–25. Flow, dependencies, recommendations

| Stage | Detail | Status |
|---|---|---|
| Input | Hours come from manual capture today; ideally a time-tracking API | **[INTEGRATION]** (Clockify) + **[BACKEND]** persistence |
| Validation | n/a on this page (capture happens on `/capture`) | — |
| Processing | `utilizationSummary()` client-side | **[MOCK]** |
| Reporting | KPIs, util chart, load split, overload card, team table | **[MOCK]** |
| Follow-up | route to Capture to lift coverage | **[IMPLEMENTED]** |

- **Core principle:** the module never presents missing time as idle. Unlogged staff are "unknown, not idle"; firm-wide spare capacity is **refused** until coverage is trustworthy. This is the same discipline as Profitability's true-margin refusal.
- **[RECOMMENDED]:** integrate Clockify/timesheet capture so coverage clears 80%, unlocking spare-capacity and "can we take on a new project?" answers; wire "Set up time capture".

---

## Appendix — Cross-module reference

### Bangladesh net-cash chain (one place)

| Component | Rate basis | Notes |
|---|---|---|
| VAT | 15% of gross | added on top |
| VDS | 60% of the VAT figure (≈9% of gross) | withheld by client at source |
| AIT/TDS | ≈10% of gross | withheld at source |
| Net receivable | `gross + VAT − VDS − AIT` | the only figure that reflects cash |

### "Insufficient data" / refusal points across these six modules

| Module | Refusal / gating point |
|---|---|
| Profitability | Firm-wide true margin refused; per-project forecast margin shows `Insufficient data` when null |
| Resourcing | Spare-capacity KPI forced to `null`/insufficient; unlogged staff = "No time logged" |
| Pipeline | Win rate flagged low-confidence (too few closed deals; lost bids unlogged) |
| Financials | "Billed ≠ cash" framing; WIP marked medium-confidence (partly manual) |

### Visual-only / non-functional controls (do not describe as working)

| Module | Control | Status |
|---|---|---|
| Financials | Export | **[BACKEND]** |
| Profitability | Export | **[BACKEND]** |
| Resourcing | "Set up time capture" (callout button) | **[BACKEND]** |
| All five tax/coverage constants (`moneyTrend`, tax explainer chips, `TIMESHEET_COVERAGE`, `BAND`, KPI trend arrays) | hardcoded literals | **[MOCK]** |

### Persistence reality (all six modules)

There are **no mutation hooks** in `api.ts`. Every filter, search, tab, and Select on these pages is **client-side state that resets on refresh**. No data entered or selected here is saved. Pages that would need persistence or external data to truly function are tagged **[BACKEND]** / **[INTEGRATION]** above.
