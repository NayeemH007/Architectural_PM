# Backend & Database Requirements

> **Read this first.** SPACE ESSE · Practice Intelligence is, today, a **frontend-only, high-fidelity interactive prototype**. There is **no backend, no database, no authentication, no persistence, and no real network or third-party calls**. Every read flows through `app/src/lib/api.ts`'s `resolve()`, which deep-clones a mock object (via `JSON.parse(JSON.stringify(...))`) and resolves it after a fixed `LATENCY = 280ms` simulated delay. Every "write" you can perform in the UI — capturing a record, approving a review item, toggling a schedule, saving settings — lives in React component state at most and **resets on refresh**. There are **no `useMutation` hooks anywhere**; all hooks are read-only `useQuery` calls.
>
> This document specifies what a **real backend must provide** to turn that prototype into a working product without rewriting the UI. Everything described here is, by definition, not built. To keep the legend honest, almost every line below is tagged **[BACKEND]** (needs API/database/persistence), **[INTEGRATION]** (needs a third-party connector), or **[PLANNED]/[RECOMMENDED]** (a future enhancement). Where a behavior *is* already real in the frontend (client-side only), it is tagged **[IMPLEMENTED]** and called out as the part the backend must preserve, not replace.
>
> **Status legend** — every requirement carries one tag:
> - **[IMPLEMENTED]** — interactive and working in the frontend today (client-side only; resets on refresh).
> - **[MOCK]** — renders from mock data; the underlying read/sync/calculation is simulated, not live.
> - **[BACKEND]** — designed in the UI but needs an API / database / persistence to actually function.
> - **[INTEGRATION]** — needs a third-party connector (accounting, Drive, email, authority portal, etc.) to function.
> - **[PLANNED] / [RECOMMENDED]** — not built; a future enhancement.

---

## 0. The one-paragraph summary

The prototype already has a **clean seam** for a backend: a single transport function (`resolve()`) sits between every page and the mock data, and the UI consumes promises through TanStack Query. Swapping `resolve()` for `fetch()` is the bulk of the read-path work and **touches no components**. Beyond that swap, a real product needs five things the prototype does not have: (1) a **PostgreSQL system-of-record** with provenance columns on every fact; (2) **write endpoints + persistence** for the four interactions that are currently ephemeral (manual capture, review decisions, schedule toggles, settings); (3) **authentication, sessions, and server-enforced RBAC** (finance gating is a hardcoded UI affordance today); (4) a **deterministic KPI semantic layer** that computes the numbers the UI now derives client-side or hardcodes; and (5) an **ingestion/ETL layer** that fills those tables from the real tools (TallyPrime, Google Workspace, RAJUK ECPS, WhatsApp, manual capture). All five are **[BACKEND]/[INTEGRATION]**.

**Recommended stack (per blueprint `10-technical-architecture.md`):**

| Concern | MVP choice | Region / note |
|---|---|---|
| Database / system of record | **Supabase PostgreSQL** (`raw` → `canonical` → `mart` schemas; RLS on `company_id` from day one) | ap-southeast-1 (Singapore) |
| Auth & sessions | **Supabase Auth** (Google + Microsoft OAuth, email OTP), JWT, Postgres **RLS** as the isolation boundary | — |
| API / semantic layer | **Python + FastAPI**, Pydantic-typed contracts; houses the **versioned KPI functions** | Container on Render/Fly.io, Singapore |
| Object / file storage | **Supabase Storage** (or S3-compatible) for report PDFs, CSV uploads, capture attachments | Singapore |
| ETL / connectors | **Custom FastAPI/Python extractors** for the 6 MVP sources + **n8n** (webhook/notification glue) + **Prefect** (typed jobs) | Read-only-first |
| AI narration | **Claude** as a tool-calling narrator over the semantic-layer functions only (never computes numbers) | Behind a provider interface |
| Production frontend | **Next.js** (swap from the current Vite SPA when the backend lands; same React components) | Vercel |

Everything in this table is **[RECOMMENDED]** — none of it is implemented.

---

## 1. The swappable API contract (`resolve()` → `fetch()`)

### 1.1 Why the seam exists and how to use it

The data layer is already abstracted behind one function:

```ts
// app/src/lib/api.ts (current, mock)
const LATENCY = 280;
function resolve<T>(data: T): Promise<T> {
  return new Promise((res) => setTimeout(() => res(structuredCloneSafe(data)), LATENCY));
}
```

The file's own comment states the intent: *"Swap this for fetch() … later without touching components or hooks."* Each hook is a thin `useQuery` wrapper whose `queryFn` calls `resolve(<mock>)`. The migration is therefore mechanical:

```ts
// app/src/lib/api.ts (target, real backend) — [BACKEND]
async function resolve<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",          // session cookie — see §5
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  return res.json() as Promise<T>;
}
```

**[BACKEND]** Each `resolve(<mockArray>)` becomes `resolve("/api/v1/<resource>")`. Query keys stay identical, so TanStack caching, refetching, and devtools are unchanged. The components, which only ever see `{ data, isLoading }`, do not change at all. This is the single most important property of the codebase from a backend perspective.

