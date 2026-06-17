# Integration Architecture

> **Status of this layer at a glance:** Every external connector described in this document is **`[INTEGRATION]`** — designed in the UI, modelled in the data, and ready to be wired, but **not live**. The Data Sources page is **display-only**: `Connect`, `Sync now`, `Disconnect`, and `Auto-sync` controls render but do nothing. All "synced" records, freshness clocks, and ingest counts are served from `src/lib/mock/integrations.ts` through `src/lib/api.ts` `resolve()`, which deep-clones the mock array and resolves after ~280 ms of simulated latency. There is **no backend, no OAuth handshake, no webhook listener, no file watcher, and no third-party network call anywhere in the prototype.**

This file describes the *intended* integration model — how SPACE ESSE · Practice Intelligence is meant to read from the tools an architecture firm already uses — and is explicit about what exists today versus what is required to make it real. For the deeper end-to-end ingestion, matching, and reconciliation design, see **`blueprint/08`**.

---

## 1. Design philosophy

SPACE ESSE is conceived as a **read-only intelligence layer**, not a system of record. Three principles drive the whole integration model, and all three are surfaced verbatim in the prototype UI:

1. **Observe, never replace, never write back.** The Data Sources page states: *"Space Esse reads from the tools you already use — it never replaces them and never writes back."* Every connector in the catalog requests least-privilege, read-only scope. Your accounting package, your Drive, your authority portal remain the single source of truth. `[INTEGRATION]` intent — enforced today only as the `readOnly` boolean on each mock `DataSource`.

2. **Where there is no API, capture is first-class.** The highest-value records in an architecture practice — decisions, authority status changes, scope variations, effort — live in conversations, phone calls, and WhatsApp threads that expose no programmatic feed. Rather than pretend these can be scraped, the system promotes **Manual Capture** to a peer connector with full provenance and confidence. `[IMPLEMENTED]` as a UI form (client-side only; does not persist).

3. **Confidence travels with freshness.** A KPI is only ever shown as confident when the data behind it is fresh and matched. The Data Quality page exists to make staleness, unmatched aliases, and domain gaps visible — so the product can *refuse* rather than fabricate. `[MOCK]` — the freshness clocks and health bars render from static fields, not live sync state.

> **Reality check.** None of these principles are *enforced* by running code beyond rendering. Read-only access, least-privilege scopes, and "never writes back" are properties the connectors *would* have once built `[INTEGRATION]`; today they are assertions in copy and flags in mock data.

---

## 2. The data sources catalog

The catalog lives in `src/lib/mock/integrations.ts` as `dataSources: DataSource[]` — **17 sources** split into a **connected/MVP stack** (10 sources, `mvp: true`) and an **available/pluggable** set (7 sources, `mvp: false`, all `not_connected`). The catalog is consumed by `useDataSources()` and surfaced on the Data Sources, Data Quality, and Topbar status pill.

Each record carries this shape (`DataSource` interface, `types.ts`):

| Field | Meaning |
|---|---|
| `id`, `name`, `vendor` | Identity and owning vendor |
| `kind` | One of 10 `DataSourceKind` categories (drives icon + grouping) |
| `status` | `connected` / `syncing` / `stale` / `error` / `manual` / `not_connected` |
| `method` | `IngestMethod` — `api` / `webhook` / `csv_import` / `file_watch` / `email` / `manual` / `odbc` |
| `cadence` | `realtime` / `near_realtime` / `scheduled` / `manual` |
| `readOnly` | Intended access posture |
| `lastSync` | ISO timestamp or `null` (drives "Synced N ago") |
| `recordsIngested` | Count (mock) |
| `freshnessHours` | Hours since last data, or `null` |
| `health` | 0–100 score (drives the health bar) |
| `mvp` | Whether part of the launch/connected stack |
| `authMethod`, `notes`, `logoGlyph` | Display detail for the source dialog |
| `feeds` | List of record types this source contributes (e.g. `Invoice`, `Decision`) |

### 2.1 Connected / MVP stack (`mvp: true`)

These ten tiles render with status dots, sync timestamps, and health bars. **All of it is `[MOCK]`** — the `status`/`lastSync`/`recordsIngested`/`freshnessHours`/`health` values are authored constants, not the result of any sync.

