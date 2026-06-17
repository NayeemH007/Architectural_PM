# Glossary of System Terms

This glossary defines every term you are likely to meet while reading the **SPACE ESSE · Practice Intelligence** documentation, using it, or building on it. It is written for a mixed audience — founders, partners, architects, project managers, developers, investors and QA — so each definition is short, plain, and tied to how the term actually appears in the product.

## How to read the status tags

Many entries describe *features*. Where a feature is named, it carries one of the tags below so you always know whether it truly works in the current build. This matters because **the current SPACE ESSE build is a frontend-only, high-fidelity interactive prototype**: there is no backend, no database, no real authentication, no persistence, and no live third-party calls. All data is mock data served through a simulated `resolve()` transport with roughly 280 ms of fake latency.

| Tag | Meaning |
|---|---|
| **[IMPLEMENTED]** | Interactive and working today — but entirely client-side (refreshing the browser resets it). |
| **[MOCK]** | Renders from mock data; the underlying read, sync or calculation is simulated, not live. |
| **[BACKEND]** | Designed in the UI, but needs an API / database / persistence layer to actually function. |
| **[INTEGRATION]** | Needs a third-party connector (accounting, file storage, email, authority portal, etc.) to function. |
| **[PLANNED]** / **[RECOMMENDED]** | Not built; a future enhancement. |

> Throughout this document, "today" / "the build" means the prototype as inventoried. Anything that would require a server is labelled accordingly rather than described as working.

---

## A

**AIT — Advance Income Tax (also TDS, Tax Deducted at Source)**
A Bangladesh withholding tax. Corporate and government clients deduct roughly **10% of the gross fee** before paying an architecture firm, then remit it to the tax authority on the firm's behalf. SPACE ESSE models this so that "collected" figures reflect real cash, not invoice face value. In the mock invoice factory it is computed as `aitWithheld = round(grossFee × 0.10)`. See also **VAT**, **VDS**, **Net receivable**.

**Alert**
A flagged signal — money, schedule, approval, resourcing, profitability or data-quality — shown in the Topbar notifications popover, on the Dashboard, and on the Risks page as "AI-detected anomalies". Each alert carries a severity (`critical` / `warning` / `info` / `positive`), a confidence level, a category, a provenance source, and an `acknowledged` flag. **[MOCK]** — alerts come from a fixed mock array; the `acknowledged` flag exists as data but no control changes it.

**Anti-hallucination principle**
The product's core promise: every number is computed deterministically from cited records, and the AI only writes the *narrative* around verified facts. When data is missing, the system shows a refusal (an **insufficient-data state**) rather than inventing a figure. Surfaced in the AI Reports "How these reports stay honest" strip and the Assistant disclaimer. In the prototype the deterministic computation is real (client-side); the "AI" wording is canned text, not live inference.

**Approval (Authority Approval)**
A regulatory submission to a Bangladesh authority (e.g. RAJUK, FSCD) tracked through statuses from `not_started` to `approved` / `rejected`. Each approval records the authority, statutory decision window, days-in-stage, whether it is `blocking`, and its source. **[MOCK]** — tracked from mock data; no authority exposes an API, so in production these are **[INTEGRATION]** (manual portal entry / liaison capture).

**Atelier theme**
The light, paper-toned visual design language of the app (warm "bone"/"paper" backgrounds, ink text, and an accent palette of blue, sienna, sage, ochre, slate, taupe). Typeset in Schibsted Grotesk (display), JetBrains Mono (figures/code) and Hind Siliguri (Bangla).

**Attainment**
On the Goals page, how close a target's actual value is to its target value, expressed as a clamped 0–100%. For "lower is better" metrics (days) the logic inverts. **[IMPLEMENTED]** as a client-side calculation over mock targets.

---

## B

**BDT — Bangladeshi Taka (৳)**
The firm's base currency. Formatted with the `৳` glyph and Indian-style digit grouping (lakh/crore). The `bdt()` formatter compacts large numbers: ৳ ≥ 1 crore → "Cr", ≥ 1 lakh → "L", ≥ 1 thousand → "k".

