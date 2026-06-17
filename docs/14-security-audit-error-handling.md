# Security, Audit & Error Handling

> **Scope of this document.** This file describes the security posture, audit trail, and error/edge-state handling of **SPACE ESSE · Practice Intelligence**: who can see what (roles/permissions), how the firm's actions are logged (the Activity / Audit Log), where data is meant to live (residency / PDPO), and how the interface behaves when things are loading, empty, refused, missing, or broken. For every capability it states plainly what the prototype does *today* versus what a backend must add.
>
> **Read this first.** SPACE ESSE is a **frontend-only, high-fidelity interactive prototype**. There is **no backend, no database, no real authentication, no role-based access control, no encryption layer, no network calls, and no persistence**. All data is mock data in `src/lib/mock/*`, served through `src/lib/api.ts` `resolve()` — a JSON deep-clone that resolves after ~280 ms of simulated latency. The whole app runs as one implied, fully-privileged user (Tahmid Karim, Owner / Principal), hard-coded into the topbar. Anything described here as a permission, a residency control, an encryption guarantee, or a server-side audit guarantee is **target design**, not working software, unless tagged `[IMPLEMENTED]`.

---

## Status legend

Every capability in this document carries exactly one tag.

| Tag | Meaning |
|---|---|
| **[IMPLEMENTED]** | Interactive and working in the frontend today (client-side only; resets on refresh). |
| **[MOCK]** | Renders from mock data; the underlying read / calc / log is simulated, not live. |
| **[BACKEND]** | Designed in the UI but needs an API / database / persistence to function. |
| **[INTEGRATION]** | Needs a third-party connector (accounting, Drive, email, authority portal). |
| **[PLANNED] / [RECOMMENDED]** | Not built; a future enhancement and the recommended target state. |

---

## 1. Security posture at a glance

The single most important fact: **the prototype has no security boundary.** There is nothing to attack and nothing to protect, because there is no server, no stored data, and no identity. This is normal and correct for a UI prototype — but it must be stated so no one mistakes the *appearance* of access control (finance restriction copy, role pickers, residency switches) for the *enforcement* of it.

| Security control | Today | Target |
|---|---|---|
| Authentication (login, session, MFA) | None — no login screen, no session | **[BACKEND]** |
| Authorization / RBAC | None — all screens visible to everyone | **[BACKEND]** |
| Finance-band restriction | Visual copy + uncontrolled switches only | **[BACKEND]** |
| Audit / activity log | **[MOCK]** read-only timeline of 14 seeded events | **[BACKEND]** (append-only store + server stamping) |
| Encryption (in transit / at rest) | N/A — no transport, no storage | **[BACKEND]** |
| Data residency / PDPO controls | Visual-only Selects + one local-state Switch | **[BACKEND]** |
| Read-only-by-design connector model | Stated in copy; connectors are **[MOCK]/[INTEGRATION]** | **[INTEGRATION]** |
| Input validation / sanitization | One presence gate (Capture); no sanitization | **[BACKEND]** |
| Error handling (network, permission) | None — no failures can occur offline | **[BACKEND]** |

A useful framing: the prototype demonstrates the *trust UX* (provenance, confidence, maker–checker, "we refuse to fabricate") without any of the *trust infrastructure* (auth, RBAC, audit integrity, encryption). The trust infrastructure is the bulk of the backend work.

---

## 2. Roles & permissions

### 2.1 Today: one implied super-user

The app ships with a single baked-in identity and no way to switch it:

- The topbar user menu hard-codes `Avatar name="Tahmid Karim"` with the subtitle **"Owner / Principal"**. Its three buttons — **"Profile & preferences"**, **"Switch role view"**, **"Sign out"** — have **no `onClick` handlers** and do nothing. **[BACKEND]**
- There is no login, no session, no "current user" object. Anyone who opens the URL sees and can operate every screen, including all finance figures. **[BACKEND]**
- The Dashboard greeting ("Good morning, Tahmid") and executive copy assume an owner-level reader; it is static text, not derived from an authenticated principal. **[MOCK]**

Role strings *do* exist in mock data — every `Employee` carries a human-readable `role` and `title` (e.g., Owner / Principal, Project Director, Finance / Admin, Authority Liaison). **Nothing in the code reads these to gate a screen.** They are display labels, not grants. **[MOCK]**

