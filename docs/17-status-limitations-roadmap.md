# Feature Status, Limitations & Implementation Roadmap

> **SPACE ESSE · Practice Intelligence** — the decision-ready map of what works today, what is only shown, and what must be built next.

This document is the single authoritative status reference for the product. It exists because the system is a **high-fidelity, frontend-only interactive prototype**: it demonstrates the entire experience, information architecture and trust model using mock data, with **no backend, no database, no real authentication, no persistence, no real integrations and no AI inference**. Every read passes through a simulated transport (`src/lib/api.ts → resolve()`, a deep-clone resolving after ~280 ms); every "save", "approve", "sync" or "connect" either changes local React state only (and resets on refresh) or does nothing at all.

The purpose here is to let founders, partners, PMs, developers, investors and QA see — at a glance and in detail — exactly where the line sits between *demonstrated* and *functional*, and to lay out a sequenced path from prototype to product.

---

## Status legend

Every feature below is tagged with exactly one status.

| Tag | Meaning |
|---|---|
| `[IMPLEMENTED]` | Interactive and genuinely working in the frontend — **client-side only**. State is real but ephemeral (lost on refresh). |
| `[MOCK]` | Renders from mock data. The underlying read / sync / calculation is **simulated**, not live. |
| `[BACKEND]` | Designed in the UI but needs an API, database or persistence layer to actually function. |
| `[INTEGRATION]` | Designed in the UI but needs a third-party connector (accounting, Drive, email, authority portal, etc.) to function. |
| `[PLANNED]` / `[RECOMMENDED]` | Not built; a future enhancement or sequencing recommendation. |

A single feature can carry two tags when its layers differ — e.g. a list that **renders** from mock data `[MOCK]` but whose **action button** needs persistence `[BACKEND]`. Where that happens it is stated explicitly.

---

## A. Master feature status matrix

The matrix is organised by the product's own navigation groups, plus the global shell and the cross-cutting trust system. Routes are the 24 defined in `App.tsx`.

### A.0 Global shell, navigation & trust primitives

| Module / feature | Status | Notes |
|---|---|---|
| Routing (24 routes + `*` redirect), lazy-loading, Suspense loader | `[IMPLEMENTED]` | React Router; three-dot pulse fallback. |
| Per-route `document.title` | `[IMPLEMENTED]` | `useEffect` on pathname; detail routes fall back to firm name. |
| Sidebar nav, group collapse / auto-expand, alert dots | `[IMPLEMENTED]` | Client state; active-group detection by path. |
| Sidebar "Firm data health 68%" footer | `[MOCK]` | Hardcoded literal `68%` and bar width — not data-driven. |
| Command palette (`Ctrl/Cmd+K`): search, keyboard nav, navigate, Ask-AI/Search synthetic items | `[IMPLEMENTED]` | Reads mock projects + nav; navigation is real. |
| Topbar search trigger | `[IMPLEMENTED]` | Opens palette only — not a text input. |
| Language toggle (EN ↔ বাংলা) | `[IMPLEMENTED]` *(cosmetic)* | Flips the **label only**; no i18n applied. App is **not localized**. `[BACKEND]`/`[PLANNED]` for real translation. |
| Data-source status pill + popover | `[MOCK]` | Reads `useDataSources()` mock; counts live/stale. |
| Notifications bell + popover (unread count, 6 alerts) | `[MOCK]` | Reads `useAlerts()` mock; `acknowledged` never mutated. |
| User menu (Profile / Switch role / Sign out) | `[BACKEND]` | All three buttons have **no handlers**. Identity is hardcoded "Tahmid Karim". |
| AI assistant panel (`Ctrl/Cmd+J`): thread, thinking state, suggestions | `[IMPLEMENTED]` *(canned)* | UI and conversation state are real; **answers are not** — see A.6. |
| Provenance "Why this number?" popover | `[IMPLEMENTED]` | Radix popover; renders formula, completeness, confidence, sources from the metric object. |
| Confidence meter / badge, data-completeness bar | `[IMPLEMENTED]` *(presentational)* | Faithfully renders stored confidence/completeness values. |
| "Insufficient data" refusal states | `[IMPLEMENTED]` *(presentational)* | Honest non-fabrication is real UI; the decision of *when* to refuse is pre-authored in mock data. |

### A.1 Dashboard & Projects group