| Source | Vendor | Kind | Method | Cadence | Read-only | Status (mock) | Feeds |
|---|---|---|---|---|---|---|---|
| Manual Capture | Space Esse | Manual Capture | manual | realtime | No (writes records) | connected | Decision, Approval, Change, SiteReport, Timesheet, Milestone |
| Google Drive | Google Workspace | File Storage | api | near_realtime | Yes | connected | Document, Deliverable, Drawing, Revision |
| Gmail | Google Workspace | Communication | email | near_realtime | Yes | connected | Decision, Approval, Consultant |
| Google Calendar | Google Workspace | Calendar | api | near_realtime | Yes | connected | Meeting, Milestone |
| TallyPrime | Tally Solutions | Accounting & Finance | csv_import | scheduled | Yes | **stale** | Invoice, Payment, Expense, Fee |
| Excel / CSV Import | Spreadsheets | Accounting & Finance | csv_import | manual | Yes | connected | Fee, Budget, Task, Deliverable |
| AutoCAD (via Drive) | Autodesk | BIM / CAD | file_watch | scheduled | Yes | connected | Drawing, Revision, Deliverable |
| Trello | Atlassian | Project Management | api | near_realtime | Yes | **syncing** | Task, Milestone |
| RAJUK ECPS | RAJUK | Authority Portals | manual | manual | Yes | **manual** | Approval, Milestone |
| WhatsApp | Meta | Communication | manual | manual | Yes | **manual** | Decision, Approval, Change, SiteReport |

Notes drawn from the mock:
- **TallyPrime** carries `status: stale` deliberately — the Data Quality page hardcodes a companion callout ("Export is 5 days stale", last export 12 Jun) so finance KPIs are flagged as lagging.
- **Trello** is the only tile shown mid-`syncing`; its `StatusDot` is the only one that animates (`animate-ping`).
- **RAJUK ECPS** and **WhatsApp** are `manual` by nature (no API exists), so they sit in the connected stack but are fed by capture, not by sync.

### 2.2 Available / pluggable sources (`mvp: false`)

These seven render as dashed tiles with a (non-functional) **Connect** button. All share `status: not_connected`, `lastSync: null`, `freshnessHours: null`, `recordsIngested: 0`, `health: 0`. They represent the future connector surface — **`[INTEGRATION]` / `[PLANNED]`**.

| Source | Vendor | Kind | Method | Cadence | Auth (intended) | Feeds |
|---|---|---|---|---|---|---|
| QuickBooks Online | Intuit | Accounting & Finance | api | near_realtime | OAuth 2.0 | Invoice, Payment, Expense |
| Xero | Xero | Accounting & Finance | api | near_realtime | OAuth 2.0 | Invoice, Payment, Expense |
| Autodesk Construction Cloud | Autodesk | BIM / CAD | api | scheduled | APS (OAuth 2.0) | Model, Drawing, Deliverable |
| Microsoft 365 / SharePoint | Microsoft | Document Management | api | near_realtime | Microsoft Graph (OAuth 2.0) | Document, Deliverable |
| Procore | Procore | Project Management | api | near_realtime | OAuth 2.0 | RFI, Submittal, SiteReport |
| Clockify | Clockify | Time Tracking | api | near_realtime | API key | Timesheet |
| Dropbox | Dropbox | File Storage | api | near_realtime | OAuth 2.0 | Document, Deliverable |

### 2.3 Kind taxonomy

`KIND_LABELS` defines the 10 connector categories used for grouping and icons (`KIND_ICON`):

| Kind | Label | Icon |
|---|---|---|
| `accounting` | Accounting & Finance | Banknote |
| `bim_cad` | BIM / CAD | Ruler |
| `project_mgmt` | Project Management | Box |
| `document_mgmt` | Document Management | Files |
| `file_storage` | File Storage | FolderOpen |
| `communication` | Communication | MessageSquare |
| `time_tracking` | Time Tracking | Timer |
| `calendar` | Calendar | CalendarClock |
| `manual_capture` | Manual Capture | PencilLine |
| `authority` | Authority Portals | Landmark |

---

## 3. How each source is meant to connect

