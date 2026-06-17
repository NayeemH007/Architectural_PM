# Data Architecture & Data Lifecycle

> **SPACE ESSE · Practice Intelligence** — the canonical data model, the relationships between its entities, and the full journey a record *would* take from capture to archive.

---

## How to read this document

This system is a **high-fidelity, frontend-only prototype**. There is no backend, no database, no authentication, no persistence and no real integrations. Every "read" is served by `src/lib/api.ts → resolve()`, which deep-clones an in-memory mock array (`JSON.parse(JSON.stringify(...))`) and resolves after a simulated ~280 ms latency, consumed through TanStack Query hooks. There are **no mutation hooks anywhere** — no `useMutation`, no POST/PATCH/DELETE path. Fields that look like state (`acknowledged`, `status: "pending"`, `promoted`, `matched`) are stored values in the mock data; nothing in the app changes them on the server because there is no server.

Because of that, this document deliberately separates two things at every step:

- **Current prototype reality** — what the code actually does today.
- **Target architecture** — what a real deployment would need, tagged so you can plan it.

Every feature is tagged with the status legend:

| Tag | Meaning |
|---|---|
| `[IMPLEMENTED]` | Interactive and working in the frontend (client-side only; resets on refresh). |
| `[MOCK]` | Renders from mock data; the underlying read/calc/sync is simulated, not live. |
| `[BACKEND]` | Designed in the UI but needs an API / database / persistence to function. |
| `[INTEGRATION]` | Needs a third-party connector (accounting, Drive, email, authority portal, etc.). |
| `[PLANNED]` / `[RECOMMENDED]` | Not built; a future enhancement. |

> **The single most important architectural fact:** the mock transport carries the comment *"Swap this for fetch() … later without touching components or hooks."* The frontend is shaped to be backend-ready; the backend, database and lifecycle machinery described below **do not yet exist**.

---

## Part A — The Canonical Data Model

### A.1 Where the model lives

All types are declared in `src/lib/types.ts`; a handful of operational entities live in `src/lib/mock/ops.ts`. Mock instances are authored in `src/lib/mock/{data,ops,insights,integrations}.ts`. There is **no schema migration system, no ORM, no table definitions** — these TypeScript interfaces are the closest thing the prototype has to a schema. `[BACKEND]` A production build would translate them into database tables/collections plus server-side validation.

Two cross-cutting concepts make the model distinctive:

- **Provenance is first-class.** A reusable `Provenance` shape (`sourceId`, `sourceName`, `recordRef`, `observedAt`, optional `ingestedAt`) is embedded directly on facts, so any number can name the record it came from.
- **Confidence and "insufficient" are first-class.** `Confidence = "high" | "medium" | "low" | "insufficient"` and `Metric.value` is **nullable** (`number | null`). The system is built to show *nothing* rather than a fabricated figure.

### A.2 Entity catalogue

Counts are the authored mock instance counts. The anchor "today" across the app is the hardcoded date **2026-06-17** (`TODAY` constant; `format.ts` `daysFromNow()` uses `new Date("2026-06-17")`).

| # | Entity | Count | Defined in | Role |
|---|---|---|---|---|
| 1 | **Project** | 8 (p1–p8) | types.ts | The canonical hub record |
| 2 | **Client** | 8 (c1–c8) | types.ts | Account / customer |
| 3 | **Employee** | 10 (e1–e10) | types.ts | Person + capacity |
| 4 | **Invoice** | 10 | types.ts | Billed fee + tax breakdown |
| 5 | **Payment** | 4 | types.ts | Cash received |
| 6 | **Approval** | 8 (ap1–ap8) | types.ts | Authority permit status |
| 7 | **Milestone** | 10 (m1–m10) | types.ts | Dated programme point |
| 8 | **Task** | 8 (t1–t8) | types.ts | Work item |
| 9 | **Deliverable** | 9 (d1–d9) | types.ts | Drawing / document |
| 10 | **Risk** | 8 (r1–r8) | types.ts | Logged project risk |
| 11 | **Decision** | 5 (dec1–dec5) | types.ts | Captured decision |
| 12 | **Opportunity** | 7 (o1–o7) | types.ts | Pipeline deal |
| 13 | **Contact** | 7 (ct1–ct7) | ops.ts | Person at a client |
| 14 | **Meeting** | 10 (mt1–mt10) | ops.ts | Calendar event |
| 15 | **ActivityEvent** | 14 (ac1–ac14) | ops.ts | Audit-log entry |
| 16 | **ScheduledReport** | 6 (sc1–sc6) | ops.ts | Report delivery config |
| 17 | **Target** | 8 (g1–g8) | ops.ts | Goal vs. actual |
| 18 | **ReviewItem** | 6 (rv1–rv6) | ops.ts | Maker-checker queue item |
| 19 | **DataSource** | 17 | integrations.ts | Connector definition |
| 20 | **Alert** | 8 (al1–al8) | insights.ts | Detected signal |
| 21 | **AIReport** | 3 | insights.ts | Generated briefing |
| — | **Provenance / Metric / CrossRef** | embedded | types.ts | Trust value objects |