| Module / feature | Status | Notes |
|---|---|---|
| **Dashboard** (`/`) layout, KPI cards, charts, watchlist | `[MOCK]` | KPI values pull `portfolio?.*` (computed client-side from mock); cards are hardcoded `Metric` objects. |
| Dashboard header buttons "This week", "Generate brief" | `[BACKEND]` | Visual-only, no handlers. |
| Dashboard `moneyTrend` area chart, `kMargin = 18`, AI-brief confidence "medium" | `[MOCK]` | Hardcoded literals in-file. |
| **Delivery & Ops** (`/delivery`) KPIs, charts, scorecard | `[MOCK]` | KPIs derived live from mock arrays; chart captions partly hardcoded ("Bashati"). |
| **Portfolio** (`/portfolio`) summary, analytics, filters, grid/table | `[IMPLEMENTED]` + `[MOCK]` | Search / type / stage / health filters and grid↔table toggle are real client state; data is mock. |
| **Project Detail** (`/projects/:id`) header, phase stepper, KPI strip, 7 tabs | `[IMPLEMENTED]` + `[MOCK]` | Tab switching and provenance popover are real; phase stepper and header buttons (Capture / Weekly report / Ask) are visual-only `[BACKEND]`. |
| **Authority Approvals** (`/approvals`) tracker, group-by, critical banner | `[IMPLEMENTED]` + `[MOCK]` | Group-by select is real; overdue-vs-statutory logic computed from mock. |
| Approvals "Open ECPS", "Ask liaison" buttons | `[INTEGRATION]` / `[BACKEND]` | Visual-only. RAJUK ECPS has no API. |
| **Document Control** (`/deliverables`) register, charts, churn watchlist | `[IMPLEMENTED]` + `[MOCK]` | Search + 3 selects are real; "Open review" button visual-only `[BACKEND]`. File presence is `[INTEGRATION]` (Google Drive). |
| **Risks & Issues** (`/risks`) matrix, category panel, register, anomalies | `[IMPLEMENTED]` + `[MOCK]` | Matrix-cell click, category buttons, status/category selects are real filters; AI anomalies are `[MOCK]` (no real detection). |
| **Calendar** (`/calendar`) month grid, agenda, month nav | `[IMPLEMENTED]` + `[MOCK]` | Prev/Today/Next navigation is real client state; events from mock. |

### A.2 Finance group

| Module / feature | Status | Notes |
|---|---|---|
| **Financials** (`/financials`) KPIs, aging, invoice ledger | `[MOCK]` | `computePortfolio` / `agingBuckets` computed client-side from mock invoices. |
| Invoice status filter | `[IMPLEMENTED]` | Real client-state select. |
| `moneyTrend` cash-flow chart, BD tax explainer chips | `[MOCK]` | Hardcoded literals, not derived. |
| Financials "Export" button | `[BACKEND]` | Visual-only. |
| **Profitability** (`/profitability`) KPIs, honest-margin callout, charts, table | `[MOCK]` | Margin figures computed from mock; `TIMESHEET_COVERAGE` map is hardcoded. |
| Profitability stage filter | `[IMPLEMENTED]` | Real client-state select. |
| Profitability "Export" button | `[BACKEND]` | Visual-only. |
| Invoice tax model (VAT 15%, VDS 60% of VAT, AIT ~10%) | `[MOCK]` | Computed in the `inv()` factory at data-author time; correct arithmetic, fixed inputs. |

### A.3 Clients & Growth group

| Module / feature | Status | Notes |
|---|---|---|
| **Clients** (`/clients`) KPIs, charts, table | `[IMPLEMENTED]` + `[MOCK]` | Search is real; sort fixed by lifetime fee. |
| **Client Detail** (`/clients/:id`) header, contacts, projects, invoices | `[MOCK]` | Synchronous mock reads (no hook → no loading state). |
| Client contact `mailto:` / `tel:` links | `[IMPLEMENTED]` | Real anchor hrefs. |
| **Pipeline** (`/pipeline`) KPIs, kanban board, weighted chart, table | `[MOCK]` | `pipelineByStage` computed from mock; board is static layout (no drag-drop). |
| Pipeline owner filter | `[IMPLEMENTED]` | Real client-state select (filters board + table). |
| **Goals & Targets** (`/goals`) KPIs, firm/project goals, attainment chart | `[MOCK]` | Attainment computed from mock targets; no filters/sorts. |

### A.4 People group