What the swap *adds* that the mock never had, and which the backend must provide:
- **Real error states.** `resolve()` never rejects; the prototype has **no error-boundary or error-state UI anywhere**. The backend will produce 4xx/5xx, network failures, and timeouts, so error handling becomes new frontend + contract work. **[BACKEND]**
- **Real latency variance.** The fixed 280ms becomes variable; loading skeletons (already present on most pages) must stay.
- **Pagination / filtering server-side.** Today every hook returns the *entire* mock array and the UI filters/sorts in memory. At real data volumes, list endpoints need query params (`?status=`, `?q=`, `?page=`). **[BACKEND]**

### 1.2 Hook → data → endpoint/table map

The table below maps **every hook exported by `api.ts`** to the data it returns, the REST endpoint it implies, and the backing table(s)/view(s). All endpoints are **[BACKEND]**; none exist today.

| Frontend hook (queryKey) | Data returned today (mock) | Backend endpoint (proposed) | Backing table / view |
|---|---|---|---|
| `useProjects` `["projects"]` | All 8 projects | `GET /api/v1/projects` | `canonical.project` (+ joins for `healthScore`, `forecastMargin` from `mart`) |
| `useProject(id)` `["project", id]` | One project or `null` | `GET /api/v1/projects/{id}` | `canonical.project` |
| `useProjectBundle(id)` `["bundle", id]` | `{project, approvals, milestones, tasks, deliverables, invoices, risks, decisions}` for one project | `GET /api/v1/projects/{id}/bundle` | aggregate read across 8 tables (one composed response) |
| `useEmployees` `["employees"]` | 10 employees + `utilization` Metric | `GET /api/v1/employees` | `canonical.employee` + `mart.employee_utilization` |
| `useClients` `["clients"]` | 8 clients | `GET /api/v1/clients` | `canonical.client` (+ `mart.client_outstanding`) |
| `useInvoices` `["invoices"]` | 10 invoices (tax fields computed in `inv()`) | `GET /api/v1/invoices` | `canonical.invoice` |
| `usePayments` `["payments"]` | 4 payments | `GET /api/v1/payments` | `canonical.payment` |
| `useApprovals` `["approvals"]` | 8 authority approvals | `GET /api/v1/approvals` | `canonical.approval` |
| `useMilestones` `["milestones"]` | 10 milestones | `GET /api/v1/milestones` | `canonical.milestone` |
| `useTasks` `["tasks"]` | 8 tasks | `GET /api/v1/tasks` | `canonical.task` |
| `useDeliverables` `["deliverables"]` | 9 deliverables | `GET /api/v1/deliverables` | `canonical.deliverable` |
| `useRisks` `["risks"]` | 8 risks | `GET /api/v1/risks` | `canonical.risk` |
| `useDecisions` `["decisions"]` | 5 decisions | `GET /api/v1/decisions` | `canonical.decision` |
| `useOpportunities` `["opps"]` | 7 opportunities | `GET /api/v1/opportunities` | `canonical.opportunity` |
| `useContacts` `["contacts"]` | 7 contacts | `GET /api/v1/contacts` | `canonical.contact` |
| `useMeetings` `["meetings"]` | 10 meetings | `GET /api/v1/meetings` | `canonical.meeting` |
| `useActivity` `["activity"]` | 14 activity events | `GET /api/v1/activity` | `canonical.activity_event` (append-only) |
| `useSchedules` `["schedules"]` | 6 scheduled reports | `GET /api/v1/schedules` | `canonical.scheduled_report` (+ `recipient`) |
| `useTargets` `["targets"]` | 8 firm/project targets | `GET /api/v1/targets` | `canonical.target` |
| `useReviewQueue` `["review"]` | 6 review items | `GET /api/v1/review` | `canonical.review_item` |
| `useDataSources` `["sources"]` | 17 connectors | `GET /api/v1/data-sources` | `canonical.data_source` (+ live status from connector runtime) |
| `useAlerts` `["alerts"]` | 8 alerts | `GET /api/v1/alerts` | `canonical.alert` (anomaly engine output) |
| `useAIReports` `["reports"]` | 3 AI reports | `GET /api/v1/reports` | `canonical.ai_report` (+ `ai_report_block`, `ai_citation`) |
| `usePortfolio` `["portfolio"]` | `computePortfolio()` result (15 derived fields) | `GET /api/v1/portfolio` | `mart.portfolio_summary` (materialized) |
| re-export `firm` | Static firm object | `GET /api/v1/firm` | `canonical.company` (single row in MVP) |

**Derived endpoints** (the UI calls these as in-file functions today, computed client-side — they must move server-side to the semantic layer; see §6):

