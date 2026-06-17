# System Overview & Business Objectives

> **SPACE ESSE · Practice Intelligence** — an AI reporting and analytics layer for an architecture practice in Dhaka, Bangladesh.

---

## Elevator pitch

SPACE ESSE · Practice Intelligence is a reporting and decision-support layer that sits *above* the tools an architecture firm already uses — accounting, file storage, email, calendars, project boards and the government authority portals — and turns their scattered records into one trustworthy view of money, delivery, people and pipeline. Its defining promise is honesty: every number cites the source record it came from, every figure carries a confidence level, and the system refuses to fabricate an answer when the underlying data is missing (it shows "Insufficient data" instead of a guess). It is purpose-built for the realities of a Dhaka practice — Bangladeshi tax withholding (VAT, VDS, AIT/TDS) baked into cash calculations, RAJUK/FSCD authority approvals that expose no API, and the hard truth that the most valuable data (decisions, approvals, scope changes, effort) is captured by hand. **What exists today is a high-fidelity, frontend-only interactive prototype: it demonstrates the entire experience and information architecture using mock data, with no backend, no database, no real integrations and no persistence.**

---

## 1. What this system is

Practice Intelligence is an **intelligence and reporting layer**, not a system of record. It is deliberately positioned *on top of* the firm's existing toolchain rather than replacing any of it.

| It IS | It is NOT |
|---|---|
| A read-only analytics & reporting layer | An ERP that runs the business |
| A place to *observe* money, delivery, people and pipeline in one view | A BIM/CAD authoring tool (AutoCAD, SketchUp, D5) |
| A trust layer that cites sources and confidence on every number | A project-management / task system (it reads from Trello, not replaces it) |
| A first-class home for *manually captured* decisions, approvals and effort | An accounting package (it reads from TallyPrime, not replaces it) |
| A narrative-generating briefing tool that refuses when data is missing | A document-management system (it observes Google Drive file presence) |

The design intent is captured in the source itself: the mock transport layer carries the comment *"Swap this for fetch() … later without touching components or hooks."* The frontend is built to be backend-ready, but the backend does not yet exist.

### 1.1 The "layer above the tools" model

The system reads from the tools a practice already pays for and trusts, reconciles their records into a single canonical project view, and never writes back. The read-only assurance is stated verbatim in the product: *"Read-only by design. Every connector requests least-privilege, read-only access. Your source systems remain the single source of truth — Space Esse only observes."*

```
   Existing tools (sources of truth)          Practice Intelligence (this system)
   ┌─────────────────────────────┐
   │ TallyPrime (accounting)     │
   │ Google Drive / AutoCAD      │──┐
   │ Gmail / WhatsApp            │  │   read-only      ┌───────────────────────────┐
   │ Google Calendar             │  ├──────────────►   │  Reconcile → cite → score │
   │ Trello                      │  │   (observe,      │  Money · Delivery ·       │
   │ RAJUK ECPS (manual portal)  │  │    never write)  │  People · Pipeline        │
   │ Manual Capture (in-app)     │──┘                  │  + AI briefings & alerts  │
   └─────────────────────────────┘                     └───────────────────────────┘
```

---

## 2. The business problem

A growing architecture practice generates enormous decision-relevant signal, but almost none of it is captured in a way that can answer simple, high-stakes questions: *Are we losing money on this project? What is genuinely overdue? Where are we stuck with the authorities? Can we take on more work? Who is overloaded?*

The data that would answer those questions is **uncaptured, scattered, and trapped in the wrong places**:

| Problem | How it shows up in a Dhaka practice |
|---|---|
| **The most valuable data has no API** | Decisions, approvals, scope changes and effort live in meetings, phone calls, WhatsApp threads and people's heads. |
| **Authorities are opaque, manual schedule drivers** | RAJUK, FSCD, CAAB, DoE and City Corporation expose no API; permit status is tracked by hand from portals and liaison notes. |
| **"Billed" never equals "cash"** | Corporate clients deduct VAT at source (VDS) and ~10% AIT/TDS before paying, so face-value invoices overstate real collections. |
| **Margin is unknowable without effort data** | True profitability needs labour cost, which needs timesheets — and timesheet coverage is partial across the team. |
| **Tools don't talk to each other** | Accounting, drawings, tasks and approvals each hold a fragment; nobody owns the joined-up picture. |
| **Numbers without provenance aren't trusted** | A dashboard figure with no source and no confidence level is easy to dismiss in a partner meeting. |