> **Data-integrity note already visible in the mock:** `firm.staff = 22` but only **10** Employee records exist, and standalone `payments` amounts are hand-authored — they are **not** reconciled against invoice `amountReceived`. These are honest seams in the prototype that a real backend's validation and reconciliation steps (below) would resolve.

### A.3 Key fields by entity (selected)

#### Project — the hub
`id`, `code`, `name`, `nameBn?`, `client`, `clientId`, `type` (`ProjectType`), `stage` (`ProjectStage`), `city`, `leadId`, `teamIds[]`, `startDate`, `targetHandover`, `health` (`HealthBand`), `healthScore: Metric`, `feeContract`, `feeBilled`, `feeCollected`, `feeWip`, `budgetCost`, `costToDate`, `forecastMargin: Metric`, `pctComplete`, `scheduleVarianceDays` (negative = behind), `openRisks`, `openApprovals`, `crossRefs: CrossRef[]`, `completeness`, `currency`.

#### Client
`id`, `name`, `type` (developer / private / corporate / government / institution), `city`, `activeProjects`, `lifetimeFee`, `outstanding`, `relationship` (strong / neutral / at_risk).

#### Employee
`id`, `name`, `role`, `title`, `avatarTone`, `utilization: Metric` (**nullable value**), `capacityHours`, `allocatedHours`, `activeProjects`, `timesheetCompliance` (% weeks submitted). *Employees e1 (Tahmid Karim), e8 (Maya Das), e10 (Shahed Alam) carry `utilization.value: null` + `confidence: "insufficient"` — these people read as "No time logged", never as idle.*

#### Invoice (Bangladesh tax-aware)
`id` (= `number`), `number`, `projectId`, `client`, `issueDate`, `dueDate`, `grossFee` (pre-tax), `vat` (15% NBR VAT), `vdsWithheld`, `aitWithheld` (~10% AIT/TDS), `netReceivable`, `amountReceived`, `status` (`InvoiceStatus`), `agingDays`, `currency`.

#### Approval (authority)
`id`, `projectId`, `authority` (`ApprovalAuthority`: RAJUK / FSCD / CAAB / DoE / City Corporation / DPDC / DESCO / WASA / Titas / Land Mutation), `title`, `status` (`ApprovalStatus`), `submittedDate`, `expectedDate`, `approvedDate`, `daysInStage`, `statutoryDays` (nullable), `blocking`, `owner`, `lastUpdate`, `source: Provenance`.

#### Value objects
- **Provenance:** `sourceId`, `sourceName`, `recordRef`, `observedAt`, `ingestedAt?`.
- **Metric:** `value: number | null`, `unit?`, `label`, `confidence`, `completeness` (0–100), `asOf`, `deltaPct?`, `formula?`, `sources: Provenance[]`, `trend?`, `note?`.
- **CrossRef:** `sourceId`, `sourceName`, `alias`, `matched`, `confidence` — the matching record that links an external alias to a canonical Project.

Other entities (Milestone, Task, Deliverable, Risk, Decision, Opportunity, Contact, Meeting, ActivityEvent, ScheduledReport, Target, ReviewItem, DataSource, Alert, AIReport) are catalogued field-by-field in the inventory; their relationships are described next.

---

## Part B — Relationships (Textual ERD)

### B.1 The hub-and-spoke shape

The **Project** is the canonical hub. Almost every operational record points back to it through a `projectId` foreign key (a plain string in the mock; **not enforced** — there is no referential-integrity check). `[BACKEND]` A real database would add FK constraints and cascade rules.