| Current client-side function | Returns | Backend endpoint | Backing view |
|---|---|---|---|
| `computePortfolio()` | portfolio KPI bundle | `GET /api/v1/portfolio` | `mart.portfolio_summary` |
| `agingBuckets()` | 5 receivables-aging buckets | `GET /api/v1/financials/aging` | `mart.invoice_aging` |
| `pipelineByStage()` | per-stage count + value | `GET /api/v1/pipeline/by-stage` | `mart.pipeline_by_stage` |
| `utilizationSummary()` | mean util, coverage, overloaded, confidence | `GET /api/v1/resourcing/utilization` | `mart.utilization_summary` |

> **Note on currently-hardcoded numbers.** Several KPIs are **not** derived from the mock at all — e.g. Dashboard "Portfolio margin" is the literal `18`; Financials/Profitability/Capture trend arrays and the tax explainer chips are inline literals; `TIMESHEET_COVERAGE`, `BAND`, and `OVERLOADED_ID` are hardcoded maps. Each such number needs a real semantic-layer source before it can be trusted. All **[BACKEND]**.

---

## 2. Entity → table mapping (PostgreSQL)

### 2.1 Schema layering

Per blueprint, use **one PostgreSQL** with three schemas (no warehouse for MVP):

- **`raw`** — JSONB landing zone for connector payloads (Tally CSV rows, Drive file metadata, WhatsApp forwards, webhook bodies). Append-only, never read by the UI directly. **[BACKEND]**
- **`canonical`** — the typed entities the UI consumes (the tables below). One normalized row per real-world fact. **[BACKEND]**
- **`mart`** — materialized views / scheduled rollup tables for KPI outputs (`portfolio_summary`, `invoice_aging`, `pipeline_by_stage`, `utilization_summary`, `employee_utilization`, `client_outstanding`). Read-only; refreshed by the recompute job. **[BACKEND]**

Every `canonical` table carries a `company_id` (multi-tenant boundary, RLS-enforced from day one) and standard audit columns. The prototype's `firm` is a single tenant; the column exists so the schema never needs a migration to go multi-tenant.

### 2.2 Universal provenance & audit columns

The product's central thesis — *every number cites its source* — must be enforced at the column level, not just in the UI. The prototype already models this via the `Provenance` interface (`sourceId`, `sourceName`, `recordRef`, `observedAt`, `ingestedAt?`) and `CrossRef`. In the database, **every fact-bearing canonical row carries provenance**:

| Column | Type | Purpose |
|---|---|---|
| `id` | `uuid` (PK) | canonical id (prototype uses `p1`, `inv-…` etc.; keep a stable text `code` too) |
| `company_id` | `uuid` (FK, RLS) | tenant isolation |
| `source_id` | `uuid` (FK → `data_source`) | which connector produced this |
| `source_name` | `text` | denormalized for display (e.g. "TallyPrime", "Manual capture") |
| `record_ref` | `text` | the source's own ref (e.g. `INV-2026-019`, `ECPS-2024-88213`) |
| `observed_at` | `timestamptz` | when the fact was true at source |
| `ingested_at` | `timestamptz` | when Space Esse recorded it |
| `confidence` | `enum(confidence)` | `high\|medium\|low\|insufficient` |
| `completeness` | `smallint` (0–100) | how complete the inputs were |
| `created_at` / `updated_at` | `timestamptz` | audit |
| `created_by` / `updated_by` | `uuid` (FK → `app_user`) | audit (who captured/edited) |

> **Provenance is non-nullable on captured facts.** A decision, approval update, or timesheet entry cannot exist without `source_id` + `record_ref` + `observed_at`. This is what makes "cited to you" real rather than cosmetic. **[BACKEND]**

### 2.3 Entity catalog → tables

The prototype defines its types in `app/src/lib/types.ts` (and `mock/ops.ts`). Each maps to one canonical table. Key columns shown; provenance/audit columns from §2.2 are implied on all fact tables.

