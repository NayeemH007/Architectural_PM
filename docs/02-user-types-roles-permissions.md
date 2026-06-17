# User Types, Roles & Permissions

> **Scope of this document.** This file describes *who* SPACE ESSE · Practice Intelligence is built for, *what each role does day-to-day*, *which screens serve them*, and *how access control is meant to work*. It then states — plainly — what the prototype actually enforces today.
>
> **Read this first.** SPACE ESSE is a **frontend-only, high-fidelity interactive prototype**. There is **no backend, no database, no real authentication, and no role-based access control (RBAC)**. The entire app runs as a single, implied, fully-privileged user — **Tahmid Karim, Owner / Principal** — whose name and avatar are hard-coded into the topbar. Every screen, every figure, and every restricted control is visible to whoever opens the app. All data is mock data served from `src/lib/mock/*` through `src/lib/api.ts` `resolve()` (a deep-clone with ~280ms simulated latency). Wherever this document describes a permission, a finance restriction, or a role view, treat it as the **target design**, not as working software, unless explicitly tagged `[IMPLEMENTED]`.

---

## Status legend

Every capability in this document is tagged with exactly one status:

| Tag | Meaning |
|---|---|
| **[IMPLEMENTED]** | Interactive and working in the frontend today (client-side only; resets on refresh). |
| **[MOCK]** | Renders from mock data; the underlying read/calc is simulated, not live. |
| **[BACKEND]** | Designed in the UI but needs an API / database / persistence to actually function. |
| **[INTEGRATION]** | Needs a third-party connector (accounting, Drive, email, authority portal, etc.). |
| **[PLANNED] / [RECOMMENDED]** | Not built; a future enhancement and the recommended target state. |

---

## 1. The honest baseline: who is the "user" today?

The prototype ships with **one identity**, baked in as static UI:

- The topbar user menu hard-codes **`Avatar name="Tahmid Karim"`** with the subtitle **"Owner / Principal"**. Its three buttons — **"Profile & preferences"**, **"Switch role view"**, **"Sign out"** — have **no `onClick` handlers** and do nothing. **[BACKEND]**
- Per-route `document.title` and the brand block read `firm.name` from mock data; there is no login screen, no session, and no notion of "the current user." Anyone who loads the URL is, in effect, Tahmid Karim. **[BACKEND]**
- The greeting on the Dashboard ("Good morning, Tahmid") and the executive framing of the copy assume an owner-level reader. It is hard-coded text, not derived from an authenticated identity. **[MOCK]**

So while this document lays out a full set of user types and a complete RBAC matrix, **none of it is enforced in the prototype**. The value of the document is twofold: (1) it shows *who the product is for* so screens can be judged against real jobs-to-be-done, and (2) it defines the **target permission model** a backend team must implement before this becomes a multi-user system.

### Where role data already exists in mock form

The firm's ten people are modelled as `Employee` records in `src/lib/mock/data.ts`, each carrying a human-readable `role` and `title`. These are **display strings, not permission grants** — nothing in the code reads `employee.role` to gate a screen. **[MOCK]**

| Employee ID | Name | `role` | `title` |
|---|---|---|---|
| e1 | Tahmid Karim | Owner / Principal | Principal Architect |
| e2 | Rezwana Hoque | Project Director | Director, Delivery |
| e3 | Arif Chowdhury | Project Architect | Senior Project Architect |
| e4 | Nusrat Jahan | Design Lead | Design Lead |
| e5 | Sabbir Rahman | Project Architect | Project Architect |
| e6 | Farhana Islam | Architect | Architect |
| e7 | Imran Hossain | Junior Architect | Junior Architect |
| e8 | Maya Das | Finance / Admin | Finance & Admin Officer |
| e9 | Kamrul Pasha | BIM / CAD Lead | BIM & Visualization Lead |
| e10 | Shahed Alam | Liaison | Authority Liaison |