The `method` field declares the *transport* a connector would use. Today no transport runs — the table below is the wiring spec for `blueprint/08`, with the current prototype reality stated per row.

| Method | What it means | Sources using it (intended) | Prototype reality |
|---|---|---|---|
| **`api`** | Authenticated REST/Graph pulls on a schedule or trigger | Google Drive, Google Calendar, Trello, QuickBooks, Xero, Autodesk ACC, Microsoft 365, Procore, Clockify, Dropbox | `[INTEGRATION]` — no OAuth, no HTTP client, no token store. |
| **`webhook`** | Source pushes change events to a SPACE ESSE endpoint | (none currently assigned in mock; reserved in the `IngestMethod` union) | `[BACKEND]` — needs a public endpoint + event handler that do not exist. |
| **`csv_import`** | Templated export/upload reconciled into records | TallyPrime, Excel / CSV Import | `[INTEGRATION]`/`[BACKEND]` — no upload handler; the CSV button is absent and "import" is implied, not built. |
| **`file_watch`** | Detect new/changed files in a watched folder | AutoCAD (via Drive) | `[INTEGRATION]` — relies on Drive access; presence is the signal, file contents are not parsed. |
| **`email`** | Parse structured signals from a mailbox | Gmail (`gmail.metadata` scope) | `[INTEGRATION]` — no IMAP/Graph mail read; metadata-only scope is intended. |
| **`manual`** | A human records the fact in-app | Manual Capture, RAJUK ECPS, WhatsApp | `[IMPLEMENTED]` as a form (client-state only); **does not persist** (`[BACKEND]` to store). |
| **`odbc`** | Direct database/ODBC connection | (reserved in union; unused in mock) | `[PLANNED]`. |

### 3.1 Authentication posture (intended)

| Source | Intended auth | Scope intent |
|---|---|---|
| Google Drive / Calendar | OAuth 2.0 | read-only |
| Gmail | OAuth 2.0 | `gmail.metadata` (headers, not bodies) |
| AutoCAD (via Drive) | via Google Drive OAuth | file presence only |
| Autodesk Construction Cloud | APS (OAuth 2.0) | read-only |
| Microsoft 365 / SharePoint | Microsoft Graph (OAuth 2.0) | read-only |
| QuickBooks / Xero / Procore / Dropbox | OAuth 2.0 | read-only |
| Clockify | API key | read-only |
| TallyPrime | Templated export (weekly) | no live auth — file handoff |
| Excel / CSV | Templated upload | no auth — file handoff |
| RAJUK ECPS | Portal (manual entry) | human-in-portal, no API |
| WhatsApp | Forward / screenshot capture | human paste, no API |
| Manual Capture | In-app (session) | the app itself |

Every value above is the `authMethod` string on the mock record — it is descriptive metadata shown in the source dialog, **not** an implemented auth flow `[INTEGRATION]`.

---

## 4. Connector classification by cadence

The `cadence` field places each connector on a freshness spectrum. This is how the product *intends* to keep KPIs current; today the cadence is a label only `[MOCK]`.

### Real-time `[INTEGRATION]`
Data is expected the moment it changes.
- **Manual Capture** — `realtime`. A captured decision is meant to land in the project record instantly. (In the prototype the form is `[IMPLEMENTED]` but inline-only — submitting sets local success state and **adds nothing** to the feed or any store.)

### Near-real-time `[INTEGRATION]`
Frequent polling or push, latency of minutes.
- Google Drive, Gmail, Google Calendar (Google Workspace stack)
- Trello (the only mock source shown actively `syncing`)
- All pluggable API sources once connected: QuickBooks, Xero, Microsoft 365, Procore, Clockify, Dropbox

### Scheduled `[INTEGRATION]`
Batch on a fixed cadence (e.g. nightly, weekly).
- **TallyPrime** — weekly templated export (the source of its deliberate `stale` state)
- **AutoCAD (via Drive)** — scheduled folder scan
- **Autodesk Construction Cloud** — scheduled API pull

### Manual fallback `[IMPLEMENTED] (capture) / [INTEGRATION] (the source)`
No API exists; a human bridges the gap.
- **RAJUK ECPS** — status copied from the authority portal by the liaison
- **WhatsApp** — threads forwarded/pasted via the Capture form
- **Excel / CSV Import** — `manual` cadence templated upload