```
                          ┌──────────────────────────────┐
                          │            CLIENT             │
                          │  c1..c8 · lifetimeFee,        │
                          │  outstanding, relationship    │
                          └───────────────┬───────────────┘
              clientId (Project)          │ 1
              client name (Invoice)       │
                                          │ N
                          ┌───────────────▼───────────────┐
        leadId / teamIds  │           PROJECT  (hub)       │  crossRefs[] (CrossRef)
        ┌─────────────────┤  p1..p8 · stage, health,      ├──────────────► DATA SOURCE
        │                 │  fees, costToDate, completeness│   alias → matched? → confidence
        │                 └──┬───┬───┬───┬───┬───┬───┬─────┘
        │  N                 │   │   │   │   │   │   │
        ▼                    │   │   │   │   │   │   │ projectId (FK on each)
  ┌───────────┐   ┌──────────▼┐ ┌▼────┐ ┌▼────┐ ┌▼─────┐ ┌▼────┐ ┌▼──────┐ ┌▼────────┐
  │ EMPLOYEE  │   │ MILESTONE │ │TASK │ │DELIV│ │APPROV│ │RISK │ │DECISION│ │ INVOICE │
  │ e1..e10   │   │ m1..m10   │ │t1-8 │ │d1-9 │ │ap1-8 │ │r1-8 │ │dec1-5  │ │ 10 inv. │
  │ utilization│  └───────────┘ └─────┘ └─────┘ └──────┘ └─────┘ └────┬───┘ └────┬────┘
  │  (nullable)│        ▲                          ▲                  │          │
  └─────┬──────┘        │ phase ∈ ProjectStage     │ source           │ source   │ invoiceNumber
        │ assigneeId    │                          │ (Provenance)     │(Prov.)   ▼
        │ (Task)        │                          │                  │     ┌─────────┐
        │ owner (Approval/Risk, by name)           │                  │     │ PAYMENT │
        └───────────────┘                          │                  │     │ 4 rows  │
                                                   AUTHORITY (enum, no API)  └─────────┘
```

### B.2 Relationship-by-relationship

| From | To | Key | Cardinality | Enforced? | Notes |
|---|---|---|---|---|---|
| Project | Client | `Project.clientId` → `Client.id`; also `Project.client` (name string) | N : 1 | No `[BACKEND]` | Two links exist (id and name) — a real model would keep one. |
| Project | Phase/Stage | `Project.stage` (`ProjectStage` enum, 10 values) | 1 : 1 | enum only | `STAGE_ORDER` (8 stages) drives the phase stepper and scorecard sort. |
| Project | Employee (lead) | `Project.leadId` → `Employee.id` | N : 1 | No | Project lead. |
| Project | Employee (team) | `Project.teamIds[]` → `Employee.id` | N : N | No | Resolved via `employeeById`; null employees are skipped in UI. |
| Project | Milestone / Task / Deliverable / Approval / Risk / Decision | `projectId` on each | 1 : N | No `[BACKEND]` | Pure string FK; bundled by `*ByProject(id)` helpers. |
| Project | Invoice | `Invoice.projectId` | 1 : N | No | Project name resolved for display; falls back to `Invoice.client`. |
| Invoice | Payment | `Payment.invoiceNumber` → `Invoice.number` | 1 : N | No | **Not reconciled** — payment amounts are independent constants. |
| Client | Invoice | `Invoice.client` = `Client.name` (string match) | 1 : N | No (fragile) | Matched by **name**, not id — a known brittle join. |
| Client | Contact | `Contact.clientId` → `Client.id`; helper `contactsByClient(cid)` | 1 : N | No | |
| Task | Employee | `Task.assigneeId` → `Employee.id` | N : 1 | No | |
| Approval / Risk | Employee | `owner` is a **name string**, not an id | N : 1 | No | Owner is free text (e.g. liaison "Shahed Alam"). |
| Opportunity | Client | `Opportunity.client` (name string) | N : 1 | No | Pre-project; no `clientId`. |
| Project | DataSource | `Project.crossRefs[]` (CrossRef: `sourceId`, `alias`, `matched`, `confidence`) | N : N | No | **The matching layer** — see B.3. |
| Alert / Decision / Approval / ReviewItem / ActivityEvent / AIReport block | Provenance | embedded `source` / `citations[]` | 1 : N | n/a | Every fact can name its origin record. |
| Alert / AIReport / ActivityEvent / Meeting | Project | `projectId: string \| null` | N : 0..1 | No | `null` = firm-wide. |
| Target | Project | `Target.projectId` (when `scope === "project"`) | N : 0..1 | No | Firm-scope targets have null. |

### B.3 The matching layer (CrossRef) — the heart of "one record across tools"

A single project is referred to by different names in different tools — TallyPrime might call it `MEGHNA-HQ`, Google Drive a folder name, WhatsApp a nickname. The **CrossRef** object reconciles those aliases to the canonical Project:

```
External alias (in a DataSource)  ──CrossRef──►  Canonical Project
  sourceId  + alias  + matched(bool) + confidence
```

- `matched: true` → the alias is confidently linked (rendered with a **connected** StatusDot).
- `matched: false` → an **unmatched alias** awaiting human confirmation (rendered **manual**; surfaced on Data Quality and Settings → Project matching).

**Current reality `[MOCK]`/`[IMPLEMENTED]`-display-only:** the matching *queue* renders from `project.crossRefs`. The **"Confirm match" / "Re-match" / "Confirm" buttons are visual-only** (no `onClick`) on both Data Quality and Settings. **Target `[BACKEND]`:** a real matching service would propose links (fuzzy match on code/name/alias), persist confirmations, and feed an alias dictionary so future syncs auto-resolve.