**Backend**
A server-side layer (API + database + business logic) that would store data, authenticate users and run real computation. **The prototype has none.** Any feature that writes, saves, authenticates or persists is tagged **[BACKEND]**.

**Badge**
A small status pill (e.g. a health band, an approval status, "MVP", "Needs approval"). Most badges are **visual-only** indicators driven by data; a few sit inside interactive links.

**Blocking (approval)**
A flag meaning an authority approval is holding up downstream delivery phases. A blocking, overdue approval can trigger the Critical Banner on the Approvals page and caps a project's health score. **[MOCK]**.

---

## C

**CAAB — Civil Aviation Authority of Bangladesh**
The authority that issues height/clearance approvals (relevant where a building sits near flight paths). One of the listed `ApprovalAuthority` values; treated as a "No API · manual" source.

**Cadence**
How often a data source refreshes: `realtime`, `near_realtime`, `scheduled`, or `manual`. Displayed on Data Sources tiles and the source detail dialog. **[MOCK]**.

**Capture (Manual Capture)**
The act of logging high-value, no-API data — decisions, approval updates, scope changes, timesheets, site reports, promoted WhatsApp threads — directly into the project record on the `/capture` page. **[IMPLEMENTED]** as an interactive form with client-side validation and an inline success panel, but **it does not persist**: nothing is written to a store, and the captured item never appears in the recent-captures feed. Real saving is **[BACKEND]**.

**Command Palette**
The Ctrl/Cmd+K overlay for searching and jumping to projects, pages and people, or asking the AI. **[IMPLEMENTED]** (client-side keyboard navigation, fuzzy substring filter, synthetic "Ask AI" and "Search everywhere" items). State resets on close.

**Completeness — see Data completeness.**

**Confidence level**
A four-step honesty rating attached to metrics, alerts, AI answers and report blocks: **High** (4 bars, sage), **Medium** (3 bars, ochre), **Low** (2 bars, sienna), **Insufficient** (0 bars, "No data"). Rendered by the `ConfidenceBadge` / `ConfidenceMeter` components. It signals how much the underlying records support the number — not optimism about the outcome. **[IMPLEMENTED]** as a visual component over mock confidence values.

**CP — Construction Permit**
The RAJUK permit (e.g. "Form 301") authorising construction to begin. Used as the flagship blocking-approval example throughout the app. See **RAJUK**, **LUC**.

**Cross-reference (Project cross-reference / CrossRef)**
A recorded link between a project's canonical record and an *alias* it carries in an external source (e.g. a folder name on Drive, a ledger name in TallyPrime). Each cross-ref has `matched: true/false` and a confidence level. Unmatched aliases surface in the Data Quality matching queue and the Settings matching tab. **[MOCK]** — the "Confirm match" / "Re-match" controls are **visual-only**; real matching is **[BACKEND]**.

**Critical Banner**
The red, top-of-page callout on Authority Approvals that appears only when a blocking, overdue approval exists (preferring the RAJUK Form 301 case). **[MOCK]** (renders conditionally from mock data).

---

## D

**Data completeness**
A 0–100% measure of how much of the data behind a figure is actually present. Shown as a small fill bar (`DataCompleteness`: sage ≥ 75%, ochre ≥ 50%, sienna below). Distinct from confidence, though the two usually move together. **[IMPLEMENTED]** as a visual indicator; values are hardcoded or mock.

**Data Quality (page)**
The "trust backbone" at `/data-quality`: source freshness, completeness by domain (Money / Delivery / People / Approvals), and the unmatched-alias queue. **[MOCK]** for reads; "Confirm match" is **visual-only**.

**Data Source / Data Sources (page)**
A connector to a tool the firm already uses (accounting, file storage, communication, calendar, project management, time tracking, authority portals, manual capture). The `/data-sources` page lists 17 mock sources — 10 "connected/MVP" and 7 "available/pluggable". **[MOCK]** for status display; **Connect / Sync now / Disconnect / Auto-sync** are all **visual-only**, and live connectors are **[INTEGRATION]**.

**Deliverable**
A drawing or document in the register (Document Control), with discipline, status (`not_started`…`approved`/`revise`), revision number and a file reference. A high `revisionCount` (>3) flags rework risk. **[MOCK]**. File presence comes from Drive in production — **[INTEGRATION]**.