> **Why this matters for the product's honesty model.** A near-real-time API feed earns higher confidence than a weekly export, which earns more than a manual paste. The Data Quality page is built to expose exactly this — a `stale` TallyPrime export downgrades finance KPI confidence; a manual-only People domain sits at 40% completeness with a low-confidence flag. The cadence ladder is the backbone of the "refuse rather than fabricate" stance. (All of it currently driven by static fields, not live timing — `[MOCK]`.)

---

## 5. Manual Capture as a first-class connector

Manual Capture is the philosophical core of the integration model: the acknowledgement that an architecture practice's most decision-critical data has **no API**. It appears in the catalog as a full `DataSource` (kind `manual_capture`, status `connected`, cadence `realtime`, the only `readOnly: false` source because it *creates* records) and feeds six record types: Decision, Approval, Change, SiteReport, Timesheet, Milestone.

### 5.1 The capture surface `[IMPLEMENTED]` (client-state only)

The `/capture` page (`Capture.tsx`) offers six capture types via an interactive selector:

| Type | Purpose | Key fields |
|---|---|---|
| `decision` | Who decided what, when | summary, decided-by, channel (Meeting/WhatsApp/Email/Phone/Site) |
| `approval` | Authority status change | authority (RAJUK/FSCD/CAAB/DoE/City Corp/DPDC), new status, what changed |
| `scope` | Change order / variation | description, est. cost impact (BDT), requested-by |
| `timesheet` | Log hours fast | team member, hours, what was worked on |
| `site` | Field note from site | single site-note field |
| `whatsapp` | Promote a pasted thread | pasted text → "extracted draft" preview |

All variants share a **Project** select (canonical link), a **Date** (defaults to the 2026-06-17 anchor), and a **"Cite this to me"** switch (default on).

### 5.2 The capture flow — and where it stops

```
Input            →  Validation        →  Processing         →  Approval            →  Storage     →  Reporting          →  Follow-up
(form fields)       (ready gate)          ("extract" draft)     (Review queue)         (—)            (cited record)        (promotion)
```

| Stage | Intended behaviour | Prototype reality |
|---|---|---|
| **Input** | Pick type, project, fill fields | `[IMPLEMENTED]` — full interactive form |
| **Validation** | Required fields per variant | `[IMPLEMENTED]` — single `ready` gate (project + variant-specific field); no per-field errors, no required markers |
| **Processing** | Parse/extract a structured record (e.g. WhatsApp → draft Decision) | `[MOCK]` — the "extracted draft" is just the **last pasted line sliced to 120 chars**; no NLP/extraction |
| **Approval** | Unverified capture enters the Review queue for maker-checker sign-off | `[BACKEND]` — the Review queue exists and approve/reject toggles **local state only**; captures never actually arrive there |
| **Storage** | Write the cited record to the project's canonical store | **Absent** `[BACKEND]` — `submit` sets an inline success panel and **persists nothing**; refresh resets |
| **Reporting** | Record becomes citable in KPIs, AI answers, reports | `[MOCK]` — only the pre-seeded mock decisions are cited; new captures are invisible to the rest of the app |
| **Follow-up** | "Promote" unverified → verified record | `[BACKEND]` — promotion (`promoted` flag) is a data field with no write path |

The recent-captures feed on `/capture` reads from `useDecisions()` (mock) — it shows the seeded decisions, **not** anything the user just entered. The KPI strip on the page ("18 captures this week", "64% timesheet coverage", etc.) is **hardcoded**, not computed.

### 5.3 Provenance — the `Provenance` contract

Every captured (and every ingested) record is meant to carry a `Provenance` stamp so it can be traced:

| Field | Meaning |
|---|---|
| `sourceId` | Which connector produced it |
| `sourceName` | Human-readable source (e.g. "Manual capture · Change log") |
| `recordRef` | The source-side reference |
| `observedAt` | When the fact was observed/true |
| `ingestedAt?` | When SPACE ESSE recorded it |