---

## Part C — The Data Lifecycle

This is the full intended journey of a record. For **every stage** the table or note states the **current prototype reality** versus the **target**. The blunt summary up front: today the lifecycle is **read-only and ephemeral** — data is read (from mock arrays), displayed, and lost on refresh. Stages 4–14 below (validation, approval-before-publish, dedup, versioning, correction, audit-write, permissions, storage, archiving) are **largely absent or simulated** and are tagged accordingly.

### Stage 1 — Ingestion (how data enters)

The system is explicitly a **layer above** the firm's tools and is **read-only by design** — it observes, never writes back (verbatim product copy: *"Your source systems remain the single source of truth — Space Esse only observes."*).

The 17 `DataSource` records describe the intended ingestion fabric. Ten are "connected/MVP" (mock statuses), seven are "available / pluggable" (`status: not_connected`, `health: 0`, `recordsIngested: 0`).

| Channel | Concrete source(s) | `IngestMethod` / `Cadence` | Status today |
|---|---|---|---|
| **Manual entry** | Manual Capture (in-app) | `manual` / `realtime` | `[IMPLEMENTED]` form UX; **does NOT persist** (see Stage 1a) |
| **File storage / design files** | Google Drive, AutoCAD (file-watch via Drive), Dropbox | `api` / `file_watch` | `[INTEGRATION]` — mock only; "file-presence signals", not read from CAD apps |
| **Spreadsheet imports** | Excel / CSV Import | `csv_import` / `manual` | `[INTEGRATION]` — mock only |
| **Accounting** | TallyPrime (CSV export, weekly), QuickBooks, Xero | `csv_import` / `api` | `[INTEGRATION]` — TallyPrime shown `stale`; others `not_connected` |
| **Email / calendar** | Gmail (metadata), Google Calendar | `email` / `api` | `[INTEGRATION]` — mock only |
| **Communication** | WhatsApp (forward/screenshot), Gmail | `manual` | `[INTEGRATION]` — paste-only by design (no history API) |
| **Project mgmt** | Trello, Procore | `api` | `[INTEGRATION]` — Trello shown `syncing` (mock); Procore `not_connected` |
| **Document mgmt** | Microsoft 365 / SharePoint | `api` | `[INTEGRATION]` — `not_connected` |
| **Time tracking** | Clockify; Manual Capture timesheets | `api` / `manual` | `[INTEGRATION]` / `[BACKEND]` |
| **BIM/CAD cloud** | Autodesk Construction Cloud | `api` | `[INTEGRATION]` — `not_connected` |
| **Authority portals** | RAJUK ECPS, FSCD, CAAB, DoE, City Corp | `manual` | `[INTEGRATION]`/`[BACKEND]` — **no API exists**; manual entry from portals |
| **CRM / pipeline** | (no dedicated connector) | manual | `[BACKEND]` — pipeline is "the owner's memory" + WhatsApp |
| **Database** | (none) | — | `[BACKEND]` — no DB exists |

> **Authority portals are an architectural constant, not a gap to be closed.** RAJUK, FSCD, CAAB, DoE and City Corporation **expose no API**. Approval status is, and will remain, manually tracked from the ECPS portal and liaison capture. Any authority group is badged `"No API · manual"`. This is by design.

**Connect / Sync now / Disconnect / Auto-sync controls** on Data Sources are **all visual-only** (no handlers). `[BACKEND]`/`[INTEGRATION]`

#### Stage 1a — Manual Capture in detail `[IMPLEMENTED]` UX, `[BACKEND]` persistence

The Capture page is the highest-fidelity ingestion path and the prototype's flagship interaction. Six capture types: **decision, approval, scope, timesheet, site, whatsapp**. Each has variant-specific fields plus common Project, Date (default 2026-06-17) and a "Cite this to me" switch.

- The form is fully interactive (type selection, conditional fields, a `ready` gate, inline success panel). `[IMPLEMENTED]`
- **It does NOT persist.** `submit` calls `preventDefault()` and sets a local `confirmed` object; **nothing is written to any store or API**, and **nothing is added to the "Recent captures" feed** (that feed reads `useDecisions()` mock data, not your new entry). `[BACKEND]`
- The WhatsApp "Extracted draft" preview is **pure client string manipulation** — it slices the last pasted line to 120 chars. There is **no NLP/extraction**. `[PLANNED]` real extraction.

```
INPUT (form)  →  VALIDATION (ready gate)  →  PROCESSING (none)  →  "STORAGE" (local useState, lost on refresh)
                                                                    └─ Target: POST → server validate → persist [BACKEND]
```

### Stage 2 — Mapping & transformation