> **Data note.** `firm.staff` is `22`, but only **10** employee records exist. Utilization for e1 (Owner), e8 (Finance/Admin), and e10 (Liaison) is `null` ("no time logged"), which the Resourcing page surfaces as *unknown*, never as *idle*. This is deliberate: non-billable and field roles are not expected to log billable time.

---

## 2. User types & responsibilities

Each subsection describes the role's job-to-be-done and the **modules/dashboards that serve them**. All modules listed are **[MOCK]** reads unless otherwise noted (they render mock data through React Query). Interactivity tags refer to client-side behaviour only.

### 2.1 Owner / Principal (Tahmid Karim, e1)

**What they do.** Runs the practice. Owns money, growth, hiring, client relationships, and final sign-off on anything client-facing. Wants a single morning read on "what needs me today" and the ability to interrogate any number down to its source.

**Primary modules:**
- **Dashboard (`/`)** — executive overview: collected/overdue KPIs, AI daily briefing card, top alerts, stuck approvals, project watchlist. **[MOCK]**
- **Financials (`/financials`)** and **Profitability (`/profitability`)** — cash, collections, fee-based margins, the Bangladesh withholding (VAT/VDS/AIT) explainer. **[MOCK]**
- **Goals & Targets (`/goals`)** — the director's scorecard: firm and project targets vs actuals. **[MOCK]**
- **AI Reports (`/reports`)** — reads briefings and (in the target design) approves client-facing reports. **[MOCK]**
- **Review Queue (`/review`)** — the maker–checker gate; approve/reject is **[IMPLEMENTED]** as local state only (resets on refresh; no persistence).
- **Pipeline (`/pipeline`)**, **Clients (`/clients`)** — growth and relationship health. **[MOCK]**
- **AI Assistant (Ctrl/Cmd+J)** — natural-language questions; canned answers from a fixed map, including a deliberate "insufficient data" refusal. **[IMPLEMENTED]** (interactive UI; answers are canned, not inferred).

**Owner-only controls in the target design:** finance visibility, role assignment, KPI weight tuning, data-residency settings — all currently **[BACKEND]/[PLANNED]** (see §4–§5).

### 2.2 Project Director / Manager (Rezwana Hoque, e2)

**What they do.** Owns delivery across the portfolio — schedule, approvals, deliverable health, risk, and resourcing. The operational counterpart to the Owner.

**Primary modules:**
- **Delivery & Operations (`/delivery`)** — schedule slippage, overdue milestones, stuck approvals, deliverables at risk, and the per-project delivery scorecard. **[MOCK]**
- **Portfolio (`/portfolio`)** — all active projects with filters, search, and grid/table toggle. **[IMPLEMENTED]** filters/search/view-toggle (client state).
- **Authority Approvals (`/approvals`)** — RAJUK/FSCD/CAAB/DoE tracker with statutory-window overdue logic and a critical blocking banner. **[MOCK]**; group-by Select is **[IMPLEMENTED]**.
- **Risks & Issues (`/risks`)** — risk matrix, by-category filter, AI-detected anomalies. **[IMPLEMENTED]** matrix-cell and category filters (client state).
- **Calendar (`/calendar`)** — milestones, approval deadlines, meetings. **[IMPLEMENTED]** month navigation (client state).
- **Resourcing (`/resourcing`)** — team load and capacity (read for planning). **[MOCK]**
- **Goals & Targets (`/goals`)** — owns several project-scope targets. **[MOCK]**

### 2.3 Project Architect (Arif Chowdhury e3, Sabbir Rahman e5)

**What they do.** Runs one or more projects end-to-end: drawings, milestones, decisions, day-to-day coordination. Most of their "data" (decisions, scope changes, site notes) has no API, so manual capture is their primary contribution.