### 2.2 The target RBAC model (where it surfaces in the UI)

Two places in the prototype *render* permission concepts without enforcing them:

**Settings → Users & roles (`UsersTab`).** **[MOCK]** read of `useEmployees()`.
- A static notice states: *"Finance is restricted. Fees, invoices and payments are visible only to the Owner and Finance / Admin roles… Toggle exceptions per person below."* This describes the **finance band** — the one permission boundary the product cares most about. It is **not enforced anywhere**; every finance page (`/financials`, `/profitability`, invoice tables, client outstanding) is fully visible. **[BACKEND]**
- Each row has a **Role** Select (options: Owner / Principal, Project Director, Project Architect, Design Lead, Finance / Admin, Authority Liaison, Viewer (read-only)). The Select holds local state but **does not persist or change any permission**. **[IMPLEMENTED]** (client state only) / **[BACKEND]** (effect).
- Each row has a **Finance access** Switch (`defaultChecked` from initial role) and a label ("Full financials" / "Hidden"). The switch is **uncontrolled and visual-only**; the label is derived from the *initial* role and does **not** react to the switch. **[BACKEND]**
- **"Invite member"** button: **visual-only** (no handler). **[BACKEND]**

**Settings → Firm / KPIs / Localization tabs.** Owner-only controls (firm profile, KPI health-score weights, data residency) are presented as if owner-gated, but there is no gate — see §4 and the Settings inventory.

### 2.3 Target permission matrix (RECOMMENDED)

This is the model a backend should implement. It is **[BACKEND]/[PLANNED]** in full.

| Role | Delivery / Portfolio / Approvals | Finance (`/financials`, `/profitability`, invoices) | Capture | Review Queue (approve) | Settings (admin) | Client-facing report sign-off |
|---|---|---|---|---|---|---|
| Owner / Principal | Full | **Full** | Full | **Yes** | **Full** | **Yes** |
| Finance / Admin | Read | **Full** | Finance captures | Finance items | Finance/threshold config | No |
| Project Director | Full | Summary only (no invoice detail) | Full | Delivery items | No | Internal only |
| Project / Junior Architect | Project-scoped | **Hidden** | Own captures | No | No | No |
| Authority Liaison | Approvals-scoped | Hidden | Approval captures | No | No | No |
| Viewer (read-only) | Read | Hidden | No | No | No | No |

**Enforcement notes the backend must honour:**
- The finance band is the highest-stakes rule. It must be enforced **server-side** (filter the API response), not by hiding UI — otherwise figures leak in network payloads. **[BACKEND]**
- "Switch role view" (topbar) should let an Owner preview another role's view for QA. Currently a dead button. **[BACKEND]**
- Roles must map to permissions in a policy layer; the Settings copy already promises "roles sync to Space Esse permissions." **[BACKEND]**

---

## 3. Activity & Audit Log

**Route:** `/activity` · **Component:** `ActivityLog.tsx` · **Data:** `useActivity()` over 14 seeded `ActivityEvent` records in `src/lib/mock/ops.ts`. **Status: [MOCK] read.** It renders a convincing, provenance-stamped audit trail, but it logs *seeded history only* — **no live action in the app writes a new event** (Capture, Review approve/reject, Schedule toggle, etc. do **not** append here). **[BACKEND]**

### 3.1 Intent: append-only, tamper-evident, provenance-stamped

The page header states the design goal verbatim: *"An append-only, provenance-stamped trail of every capture, sync, approval, report and match — so every number in Space Esse can be traced back to who recorded it, when, and from where."* A closing note reinforces the tamper-evidence intent: *"Append-only — tamper-evident. Entries are never edited or deleted in place; corrections are recorded as new events. This is the audit trail of record for the firm."*

These are **statements of intent rendered as copy**. The current array is static mock data; nothing enforces append-only or tamper-evidence. Real append-only integrity (immutable storage, hash-chaining, no UPDATE/DELETE) is **[BACKEND]**.

### 3.2 What an event records

| Field | Meaning | Surfaced in UI |
|---|---|---|
| `id` | Event identifier | No (internal) |
| `type` | One of 7 event types (see below) | Type Badge + timeline node icon/tone |
| `actor` | Who performed it (name string) | Bold lead-in of each row |
| `summary` | What happened | Row text |
| `projectId` (nullable) | Linked project | Project Link → `/projects/:id` (if resolvable) |
| `timestamp` (ISO) | When | `relative(timestamp)`, `title=shortDate(...)` |
| `sourceName` | Originating source | `SourceChip` |
| `recordRef` (optional) | Source record reference | Appended to chip as `· {recordRef}` |