| Concern | Current reality | Target |
|---|---|---|
| Source alias → canonical Project | `CrossRef` objects authored into mock data | `[BACKEND]` matching service persists confirmed aliases |
| Tax decomposition (gross → net cash) | **`[IMPLEMENTED]` client-side** in `inv()` factory (data.ts) | `[BACKEND]` move to server; reconcile vs. accounting |
| KPI derivation | **`[MOCK]`-computed client-side** (`computePortfolio`, `agingBuckets`, `pipelineByStage`, `utilizationSummary`) | `[BACKEND]` server-side aggregation |
| Currency formatting | `[IMPLEMENTED]` `bdt()` — crore/lakh/k compaction, `৳` glyph | n/a (presentation) |
| Date math | `[IMPLEMENTED]` `daysFromNow`/`agingDays` anchored to **2026-06-17** | `[BACKEND]` use real `now()` |

**The Bangladesh tax transform (`inv()` factory) is genuinely implemented client-side** and is the model's most substantive transformation:

```
grossFee
  → vat          = round(grossFee × 0.15)        // 15% NBR VAT
  → vdsWithheld  = round(vat × 0.60)             // VDS = 60% of the VAT figure (≈9% of gross)
  → aitWithheld  = round(grossFee × 0.10)        // ~10% AIT/TDS
  → netReceivable = grossFee + vat − vdsWithheld − aitWithheld
  → amountReceived = paid ? netReceivable : part_paid ? round(net × 0.5) : 0
  → agingDays      = paid ? 0 : max(0, round((TODAY − dueDate)/86_400_000))
```

This is why the product insists *"billed never equals cash."* It runs in the browser over mock data; a real system would compute it server-side and reconcile it against TallyPrime. `[BACKEND]`

### Stage 3 — Validation before save

**Current reality:** essentially **absent**, except one capture gate.

- Capture `ready` gate `[IMPLEMENTED]`: requires `projectId` + (timesheet → employee & hours; whatsapp → paste; else → note). **No per-field errors, no required markers, no type/range checks beyond `inputMode`.** Date is defaulted but not enforced.
- Settings → KPIs has a **live weight-sum check** `[IMPLEMENTED]`: health-score weights must total `1.00` (`|Σ−1| < 0.001`) or the (visual-only) Save is `disabled`. This is the only real validation-gates-an-action example, and the action it gates still doesn't persist.
- No schema validation, no server-side validation, no referential-integrity checks anywhere. `[BACKEND]`

```
TARGET FLOW (not built):
  field-level rules → cross-field rules → schema (zod/server) → referential integrity (FK exists)
  → tax/units sanity → THEN save                                                            [BACKEND]
```

### Stage 4 — Approval before publish (maker-checker)

The product models a genuine **maker-checker** trust gate; the UI for it is the best-developed lifecycle stage after capture.

| Element | Reality | Tag |
|---|---|---|
| Review Queue (`/review`) approve/reject | Mutates a **local seeded copy** (`useState`) — `resolveItem(id, status)` updates client state only | `[IMPLEMENTED]` (local), `[BACKEND]` (persist) |
| Review item kinds | `report`, `capture`, `match`, `discrepancy` — each requires a human check | `[MOCK]` |
| "Approve & send" beyond local state | No backend effect | `[BACKEND]` |
| Client-facing AI reports | "never send automatically — they pass through the Review queue for owner sign-off" | `[BACKEND]` (send), `[IMPLEMENTED]` (gate UI) |
| Schedules "active" toggle | Local `useState`; does NOT write back to mock module | `[IMPLEMENTED]` (local) |
| Decision `promoted` flag | Stored field; "Verified/Unverified" badge reads it | `[MOCK]` (no promote action persists) |

**The principle is real even though persistence is not:** *"Maker proposes · checker approves … you approve evidence, not guesses."* Confidence and source travel with every queue item.

### Stage 5 — Duplicate prevention

**Current reality: none.** There is no dedup logic, no unique-key enforcement, no "this looks like an existing record" check. `Invoice.id` is simply set equal to `Invoice.number` in the mock factory, which is a convention, not a constraint. `[BACKEND]`/`[PLANNED]`

**Target `[BACKEND]`:** unique constraints (invoice number, project code), idempotency keys on sync, and a fuzzy-match dedup pass on capture (e.g. "a decision with this summary on this date already exists").

### Stage 6 — Version control

| What | Reality | Tag |
|---|---|---|
| Deliverable revisions | `Deliverable.revision` (e.g. "C") + `revisionCount` are **stored counters**; `>3` flags "high churn" with a ⚠ tooltip | `[MOCK]` |
| Drawing register | "Revision load" chart highlights churn | `[MOCK]` |
| Record-level history (who changed a field, when, prior value) | **Absent** | `[BACKEND]` |
| File versioning | Would come from Google Drive / CAD | `[INTEGRATION]` |