**Primary modules:**
- **Project Detail (`/projects/:id`)** — their main workspace: phase stepper, KPI strip, and seven tabs (Overview, Schedule & Approvals, Deliverables, Financials, Team, Decisions, Risks). **[MOCK]**
- **Manual Capture (`/capture`)** — log decisions, approval updates, scope changes, timesheets, site reports, promote WhatsApp threads. **[IMPLEMENTED]** as form + inline success only; **nothing is saved** (no write to store/API). **[BACKEND]** for real persistence.
- **Document Control (`/deliverables`)** — drawing register, revision/churn tracking. **[MOCK]**; filters/search **[IMPLEMENTED]**.
- **Calendar (`/calendar`)**, **Risks (`/risks`)** — their project's deadlines and risks. **[MOCK]**

> **Spotlight: Arif Chowdhury (e3)** is the prototype's hard-coded "overloaded" person — flagged >90% utilization for six consecutive weeks. The Resourcing page renders a dedicated rust warning card for `e3`, and the AI Assistant cites him by name. **[MOCK]** (the flag is data, not a live calculation against a threshold engine).

### 2.4 Design Lead (Nusrat Jahan, e4) & Architect / Junior Architect (Farhana Islam e6, Imran Hossain e7)

**What they do.** Design development and production. They consume project schedules and deliverable status, capture effort (timesheets) and design decisions, and work the drawing register. Junior staff have the narrowest scope.

**Primary modules:**
- **Project Detail (`/projects/:id`)**, **Document Control (`/deliverables`)**, **Manual Capture (`/capture`)** — same as Project Architect, scoped in the target design to their assigned projects. **[MOCK]** / capture **[IMPLEMENTED]** (non-persisting).
- **Calendar (`/calendar`)** — personal and project deadlines. **[MOCK]**

These roles are the ones whose **timesheet coverage gates every utilization, capacity, and true-margin number** in the app. The product repeatedly states (Resourcing, Profitability, Capture) that capacity and margin answers stay low-confidence until coverage clears ~80%.

### 2.5 Finance / Admin (Maya Das, e8)

**What they do.** Owns money: invoices, payments, VAT/VDS/AIT withholding, collections, outstanding-by-client. The only non-Owner role expected to see full financial detail.

**Primary modules:**
- **Financials (`/financials`)** — invoices ledger, aging buckets, cash-flow trend, withholding explainer. **[MOCK]**; status filter **[IMPLEMENTED]**.
- **Profitability (`/profitability`)** — fee-based margins, planned-vs-actual cost. **[MOCK]**.
- **Clients (`/clients` and `/clients/:id`)** — lifetime fee, outstanding, relationship health. **[MOCK]**.
- **Manual Capture (`/capture`)** — log approval status updates and reconcile change orders. **[IMPLEMENTED]** (non-persisting).
- **Data Sources (`/data-sources`)** / **Data Quality (`/data-quality`)** — watches the TallyPrime export freshness that drives finance KPIs. **[MOCK]**.

> **Finance restriction (target design).** The Settings → Users & roles tab states: *"Finance is restricted. Fees, invoices and payments are visible only to the Owner and Finance / Admin roles."* In the prototype this is **static copy plus a visual-only switch** — the finance modules are open to everyone who opens the app. **[BACKEND]** (see §4).

### 2.6 BIM / CAD Lead (Kamrul Pasha, e9)

**What they do.** Owns the model/drawing production pipeline and visualization. Cares about revision churn, file presence on Drive, and deliverable status across disciplines.

**Primary modules:**
- **Document Control (`/deliverables`)** — drawing register, by-discipline and by-status charts, the high-churn (>3 revisions) watchlist, file-presence signals. **[MOCK]**; filters **[IMPLEMENTED]**.
- **Project Detail → Deliverables tab** — per-project drawing register. **[MOCK]**.

> **Reality of the "CAD integration."** AutoCAD/SketchUp/D5 expose **no data API**. Deliverable rows are **file-presence signals harvested from Google Drive**, not read from the CAD apps. A "manual" source chip means no file detected yet. Live Drive harvesting is **[INTEGRATION]**; what renders today is **[MOCK]**.