**Event types (`TYPE_META`):** `capture` (PencilLine/sage), `sync` (RefreshCw/blue), `approval` (Check/sage), `report` (FileText/blue), `match` (GitMerge/ochre), `invoice` (Receipt/ochre), `alert` (AlertTriangle/rust). Each type has ring/fill classes for its timeline node.

### 3.3 What the page computes (all over the seeded set)

- **KPIs** (`stats`, full unfiltered set):
  - **Events today** — events where `isSameDay(timestamp, TODAY)`, `TODAY = parseISO("2026-06-17")`. Footnote `Recorded {shortDate}`.
  - **Captures this week** — `type === "capture"` AND `timestamp >= TODAY − 7d`. Footnote Badge "Manual records".
  - **Last sync** — `relative` of newest `type === "sync"` event; footnote `SourceChip` of that source name, else "No sync recorded". While loading, KPI values show "—".
- **Day-grouped timeline** (`groupByDay`): keyed `yyyy-MM-dd`, group label `EEE, d MMM yyyy`, days sorted **descending**, events within a day **newest-first**. The current day gets a blue **"Today"** badge. A persistent **"Append-only"** badge sits in the card header.
- **Filters [IMPLEMENTED]** (client state): a **Type** Select ("All event types" + one per type) and a **SearchInput** matching `summary` OR `actor` (case-insensitive substring). `totalShown` and "of N total" update live.

### 3.4 Capture → audit-trail flow (target)

The Manual Capture page presents itself as the front door to the audit trail (*"it lands in the project record, cited to you"*), but the chain is broken at persistence today.

| Stage | Today | Target |
|---|---|---|
| **Input** | Capture form, per-variant fields, `projectId` + date + "Cite this to me" switch | Same UI |
| **Validation** | `ready` gate: required fields present only. No format/sanitization checks | Schema + provenance validation **[BACKEND]** |
| **Processing** | None — `submit` sets local `confirmed`; nothing computed/stored | Promote to citable record, attach provenance **[BACKEND]** |
| **Approval** | None at capture; decisions show "Unverified" cosmetically | Route to Review Queue (maker–checker) **[BACKEND]** |
| **Storage** | **None** — refresh discards everything | Append-only event + project record **[BACKEND]** |
| **Reporting** | Capture does **not** appear in `/activity`; recent-captures feed reads seeded `useDecisions()`, not new input | New `capture` event auto-appended **[BACKEND]** |
| **Follow-up** | "Capture another" / "Review entry" reset local state | Item appears in Review Queue for verification **[BACKEND]** |

---

## 4. Data residency, PDPO posture & the finance band

All controls below live in **Settings → Localization & residency (`LocaleTab`)** and **Firm profile (`FirmTab`)** and are **visual-only unless noted**.

### 4.1 Residency & PDPO (Bangladesh Personal Data Protection)

| Control | Behaviour | Status |
|---|---|---|
| **"PDPO 2025"** badge | Static label asserting compliance intent | **[MOCK]** (claim only) |
| **Hosting region** Select | `value="singapore"` (Singapore `ap-southeast-1` / Mumbai `ap-south-1`); no `onValueChange` | **[BACKEND]** (visual-only) |
| **"Bangladesh local mirror"** Switch | `mirror` local state, default off; toggles but **drives no other UI** | **[IMPLEMENTED]** (state only) / **[BACKEND]** (effect) |
| **"Data minimization"** note | Static: system "never stores NID / TIN / passport" | **[MOCK]** (policy copy) |
| Coverage benchmark | `"{pct(80)} of records carry full provenance"` (hardcoded 80%) | **[MOCK]** |
| **"View data map"** button | No handler | **[BACKEND]** (visual-only) |

The **data-minimization** stance (never persist national ID, tax ID, or passport numbers) is a meaningful design commitment, but with no storage layer there is nothing to enforce it against. A backend must implement field-level minimization and a residency/mirror policy that actually routes storage. **[BACKEND]**

### 4.2 Localization (security-adjacent, for completeness)