Revision *counts* are displayed; there is **no version history store** for any entity. The audit log (Stage 10) is the intended substitute for field-level history.

### Stage 7 — Correction

The product states an explicit correction philosophy in the Activity Log: *"Append-only — tamper-evident. Entries are never edited or deleted in place; corrections are recorded as new events."*

- **Current reality:** this is **narrative copy only** `[MOCK]`. No correction workflow exists; no event can be appended (no write path).
- **Target `[BACKEND]`:** corrections create new immutable events that supersede prior values, preserving the trail.

### Stage 8 — Audit trail

The Activity Log (`/activity`) is the designed audit surface.

| Aspect | Reality | Tag |
|---|---|---|
| Append-only, provenance-stamped timeline | Renders 14 `ActivityEvent` mock rows, day-grouped, newest-first | `[MOCK]` (read), display-only |
| Event types | `capture, sync, approval, report, match, invoice, alert` | `[MOCK]` |
| Per-event provenance | `actor`, `sourceName`, `recordRef`, `timestamp`, optional project link | `[MOCK]` |
| Filter by type / search actor+summary | Client-side | `[IMPLEMENTED]` |
| **Writing** new audit events | **No write path** — nothing the user does appends here | `[BACKEND]` |

The audit log is **read-only and pre-seeded**. Captures, approvals and toggles you perform do **not** generate audit entries. A real system would write an event on every state change (the foundation for Stages 6 and 7).

### Stage 9 — Permission checks

| Element | Reality | Tag |
|---|---|---|
| Roles (Owner/Principal, Project Director, … Viewer) | Defined as `ROLE_OPTIONS`; per-user Role select is interactive client state | `[IMPLEMENTED]` (local), `[BACKEND]` (enforce) |
| "Finance is restricted" notice + per-person finance switches | **Visual-only** (uncontrolled switches; label derived from initial role only) | `[BACKEND]` |
| Data residency / "Bangladesh local mirror" / hosting region | Toggles client state but **enforces nothing** | `[IMPLEMENTED]` (toggle), `[BACKEND]` |
| User menu "Switch role view" / "Sign out" | **No onClick handlers** | `[BACKEND]` |
| Authentication | **None** — no login, no session, no real user | `[BACKEND]` |

**There is no auth and no authorization.** Everything renders for everyone. Roles and finance-restriction are an *intent model* drawn in the UI; enforcement requires a backend with sessions and row/column-level access control.

### Stage 10 — Storage

**Current reality:** **in-memory JavaScript only.**

- Reads: mock arrays in `src/lib/mock/*` → `resolve()` deep-clones them (`JSON.parse(JSON.stringify())`, ~280 ms) → TanStack Query cache. The deep-clone means each hook returns a fresh copy, not the live module array. `[MOCK]`
- Writes: there are none that survive a refresh. All "writes" are React `useState` (capture confirmation, review approve/reject, schedule toggle, settings weights). `[IMPLEMENTED]` (ephemeral)
- **No database, no localStorage, no IndexedDB, no file persistence, no server.** `[BACKEND]`

> The JSON round-trip clone has subtle real-world implications a backend would need to handle: it drops `undefined`, and converts Dates to strings — which is fine here because all dates are already ISO strings.

```
TODAY:   mock array → structuredCloneSafe → React Query cache → component   (no persistence)
TARGET:  DB ⇄ API (REST/GraphQL) ⇄ React Query (fetch swaps in for resolve) ⇄ component   [BACKEND]
```

### Stage 11 — Report generation

| Surface | Reality | Tag |
|---|---|---|
| AI Reports (`/reports`) | Renders 3 pre-authored `AIReport` mock objects with cited, dated, confidence-rated blocks | `[MOCK]` |
| Insufficient blocks | A daily-brief block renders `InsufficientData` (refuses rather than fabricates); hint string is **hardcoded** | `[MOCK]` |
| "Generate brief" / "New report" / "Regenerate" / "Export" / "Approve & send" | **All visual-only** (no handlers) | `[BACKEND]` |
| AI Assistant (Ctrl/Cmd+J) | Canned answers from a fixed map after a 650 ms timeout; includes a deliberate "insufficient data" refusal; unmatched questions → generic refusal | `[IMPLEMENTED]` (canned), `[BACKEND]` (real inference) |
| Scheduled Reports (`/schedules`) | 6 mock configs; cadence/recipients/channel; "active" toggle is local | `[MOCK]` + `[IMPLEMENTED]` toggle |

Reports are **pre-written, not generated**. The defining promise — *"The narrative is generated; the numbers are not"* — describes the **target** architecture: deterministic numbers from verified records, narrative wrapped around cited facts. No real generation or inference runs. `[BACKEND]`/`[PLANNED]`