The result is that founders and partners make consequential calls — pricing, hiring, taking new work, chasing collections — on instinct and incomplete spreadsheets.

---

## 3. Business objectives

1. **Give the owner two answers a day, not a hundred dashboards.** Surface the few items that actually need a decision today (e.g. a 90-day receivable, an overdue permit) above the noise.
2. **Make every number defensible.** Attach a source record, an observation date and a confidence level to every figure so leadership can act on signal, not guesses. *(See the "Why this number?" provenance popovers — [IMPLEMENTED] as client-side popovers over mock provenance.)*
3. **Turn manual capture into a first-class data source.** Let anyone log a decision, approval, scope change or timesheet in under a minute, cited to them — closing the gap left by tools with no API.
4. **Model Bangladeshi finance honestly.** Compute cash net of VAT, VDS and AIT/TDS so collection and margin figures reflect real money. *(Tax math is [IMPLEMENTED] client-side over mock invoices.)*
5. **Track opaque authority approvals against statutory windows.** Make RAJUK/FSCD delays visible and tie them to downstream schedule risk.
6. **Refuse to fabricate.** When coverage is too low to answer confidently (e.g. firm-wide spare capacity at 64% timesheet coverage), say "Insufficient data" rather than show a number. *(The AI assistant and `InsufficientData` states do this today — [IMPLEMENTED] over canned/mock data.)*
7. **Keep an auditable trail.** Provide an append-only, provenance-stamped activity log and a maker–checker review gate before anything client-facing is sent.

---

## 4. The Money → Delivery → People → Pipeline priority

The product is deliberately ordered. The four intelligence domains are not equal — they are sequenced by how directly they protect the business and by how trustworthy their data is.

| # | Domain | Core question | Why this rank | Data confidence today | Primary routes |
|---|---|---|---|---|---|
| 1 | **Money** | Are we collecting real cash? | Cash is existential; accounting data is the most complete and most reconcilable. | High on collections; margin is fee-based proxy only | `/financials`, `/profitability` |
| 2 | **Delivery** | Are projects on track and unblocked? | Late delivery and stuck approvals destroy margin and client trust. | High on overdue counts; partly manual on schedule/deliverables | `/delivery`, `/approvals`, `/deliverables`, `/risks`, `/calendar` |
| 3 | **People** | Who is overloaded; do we have capacity? | Capacity decisions depend on effort data, which is the weakest domain. | Low — gated entirely on timesheet coverage (~64%) | `/resourcing` |
| 4 | **Pipeline** | What new work is coming? | Important but least-instrumented; lives in the owner's head and WhatsApp. | Lowest — manual estimates, too few closed deals to trust | `/pipeline`, `/goals`, `/clients` |

This ordering is reinforced everywhere in the product: the firm's own data-health framing names **"People — timesheets & effort"** as the weak domain (40% completeness, low confidence), and **Pipeline** is described in-product as *"the least-instrumented part of the practice."* The honesty is structural, not cosmetic — the further down this list a question sits, the more the system hedges or refuses.

---

## 5. What makes it distinctive

### 5.1 Trust and provenance as the core feature

Provenance is not a footnote; it is the product's reason to exist.

| Trust mechanism | What it does | Status |
|---|---|---|
| **"Why this number?" popover** | Reveals the formula, completeness bar, confidence badge, source records (name + reference + date) and notes behind any KPI. | [IMPLEMENTED] (client-side, over mock provenance) |
| **Confidence levels** | Every metric, alert, report block and AI answer carries High / Medium / Low / Insufficient, shown as a 4-bar meter. | [IMPLEMENTED] |
| **Source citations** | Alerts, AI answers and report blocks display source chips (e.g. "TallyPrime · INV-2026-019"). | [MOCK] (citations are authored in mock data) |
| **"Insufficient data" as a first-class state** | The system shows a refusal rather than a fabricated figure when coverage is too low. | [IMPLEMENTED] (renders from mock/canned data) |
| **Maker–checker review gate** | Captures, AI reports, matches and discrepancies pass a human sign-off before client delivery. | [IMPLEMENTED] as local state only — approve/reject mutates the on-screen list but **does not persist** ([BACKEND] to make durable) |
| **Append-only activity log** | A tamper-evident, provenance-stamped trail of every capture, sync, approval, report and match. | [MOCK] (renders 14 mock events; not actually append-only without a [BACKEND]) |