| Module / feature | Status | Notes |
|---|---|---|
| **Resourcing** (`/resourcing`) KPIs, utilization chart, load split, team table | `[MOCK]` | `utilizationSummary` computed from mock; honest null-handling ("No time logged") is real presentation. |
| Spare-capacity KPI forced to "Insufficient data" | `[IMPLEMENTED]` *(presentational)* | Deliberate refusal driven by mock coverage. |
| Resourcing "Set up time capture" (callout button) | `[BACKEND]` | Visual-only. |
| Resourcing "Set up time capture" / "Improve coverage" (header + footer links) | `[IMPLEMENTED]` | Real navigation to `/capture`. |

### A.5 Data & Setup group

| Module / feature | Status | Notes |
|---|---|---|
| **Manual Capture** (`/capture`) 6 capture types, per-variant forms, `ready` gate | `[IMPLEMENTED]` *(does not persist)* | Type selection, form state, validation gate, inline success are all real client state. **Nothing is saved.** |
| Capture submit / success panel | `[BACKEND]` | No write to any store/API; recent-captures feed does **not** update. |
| Capture KPI row (18 captures, 64% coverage, etc.) | `[MOCK]` | Hardcoded literals. |
| WhatsApp "extracted draft" preview | `[MOCK]` | Last pasted line sliced to 120 chars — **no NLP/extraction**. |
| Recent captures feed | `[MOCK]` | Reads `useDecisions()`; static. |
| **Activity Log** (`/activity`) timeline, KPIs, type filter, search | `[IMPLEMENTED]` + `[MOCK]` | Filter + search are real; timeline is append-only **in narrative only** — never actually appended. |
| **Data Sources** (`/data-sources`) summary, tiles, detail dialog | `[IMPLEMENTED]` + `[MOCK]` | Category filter + tile→dialog are real client state; 17-source catalog is mock. |
| Connect / Sync now / Disconnect / Auto-sync / Add a source | `[INTEGRATION]` / `[BACKEND]` | All visual-only — no handlers, no effect. |
| **Data Quality** (`/data-quality`) KPIs, freshness table, domains, matching queue | `[MOCK]` | Completeness/freshness/match counts derived or static; freshness is not live timing. |
| "Confirm match" button | `[BACKEND]` | Visual-only. |
| **Settings** (`/settings`) 5 tabs | partial | See A.7. |

### A.6 Intelligence group

| Module / feature | Status | Notes |
|---|---|---|
| **AI Reports** (`/reports`) library, reader, citations, blocks | `[IMPLEMENTED]` + `[MOCK]` | Report selection is real client state; 3 reports + narrative + citations are pre-authored mock. |
| AI Reports "New report" / "Approve & send" / "Regenerate" / "Export" | `[BACKEND]` | All visual-only, no handlers. Narrative is **not generated** — it is authored mock. |
| AI assistant canned answers (5 questions + generic refusal) | `[MOCK]` | Fixed `ANSWERS` map; 650 ms timeout; **no inference, no retrieval, no live computation**. |
| AI assistant free-text questions | `[MOCK]` | Any unmatched question returns the hardcoded "insufficient data" refusal. |
| **Review Queue** (`/review`) maker-checker, tabs, kind filter, approve/reject | `[IMPLEMENTED]` *(local only)* | Seeds a local mutable copy of mock; approve/reject mutate **local state only** — no backend write. |
| Review "Approve & send" beyond local effect (actual sending) | `[BACKEND]` + `[INTEGRATION]` | No email/delivery occurs. |
| **Scheduled Reports** (`/schedules`) table, active toggles | `[IMPLEMENTED]` *(local only)* | Active switches change local state (reset on refresh); do not write to mock. |
| Schedules "New schedule" / "Edit" buttons | `[BACKEND]` | Visual-only. |
| Actual scheduled delivery (cron, email/WhatsApp/in-app dispatch) | `[BACKEND]` + `[INTEGRATION]` | None exists. |
| **Search** (`/search`) cross-dataset index, URL query state | `[IMPLEMENTED]` + `[MOCK]` | `?q=` URL state and live substring match across 6 mock datasets are real; "index" is client-side filtering. |

### A.7 Settings tabs (detail)