### 2.7 Authority Liaison (Shahed Alam, e10)

**What they do.** Shepherds submissions through Dhaka authorities (RAJUK, FSCD, CAAB, DoE, City Corporation, utilities). Tracks statutory windows, query letters, and resubmission dates — almost all by hand, because none of these bodies expose an API.

**Primary modules:**
- **Authority Approvals (`/approvals`)** — the tracker; owner of nearly every approval record in the mock data (Shahed Alam is the named owner on 7 of 8 approvals). **[MOCK]**; group-by **[IMPLEMENTED]**.
- **Manual Capture → "Approval update"** — log authority status changes and query details. **[IMPLEMENTED]** (non-persisting).
- **Calendar (`/calendar`)** — next expected decision dates. **[MOCK]**.

> **Reality of the "RAJUK integration."** Approval status is tracked **manually from the RAJUK ECPS portal and liaison capture**. "Open ECPS" and "Ask liaison" buttons on the Approvals page are **visual-only**. Live authority sync is **[INTEGRATION]/[PLANNED]**.

### 2.8 The broader role set (target design)

The Settings → Users & roles tab defines a `ROLE_OPTIONS` list used to populate a per-person role Select. These are the canonical roles the target RBAC should support:

| Role option (verbatim in Settings) | Maps to user type above |
|---|---|
| Owner / Principal | §2.1 |
| Project Director | §2.2 |
| Project Architect | §2.3 |
| Design Lead | §2.4 |
| Finance / Admin | §2.5 |
| Authority Liaison | §2.7 |
| Viewer (read-only) | New: read-only stakeholder / investor / external reviewer |

> The role Select **is [IMPLEMENTED]** as client state (you can change the displayed role in the dropdown), but **changing it grants/revokes nothing** — there is no permission engine behind it, and the change is not persisted. **[BACKEND]**.
>
> Note the BIM / CAD Lead and the broader "Architect / Junior Architect" titles exist in the *employee* data but are **not** distinct options in the Settings role Select. A target implementation should reconcile the employee `role` strings with the canonical `ROLE_OPTIONS` (e.g., add BIM/CAD Lead and the junior architect tiers, or map them onto Project Architect + a seniority attribute).

---

## 3. Module-to-role service map

A quick reference of which modules primarily serve which user types. All are **[MOCK]** reads unless tagged otherwise; "owns" means the role is the primary actor/contributor in the target design.

| Module / Route | Owner | Director | Proj. Architect | Design/Jr | Finance | BIM/CAD | Liaison | Viewer |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Dashboard `/` | reads | reads | reads | reads | reads | reads | reads | reads |
| Delivery & Ops `/delivery` | reads | **owns** | reads | reads | – | reads | reads | reads |
| Portfolio `/portfolio` | reads | **owns** | reads | reads | – | reads | – | reads |
| Project Detail `/projects/:id` | reads | reads | **owns** | reads | reads (fin tab) | reads (deliv) | reads (appr) | reads* |
| Financials `/financials` | reads | – | – | – | **owns** | – | – | – |
| Profitability `/profitability` | reads | reads | – | – | **owns** | – | – | – |
| Clients `/clients`, `/clients/:id` | reads | reads | – | – | **owns** | – | – | reads |
| Pipeline `/pipeline` | **owns** | reads | – | – | – | – | – | reads |
| Goals & Targets `/goals` | **owns** | reads | – | – | reads | – | – | reads |
| Authority Approvals `/approvals` | reads | reads | reads | – | – | – | **owns** | reads |
| Document Control `/deliverables` | reads | reads | reads | reads | – | **owns** | – | reads |
| Risks & Issues `/risks` | reads | **owns** | reads | reads | – | – | reads | reads |
| Calendar `/calendar` | reads | reads | reads | reads | – | reads | reads | reads |
| Resourcing `/resourcing` | reads | **owns** | reads | reads | – | – | – | – |
| AI Reports `/reports` | **owns** | reads | reads | reads | reads | – | – | reads (internal) |
| Review Queue `/review` | **owns** | reads | – | – | reads | – | – | – |
| Scheduled Reports `/schedules` | **owns** | reads | – | – | – | – | – | – |
| Manual Capture `/capture` | reads | reads | **owns** | **owns** | **owns** | **owns** | **owns** | – |
| Activity Log `/activity` | **owns** | reads | reads | – | reads | – | – | – |
| Data Sources `/data-sources` | **owns** | reads | – | – | reads | – | – | – |
| Data Quality `/data-quality` | **owns** | reads | – | – | reads | – | – | – |
| Settings `/settings` | **owns** | – | – | – | partial (finance) | – | – | – |
| Search `/search` | reads | reads | reads | reads | reads | reads | reads | reads |