### 5.2 Manual capture as a first-class source

Most analytics tools treat hand-entered data as second-class. Here it is the headline. The Manual Capture screen (`/capture`) offers six fast capture types — Decision, Approval update, Scope change, Quick timesheet, Site report, and Promote WhatsApp — each cited to the person who logged it.

**Capture flow (Input → Validation → Processing → Approval → Storage → Reporting → Follow-up):**

| Stage | What happens today | Status |
|---|---|---|
| **Input** | User picks a capture type and fills variant-specific fields (project, summary, hours, etc.). | [IMPLEMENTED] (`useState` form) |
| **Validation** | A single `ready` gate enables the Capture button: project required, plus variant-specific minimums (timesheet needs member + hours; WhatsApp needs pasted text; others need a note). No per-field errors. | [IMPLEMENTED] (gate only) |
| **Processing** | WhatsApp "extracted draft" shows the last pasted line truncated to 120 chars — pure string slicing, **no real extraction**. | [MOCK] (cosmetic; real NLP extraction is [PLANNED]) |
| **Approval** | Captured items are meant to flow into the Review Queue for maker–checker promotion. | [BACKEND] (no link from capture into the queue today) |
| **Storage** | On submit, an inline success panel renders. **Nothing is saved**; the record does not appear in the recent-captures feed; a refresh discards it. | [BACKEND] (persistence required) |
| **Reporting** | A "Recent captures" feed reads existing mock decisions (not the just-captured item). | [MOCK] |
| **Follow-up** | Promotion to a verified/citable record. | [BACKEND] |

### 5.3 Built for Bangladesh

| Distinctive | Detail | Status |
|---|---|---|
| **Tax-accurate cash** | Invoices compute VAT (15%), VDS (60% of the VAT figure), and AIT/TDS (~10%); collection KPIs reflect net cash, not invoice face value. | [IMPLEMENTED] (client-side over mock invoices) |
| **Authority approvals tracker** | RAJUK, FSCD, CAAB, DoE, City Corporation tracked against each form's statutory decision window; overdue = days-in-stage beyond the legal window. "No API · manual" is shown explicitly. | [MOCK] reads / [INTEGRATION] for live status (no authority exposes an API) |
| **Bilingual touches** | Bangla appears in select mock fields (e.g. `project.nameBn`); a header language toggle flips the EN/বাংলা label. | Toggle is [IMPLEMENTED] but **label-only** — the UI is **not** translated ([PLANNED] for real localization) |
| **Data residency framing** | Settings reference PDPO 2025, a Singapore/Mumbai hosting choice and a "Bangladesh local mirror" toggle. | [BACKEND]/[PLANNED] (toggles are visual-only or local-state with no effect) |

---

## 6. The high-fidelity-prototype reality

**This is the single most important thing for every reader to understand.** Practice Intelligence today is a **frontend-only, high-fidelity interactive prototype**. It looks and behaves like a finished product across 24 routes, but it is powered entirely by mock data and client-side state.

### 6.1 The technical reality in one table

| Concern | Reality today | Implication |
|---|---|---|
| **Stack** | Vite + React + TypeScript + Tailwind v4, React Router, TanStack Query, Recharts, Radix UI. | Modern, production-grade frontend foundation. |
| **Data source** | All data is mock (`src/lib/mock/{data,ops,insights,integrations}.ts`). | No real records anywhere. |
| **Transport** | A `resolve()` helper deep-clones mock data and resolves after ~280 ms simulated latency, consumed by React Query hooks. | Loading states feel real; the network is fake. |
| **Backend / database** | None. | Nothing is stored or retrieved from a server. |
| **Authentication** | None. The user menu ("Sign out", "Switch role view") has no handlers. | No real users, roles or permissions. |
| **Persistence** | None. All interaction is in-memory; **a refresh resets everything.** | Captures, approvals, toggles do not survive reload. |
| **AI inference** | None. The assistant returns answers from a fixed map (including a deliberate "insufficient data" refusal) after a 650 ms delay. | No model is running; answers are authored, not generated. |
| **Integrations** | None. Connect / Sync now / Disconnect are visual-only. | No third-party data flows in. |