| Setting | Status | Notes |
|---|---|---|
| Tab switching (Firm / Users / Matching / KPIs / Locale) | `[IMPLEMENTED]` | Real client state. |
| Firm profile inputs (name, legal, office, established) | `[BACKEND]` | Uncontrolled `defaultValue`; "Save profile" visual-only. |
| Base currency select | `[IMPLEMENTED]` *(local)* | Real client state; not persisted. |
| Fiscal year / Timezone selects | `[BACKEND]` | Visual-only (no `onValueChange`). |
| Users & roles — Role select | `[IMPLEMENTED]` *(local)* | Real client state; not persisted. `[BACKEND]` for real RBAC. |
| Users & roles — Finance-access switch, "Invite member" | `[BACKEND]` | Visual-only; label does not react to the switch. |
| Project matching — "Re-match" / "Confirm" | `[BACKEND]` | Visual-only. |
| KPIs & thresholds — health-score weight inputs + live Σ + balanced gating | `[IMPLEMENTED]` *(local)* | Weight inputs, live sum, and the `disabled` state of Save are genuinely reactive. |
| KPIs & thresholds — threshold inputs + "Save thresholds" action | `[BACKEND]` | Inputs uncontrolled; save action visual-only (disabled gating is real). |
| Localization — interface language / Bangla typesetting | `[BACKEND]` / `[PLANNED]` | Select visual-only; no i18n engine. |
| Data residency — hosting region select, "View data map" | `[BACKEND]` | Visual-only. |
| Data residency — "Bangladesh local mirror" switch | `[IMPLEMENTED]` *(local)* | Toggles state but drives no other UI. |

### A.8 Status roll-up

| Status | Approx. count of distinct capabilities | Character |
|---|---|---|
| `[IMPLEMENTED]` (client-side, ephemeral) | ~25 | Navigation, filters/search/sort/tabs, palette, assistant *shell*, capture *form*, review/schedule *local* toggles, KPI weight maths, provenance popovers. |
| `[MOCK]` | ~30 | Every data read, every KPI value, all charts, all catalogs, canned AI answers, freshness/health, activity trail. |
| `[BACKEND]` | ~20 | All Save/Connect/Confirm/Export/Generate/Edit/Invite actions; capture & review persistence; identity. |
| `[INTEGRATION]` | ~17 sources + dispatch | All connectors (Google Workspace, TallyPrime, Trello, RAJUK ECPS, QuickBooks, Xero, M365, ACC, Procore, Clockify, Dropbox) and report delivery. |
| `[PLANNED]` / `[RECOMMENDED]` | full | Real AI inference, real localization, multi-tenancy, audit immutability. |

---

## B. Current frontend limitations

These are characteristics of the prototype as built — not defects. They define what a buyer, investor or new developer must understand before treating any output as operational.

### B.1 No persistence — all state is ephemeral

There is **no backend, no database, and no local persistence** (no `localStorage`, no IndexedDB, no cookies driving data). The transport is `resolve()`, which deep-clones a mock module and resolves after a fixed 280 ms. Consequences:

- A **refresh resets everything.** Capture entries, review approvals/rejections, schedule toggles, role selections, KPI weights, the currency setting and the data-residency mirror toggle all return to their mock defaults.
- The **Recent captures feed never grows** — submitting the capture form shows an inline success panel but writes nothing.
- The **Activity Log is "append-only" in copy only** — no event is ever appended.
- React Query hooks return a **fresh deep copy** each time, so even within a session there is no single mutable store the UI writes back to.

### B.2 No authentication or authorisation

There is no login, no session, no token, no real role enforcement.

- The identity is **hardcoded** ("Tahmid Karim · Owner / Principal"); the user menu's Profile / Switch-role / Sign-out buttons have no handlers.
- The Settings → Users role select and finance-access switches change **local state only** and enforce nothing. The "Finance is restricted" notice is descriptive, not operative — every page is reachable by anyone running the app.

### B.3 Minimal validation