**DoE — Department of Environment**
The Bangladesh authority that issues environmental clearances. One of the `ApprovalAuthority` values; "No API · manual".

**DPDC / DESCO**
Dhaka's electricity distribution utilities (Dhaka Power Distribution Company; Dhaka Electric Supply Company). Listed as authority/utility approval bodies; capture-only in the prototype.

---

## E

**EAC — Estimate at Completion**
The forecast total cost of a project once finished. An industry-standard earned-value term. **[PLANNED]** — the prototype does **not** compute EAC; it shows a *fee-based* `forecastMargin` and explicitly labels it indicative, not true margin. A true EAC needs full labour cost, which depends on timesheet coverage that is currently incomplete.

**EmptyState**
The reusable "nothing here" panel (icon, title, optional description and action). Used on Pipeline, Goals, Calendar, Activity, Search, Data Quality matching, and elsewhere. **[IMPLEMENTED]** (presentational).

**ETL — Extract, Transform, Load**
The classic data-pipeline pattern of pulling data from sources, reshaping it, and loading it into a store. SPACE ESSE's production vision is ETL-like (read-only ingestion, normalisation, matching into a canonical model). **[PLANNED]/[BACKEND]** — the prototype simulates only the *read* step via `resolve()`; there is no real extract, transform or load.

---

## F

**Fee-based margin**
A margin computed as `(contracted fee − captured cost) ÷ contracted fee`. It is a **proxy**, not true margin, because captured cost is mostly labour and labour is under-captured while timesheet coverage is low (~64%). The Profitability page and several KPIs label this explicitly and keep its confidence low. **[IMPLEMENTED]** (client-side calc over mock data).

**Freshness**
How old a source's data is, in hours. Flagged on Data Quality as stale beyond 48 hours (rust), watch beyond 12 hours (ochre). **[MOCK]**.

**FSCD — Fire Service and Civil Defence**
The Bangladesh authority that approves fire-safety and refuge-floor provisions. A common blocker example (FSCD refuge-floor query). One of the `ApprovalAuthority` values; "No API · manual".

---

## H

**Health band / Health score**
A project's overall delivery-and-finance health, expressed as a band — **Healthy** (sage), **Watch** (ochre), **At risk** (sienna), **Critical** (rust) — and a numeric score (a `Metric` with confidence and provenance). In Settings, the score is a weighted blend (Budget 0.30, Schedule 0.25, Deliverable 0.20, Approval 0.15, Completeness 0.10) — the weights are **[IMPLEMENTED]** as editable inputs with a live "must total 1.00" check, but **Save is visual-only** and the model does not recompute.

---

## I

**Insufficient-data state**
The product's deliberate refusal to show a number it cannot justify. Surfaced three ways: the `InsufficientData` component (dashed box, "we show nothing rather than a fabricated number"), the KPI "— —" / "Insufficient data" rendering, and the Assistant's "No data" confidence badge. Examples: firm-wide spare capacity (blocked by low timesheet coverage), forecast margin on projects with no reliable cost data, and the Assistant's refusal to estimate new-project capacity. **[IMPLEMENTED]** — this is a real, first-class state in the UI, driven by null metric values and `confidence: "insufficient"`.

**Integration**
A live link to an external system. None are live in the prototype. Designed connectors (QuickBooks, Xero, Procore, SharePoint, Clockify, Dropbox, Autodesk Construction Cloud, plus the connected stack of Drive, Gmail, Calendar, TallyPrime, Trello, etc.) are **[INTEGRATION]**.

---

## K

**KPI — Key Performance Indicator**
A headline number shown in a `KpiCard`: a value, unit, confidence meter, optional delta vs. last period, optional sparkline, a data-completeness bar, and a "Why this number?" provenance popover. KPI values are either **computed client-side** from mock data (e.g. collection rate, aging) or **hardcoded `Metric` objects** in the page. **[MOCK]/[IMPLEMENTED]** — the cards render and the popovers work; the figures are not live.

---

## L