- **Interface language** Select (`value="en"`: English / "বাংলা — Bangla") — **visual-only**; no i18n applied. The topbar language toggle flips only the EN/বাংলা **label**, not the UI. **[IMPLEMENTED]** (label) / **[PLANNED]** (real localization).
- Bangla appears only in select mock fields (e.g. `project.nameBn`); the app is **not** localized.

### 4.3 The finance band (the one restriction that matters)

Described in §2.2. To restate for the security reader: the product's *only* genuine confidentiality boundary is **finance visibility** (fees, invoices, payments, margins, outstanding). It is currently **rendered as restricted** (Users & roles copy, Finance access switches) but **enforced nowhere**. The Settings inventory confirms the switches are uncontrolled and visual-only.

**Backend requirements for the finance band [BACKEND]:**
1. Enforce server-side: finance fields must be **omitted from API responses** for non-finance roles, never merely hidden in the DOM.
2. Make the Finance access Switch controlled, persisted, and audited (a `match`/`approval`-style event when access changes).
3. Gate finance routes (`/financials`, `/profitability`) and finance columns in shared tables (Portfolio, Clients, Project Detail) behind the policy.

---

## 5. Encryption, retention & backup (all [BACKEND])

None of these exist; there is no transport or storage. They are listed so the backend team has the full target.

| Control | Requirement | Status |
|---|---|---|
| **Encryption in transit** | TLS 1.2+ for all API + connector traffic | **[BACKEND]** |
| **Encryption at rest** | Encrypted DB volumes / field-level encryption for finance + contact PII | **[BACKEND]** |
| **Connector secrets** | OAuth tokens / API keys in a secrets vault, never in client state. The mock lists `authMethod` per source (e.g. "OAuth 2.0 (read-only)") but tokens are fictional | **[INTEGRATION]** |
| **Read-only enforcement** | Connectors are *described* as read-only/least-privilege ("never writes back"); must be enforced by scoped OAuth grants | **[INTEGRATION]** |
| **Retention policy** | Define retention for captures, audit events, reports; align with PDPO | **[BACKEND]** |
| **Backup / disaster recovery** | Regular encrypted backups; the sidebar "Firm data health 68%" is hardcoded, not a real health metric | **[BACKEND]** |
| **Audit-log immutability** | Append-only store, hash-chaining or WORM storage to honour the tamper-evidence claim | **[BACKEND]** |

---

## 6. Error handling & UI states actually present

This is the honest catalogue of states the UI handles **today**, drawn directly from the code inventory. The headline: the prototype handles the *benign* states well (loading, empty, refusal, not-found) and the *failure* states **not at all** — because offline mock reads never fail.

### 6.1 Loading (Skeleton) — [IMPLEMENTED]

Because every read goes through `resolve()` with ~280 ms simulated latency, React Query reports a brief `isLoading`. Many pages render `Skeleton` placeholders during it. Coverage is **inconsistent** — some pages skeleton fully, some only the KPI row, some not at all.

| Page / area | Loading behaviour |
|---|---|
| App route transitions | `Loader` — three pulsing dots (staggered 0/150/300 ms) at `h-[60vh]` via Suspense fallback |
| Dashboard | 4× KPI skeleton when `portfolio` falsy |
| Delivery | Full gate (KPIs + charts + lists + scorecard) skeletoned |
| Project Detail | Skeleton header + 4 KPI skeletons |
| Profitability / Resourcing | **KPI row only** skeletoned (charts/tables render with defaults) |
| Goals | **Full-page** skeleton (4 KPI + 5 rows) + alternate loading description |
| Approvals / Risks / Clients / Calendar / Review / Schedules / Activity Log / Search | Skeleton present (full or partial per page) |
| **Financials / Pipeline** | **No skeleton** — render with empty/default data |
| **Portfolio** | No skeleton branch — relies on `projects=[]` default |
| **Client Detail / Capture / Data Sources / Data Quality / Settings** | **No loading state** (synchronous mock reads / hook defaults) |

### 6.2 Empty (EmptyState) — [IMPLEMENTED]

`EmptyState` (icon + title + description + optional action) renders when a filtered/derived list is empty.