This is what powers the **"Why this number?"** provenance popovers and the source chips on every alert, decision, and report block. In the prototype the provenance is authored into mock records `[MOCK]`; capture would produce real provenance once storage exists `[BACKEND]`.

---

## 6. External systems — per-source integration intent

Each entry states the role, the intended connection, the record types fed, and the prototype status.

### Accounting & finance

- **TallyPrime** `[INTEGRATION]` — the firm's accounting system. No live API; intended as a **weekly templated CSV export** reconciled into Invoice, Payment, Expense, and Fee records. Carries the deliberate `stale` status (5-day-old export) that the Data Quality page uses to demonstrate confidence downgrades on finance KPIs.
- **QuickBooks Online / Xero** `[INTEGRATION]` / `[PLANNED]` — alternative cloud accounting packages, intended via **OAuth 2.0 near-real-time API**. Pluggable, currently `not_connected`. These would replace the CSV gap with a live feed of Invoice/Payment/Expense.
- **Excel / CSV Import** `[INTEGRATION]` — templated **manual upload** for fees, budgets, tasks, deliverables where no system exists. No upload handler is built `[BACKEND]`.

### Google Workspace

- **Google Drive** `[INTEGRATION]` — primary file store; intended **OAuth read-only, near-real-time API**. The declared source of truth for *file presence* (Document, Deliverable, Drawing, Revision). The Document Control page treats a missing file as a "manual" chip needing attention.
- **Gmail** `[INTEGRATION]` — intended **`gmail.metadata` scope** (headers only, not bodies) to detect Decision/Approval/Consultant signals via email.
- **Google Calendar** `[INTEGRATION]` — intended **OAuth read-only API** feeding Meetings and Milestones into the Calendar page.

### Microsoft 365

- **Microsoft 365 / SharePoint** `[INTEGRATION]` / `[PLANNED]` — alternative document store via **Microsoft Graph (OAuth 2.0)**, feeding Document/Deliverable. Pluggable, `not_connected`.

### BIM / CAD

- **AutoCAD (via Drive)** `[INTEGRATION]` — CAD files expose **no data API**, so the intended method is **`file_watch` over Google Drive**: presence and revision signals are harvested from the folder, *not read from the CAD app*. The Document Control page is explicit: *"these are file-presence signals harvested from Google Drive, not read from the CAD apps themselves."*
- **Autodesk Construction Cloud (ACC) / Revit** `[INTEGRATION]` / `[PLANNED]` — intended **APS (Autodesk Platform Services) OAuth API** for Model/Drawing/Deliverable. The path to actual model-aware data (vs. mere file presence). Pluggable, `not_connected`.

### Communication

- **WhatsApp** `[INTEGRATION]` — **no history/backfill API exists by design** of the platform. Treated as a first-class but **paste-only** source: a user forwards a thread into the Capture form, which produces a draft Decision for confirmation. The Data Quality page documents this limit ("No backfill API"). The prototype "extraction" is a 120-char string slice `[MOCK]`, not real parsing.
- **Gmail** — see Google Workspace above.

### Project management

- **Trello** `[INTEGRATION]` — intended **OAuth read-only near-real-time API** for Task/Milestone. The only mock source shown mid-`syncing`.
- **Procore** `[INTEGRATION]` / `[PLANNED]` — construction-management platform via **OAuth API** for RFI/Submittal/SiteReport. Pluggable, `not_connected`.

### Time tracking

- **Clockify** `[INTEGRATION]` / `[PLANNED]` — intended **API-key near-real-time** feed of Timesheets. This is the connector that would close the product's biggest data gap: timesheet coverage sits at ~64% in the mock, which is why capacity/utilization/margin KPIs are repeatedly flagged low-confidence or refused outright. Currently `not_connected`; timesheets today rely on Manual Capture.

### File storage

- **Dropbox** `[INTEGRATION]` / `[PLANNED]` — alternative file store via **OAuth API** for Document/Deliverable. Pluggable, `not_connected`.

### Authority portals