**LUC — Land Use Clearance**
The RAJUK clearance confirming a site's permitted land use, typically obtained before the construction permit. Part of the authority-approval chain alongside **CP**. Referenced generically as authority milestones; **[INTEGRATION]/[MOCK]**.

**Land Mutation**
The legal updating of land-ownership records (a `mutation`) with the local land office — a precondition for many approvals. Listed as an `ApprovalAuthority` value; capture-only.

---

## M

**Maker-checker**
A two-person control: one person (the *maker*) proposes a record or report, and another (the *checker*) approves it before it counts. This is the model behind the Review Queue, where captures, project matches, discrepancies and client-facing AI reports wait for human sign-off. **[IMPLEMENTED]** as **local state only** — approve/reject changes the on-screen status but does not persist; real sign-off is **[BACKEND]**.

**Manual capture — see Capture.**

**Metric**
The structured shape behind every honest number: `value` (nullable), unit, label, confidence, completeness, `asOf` date, optional delta, optional trend, an optional human-readable `formula` string, an optional note, and a list of provenance sources. The nullable value is what makes the **insufficient-data state** possible.

**Mock API / `resolve()`**
The simulated data transport. `resolve(data)` deep-clones mock data (via `JSON.parse(JSON.stringify(...))`) and returns it after ~280 ms of fake latency, so the UI behaves like it is fetching from a server. Consumed by TanStack Query hooks. **[MOCK]** — the comment in code notes it is meant to be swapped for real `fetch()` later. There are **no mutation hooks** anywhere (no write/POST/PATCH).

**MOM — Minutes of Meeting**
The written record of what was decided in a meeting. In SPACE ESSE this maps to a **Decision** record (summary, decided-by, date, channel such as `meeting`/`whatsapp`/`email`/`call`/`site`) that can be *promoted* (verified) into a citable record. **[MOCK]** for the feed; capture is **[IMPLEMENTED]** but non-persisting.

**Multi-tenant**
An architecture where one deployment securely serves many separate firms (tenants), each isolated from the others' data. **[PLANNED]/[BACKEND]** — the prototype is single, hardcoded to one firm ("SPACE ESSE"); no tenancy boundary exists.

**MVP — Minimum Viable Product**
Here, the badge on data sources that form the initial connected stack (Manual Capture, Google Drive, Gmail, Calendar, TallyPrime, Excel/CSV, AutoCAD-via-Drive, Trello, RAJUK ECPS, WhatsApp). Marks which connectors the first release would ship with. **[MOCK]** label.

---

## N

**NBR — National Board of Revenue**
Bangladesh's tax authority. Sets VAT (15%), governs VDS withholding and AIT/TDS, and defines the July–June fiscal year referenced in Settings.

**Net receivable**
The cash a firm should actually receive on an invoice after taxes and withholding: `grossFee + VAT − VDS − AIT`. This — not the gross fee — is what collection KPIs track. **[IMPLEMENTED]** (computed in the mock invoice factory).

---

## P

**Practice Intelligence**
The product itself: an AI reporting-and-analytics layer that sits on top of an architecture firm's existing tools, reads (never writes) from them, matches everything into one canonical project record, and answers questions with cited, confidence-rated facts. The subtitle "Practice intelligence" appears under the firm brand in the sidebar.

**Provenance**
The chain of evidence behind a number: which source, which record reference, when it was observed (and optionally ingested). Stored on every `Metric`, alert and decision, and surfaced in the **"Why this number?"** popover. **[IMPLEMENTED]** as a UI feature over mock provenance data.

**"Why this number?" popover (ProvenancePopover)**
The provenance-and-method popover triggered from a KPI's footer (Info icon). Shows the formula, completeness, confidence, the list of source records with dates, any note, and the "as of" date. **[IMPLEMENTED]** (Radix popover; reads mock metric data).

---

## R

**RAJUK — Rajdhani Unnayan Kartripakkha (Capital Development Authority)**
Dhaka's principal planning and building-control authority. It issues land-use clearances and construction permits (e.g. Form 301) via the **ECPS** portal. RAJUK approvals are the most prominent schedule drivers and blockers in the app. No public API — tracked manually. **[MOCK]/[INTEGRATION]**.