| Where | Title (verbatim) |
|---|---|
| Portfolio | "No projects match" |
| Delivery — milestones | "Nothing due" |
| Delivery — approvals | "Nothing in flight" |
| Approvals | "No approvals tracked" |
| Deliverables | "No deliverables match" |
| Risks — register | "No matching risks" |
| Risks — anomalies | "No anomalies right now" |
| Calendar — agenda | "Nothing scheduled" |
| Clients | "No clients match" |
| Pipeline — table | "No opportunities" |
| Goals — firm / project | "No firm goals set" / "No project goals set" |
| Review — pending / resolved | "Queue is clear" / "Nothing resolved yet" |
| Schedules | "No scheduled reports" |
| Activity Log | "No matching events" (filtered vs unfiltered description branch) |
| Search | "Type a query to search" / `No results for "{q}"` |
| Capture — recent feed | "Nothing captured yet" |
| Data Quality — matching queue | "Every alias is matched" |
| Command Palette | `No matches for "{q}".` |

**Gaps:** Topbar Notifications popover, Data Sources tiles, and the Data Quality freshness/source tables have **no dedicated empty component** — they render an empty list silently.

### 6.3 "Insufficient data" — the anti-hallucination state — [IMPLEMENTED]

This is the product's signature state and the most security-relevant one: the system **refuses to show a number it cannot defend**, rather than fabricating. It is first-class in both the data model (`Confidence` includes `"insufficient"`; `Metric.value` is nullable) and the UI.

| Surface | Behaviour |
|---|---|
| `InsufficientData` component | Dashed box, DatabaseZap icon, "Insufficient data" + *"We show nothing rather than a fabricated number."* Optional "Capture the missing data" action (only if `onCapture` wired) |
| `KpiCard` insufficient branch | When `confidence === "insufficient"` or `value === null` → renders "— —" + "Insufficient data" (+ note), no delta/sparkline |
| `ConfidenceBadge` / `CONFIDENCE.insufficient` | 0 bars, neutral tone, label literal **"No data"** |
| AI Assistant | Two refusal paths: the canned "Can we take on a new project next month?" answer (dashed card) and `genericAnswer()` fallback for any unmatched question (insufficient, empty citations) |
| AI Reports | Daily-brief block 4 (`insufficient: true`, empty citations) renders `InsufficientData` (hint is hardcoded copy) |
| Project Detail | Forecast-margin KPI shows "Insufficient data" when `forecastMargin.value === null` (p6, p8); Decisions tab empty → `InsufficientData` |
| Profitability / Resourcing | Callouts + per-row insufficient badges; Resourcing **forces** Spare-capacity KPI to `null`/insufficient despite a computed value, because timesheet coverage is too low to trust |

**Security note:** this refusal is currently driven by *seeded confidence/null values*, not by a live confidence engine. The behaviour is real **[IMPLEMENTED]**; the *judgement* behind it (coverage thresholds, provenance scoring) is **[BACKEND]**.

### 6.4 Not-found — [IMPLEMENTED] (partial)

| Where | Behaviour |
|---|---|
| Unknown route `*` | `<Navigate to="/" replace />` — silent redirect to Dashboard (no 404 page) |
| Project Detail (`/projects/:id`) | `useProjectBundle` returns `null` for an unknown id → renders text **"Project not found."** |
| Client Detail (`/clients/:id`) | `clientById(id)` undefined → card **"Client not found"** + *"We couldn't find an account for {id}."* + back link |

Detail routes resolve no NAV item, so `document.title` falls back to the firm name.

### 6.5 Error states — **absent** ([BACKEND])

There is **no error UI anywhere**: no error boundary, no "failed to load," no retry, no network/validation/permission error rendering. This is expected — offline mock reads through `resolve()` cannot reject. The lone `SOURCE_STATUS.error` ("Error"/rust) exists as an enum value but **no mock source uses it**, so it never renders.

### 6.6 Other connector/data states (visual indicators only)

`SourceStatus` is surfaced visually (Topbar pill, Data Sources tiles, Data Quality freshness): `connected`, `syncing` (pulsing dot), `stale`, `error`, `manual`, `not_connected`. Stale/freshness is computed against the 48h `STALE_HOURS` threshold for display only. None of this is a live health check — it reads seeded `lastSync`/`freshnessHours`. **[MOCK]**

---

## 7. State → where used → behaviour (master table)