| Canonical table | Source type | Notable columns (beyond §2.2) | Enums (Postgres `enum` or `check`) |
|---|---|---|---|
| `company` | `firm` | `name, legal_name, tagline, office, staff, founded, currency` | — |
| `app_user` | (new — no prototype type) | `email, display_name, role, finance_access bool, auth_provider, last_login_at` | `role` (see §5) |
| `project` | `Project` | `code, name, name_bn, client_id, type, stage, city, lead_id, start_date, target_handover, health, pct_complete, schedule_variance_days, fee_contract, fee_billed, fee_collected, fee_wip, budget_cost, cost_to_date, open_risks, open_approvals, currency` | `project_type`, `project_stage`, `health_band` |
| `project_cross_ref` | `CrossRef` | `project_id, source_id, source_name, alias, matched bool, confidence` | — |
| `client` | `Client` | `name, type, city, active_projects, lifetime_fee, outstanding, relationship` | `client_type`, `relationship` |
| `contact` | `Contact` | `client_id, name, role, email, phone, is_primary bool` | — |
| `employee` | `Employee` | `name, role, title, avatar_tone, capacity_hours, allocated_hours, active_projects, timesheet_compliance` | — |
| `invoice` | `Invoice` | `number, project_id, client, issue_date, due_date, gross_fee, vat, vds_withheld, ait_withheld, net_receivable, amount_received, status, aging_days, currency` | `invoice_status` |
| `payment` | `Payment` | `invoice_number, project_id, date, amount, method, currency` | `payment_method` |
| `approval` | `Approval` | `project_id, authority, title, status, submitted_date, expected_date, approved_date, days_in_stage, statutory_days, blocking bool, owner, last_update` | `approval_authority`, `approval_status` |
| `milestone` | `Milestone` | `project_id, name, phase, due_date, status, completed_date` | `milestone_status`, `project_stage` |
| `task` | `Task` | `project_id, title, assignee_id, status, due_date, overdue bool` | `task_status` |
| `deliverable` | `Deliverable` | `project_id, name, discipline, status, revision, revision_count, due_date, issued_date, file_ref` | `deliverable_status`, `discipline` |
| `risk` | `Risk` | `project_id, title, category, likelihood, impact, status, owner, raised_date` | `risk_category`, `level`, `risk_status` |
| `decision` | `Decision` | `project_id, summary, decided_by, date, channel, promoted bool` | `decision_channel` |
| `opportunity` | `Opportunity` | `name, client, type, stage, est_fee, probability, owner, expected_decision, last_activity` | `project_type`, `opp_stage` |
| `meeting` | `Meeting` | `title, project_id, date, duration_min, type, attendees[], location` | `meeting_type` |
| `target` | `Target` | `scope, project_id, label, metric, unit, target, actual, period, status, owner` | `target_scope`, `target_status` |
| `data_source` | `DataSource` | `name, vendor, kind, status, method, cadence, read_only bool, last_sync, records_ingested, freshness_hours, health, mvp bool, auth_method, notes, logo_glyph, feeds[]` | `source_kind`, `source_status`, `ingest_method`, `cadence` |
| `alert` | `Alert` | `severity, title, detail, project_id, category, created_at, confidence, acknowledged bool` | `alert_severity` |
| `ai_report` | `AIReport` | `kind, title, project_id, generated_at, status, audience, summary, completeness` | `ai_report_kind`, `report_status`, `audience` |
| `ai_report_block` | `AIReportBlock` | `report_id, heading, body, confidence, insufficient bool, sort_order` | — |
| `ai_citation` | `AICitation` | `block_id, ref, source_name, observed_at` | — |
| `scheduled_report` | `ScheduledReport` | `name, kind, cadence, schedule, channel, active bool, next_run, last_run, audience` | `ai_report_kind`, `report_cadence`, `channel`, `audience` |
| `report_recipient` | `Recipient` | `scheduled_report_id, name, role` | — |
| `review_item` | `ReviewItem` | `kind, title, detail, project_id, submitted_by, submitted_at, confidence, status` | `review_kind`, `review_status` |
| `activity_event` | `ActivityEvent` | `type, actor, summary, project_id, timestamp, source_name, record_ref` | `activity_type` |
| `metric` | `Metric` (embedded today) | `entity_type, entity_id, key, value (nullable), unit, label, confidence, completeness, as_of, delta_pct, formula, note, trend jsonb, kpi_version` | `metric_unit` |

> **Nullable values are first-class.** `metric.value` is `numeric NULL` on purpose — employees e1/e8/e10 have `utilization = null` and projects p6/p8 have `forecast_margin = null` with `confidence = 'insufficient'`. The schema must allow NULL with a non-NULL `confidence = 'insufficient'`, because the product *shows nothing rather than a fabricated number*. **[BACKEND]**

### 2.4 Object / file storage

| Artifact | Where today | Backend requirement |
|---|---|---|
| Deliverable file (`fileRef`) | a string label only; no file | **Object storage reference** + signed-URL retrieval; the "On Drive / No file" signal becomes a real file-presence check **[INTEGRATION]** (Google Drive) |
| AI report export (PDF) | "Export" button is **visual-only** | Server-side PDF render → object storage → download URL **[BACKEND]** |
| CSV/Excel import (Tally, fee/budget) | "Connect"/upload is **visual-only** | Upload endpoint → `raw` landing → parse job **[BACKEND]/[INTEGRATION]** |
| Capture attachment (WhatsApp screenshot, site photo) | not supported | Upload to object storage, link to the capture record **[PLANNED]** |

Recommended: **Supabase Storage** (or S3-compatible), Singapore region, signed URLs, least-privilege.

---

## 3. Persisting the currently-ephemeral interactions

These four interactions are **[IMPLEMENTED]** as client state today and **lose everything on refresh**. Each needs a write endpoint, validation, persistence, and (for some) an approval gate. For each, the **Input → Validation → Processing → Approval → Storage → Reporting → Follow-up** flow is given.

### 3.1 Manual Capture (`/capture`)