**RBAC — Role-Based Access Control**
Granting permissions by role (Owner/Principal, Project Director, Project Architect, Design Lead, Finance/Admin, Authority Liaison, Viewer). Settings shows role selectors and finance-access toggles, and prose states "Finance is restricted… visible only to Owner and Finance/Admin". **[BACKEND]** — the role selectors are **[IMPLEMENTED]** as client state, but they enforce nothing; there is no authentication and the finance-access toggle is visual-only. Real RBAC needs a backend.

**Recharts**
The charting library used for sparklines, area trends, bar series and donuts. Charts are presentational; the only interaction is hover tooltips.

**React Query (TanStack Query)**
The data-fetching/caching library that wraps every read hook (`useProjects`, `useInvoices`, etc.). It manages loading state and caching around the mock `resolve()` transport. **[IMPLEMENTED]** as the data layer; all queries are read-only.

**Review Queue**
The maker-checker workspace at `/review` where pending items are approved or rejected. See **Maker-checker**. **[IMPLEMENTED]** (local state, non-persisting).

**RFI — Request for Information**
A formal query raised during construction (typically from contractor to architect/consultant) asking for clarification on the design or documents. A standard project-management artefact. **[PLANNED]** in SPACE ESSE — RFIs are named as a *feed* the Procore connector would provide, but there is no RFI entity or screen in the prototype; it is **[INTEGRATION]**-dependent.

**RLS — Row-Level Security**
A database technique that restricts which *rows* a user can read or write, commonly used to enforce per-tenant or per-role isolation at the data layer. **[PLANNED]/[BACKEND]** — relevant to a future multi-tenant, RBAC-enforced backend; nothing in the prototype implements it.

---

## S

**Schedule variance**
How far a project is ahead of or behind plan, in days (negative = behind). Drives the "On-time projects" KPI and the delivery scorecard. **[IMPLEMENTED]** (client-side over mock data).

**Scheduled Report**
A configured AI report with a cadence (daily/weekly/monthly), recipients, channel (email/WhatsApp/in-app) and an active toggle, listed at `/schedules`. **[IMPLEMENTED]** only for the active toggle (local state); **Edit / New schedule** and actual delivery are **visual-only / [BACKEND]/[INTEGRATION]**.

**Semantic layer**
A unifying model that maps messy, source-specific data (different names, formats and IDs across Drive, TallyPrime, WhatsApp, etc.) into one consistent set of business concepts — projects, fees, approvals, decisions — so every screen and answer speaks the same language. SPACE ESSE's canonical project record plus its cross-references *are* this semantic layer in concept. **[MOCK]** — represented by the typed mock data model and `CrossRef` matching; building it from live sources is **[BACKEND]/[INTEGRATION]**.

**Sparkline**
A tiny inline trend line on a KPI card, shown only when a metric carries a `trend` array. Presentational.

**Submittal**
A construction-phase document (shop drawings, material/product data, samples) submitted by the contractor for the architect's review and approval. A standard delivery artefact. **[PLANNED]** — named as a feed the Procore connector would provide; no submittal entity or screen exists in the prototype. **[INTEGRATION]**-dependent.

---

## T

**TanStack Query — see React Query.**

**TDS — Tax Deducted at Source — see AIT.**

**Timesheet coverage**
The share of staff-weeks for which time has actually been logged (~64% firm-wide in the mock). It is the single gating figure for honest utilization, capacity and true-margin answers: where coverage is low, those numbers are forced to low confidence or "insufficient". People who do not log time read as "no time logged", never as idle. **[IMPLEMENTED]** as the gating logic (client-side over mock data).

**Topbar**
The sticky header: command/search trigger, language toggle, data-source-status popover, notifications, "Ask AI", and a user menu. The search trigger and Ask AI open overlays **[IMPLEMENTED]**; the language toggle flips only the EN/বাংলা label **[IMPLEMENTED, cosmetic]** (no actual translation); the user-menu buttons are **visual-only**.

**TypeScript**
The typed superset of JavaScript the whole app is written in. It defines every entity (Project, Invoice, Approval, Metric, etc.) and the union types (statuses, stages, confidence levels) that keep the data model honest.

---

## U