### Stage 12 — Dashboard calculation

This is where the prototype is *genuinely* doing work — but on mock inputs.

- KPI values are computed **client-side** from mock data by `computePortfolio()`, `agingBuckets()`, `pipelineByStage()`, `utilizationSummary()` in `api.ts`, **or** are hardcoded `Metric` objects in pages. Each metric carries a `formula` string surfaced in the **"Why this number?"** provenance popover. `[IMPLEMENTED]` calc over `[MOCK]` data.
- Examples (verbatim formulas): `collectionRate = Collected ÷ Billed × 100`; aging buckets sum `netReceivable − amountReceived` by `agingDays` band; `utilizationSummary` excludes null-utilization staff from the mean and sets `confidence` from coverage (`>80` high, `>60` medium, else low).
- **Honesty is computed, not cosmetic:** Resourcing forces `spareCapacity.value = null` / `confidence: "insufficient"` because timesheet coverage is too low; Profitability flags fee-based margin as low-confidence when coverage `< 65%`. These refusals are driven by the data, not hardcoded labels.

Some chart inputs (e.g. Dashboard/Financials `moneyTrend`, Profitability `TIMESHEET_COVERAGE`, KPI `trend` arrays, several `Metric.sources`/`asOf`/`deltaPct`) are **hardcoded literals**, not derived. `[MOCK]`

### Stage 13 — Archiving & retention

**Current reality: none.** No archive state, no soft-delete, no retention policy, no TTL. The only "closed" semantics are enum values (`ProjectStage.closed`, `Risk.status.closed`, `Invoice.status.paid`) used for filtering — not lifecycle archiving. `[BACKEND]`/`[PLANNED]`

**Target `[BACKEND]`/`[RECOMMENDED]`:** retention windows per entity, soft-delete with audit, cold-storage for closed projects, and **PDPO 2025** data-residency controls (the Settings "Bangladesh local mirror" / hosting-region toggles are the UI placeholders for this; they enforce nothing today). The product also states **data minimization** — *never stores NID/TIN/passport* — which a real retention/PII policy would enforce.

### Stage 14 — Follow-up (alerts & signals)

| Element | Reality | Tag |
|---|---|---|
| Alerts (8 mock `Alert` records) | Severity, confidence, provenance, `acknowledged` flag | `[MOCK]` |
| `acknowledged` | Stored field; **never mutated** (no acknowledge action) | `[BACKEND]` |
| "AI-detected anomalies" | Re-render of alerts; labelled "Space Esse AI" | `[MOCK]` |
| Notification bell unread count | Reads `!acknowledged` | `[MOCK]` |

Alerts are pre-authored; there is **no detection engine** and **no way to acknowledge** one persistently. `[BACKEND]`

---

## Part D — End-to-End Data Flow

### D.1 Today (prototype) — read-only, ephemeral

```
 ┌───────────────────────────────────────────────────────────────────────────┐
 │  MOCK MODULES  src/lib/mock/{data,ops,insights,integrations}.ts            │
 │  (the "database": in-memory TypeScript arrays, anchored to TODAY 2026-06-17)│
 └───────────────┬───────────────────────────────────────────────────────────┘
                 │  imported by
                 ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │  src/lib/api.ts                                                            │
 │   • resolve(data) = setTimeout(280ms) → structuredCloneSafe(JSON round-trip)│
 │   • derived calcs: computePortfolio / agingBuckets / pipelineByStage /      │
 │                    utilizationSummary   (tax via inv() in data.ts)          │
 │   • useQuery hooks (read-only; NO useMutation anywhere)                      │
 └───────────────┬───────────────────────────────────────────────────────────┘
                 │  React Query cache
                 ▼
 ┌───────────────────────────────────────────────────────────────────────────┐
 │  PAGES & COMPONENTS                                                        │
 │   • KPI cards + "Why this number?" provenance popovers (formula strings)    │
 │   • Charts (Recharts), tables, filters/search/sort (client state)           │
 │   • Capture form, Review queue, Schedules toggle → useState ONLY            │
 │   • Command palette (⌘K), AI assistant (⌘J, canned)                         │
 └───────────────────────────────────────────────────────────────────────────┘
                 │
                 ▼   refresh / reload
            ⟲  ALL local state is LOST. Nothing persisted.
```

### D.2 Target (a real deployment) — the seam is already drawn

The architecture is intentionally one swap away: replace `resolve()` with `fetch()` and add write paths. The component/hook layer would not change.