- **RAJUK ECPS** `[INTEGRATION]` — the Dhaka building-authority portal. **No API**; status is entered manually from the portal by the liaison. Feeds Approval/Milestone. The Authority Approvals page is explicit that RAJUK, FSCD, CAAB, DoE and City Corporation expose no API and are tracked manually, with overdue measured against each form's statutory window.
- **FSCD, CAAB, DoE, City Corporation, DPDC** `[INTEGRATION]` / `[PLANNED]` — other Bangladeshi authorities and utilities. All API-less; modelled as manual-capture targets (the Capture approval form offers these authorities as options).

---

## 7. The Data Sources page — display-only

`/data-sources` (`DataSources.tsx`) is the operator-facing connector dashboard. It is **read-only display plus a category filter and a detail dialog** — nothing connects, syncs, or disconnects.

| Element | Behaviour | Status |
|---|---|---|
| Summary counts (Live / Needs attention / Manual / Available) | Derived from `useDataSources()` status counts | `[MOCK]` (reads mock data) |
| Read-only assurance banner | Static copy | Visual-only |
| Category filter `Select` | Filters grouped tiles by `kind` | `[IMPLEMENTED]` (client state) |
| Source tile click → detail dialog | Opens `SourceDetail` | `[IMPLEMENTED]` (client state) |
| **Connect** (not-connected tiles) | — | **Visual-only — no handler** |
| **Add a source** (header) | — | **Visual-only** |
| **Sync now** (dialog, connected) | — | **Visual-only** |
| **Disconnect** (dialog, connected) | — | **Visual-only** |
| **Connect {name}** (dialog, not connected) | — | **Visual-only** |
| **Auto-sync** switch (dialog) | Uncontrolled `defaultChecked`, no `onCheckedChange` | **Visual-only** |

The detail dialog shows the full `DataSource` record — status, method, cadence, auth, access (`Read-only`/`Read/write`), last sync, the feeds it provides, and notes. Useful as a connector spec sheet; **inert as a control panel**.

The Topbar **DataSourceStatus** pill also reads this catalog: it shows `{connected} live` (status `connected` or `syncing`) and `· {issues} stale` (status `stale` or `error`), with a popover listing active sources and their last-sync relative time. `[MOCK]`.

---

## 8. Where freshness and matching are surfaced (Data Quality)

`/data-quality` (`DataQuality.tsx`) is the trust backbone for the integration layer. It reads `useDataSources()` and `useProjects()` and renders:

- **Four KPI cards** with real `formula` strings — firm data completeness (`mean(project.completeness)`), live sources (`count(status ∈ {connected, syncing})`), stale/error sources, and unmatched aliases (`count(crossRefs where matched = false)`). Computed client-side from mock `[MOCK]`.
- **Source freshness table** — active sources with status, method, last sync, freshness hours (flagged rust > 48 h, ochre > 12 h), records, and a health bar. `[MOCK]`.
- **Completeness by domain** — four **static** cards (Money 85%, Delivery 70%, **People 40% — the weak domain**, Approvals 65%). Not data-derived; hardcoded to illustrate the timesheet gap. `[MOCK]`.
- **Project matching queue** — lists every `crossRef` where `matched = false`. Each row offers a **Confirm match** button that is **visual-only** (no handler) `[BACKEND]`. This is where alias-to-project reconciliation *would* be approved.
- **Known data-health limits** — static cards documenting the WhatsApp "no backfill API" and TallyPrime "export is 5 days stale" constraints.

The matching mechanism itself lives on each `Project` as `crossRefs: CrossRef[]` (`{ sourceId, sourceName, alias, matched, confidence }`). This is how a project named "Meghna Textiles HQ" in SPACE ESSE links to "MTHQ-Interior" in Trello or "Meghna Tex" in Tally. The data structure is real; the **act of confirming a match is not wired** `[BACKEND]`.

---

## 9. Integration flow — end to end (intended)

For an API-backed source, the intended pipeline is:

```
Source system           Connect                Ingest                 Normalize/Match            Reconcile               Store                    Surface
(Tally, Drive, …)   →   OAuth / API key   →   pull/poll/webhook   →   map to records +      →   cross-source       →   provenance-stamped   →   KPIs, alerts,
                        (least-privilege,      on cadence              attach Provenance +       agreement checks       canonical records        AI reports,
                         read-only)                                    resolve crossRefs         (discrepancies)                                  Data Quality
```