**Utilization**
A team member's billable load as a percentage of capacity. Healthy band 75–90%; above 90% is overloaded (burnout risk). Members without timesheets have a null value and are excluded from averages rather than counted as zero. **[IMPLEMENTED]** (client-side; gated on timesheet coverage).

---

## V

**VAT — Value Added Tax (15%, NBR)**
A 15% tax added to the gross fee on Bangladesh invoices: `vat = round(grossFee × 0.15)`. Part of the "billed never equals cash" model. See **VDS**.

**VDS — VAT Deducted at Source**
The portion of VAT that a corporate/government client withholds and remits directly, rather than paying to the firm. Modelled as **60% of the VAT figure** (≈ 9% of gross): `vdsWithheld = round(vat × 0.60)`. With AIT, this is why net receivable is well below the invoice's face value. **[IMPLEMENTED]** (mock invoice factory).

**Vite**
The build tool and dev server powering the app (with React, TypeScript, Tailwind v4, React Router). Fast local development and bundling; not a runtime service.

**Visual-only**
A control that is present and clickable (or rendered) but wired to no behaviour — e.g. Connect, Sync now, Disconnect, Export, Generate brief, Save (Settings), Edit/New schedule, Confirm match, and the user-menu buttons. Listed so QA and developers never mistake them for working features. Effectively **[BACKEND]** or **[INTEGRATION]** work pending.

---

## W

**WhatsApp (paste-only promotion)**
Because WhatsApp exposes no history API, threads are captured by paste/forward: the user pastes a thread on the Capture page and SPACE ESSE shows a low-confidence "extracted draft" (in the prototype this is simply the last pasted line, truncated — no real extraction) to be confirmed into a Decision. **[IMPLEMENTED]** as the paste UI (non-persisting); real ingestion is **[INTEGRATION]/[BACKEND]**.

**WIP — Work in Progress**
Earned-but-unbilled fee: value the firm has delivered (by percentage complete) that has not yet been invoiced. Shown as a Financials KPI; carries a medium/low confidence because percentage complete is partly manual. Computed as `Earned (by % complete) − billed`. **[IMPLEMENTED]** (client-side over mock data).

---

## Quick-reference: Bangladesh tax stack

Because money terms recur everywhere, here is the full "billed never equals cash" chain as the prototype models it on a ৳10.0 lakh gross fee:

| Step | Term | Rate / rule | Example |
|---|---|---|---|
| 1 | Gross fee | Contract value before tax | ৳10.0 L |
| 2 | + VAT | 15% of gross (NBR) | +৳1.5 L |
| 3 | − VDS | 60% of the VAT figure (client withholds) | −৳0.9 L |
| 4 | − AIT / TDS | ~10% of gross (client withholds) | −৳1.0 L |
| 5 | = Net receivable | What actually arrives as cash | ৳9.6 L |

This is **[IMPLEMENTED]** in the mock invoice factory and surfaced in the Financials withholding explainer and per-project financials.

---

## Quick-reference: status of major capability areas

| Capability | Status | Note |
|---|---|---|
| Navigation, palette, assistant panel, filters, tabs, toggles | **[IMPLEMENTED]** | Client-side only; resets on refresh |
| KPI computation & provenance popovers | **[IMPLEMENTED]/[MOCK]** | Real client-side math over mock data |
| Insufficient-data refusals & confidence meters | **[IMPLEMENTED]** | First-class UI state |
| Capture, Review approve/reject, Schedule toggles | **[IMPLEMENTED]** | **Not persisted** — no backend write |
| Authentication, RBAC enforcement, persistence | **[BACKEND]** | None present |
| Accounting, Drive, email, calendar, authority connectors | **[INTEGRATION]** | All sync/connect controls are visual-only |
| AI inference (real natural-language answers) | **[PLANNED]** | Answers are canned from a fixed map |
| EAC, RFI, submittal, multi-tenant, RLS, ETL | **[PLANNED]/[BACKEND]** | Conceptual; not built |

---

*This glossary reflects the inventoried prototype as of the documentation date. Where a production system would differ (real backend, live integrations, enforced security), the relevant entries say so explicitly so no reader mistakes a designed surface for a working one.*