The only validation in the product is the Manual Capture `ready` gate (project required, plus the variant's key field). There are **no per-field error messages, no required-field markers, no format/range/business-rule checks, and no server-side validation** anywhere. KPI weight inputs compute a live sum and gate a (visual-only) Save button — the closest thing to a real rule — but nothing is saved.

### B.4 No real integrations

All 17 data sources are catalog entries in `mock/integrations.ts`. There is **no OAuth, no API call, no webhook, no file-watch, no email ingest, no CSV/ODBC import**. Connect / Sync now / Disconnect / Auto-sync / Add-a-source are visual-only. Freshness, health, "last sync" and record counts are static fields, not live measurements. Authority portals (RAJUK ECPS, FSCD, etc.) expose no API by nature and are represented as manual sources.

### B.5 No real AI

The "AI" is entirely scripted:

- The **assistant** answers from a fixed `ANSWERS` map keyed on the exact suggested questions; any other input returns a hardcoded "insufficient data" refusal after a 650 ms cosmetic delay. No model, no retrieval, no live computation.
- **AI Reports** are 3 pre-authored documents with pre-written narrative and citations. "Generate brief", "New report", "Regenerate" do nothing.
- **AI-detected anomalies** on the Risks page are simply mock alerts; there is no detection engine.
- The honest trust posture (cited answers, confidence levels, refusal-over-fabrication) is **real as a UX pattern** but the *decisions* it expresses are baked into the data, not produced by reasoning.

### B.6 No localization

Despite a Bangla language toggle and Bangla-aware typography, the app is **not localized**. The toggle flips only the EN/বাংলা label on the button. Bangla appears solely in a few mock fields (e.g. `project.nameBn`). There is no i18n catalogue, no string externalisation and no runtime translation.

### B.7 Visual-only controls (the action gap)

A large set of buttons render and look operational but have **no effect**: header actions ("This week", "Generate brief", "Weekly report", "Ask about this project", "Ask about captures", "Ask liaison", "Open ECPS"); every "Export"; all Settings "Save"/"Invite"; Data Sources "Connect/Sync/Disconnect/Add"; Data Quality / Matching "Confirm/Re-match"; AI Reports "Approve & send / Regenerate / New report"; Schedules "New schedule / Edit"; Deliverables "Open review"; and the user-menu items. QA should treat any such control as **non-functional by design** until its backing service exists.

### B.8 No loading/error robustness across the board

Loading skeletons exist on some pages (Dashboard, Delivery, Profitability/Resourcing KPI rows, Goals, Clients, Calendar, Review, Activity, Search, Approvals, Risks, Deliverables) but **not** on others (Financials, Pipeline, Client Detail, and the four Data-&-Setup pages). There is **no error-state UI or error boundary anywhere** — a real network/transport failure would have no designed handling. Empty states are present in select places but inconsistent (e.g. notifications popover has none).

---

## C. Future development requirements

What must be built to make the demonstrated experience real, grouped by concern. Each group lists the concrete work the inventory implies.

### C.1 Backend & database `[BACKEND]`

The foundational unlock. The codebase is explicitly built for it — `api.ts` carries the comment *"Swap this for fetch() … later without touching components or hooks."*

- **Replace `resolve(mock)` with a real API client** behind the same hook signatures (`useProjects`, `usePortfolio`, `useProjectBundle`, etc.) so components are untouched.
- **A persistent datastore** modelling the existing TypeScript entities: Project, Client, Employee, Invoice, Payment, Approval, Milestone, Task, Deliverable, Risk, Decision, Opportunity, Contact, Meeting, ActivityEvent, ScheduledReport, Target, ReviewItem, DataSource, Alert, AIReport — plus Provenance/CrossRef as first-class linked records.
- **Mutation endpoints (currently zero `useMutation` hooks exist):** create capture, promote/verify a record, approve/reject a review item, toggle a schedule, save settings, confirm a cross-reference match, acknowledge an alert.
- **Server-side KPI computation** mirroring the client formulas (`computePortfolio`, `agingBuckets`, `pipelineByStage`, `utilizationSummary`, `inv()` tax model) so figures are authoritative and cacheable, with provenance attached.
- **An immutable, append-only activity/audit store** to make the "tamper-evident audit trail of record" claim true (write-once events; corrections as new events).

### C.2 Authentication & RBAC `[BACKEND]`

- **Real authentication** (login, session/token, sign-out) replacing the hardcoded user.
- **Role model** matching the Settings UI: Owner/Principal, Project Director, Project Architect, Design Lead, Finance/Admin, Authority Liaison, Viewer.
- **Enforced finance restriction** — fees, invoices, payments and margin gated to Owner + Finance/Admin (and per-person exceptions), enforced server-side, not just hidden in the UI.
- **Maker-checker enforcement** — the Review Queue's approve/reject must be permission-bound and recorded against an authenticated identity.
- **"Switch role view"** support so partners can preview what each role sees.

### C.3 Validation `[BACKEND]`

- **Field-level validation** on every form (Capture variants, Settings inputs) with inline errors, required markers, and format/range rules (dates, hours, currency, weight sums).
- **Business-rule validation:** KPI weights must total 1.00 before save (already prototyped client-side); threshold sanity; duplicate-capture detection; project/authority consistency.
- **Server-side validation** as the source of truth, with the client mirroring rules for responsiveness.

### C.4 Integrations `[INTEGRATION]`

- **Google Workspace** (Drive, Calendar, Gmail metadata) — single OAuth provider covering files, deliverable presence, meetings and email signals.
- **Accounting** — QuickBooks/Xero API, or automate the TallyPrime export, to retire the deliberate `stale` finance state.
- **Time tracking** — Clockify (or equivalent) to lift timesheet coverage past the ~80% threshold the product repeatedly names as the unlock for trustworthy capacity and margin.
- **Project management** — Trello (and later Procore/ACC) for tasks, milestones, RFIs, submittals.
- **Authority portals** — keep RAJUK ECPS / FSCD / CAAB / DoE / City Corporation as **structured manual capture** (no APIs exist); invest in fast, well-cited liaison entry.
- **WhatsApp/communications** — paste/forward capture remains the model (no backfill API); add real extraction (see C.5).
- **Outbound delivery** — email / WhatsApp / in-app channels so scheduled and client-facing reports actually send.
- *(See `docs/12-integration-architecture.md` for the per-source connection intent and the detailed live-integration path.)*

### C.5 Real AI `[BACKEND]` + `[PLANNED]`

- **Retrieval over the canonical store** so the assistant answers any question (not just the 5 canned ones) from verified records.
- **Deterministic-number + generated-narrative split** — the product's core promise: compute every figure from data, let the model write only the prose around cited facts.
- **Genuine refusal logic** — refuse based on real completeness/confidence thresholds rather than a pre-set flag.
- **Real report generation** for the five formats (daily brief, weekly project, monthly company, risk summary, cash warning) with inline citations and confidence per block.
- **Real anomaly detection** feeding the Risks page and alerts.
- **WhatsApp/email NLP extraction** replacing the 120-char string slice with structured decision/approval/change extraction routed to Review.

### C.6 Persistence of interactions `[BACKEND]`

These are the `[IMPLEMENTED]`-but-ephemeral features that must persist to be useful:

- Capture submissions → stored, routed to Review, emitted as an Activity event.
- Review approve/reject → persisted with auditor identity and timestamp; promotion writes a citable record.
- Schedule active toggles, schedule create/edit → persisted.
- Settings (currency, roles, KPI weights, thresholds, residency mirror) → persisted per firm.
- Cross-reference match confirmations → persisted, converging multi-source data on canonical IDs.
- Alert acknowledgements → persisted.

### C.7 Localization `[PLANNED]`

- **i18n engine** with externalised strings and an EN/বাংলা catalogue, wired to the existing toggle.
- **Bangla typesetting pipeline** (Bijoy→Unicode normalisation, Nikosh/Hind Siliguri rendering) for captured and displayed Bangla content.
- **Locale-aware formatting** (already partially present via `bdt()` lakh/crore grouping and the Taka glyph).

---

## D. Recommended implementation phases

A sequenced path from prototype to multi-tenant product, mapped to the blueprint roadmap. Each phase is gated by the previous one and ordered by leverage: build the spine first, then the highest-value lowest-dependency source, then progressively richer signal and intelligence.

### Phase 1 — Foundation (backend spine) `[BACKEND]`

**Goal:** make data real and writable without touching components.

- Stand up the API and database; replace `resolve(mock)` with `fetch()` behind the existing hooks.
- Model all entities + provenance/cross-refs; seed from current mock so the UI looks identical on day one.
- Introduce the first `useMutation` paths and an append-only activity store.
- Add basic loading/error handling and an error boundary across all pages (closing the B.8 gap).

**Exit criteria:** every read comes from the database; at least one write path (capture) persists; refresh no longer resets data.

### Phase 2 — Capture + Finance `[BACKEND]`

**Goal:** the highest-value, lowest-dependency data becomes operational.

- **Wire Manual Capture end-to-end** — persist submissions, route unverified records to the Review Queue, emit Activity events, grow the Recent-captures feed. (No third party required; this is the single biggest usefulness jump.)
- **Persist Review Queue** maker-checker decisions with audit trail.
- **Add a live accounting feed** (QuickBooks/Xero or automated TallyPrime export) and move the BD tax model (VAT/VDS/AIT) server-side so collection and margin KPIs reflect real cash.
- Add field + business-rule validation to Capture and finance entry.

**Exit criteria:** decisions/approvals/scope/effort captured by hand are stored and citable; finance KPIs compute from a live or automated source.

### Phase 3 — Delivery + Approvals `[INTEGRATION]` + `[BACKEND]`

**Goal:** delivery signal flows in and authority tracking is rigorous.

- **Connect the Google Workspace stack** (Drive, Calendar, Gmail metadata) — one OAuth provider for files, deliverable presence, meetings and email signals.
- **Connect Trello** for tasks/milestones.
- **Connect Clockify** (or equivalent) to push timesheet coverage past ~80%, unlocking trustworthy capacity and margin.
- **Harden authority approvals** as structured manual capture with statutory-window tracking and the critical/blocking logic now prototyped.
- Implement **cross-reference matching + discrepancy reconciliation** so multi-source records converge on canonical projects.

**Exit criteria:** delivery, schedule and approval views are fed by live/connected sources; matching queue confirmations persist.

### Phase 4 — Real AI `[BACKEND]` + `[PLANNED]`

**Goal:** turn the scripted trust UX into genuine intelligence.

- Retrieval + deterministic-number / generated-narrative split over the canonical store.
- Real refusal logic gated on actual completeness/confidence.
- Real generation for the five report formats with per-block citations.
- Real anomaly detection feeding Risks and alerts.
- WhatsApp/email NLP extraction replacing the string-slice preview.

**Exit criteria:** the assistant answers arbitrary questions from verified records; reports generate on demand; refusals are earned, not pre-set.

### Phase 5 — Integrations breadth & delivery `[INTEGRATION]`

**Goal:** widen the source catalog and make reports actually ship.

- Activate the remaining `not_connected` connectors as demand dictates: QuickBooks/Xero, Microsoft 365/SharePoint, Autodesk Construction Cloud, Procore, Dropbox.
- Implement **outbound delivery** (email / WhatsApp / in-app) so scheduled and client-facing reports send — passing client-facing ones through Review sign-off first.
- Make Schedules create/edit/toggle fully persistent and cron-driven.

**Exit criteria:** reports schedule and deliver to internal and external recipients with maker-checker gating; the source catalog matches the firm's real toolchain.

### Phase 6 — Multi-tenant, auth, RBAC & compliance `[BACKEND]` + `[PLANNED]`

**Goal:** make it a product multiple firms can trust and buy.

- Full authentication, sessions, and enforced RBAC matching the Settings role model; enforce the finance restriction server-side; enable "Switch role view".
- **Multi-tenancy** — per-firm isolation of data, settings, KPI weights/thresholds and connectors.
- **Real localization** (EN/বাংলা i18n + Bangla typesetting).
- **Data residency & compliance** — operationalise the hosting-region and Bangladesh-mirror controls, PDPO 2025 alignment, and data-minimisation guarantees.
- Immutable audit trail certified as the firm's record.

**Exit criteria:** multiple firms run isolated instances with enforced permissions, localised UI, and compliant data handling.

---

### Phase-to-status crosswalk

| Phase | Primarily resolves | Turns into `[IMPLEMENTED]` (live) |
|---|---|---|
| 1 Foundation | `[MOCK]` reads → live; `[BACKEND]` spine | Persistence, loading/error states |
| 2 Capture + Finance | Capture & Review `[BACKEND]`; accounting `[INTEGRATION]` | Capture, Review, finance KPIs |
| 3 Delivery + Approvals | Workspace/Trello/Clockify `[INTEGRATION]`; matching `[BACKEND]` | Delivery, resourcing, approvals, matching |
| 4 Real AI | Assistant & Reports `[MOCK]` → real | AI answers, report generation, anomalies |
| 5 Integrations + delivery | Remaining connectors `[INTEGRATION]`; dispatch `[BACKEND]` | Source breadth, report delivery, schedules |
| 6 Multi-tenant | Auth/RBAC/i18n/residency `[BACKEND]`/`[PLANNED]` | Login, permissions, localization, compliance |

> The roadmap above operationalises the same leverage ordering recommended in `docs/12-integration-architecture.md` (§11). Foundation and Capture are deliberately first because they require no third party and unlock the product's core promise — trustworthy, cited, refusal-honest numbers — before any external dependency.