**Today:** `submit` calls `e.preventDefault()` and sets a local `confirmed` object. **No write occurs; nothing is added to the recent-captures feed** (which reads `useDecisions()` independently). The only validation is the `ready` gate (project set + variant-required fields). **[IMPLEMENTED]** as a form; **[BACKEND]** to persist.

| Stage | Requirement |
|---|---|
| **Input** | One of 6 variants — `decision`, `approval`, `scope`, `timesheet`, `site`, `whatsapp` — each with its fields (e.g. decision: summary, decidedBy, channel; timesheet: employeeId, hours; whatsapp: pasted thread). Common: `projectId`, `date`, `citeMe`. |
| **Validation** | Server-side mirror of the `ready` gate **plus** real rules the UI lacks: `projectId` exists and is in tenant; `hours` is numeric `> 0` and `<= capacity`; `date` not in the future; `authority`/`status` are valid enum members; required-by-variant fields present. Return field-level 422 errors (the UI currently has **no per-field error messages** — new contract). **[BACKEND]** |
| **Processing** | Stamp provenance: `source_id` = Manual Capture connector, `record_ref` = generated, `observed_at` = form date, `ingested_at` = now, `created_by` = session user (the "cite this to me" toggle drives whether the user is named). For `whatsapp`, the "extracted draft" is currently the **last pasted line sliced to 120 chars** — real extraction (LLM draft + entity linking) is **[PLANNED]**. |
| **Approval** | Captures are **proposals**, not facts. A decision/scope/match enters the **Review queue** as `status = pending` (`promoted = false`). Promotion to a citable record is a maker-checker step (§3.2). **[BACKEND]** |
| **Storage** | Insert into the relevant canonical table (`decision`, `approval`, timesheet effort, `risk`/scope, etc.) with `promoted = false`; emit an `activity_event` of type `capture`. |
| **Reporting** | After promotion, the new fact flows into the recompute job → updates `mart.*` → appears in the recent-captures feed and lifts the confidence/coverage of dependent KPIs (e.g. timesheet coverage, capacity answers). |
| **Follow-up** | The hardcoded KPI cards on this page ("Captures this week 18", "Timesheet coverage 64%") become real aggregates. **[BACKEND]** |

### 3.2 Review queue decisions (`/review`)

**Today:** `useReviewQueue()` seeds a local `items` state once; `resolveItem(id, status)` mutates that local array. Approve/Verify/Reject change **local state only — no backend write**. **[IMPLEMENTED]** locally; **[BACKEND]** to persist and enforce maker-checker.

| Stage | Requirement |
|---|---|
| **Input** | Reviewer clicks Approve & send (reports), Verify & promote (captures/matches), or Reject, on a `review_item`. |
| **Validation** | Server checks the reviewer's **role** (checker must differ from maker; finance/owner-only for client-facing reports) and that the item is still `pending` (optimistic-concurrency guard). **[BACKEND]** |
| **Processing** | On approve: set `review_item.status = approved`; for a capture/match, set the underlying record `promoted = true` (decision) or `matched = true` (cross-ref); for a report, mark `ai_report.status = published` and trigger send. On reject: `status = rejected`, underlying record stays unpromoted. |
| **Approval** | This **is** the approval gate — the maker-checker control. Must be a transactional state change with an audit row. **[BACKEND]** |
| **Storage** | `PATCH /api/v1/review/{id}` `{status}`; append an immutable `activity_event` of type `approval` (who, when, decision). |
| **Reporting** | KPIs "Pending review", "Reports awaiting sign-off", etc. recompute; resolved items move to the Resolved tab with an auditable trail. |
| **Follow-up** | A published client-facing report becomes eligible for scheduled delivery (§3.3). The "Approve & send" button's send action is **[BACKEND]/[INTEGRATION]** (email/WhatsApp/in-app). |

### 3.3 Scheduled-report toggles (`/schedules`)

**Today:** `activeById` local state overrides `r.active`; `toggleActive` flips it. Toggles **do not write back** (comment confirms). The Switch is **[IMPLEMENTED]** locally; "Edit", "New schedule" are **visual-only**.

| Stage | Requirement |
|---|---|
| **Input** | Owner/admin toggles `active`, edits cadence/recipients/channel, or creates a schedule. |
| **Validation** | Role check (owner/admin only); valid cadence + schedule expression; recipients resolvable; client-facing schedules require an approved report. **[BACKEND]** |
| **Processing** | Persist the change; (re)compute `next_run` from `cadence`/`schedule`. |
| **Approval** | Client-facing reports **never auto-send** — they pass through the Review queue first (already the stated design). Internal reports may send on cadence. |
| **Storage** | `PATCH /api/v1/schedules/{id}` `{active}` / `PUT` for edits / `POST` for new; persist to `scheduled_report` + `report_recipient`. |
| **Reporting** | A real **scheduler** (cron / Prefect schedule) must trigger report generation at `next_run`, render, route to the channel, and stamp `last_run`. **[BACKEND]** The channel delivery itself is **[INTEGRATION]** (email/WhatsApp). |
| **Follow-up** | Delivery emits an `activity_event` of type `report`. |