`reads*` for Viewer on Project Detail assumes finance tab is hidden in the target design.

> **Today's reality.** In the prototype **every cell above is "full read/write for everyone"** — there is no gating. The map is the target service model, not current behaviour.

---

## 4. Roles & permissions: current state vs. target

### 4.1 What exists today

| Capability | Status | Notes |
|---|---|---|
| Single implied user (Tahmid Karim, Owner) | **[IMPLEMENTED]** | Hard-coded avatar/name/subtitle in topbar. |
| Login / authentication | **[BACKEND]** | No login screen, no session, no token. |
| "Sign out" / "Profile & preferences" / "Switch role view" | **[BACKEND]** | Buttons exist with **no handlers**. |
| Per-person role assignment (Settings → Users) | **[IMPLEMENTED]** (cosmetic) | Role Select changes the displayed value as client state; grants nothing; not persisted. |
| Finance-access toggle per person (Settings → Users) | **[BACKEND]** | Switch is **visual-only / uncontrolled**; label derives from initial role and does not react to the switch. |
| Finance restriction (modules hidden for non-finance roles) | **[BACKEND]** | Stated in copy only; finance pages are open to all. |
| "Switch role view" (see the app as another role) | **[PLANNED]** | Menu item present, no handler. |
| Maker–checker approve/reject (Review Queue) | **[IMPLEMENTED]** (local) | Local state mutation only; resets on refresh; no audit write. |
| Append-only audit log (`/activity`) | **[MOCK]** | Renders mock events; copy claims "tamper-evident, never edited in place," but there is no real append-only store. |
| Role-scoped data (a Junior Architect sees only their projects) | **[PLANNED]** | No scoping exists; all data is visible to all. |

### 4.2 What "permissions" means in the prototype

There are **no permission checks anywhere in the codebase**. Every route is a child of one `AppShell`; every page calls read-only React Query hooks that return the full mock dataset. The few "write-like" interactions are all **client-state only and non-persistent**:

- **Capture forms** — `useState` + inline success; nothing is saved. **[IMPLEMENTED]** (UI) / **[BACKEND]** (persistence).
- **Review approve/reject** — local array mutation. **[IMPLEMENTED]** (local) / **[BACKEND]** (persistence + audit).
- **Schedules active toggle** — local state; does not write back. **[IMPLEMENTED]** (local) / **[BACKEND]**.
- **KPI weight inputs (Settings)** — live sum and a real `disabled` gate on the (visual-only) Save button. **[IMPLEMENTED]** (calc) / **[BACKEND]** (save).
- **Everything labelled Connect / Sync now / Disconnect / Confirm match / Save / Export / Generate brief / Approve & send (beyond local state)** — **visual-only**. **[BACKEND]/[INTEGRATION]**.

---

## 5. Recommended RBAC matrix (target state)

This is the **[RECOMMENDED]** target a backend team should implement. It is **not built**. Permissions are expressed per role × module as:

- **R** = Read | **W** = Create/Edit (write) | **A** = Approve / sign-off authority | **–** = No access | **R(own)** = Read limited to assigned projects | **W(own)** = Write limited to assigned projects