| Stage | Owner in the design | Prototype status |
|---|---|---|
| **Connect** | OAuth handshake / API-key store / token refresh | `[INTEGRATION]` / `[BACKEND]` — none exist |
| **Ingest** | Scheduler, poller, webhook listener, file watcher, CSV/email parser | `[BACKEND]` — none exist; reads are `resolve(mock)` |
| **Normalize & Provenance** | Map vendor payloads to typed records; stamp `Provenance` | `[MOCK]` — provenance is pre-authored in mock data |
| **Match** | Resolve `crossRefs` (alias → canonical project) | `[BACKEND]` — `crossRefs` data exists; confirm is visual-only |
| **Reconcile** | Detect cross-source disagreement (Discrepancy in Review queue) | `[BACKEND]` — discrepancy items exist as mock; resolution is local-state |
| **Store** | Persist canonical records + audit trail | **Absent** — no database, no persistence |
| **Surface** | Feed KPIs / alerts / AI reports / Data Quality | `[MOCK]` — KPIs computed client-side from mock; AI answers are canned |

The Activity Log (`/activity`) is the intended **append-only, tamper-evident audit trail** of this pipeline — every capture, sync, approval, report, and match as an event with actor, source, and timestamp. It renders from `useActivity()` mock and is display-only `[MOCK]`. No event is ever actually appended.

---

## 10. Summary status matrix

| Capability | Status |
|---|---|
| Data Sources catalog (17 sources, fields, feeds) | `[MOCK]` — renders from `mock/integrations.ts` |
| Category filter + source detail dialog | `[IMPLEMENTED]` (client state) |
| Connect / Sync now / Disconnect / Auto-sync / Add a source | **Visual-only** (no handlers) |
| Any live API / OAuth / webhook / file-watch / email ingest | `[INTEGRATION]` — none built |
| CSV / Excel upload handler | `[BACKEND]` — none built |
| Manual Capture form (6 types, validation gate) | `[IMPLEMENTED]` (client state; **does not persist**) |
| Capture → Review queue → promotion → storage | `[BACKEND]` — no write path |
| WhatsApp thread "extraction" | `[MOCK]` — 120-char string slice, no NLP |
| Provenance stamping | `[MOCK]` — pre-authored on records |
| Cross-reference matching (`crossRefs`) | data `[MOCK]`; confirm `[BACKEND]` |
| Freshness / health / staleness flags | `[MOCK]` — static fields, not live timing |
| Activity / audit trail | `[MOCK]` — display-only, never appended |
| QuickBooks, Xero, M365, ACC, Procore, Clockify, Dropbox | `[INTEGRATION]` / `[PLANNED]` — `not_connected` |

---

## 11. Recommended path to a live integration layer

Ordered by leverage `[RECOMMENDED]`:

1. **Stand up the backend and persistence first** `[BACKEND]`. Replace `resolve(mock)` with real fetch — the api.ts comment already anticipates this: *"Swap this for fetch()… later without touching components or hooks."* Capture, Review approve/reject, schedule toggles, and matching all need a write path before any connector matters.
2. **Wire Manual Capture end-to-end.** It is the highest-value, lowest-dependency source (no third party). Make `submit` persist, route unverified records to the Review queue, and emit an Activity event. This alone makes the product genuinely useful for decisions, approvals, and timesheets.
3. **Connect the Google Workspace stack** (Drive, Calendar, Gmail metadata) — single OAuth provider, near-real-time, covers files, meetings, and email signals at once.
4. **Add a live accounting feed** (QuickBooks/Xero API, or automate the TallyPrime export) to retire the deliberate `stale` finance state.
5. **Connect Clockify** (or equivalent) to lift timesheet coverage above the ~80% threshold the product repeatedly cites as the unlock for trustworthy capacity and margin KPIs.
6. **Implement cross-reference matching + discrepancy reconciliation** so multi-source data converges on canonical records with confidence.
7. **Keep authority portals (RAJUK ECPS, FSCD, etc.) as structured manual capture** — there is no API to build against; invest instead in fast, well-cited liaison capture.

> See **`blueprint/08`** for the detailed ingestion, normalization, matching, and reconciliation design that these recommendations operationalize.