### 3.4 Settings persistence (`/settings`)

**Today:** firm-profile inputs are uncontrolled `defaultValue`; "Save profile", "Save thresholds", "Invite member", "Re-match", "Confirm", language/region selects, finance-access switches are **all visual-only**. Genuinely interactive (client-only) bits: base-currency select, per-user role select, KPI weight inputs with live Σ/balanced gating, and the "Bangladesh local mirror" switch. **[IMPLEMENTED]** locally; **[BACKEND]** to persist and enforce.

| Settings group | What must persist | Tag |
|---|---|---|
| Firm profile | `company` row (name, legal entity, office, founded, base currency, fiscal year, timezone) | **[BACKEND]** |
| Users & roles | `app_user.role` + `finance_access` (the switch label is cosmetic today and doesn't react to the toggle — real backend must make the toggle authoritative and **enforce** finance gating server-side; see §5) | **[BACKEND]** |
| Project matching | Confirm/Re-match must set `project_cross_ref.matched` + write provenance; today both are visual-only | **[BACKEND]** |
| KPIs & thresholds | Health-score weights (the live Σ/`balanced` gate is real client logic and a good model — but "Save thresholds" persists nothing); these weights must version into the semantic layer (§6) so a KPI recompute uses them | **[BACKEND]** |
| Localization & residency | Interface language, hosting region, "local mirror" — these imply real **i18n** and **data-residency** infrastructure, not just a flag | **[PLANNED]** (i18n) / **[BACKEND]** (residency) |

> **Reminder on localization.** The Topbar language toggle flips the `EN/বাংলা` **label only** — the app is **not** localized, and Bangla appears only in select mock fields (`project.nameBn`). Real bilingual UI is a substantial **[PLANNED]** effort (`next-intl` + Nikosh font + Bijoy↔Unicode handling per blueprint), not a settings write.

---

## 4. The deterministic KPI semantic layer

### 4.1 Why this is the most important backend component

The product's anti-hallucination promise is that **the AI never computes a number — it only narrates deterministic output**. Today the "deterministic functions" live in two unsuitable places: (a) **client-side in `api.ts`** (`computePortfolio`, `agingBuckets`, `pipelineByStage`, `utilizationSummary`, and the `inv()` tax factory), and (b) **hardcoded literals in page files** (margin `18`, trend arrays, `TIMESHEET_COVERAGE`). Neither is testable, versioned, server-trusted, or reusable by the AI. The backend must move all KPI math into **versioned, typed semantic-layer functions** (Python/SQL in FastAPI), each emitting a `Metric` with value, unit, confidence, completeness, `formula`, sources, and `kpi_version`. **[BACKEND]**

### 4.2 The formulas that must move server-side (exactly as the prototype computes them)

These must be preserved bit-for-bit so the UI shows the same numbers after the swap:

**`computePortfolio()` → `mart.portfolio_summary`** — over `active = projects where stage != 'closed'`:
- `totalContract/Billed/Collected/Wip = Σ` of the respective project fee fields
- `unbilled = totalContract − totalBilled`
- `collectionRate = totalBilled > 0 ? totalCollected/totalBilled*100 : 0`
- `overdueTotal = Σ (netReceivable − amountReceived)` over `invoices where status='overdue'`
- `avgHealth = avg(healthScore.value ?? 0)`; `avgCompleteness = avg(completeness)`
- `pipelineWeighted = Σ (estFee*probability/100)` over open opportunities
- `openApprovals = count(status not in {approved,rejected})`
- `overdueApprovals = count(statutoryDays != null AND daysInStage > statutoryDays AND status != 'approved')`

**`agingBuckets()` → `mart.invoice_aging`** — over `open = invoices where status not in {paid,draft}`, buckets `Current(<1)`, `1–30`, `31–60`, `61–90`, `90+`, each `Σ(netReceivable − amountReceived)`.

**`pipelineByStage()` → `mart.pipeline_by_stage`** — per stage `lead/qualified/proposal/negotiation/won` (lost excluded): `count` + `Σ estFee` (raw, **not** probability-weighted).

**`utilizationSummary()` → `mart.utilization_summary`** — `billable = employees where utilization.value != null`; `coverage = avg(timesheetCompliance)` over **all** staff; `meanUtil = avg(util)` over billable; `overloaded = count(util>90)`; `underloaded`; `unknown = count(util=null)`; `confidence = coverage>80?'high':coverage>60?'medium':'low'`.

**`inv()` tax factory → computed columns on `invoice`** (NBR/Bangladesh withholding): `vat = round(gross*0.15)`; `vdsWithheld = round(vat*0.6)`; `aitWithheld = round(gross*0.1)`; `netReceivable = gross + vat − vdsWithheld − aitWithheld`; `amountReceived` by status; `agingDays` from `(TODAY − dueDate)`. **The standalone `payments` are hand-authored and NOT reconciled against invoices today — real reconciliation is [BACKEND].**

### 4.3 Semantic-layer requirements

- **Versioning.** Each KPI carries a `kpi_version`; changing a formula creates a new version, never silently mutates historic numbers. **[BACKEND]**
- **Provenance propagation.** Each computed `Metric` must list the source rows it aggregated (drives the "Why this number?" `ProvenancePopover`, which is **[IMPLEMENTED]** in the UI but fed mock provenance today). **[BACKEND]**
- **Confidence + completeness are outputs, not decoration.** They must be computed from real coverage (e.g. timesheet completeness drives margin confidence), not hardcoded as they are now. **[BACKEND]**
- **Anchor date.** The prototype hardcodes "today" as `2026-06-17` in three places (`format.ts`, `mock/data.ts`, `mock/ops.ts`). The backend uses real `now()` (server timezone Asia/Dhaka), which changes all aging/relative calculations. **[BACKEND]**
- **The AI consumes only these functions.** Claude is given the functions as tools and must never see raw tables for number-computation; it narrates the typed output and refuses (`insufficient`) when a function returns NULL. **[RECOMMENDED]** per blueprint.

---

## 5. Auth, sessions, and RBAC enforcement

### 5.1 Current state (none)

There is **no real auth**. The Topbar user menu is a hardcoded `Avatar name="Tahmid Karim"` and its "Profile", "Switch role view", "Sign out" buttons **have no handlers**. Settings shows roles and a finance-access switch, but the switch label doesn't even react to the toggle, and nothing is enforced. The "finance is restricted" notice is **descriptive prose, not a control**. All **[BACKEND]**.

### 5.2 What the backend must provide

| Concern | Requirement | Tag |
|---|---|---|
| Authentication | Email OTP + Google + Microsoft OAuth (firm uses both Workspace and M365). Issue JWT/session cookie. | **[BACKEND]** (Supabase Auth recommended) |
| Sessions | HTTP-only session cookie sent with every `fetch` (`credentials: "include"`); refresh + revoke; "Sign out" wired. | **[BACKEND]** |
| Identity | `app_user` table (email, display name, role, finance_access, provider, last_login). Replaces the hardcoded avatar. | **[BACKEND]** |
| RBAC roles | Mirror the Settings `ROLE_OPTIONS`: **Owner/Principal, Project Director, Project Architect, Design Lead, Finance/Admin, Authority Liaison, Viewer**. | **[BACKEND]** |
| Finance gating | Fees, invoices, payments, profitability, client outstanding visible **only** to Owner + Finance/Admin (+ per-person exceptions via `finance_access`). Must be **enforced on the server** (RLS + endpoint guards), not by hiding UI. | **[BACKEND]** |
| Multi-tenant isolation | **Postgres RLS on `company_id`** on every table from day one; the JWT carries `company_id`. | **[BACKEND]** |
| Maker-checker | The Review queue's approve/reject must verify checker ≠ maker and role eligibility server-side (§3.2). | **[BACKEND]** |
| Audit | Every write stamps `created_by`/`updated_by` and emits an append-only `activity_event` (the Activity Log is "the audit trail of record" — must be tamper-evident, never edited in place). | **[BACKEND]** |

> **Security principle:** the UI's finance-hiding is a convenience, not a boundary. A real backend must assume the client is hostile and gate every finance field at the API/row level. The prototype provides **zero** enforcement today.

---

## 6. Ingestion / ETL needs

The product's premise is that **the highest-value data has no API** and must be captured or harvested. The `data_source` catalog (17 connectors; 10 MVP-connected, 7 `not_connected`) describes the intended ingest surface. Today **all of it is mock** — `lastSync`, `recordsIngested`, `freshnessHours`, `health` are static numbers, and Connect/Sync now/Disconnect/Auto-sync are **visual-only**. Real ingestion is **[INTEGRATION]** per source + **[BACKEND]** for the pipeline.

### 6.1 MVP connectors → ingest method → landing

| Source (mock status) | Kind | Ingest method | Real requirement | Tag |
|---|---|---|---|---|
| Manual Capture (connected) | manual_capture | in-app write | The capture endpoints of §3.1 | **[BACKEND]** |
| Google Drive (connected) | file_storage | API (OAuth read-only) | Poll Drive, harvest file-presence/metadata → `deliverable.file_ref` | **[INTEGRATION]** |
| Gmail (connected) | communication | email (OAuth metadata) | Extract decisions/approvals from message metadata | **[INTEGRATION]** |
| Google Calendar (connected) | calendar | API (read-only) | Sync meetings/milestones | **[INTEGRATION]** |
| TallyPrime (stale) | accounting | csv_import (weekly template) | Parse exported CSV → invoices/payments/expenses; **no API**, so freshness lag is real (the mock's "5 days stale" reflects this) | **[INTEGRATION]** |
| Excel / CSV Import (connected) | accounting | csv_import (upload) | Upload endpoint → `raw` → parse → fee/budget/task/deliverable | **[BACKEND]** |
| AutoCAD via Drive (connected) | bim_cad | file_watch | File-presence signals via Drive (no CAD API) | **[INTEGRATION]** |
| Trello (syncing) | project_mgmt | API (OAuth read-only) | Tasks/milestones | **[INTEGRATION]** |
| RAJUK ECPS (manual) | authority | manual entry | **No API exists**; liaison enters portal status by hand → approval records | **[INTEGRATION]** (manual) |
| WhatsApp (manual) | communication | forward / screenshot | **No history/backfill API**; paste-only, by design → promote to decision | **[INTEGRATION]** (manual) |

The 7 `not_connected` sources (QuickBooks, Xero, Autodesk Construction Cloud, M365/SharePoint, Procore, Clockify, Dropbox) are **[PLANNED]** pluggable connectors; their tiles' "Connect" buttons are visual-only today.

### 6.2 Pipeline requirements

- **Read-only-first.** Every connector requests least-privilege, read-only scopes; Space Esse never writes back to source systems. (The UI's "Read-only by design" banner must become a real OAuth-scope guarantee.) **[INTEGRATION]**
- **Provenance on ingest.** Each landed row is stamped with `source_id`, `record_ref`, `observed_at`, `ingested_at` before it reaches `canonical`. **[BACKEND]**
- **Orchestration.** Per blueprint: **custom Python extractors** for the 6 MVP sources, **n8n** for webhook/notification glue, **Prefect** to schedule + retry the typed normalization and the KPI recompute. **[RECOMMENDED]**
- **Freshness tracking.** `data_source.last_sync` / `freshness_hours` / `health` become live; the Data Quality page's 48h staleness flag and the Topbar "X stale" pill become real. **[BACKEND]**
- **Matching / cross-ref.** The alias→project matching queue (Data Quality, Settings) must run a real matcher (deterministic + optional LLM-assisted) and persist `matched`. Confirm is visual-only today. **[BACKEND]**
- **Anomaly engine.** The `alert` records (currently a static array) must come from a real anomaly/threshold engine over the canonical data (e.g. "invoice 90+ days overdue", "approval past statutory window"). **[BACKEND]**
- **AI report generation.** `ai_report` + blocks + citations are static mock today. Real generation = semantic-layer functions produce numbers → Claude narrates around cited facts → store report with provenance, refusing (`insufficient`) where a function returns NULL. **[BACKEND]/[RECOMMENDED]**

---

## 7. Migration sequence (recommended)

A pragmatic order that keeps the prototype shippable at each step:

1. **Stand up Postgres + schemas + RLS + auth** (Supabase). Seed `canonical` from the existing mock arrays so the UI looks identical. **[BACKEND]**
2. **Swap `resolve()` → `fetch()`** behind the same hook signatures; add error states + loading parity. Read paths now live. **[BACKEND]**
3. **Build the semantic layer** (move §4 formulas server-side, versioned) and point `mart.*` endpoints at it. KPIs now trustworthy and traceable. **[BACKEND]**
4. **Persist the four ephemeral interactions** (capture, review, schedules, settings) with validation + maker-checker + audit. **[BACKEND]**
5. **Wire ingestion** source-by-source (manual capture first, then Drive/Calendar/Gmail, then Tally CSV, then Trello; authority + WhatsApp stay manual). **[INTEGRATION]**
6. **Add report generation + scheduled delivery + anomaly alerts**; move the production frontend to Next.js. **[BACKEND]/[INTEGRATION]/[RECOMMENDED]**

At no point does the component tree need rewriting — the seam at `resolve()` and the read-only hook contract are what make this a swap, not a rebuild.

---

## 8. What is explicitly NOT built today (do not describe as working)

A consolidated honesty checklist — every item is the backend's job:

- No database, no API, no server, no auth, no sessions, no RBAC enforcement. **[BACKEND]**
- No `useMutation` / write path anywhere. Capture, review approve/reject, schedule toggle, all "Save" actions persist **nothing**. **[BACKEND]**
- KPIs are client-computed from mock or hardcoded (margin `18`, trend arrays, `TIMESHEET_COVERAGE`, tax-explainer chips). **[BACKEND]**
- "today" is hardcoded `2026-06-17` in three files; `relative()` uses real system now (inconsistent). **[BACKEND]**
- Connect / Sync now / Disconnect / Auto-sync / Confirm match / Re-match / Export / Generate brief / New report / New schedule / Edit / Invite member / Save profile / Save thresholds / View data map — **all visual-only, no handlers**. **[BACKEND]/[INTEGRATION]**
- No real third-party calls (TallyPrime, Google Workspace, RAJUK ECPS, WhatsApp). **[INTEGRATION]**
- No file/object storage; `fileRef` is a label, report "Export" produces nothing. **[BACKEND]**
- Language toggle flips a label only; the app is not localized. **[PLANNED]**
- No anomaly engine; `alert`/`ai_report` arrays are static. **[BACKEND]**
- No error-boundary or failure-state UI on any page. **[BACKEND]** (new contract work once a real backend can fail).