Roles: **OWN** Owner/Principal · **DIR** Project Director · **PA** Project Architect · **DES** Design Lead / Architect / Junior · **FIN** Finance/Admin · **CAD** BIM/CAD Lead · **LIA** Authority Liaison · **VIEW** Viewer (read-only).

### 5.1 Delivery & projects

| Module | OWN | DIR | PA | DES | FIN | CAD | LIA | VIEW |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Dashboard | R | R | R | R | R | R | R | R |
| Portfolio / Delivery | R | R/W | R(own) | R(own) | R | R | R | R |
| Project Detail (non-finance tabs) | R/W | R/W | R/W(own) | R/W(own) | R | R(own) | R(own) | R |
| Risks & Issues | R/W | R/W | W(own) | R(own) | – | – | R(own) | R |
| Calendar | R | R | R | R | – | R | R | R |
| Resourcing | R | R/W | R | R | – | – | – | – |

### 5.2 Finance (restricted)

| Module | OWN | DIR | PA | DES | FIN | CAD | LIA | VIEW |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Financials | R | – | – | – | R/W | – | – | – |
| Profitability | R | R | – | – | R/W | – | – | – |
| Clients (fees/outstanding) | R | R | – | – | R/W | – | – | R(no $) |
| Project Detail → Financials tab | R | R | – | – | R/W | – | – | – |

> Finance read access should be **per-person grantable** (the Settings "Finance access" exception), so a trusted Director can be elevated without changing their base role.

### 5.3 Documents, approvals, capture

| Module | OWN | DIR | PA | DES | FIN | CAD | LIA | VIEW |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Document Control | R | R | R/W(own) | R/W(own) | – | R/W | – | R |
| Authority Approvals | R | R | R(own) | – | – | – | R/W | R |
| Manual Capture | R/W | R/W | W(own) | W(own) | W | W(own) | W | – |

### 5.4 Intelligence & administration

| Module | OWN | DIR | PA | DES | FIN | CAD | LIA | VIEW |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| AI Reports (internal) | R/W | R | R | R | R | – | – | R |
| AI Reports (client-facing send) | A | – | – | – | – | – | – | – |
| Review Queue (approve/reject) | A | R | – | – | R | – | – | – |
| Scheduled Reports | R/W | R | – | – | – | – | – | – |
| Activity Log | R | R | R(own) | – | R | – | – | – |
| Data Sources | R/W | R | – | – | R | – | – | – |
| Data Quality | R/W | R | – | – | R | – | – | – |
| Settings (firm/users/locale) | R/W | – | – | – | R/W(finance) | – | – | – |
| Settings (KPI weights/thresholds) | R/W | R | – | – | – | – | – | – |

### 5.5 Cross-cutting rules (target)