| State | Where used | Behaviour today | Status |
|---|---|---|---|
| **Loading (Skeleton)** | Most pages (see §6.1); Suspense `Loader` between routes | Placeholder blocks during ~280 ms `resolve()`; coverage inconsistent (Financials/Pipeline/Portfolio/Settings have none) | **[IMPLEMENTED]** |
| **Empty (EmptyState)** | ~20 lists/queues (§6.2) | Icon + title + description when a filtered/derived list is empty; some action buttons are visual-only | **[IMPLEMENTED]** |
| **Insufficient data** | `InsufficientData`, `KpiCard`, `ConfidenceBadge`, AI Assistant (2 paths), AI Reports, Project Detail, Profitability, Resourcing | Refuses to show an unreliable number ("No data" / "— —"); driven by seeded confidence/null values | **[IMPLEMENTED]** (UI); **[BACKEND]** (real confidence engine) |
| **Not-found** | `*` route → redirect; Project Detail; Client Detail | Redirect to `/`, or "Project/Client not found" message + back link | **[IMPLEMENTED]** |
| **Stale / syncing / manual / not-connected** | Topbar source pill, Data Sources, Data Quality | Status dot + label from seeded `SourceStatus`; freshness vs 48h threshold | **[MOCK]** |
| **Error (network/validation/permission)** | — | **No UI exists**; offline reads can't fail; `SOURCE_STATUS.error` enum is unused | **[BACKEND]** |
| **Audit event append** | Activity Log | Reads 14 seeded events; **no live action appends** | **[MOCK]** read / **[BACKEND]** write |
| **Permission denied / finance hidden** | Finance pages, Users & roles | **Not enforced**; everything visible; switches visual-only | **[BACKEND]** |
| **Auth / session expired** | — | No login, no session, nothing to expire | **[BACKEND]** |

---

## 8. What a backend must add (security/audit/error)

A prioritized target list. All **[BACKEND]** unless tagged **[INTEGRATION]**.

**Identity & access**
1. Authentication: login, sessions, MFA, and wiring the dead "Sign out" / "Switch role view" buttons.
2. RBAC enforced **server-side** — especially the finance band (filter API responses, do not just hide DOM).
3. Persist and audit role/finance-access changes from Settings → Users & roles.

**Audit integrity**
4. Append-only, tamper-evident audit store (immutable rows, hash-chaining/WORM) to make the page's claims true.
5. Auto-append events on every real action: capture, review approve/reject, schedule toggle, role change, sync, report generation, match confirmation.
6. Server-side timestamps and actor identity (never trust client-supplied `actor`/`timestamp`).

**Data protection**
7. Encryption in transit (TLS) and at rest; field-level encryption for finance + contact PII.
8. Data-minimization enforcement (reject/strip NID/TIN/passport) and a real residency/mirror policy behind the Settings controls.
9. Connector secrets in a vault; enforce least-privilege, read-only OAuth scopes. **[INTEGRATION]**
10. Retention and backup/DR policies aligned to PDPO 2025.

**Error handling**
11. Add a React **error boundary** + per-query error states (network, timeout) with retry — `resolve()`'s comment already anticipates swapping in `fetch()`.
12. Real input **validation & sanitization** on write (server-side; the Capture `ready` gate is presence-only).
13. **Permission-error** UI (403 / "you don't have access to finance") and **session-expired** handling.
14. A real **404** page instead of the silent redirect, and surface fetch failures on Data Sources / Data Quality where today empty states are silent.

---

## 9. Summary for each audience

- **Founders / partners / investors:** the trust *experience* is built and convincing — provenance popovers, confidence levels, maker–checker review, and a genuine "we refuse to fabricate" refusal. The trust *infrastructure* — auth, RBAC, an immutable audit store, encryption, residency enforcement — is not yet built and is the core of the backend phase.
- **Architects / PMs:** finance figures are visible to everyone today; the finance band, role views, and the audit trail of who-did-what are target design. Captures look saved but are not, and do not yet appear in the Activity Log.
- **Developers:** there are no `useMutation`s, no write paths, no error/permission/network handling, and no auth. The Activity Log, finance restriction, residency controls, and most Settings actions are visual-only or local-state-only. Build the security/audit/error layer server-side; the UI states (loading, empty, insufficient, not-found) are ready to receive real signals.
- **QA:** test the present states — Skeleton timing, EmptyState triggers, the insufficient/"No data" refusals, and not-found redirects — and log every visual-only control (Save, Connect, Sync, Confirm, Invite, the finance switches, residency Selects) as **not yet functional**. There is currently no error path to test because offline reads cannot fail.