### 6.2 What is genuinely interactive vs. what only looks live

Use the status legend below throughout this documentation set.

| Tag | Meaning |
|---|---|
| **[IMPLEMENTED]** | Interactive and working in the frontend (client-side only). |
| **[MOCK]** | Renders from mock data; the underlying read/sync/calc is simulated, not live. |
| **[BACKEND]** | Designed in the UI but needs an API / database / persistence to function. |
| **[INTEGRATION]** | Needs a third-party connector (accounting, Drive, email, etc.) to function. |
| **[PLANNED] / [RECOMMENDED]** | Not built; a future enhancement. |

**Genuinely interactive (client state, not persisted):**

- Command palette — Ctrl/Cmd+K [IMPLEMENTED]
- AI assistant panel — Ctrl/Cmd+J, canned answers incl. an "insufficient data" refusal [IMPLEMENTED]
- Capture forms — `useState` + inline success, **not saved** [IMPLEMENTED] (UI) / [BACKEND] (saving)
- Review queue approve/reject — local state only [IMPLEMENTED] (UI) / [BACKEND] (persistence)
- Schedules active toggle — local state only [IMPLEMENTED] (UI) / [BACKEND] (persistence)
- Filters, search, sort, tabs, grid/table toggles [IMPLEMENTED]
- "Why this number?" provenance popovers, dialogs [IMPLEMENTED]
- Sidebar group collapse/expand [IMPLEMENTED]
- Language toggle — flips the EN/বাংলা **label only**, does not translate the UI [IMPLEMENTED] (cosmetic)
- Settings: base-currency select, per-user role select, KPI health-score weight inputs (with live Σ and balance gating), "Bangladesh local mirror" toggle [IMPLEMENTED] (state only)

**Visual-only / non-functional controls (no effect):**

- Connect / Sync now / Disconnect / Auto-sync (Data Sources) — [INTEGRATION]
- Confirm match (Data Quality, Settings) — [BACKEND]
- Edit / New schedule (Schedules) — [BACKEND]
- Export, Generate brief, Regenerate, New report (AI Reports, Financials, Dashboard) — [BACKEND]
- Save profile / Save thresholds / Invite member / View data map (Settings) — [BACKEND]
- "Approve & send" beyond its local-state effect — [BACKEND]/[INTEGRATION]
- User-menu buttons, sidebar "Firm data health 68%" footer (hardcoded) — [BACKEND]
- Dashboard header buttons ("This week", "Generate brief") — [BACKEND]

### 6.3 What this means for each reader

| Reader | What to take from the prototype | What NOT to assume |
|---|---|---|
| **Founders / Partners** | Validate that the *questions answered* and the *Money→Delivery→People→Pipeline* priority match how you run the firm. | That any number is live, or that capture/approvals are being saved. |
| **Investors** | The full product vision, IA and trust model are demonstrable end-to-end. | That there is a working backend, real AI, or paying-grade integrations yet. |
| **Architects / PMs** | The day-to-day screens (capture, approvals, deliverables, calendar) reflect real workflows. | That entering data here records anything; it does not persist. |
| **Developers** | A clean, hook-based read model (`api.ts` `resolve()`) is the seam to swap mock for `fetch()`. All KPI formulas are explicit. | That mutations exist — there are **no** `useMutation`/write paths anywhere. |
| **QA** | Loading, empty and "insufficient data" states are present and testable on many pages. | That error/failure states exist — there is **no** error-boundary or failure UI anywhere. |

---

## 7. How numbers are produced today

Even though the data is mock, the computation is real and deterministic — which is what makes the trust story credible.