1. **Finance is opt-in by exception.** Only OWN and FIN see money by default; per-person finance grants are the only way to widen it. **[PLANNED]**
2. **Client-facing approval is owner-only.** A report with `audience === "external"` and `status === "needs_review"` must pass the Review Queue and be approved by OWN before any send. Today the entire flow (Approve & send, scheduled delivery) is **visual-only**. **[BACKEND]**
3. **Maker–checker is mandatory for promotions.** Captured records, AI reports, project matches, and discrepancies require a checker (OWN/DIR) to approve. The UI models this; persistence and identity binding are **[BACKEND]**.
4. **Project scoping.** PA/DES/CAD/LIA reads and writes should be limited to assigned projects (`teamIds`/`leadId` on the Project record already model the assignment). **[PLANNED]**
5. **Append-only audit.** Every write should emit an immutable `ActivityEvent` with actor, source, and timestamp. The schema exists; the store does not. **[BACKEND]**
6. **Read-only by design for sources.** All connectors are least-privilege/read-only; RBAC must never grant write-back to a source system. (Consistent with the app's stated stance.) **[INTEGRATION]**

---

## 6. Worked permission flow (target): a captured decision

This is how a single record *should* travel once a backend and RBAC exist. Tags show what is built today vs. what must be added.

| Stage | What happens | Who | Today |
|---|---|---|---|
| **Input** | Project Architect opens Manual Capture, picks a project + decision type, writes a one-line summary, sets "Cite this to me." | PA | **[IMPLEMENTED]** (form + inline success) |
| **Validation** | `ready` gate requires a project and the type-specific required field (note / hours / paste). No per-field errors. | client | **[IMPLEMENTED]** (only this gate) |
| **Processing** | Record is normalized into a `Decision` with `Provenance` (sourceId, recordRef, observedAt) and `promoted: false`. | system | **[BACKEND]** (no write occurs today) |
| **Approval** | Lands in the Review Queue as a `capture` item; a checker (OWN/DIR) clicks "Verify & promote." | DIR/OWN | **[IMPLEMENTED]** local state only; **[BACKEND]** for real promotion |
| **Storage** | On approval, `promoted` flips to `true`, the record becomes citable, and an append-only `ActivityEvent` is written. | system | **[BACKEND]** |
| **Reporting** | The promoted decision becomes available to AI Reports / the Assistant as a cited source with confidence. | system | **[MOCK]** (answers are canned; citations are mock) |
| **Follow-up** | Appears in the Activity Log and the project's Decisions tab as "Verified." | all (scoped) | **[MOCK]** |

The same Input → Validation → Processing → Approval → Storage → Reporting → Follow-up shape applies to approval updates (Liaison), scope changes (PA/Finance), and timesheets (all billable staff) — each gated to the appropriate role in the target RBAC.

---

## 7. Localization, residency & the user

Two user-relevant settings exist as **visual-only / partially-interactive** controls in Settings → Localization & residency:

- **Interface language (EN / বাংলা).** The topbar language toggle and the Settings language Select are **cosmetic**: the toggle flips the EN/বাংলা **label only** and applies no i18n. Bangla text appears solely in select mock fields (e.g., `project.nameBn`); the UI is **not localized**. **[PLANNED]** for true per-user locale.
- **Data residency (hosting region, Bangladesh local mirror, PDPO 2025).** The region Select is **visual-only**; the "Bangladesh local mirror" Switch is **[IMPLEMENTED]** as client state but drives no other UI. Residency enforcement and the "never store NID/TIN/passport" data-minimization promise are **[BACKEND]/[PLANNED]**.

These belong to per-user preferences in a real system but are firm-wide, non-persistent today.

---

## 8. Summary: current vs. planned at a glance

| Area | Current prototype | Target |
|---|---|---|
| Identity | One implied user (Owner) **[IMPLEMENTED]** | Multi-user auth + sessions **[BACKEND]** |
| Authentication | None | Login/SSO **[BACKEND]** |
| Roles | Display strings only **[MOCK]** | 8 canonical roles, assignable **[PLANNED]** |
| Permissions | None enforced | RBAC matrix in §5 **[PLANNED]** |
| Finance restriction | Copy + visual switch **[BACKEND]** | Owner/Finance-only + per-person grants **[PLANNED]** |
| Role view switching | Menu item, no handler **[BACKEND]** | "View as role" **[PLANNED]** |
| Maker–checker | Local state approve/reject **[IMPLEMENTED]** | Persisted, identity-bound, audited **[BACKEND]** |
| Audit trail | Mock events **[MOCK]** | Append-only immutable log **[BACKEND]** |
| Project scoping | None | Scoped reads/writes by assignment **[PLANNED]** |
| Localization | Label-only toggle **[PLANNED]** | Per-user EN/বাংলা i18n **[PLANNED]** |

**Bottom line:** the prototype demonstrates *what each role would do and see*, with a thoughtful maker–checker and finance-restriction model expressed in the UI. But it enforces **none** of it. The single implied Owner sees and can click everything. Treat §2–§3 as the product's intended audience map and §5 as the engineering target for the day this gains a backend, real authentication, and RBAC.