```
 SOURCES OF TRUTH                         PRACTICE INTELLIGENCE BACKEND               CLIENT
 ┌─────────────────────────┐   read-only  ┌────────────────────────────────┐  REST/  ┌──────────────┐
 │ TallyPrime / QB / Xero  │─────────────►│ Ingestion (api/csv/email/watch)│  GraphQL│ React Query  │
 │ Google Drive / AutoCAD  │  (observe,   │ → Mapping & transform          │◄───────►│ (fetch swaps │
 │ Gmail / Calendar / WA   │   never      │ → Validation → Dedup           │         │  in for      │
 │ Trello / Procore        │   write back)│ → Matching (CrossRef persist)  │         │  resolve())  │
 │ RAJUK/FSCD/CAAB (manual)│              │ → Maker-checker approval       │         │              │
 │ Manual Capture (in-app) │─writes──────►│ → Persist (DB) + Audit (append)│         │ + write paths│
 └─────────────────────────┘              │ → Permissions (auth + RBAC)    │         │ (useMutation)│
                                          │ → Report gen + KPI aggregation │         └──────────────┘
                                          │ → Retention / archive / PDPO   │
                                          └────────────────────────────────┘
```

### D.3 Worked example — a captured scope-change "decision"

| Stage | Today (prototype) | Target (backend) |
|---|---|---|
| 1. Input | Capture form, type=scope, project + note + cost impact `[IMPLEMENTED]` | Same UX |
| 2. Map | none | Normalize to `Decision` (+ provenance, cited to user) `[BACKEND]` |
| 3. Validate | `ready` gate (project + note present) `[IMPLEMENTED]` | Field + schema + FK checks `[BACKEND]` |
| 4. Dedup | none | Fuzzy-match existing decisions `[BACKEND]` |
| 5. Approve | none (capture is unverified) | Lands in Review queue as `capture` → checker promotes `[BACKEND]` |
| 6. Store | `useState` `confirmed`, lost on refresh `[IMPLEMENTED]`/`[BACKEND]` | DB row + provenance `[BACKEND]` |
| 7. Audit | not written `[BACKEND]` | Append `ActivityEvent type=capture` `[BACKEND]` |
| 8. Surface | does **not** appear in Recent captures (reads mock) | Appears on project Decisions tab, citable `[BACKEND]` |
| 9. Report | n/a | Becomes a citable fact in AI briefings `[BACKEND]` |

---

## Part E — Architecture Risks & Recommendations

| # | Observation (from the code) | Recommendation |
|---|---|---|
| 1 | **No persistence layer at all.** Every "write" is `useState`. | `[BACKEND]` Build the API behind `resolve()`'s seam; add `useMutation` write paths. |
| 2 | **Client↔Invoice joins by name string**, not id. | `[BACKEND]` Introduce `Invoice.clientId`; deprecate name matching. |
| 3 | **Owner fields are free-text names** (Approval/Risk). | `[BACKEND]` Reference `Employee.id`. |
| 4 | **Payments not reconciled** to invoice receipts; `firm.staff(22) ≠ employees(10)`. | `[BACKEND]` Add reconciliation + integrity checks at validation. |
| 5 | **No referential integrity / no dedup / no version history.** | `[BACKEND]` FK constraints, unique keys, append-only event store for history. |
| 6 | **No auth / no RBAC**; finance restriction is visual-only. | `[BACKEND]` Sessions + row/column-level permissions before any real data. |
| 7 | **Audit log is read-only and pre-seeded**, yet branded "append-only / tamper-evident." | `[BACKEND]` Make it the real write-side event store; only then is the claim true. |
| 8 | **Authority portals have no API** (architectural constant). | `[INTEGRATION]`/`[BACKEND]` Keep manual capture first-class; treat it as the source of truth for approvals. |
| 9 | **Reports are pre-written, AI answers canned.** | `[BACKEND]`/`[PLANNED]` Deterministic numeric layer + retrieval-grounded narrative with refusal behaviour preserved. |
| 10 | **No retention / residency enforcement** despite PDPO 2025 UI. | `[BACKEND]`/`[RECOMMENDED]` Implement residency, retention windows, PII minimization. |

---

## Summary

The **data model is mature and thoughtfully designed** — a clean hub-and-spoke around the Project, with provenance and confidence elevated to first-class concepts and a genuine, Bangladesh-specific tax transform. The **data *lifecycle*, by contrast, is mostly aspirational**: ingestion, validation, approval-before-publish, dedup, version control, correction, audit-write, permissions, persistent storage, real report generation, and archiving are **absent, simulated, or visual-only** in this frontend-only prototype. What works today is the *shape* of the lifecycle: capture UX, a maker-checker review gate (local), client-side KPI calculation with cited formulas, and honest "insufficient data" refusals. The codebase is deliberately one substitution — `resolve()` → `fetch()` — plus a set of write paths away from the target architecture, which is exactly how it is built to evolve.