| KPI family | How the value is produced | Status |
|---|---|---|
| Portfolio money (collected, billed, collection rate, overdue, WIP, pipeline-weighted) | Computed client-side in `api.ts` (`computePortfolio`) from mock projects/invoices/opportunities. | [IMPLEMENTED] over [MOCK] data |
| Invoice aging buckets (Current, 1–30, 31–60, 61–90, 90+) | `agingBuckets()` sums net receivable by `agingDays`. | [IMPLEMENTED] over [MOCK] |
| Pipeline by stage | `pipelineByStage()` counts and sums estimated fee per stage. | [IMPLEMENTED] over [MOCK] |
| Utilization & coverage | `utilizationSummary()` averages utilization over staff who log time and derives confidence from coverage. | [IMPLEMENTED] over [MOCK] |
| Bangladeshi tax (VAT/VDS/AIT) | `inv()` factory computes per-invoice withholding and net receivable. | [IMPLEMENTED] over [MOCK] |
| Many dashboard/page KPIs | Hardcoded `Metric` objects, each carrying a verbatim `formula` string surfaced in "Why this number?". | [MOCK] (values and provenance are authored literals) |

> **Anchor date:** the entire prototype treats **17 June 2026** as "today" (hardcoded in `format.ts` and the mock data), so aging, overdue and "days from now" calculations are stable and reproducible.

---

## 8. Expected business value & decision benefits

| Benefit | How Practice Intelligence delivers it | Realized when |
|---|---|---|
| **Faster, defensible decisions** | One executive view of cash, delivery, people and pipeline, each figure traceable to its source. | Demonstrable now (prototype); trustworthy once [BACKEND] + [INTEGRATION] land. |
| **Protected cash** | Collections shown net of VAT/VDS/AIT; overdue receivables and aging surfaced with statutory context. | Now (mock math is correct); live once accounting [INTEGRATION] connects. |
| **Fewer authority surprises** | Permits tracked against statutory windows; blocking permits flagged as critical. | Now (mock); live status needs manual capture or [INTEGRATION]. |
| **Honest capacity & margin** | Refuses to estimate firm capacity or true margin until timesheet coverage is adequate — preventing bad hiring/pricing calls on false precision. | Now (refusal logic works); accurate once capture persists ([BACKEND]). |
| **Captured institutional memory** | Decisions, approvals and scope changes logged in under a minute, cited to a person. | UI now; durable memory once capture is saved ([BACKEND]). |
| **Audit & governance** | Maker–checker review before client-facing delivery; append-only activity trail. | UI now; enforceable once persistence + roles exist ([BACKEND]). |
| **Lower tool-switching cost** | A single layer over existing tools; no rip-and-replace of accounting, BIM or PM systems. | By design; depends on [INTEGRATION] breadth. |

### 8.1 The decisions it is built to support

- *Which projects are losing money, and why?* — Profitability, fee-based margin with explicit low-confidence caveats.
- *What cash is genuinely at risk right now?* — Financials, net-of-tax overdue receivables.
- *Where are we blocked by authorities?* — Approvals, statutory-window overruns.
- *Can we take on new work next month?* — Resourcing, which **refuses** to answer at current coverage.
- *Who is overloaded?* — Resourcing, with named, time-bounded, coverage-qualified signals.
- *What's in the pipeline, and how much should we trust it?* — Pipeline, weighted but flagged as the owner's judgement, not a model.

---

## 9. Scope boundaries (what it intentionally does not do)

- It **does not write back** to any source system — read-only by design.
- It **does not replace** accounting, BIM/CAD, document management or project-management tools.
- It **does not auto-send** client-facing reports — they pass through human review.
- It **does not invent numbers** — when records are insufficient, it says so by name and section.
- In its current prototype form it **does not store, authenticate, integrate, or run AI inference** — those are the next build phases ([BACKEND], [INTEGRATION], real AI [PLANNED]).

---

*This document describes the system as inventoried from the actual frontend codebase. Every capability is tagged with its real status. Where a control looks functional but is not wired to persistence, integration or inference, it is labelled accordingly so that founders, partners, investors, developers and QA share one accurate understanding of what exists today versus what is designed for tomorrow.*
