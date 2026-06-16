# Integration Architecture, Data Source Map & Integration Matrix

> **Scope.** How PracticeLens *physically gets data in*. The previous section (Software Ecosystem) decided *which* connectors earn a place in the pilot; this section decides *how each one ingests*, classifies every connector as **Real-time / Near-real-time / Scheduled / Manual-fallback**, and specifies the cross-cutting machinery — ETL/ELT pipelines, validation, idempotency, retry, error handling, and integration-health monitoring. PracticeLens is **read-only-first**: original tools stay the system of record. Currency is **BDT** unless a foreign-client/USD case applies.

---

## 0. The architectural inversion this section is built on

A normal SaaS integration chapter leads with API connectors and treats CSV/manual entry as a sad fallback. **For the Dhaka pilot we invert that.** The research is unambiguous: in a 5–30 person Dhaka practice the highest-value data — `Decision`, `Approval`, progress %, scope `Change`, `Client Approval Time`, labour cost — lives in *the principal's head > WhatsApp > email > Excel > paper > the ECPS portal*, and **almost nothing sits in a queryable database**. You cannot integrate your way to data that was never recorded.

So the connector hierarchy for the pilot is, in priority order:

1. **Manual Capture Layer** (smart forms + templated Excel/CSV) — populates the entities no API can, and is the adoption wedge.
2. **Cloud productivity APIs** (Google **or** Microsoft) — the only rich, real APIs the firm plausibly already runs; double as the file-presence sensor.
3. **Email & calendar** (inside #2) — `Meeting`, `Consultant Response Time`, sent-document trail.
4. **Finance via export** (Tally/Excel CSV→importer) — not a live API in the pilot.
5. **Everything else** (Tally XML, QuickBooks/Xero, WhatsApp Cloud API, PM tools, APS/Procore/Deltek) — **pluggable, post-MVP**.

Every ingested record — whether it arrived by OAuth API call or by a human pasting a WhatsApp screenshot — lands as an `IntegrationRecord` tied to a `DataSource`, carrying provenance (source, observed-at, confidence) and feeding the `Data Completeness Score`. The AI layer treats both with equal standing. This is the only honest design for this market.

---

## 1. Ingestion methods — the toolkit

PracticeLens uses **seven** ingestion mechanisms. Each connector is built from one or more of these.

| # | Method | What it is | Where used | Read/Write |
|---|---|---|---|---|
| M1 | **REST/GraphQL API pull** | Authenticated incremental pull using delta/change tokens | Graph, Google, (later) QBO/Xero/Procore/APS | **Read-only** |
| M2 | **Webhook / push subscription** | Vendor POSTs a change notification; we read-back the record | Graph change-notifications, Drive `changes.watch`, Gmail Pub/Sub; (later) WhatsApp Cloud API | Read (inbound) |
| M3 | **Read-only DB / ODBC** | Direct SQL against a read replica | **None in MVP.** Tally ODBC deprecated ≥4.0; Deltek on-prem SQL is a *Later* productization path | Read-only |
| M4 | **Scheduled CSV/Excel import** | Vendor-native export → our templated importer on a cadence | Tally/TallyPrime export, finance registers, Monograph (later) | Read (file) |
| M5 | **File/folder monitoring** | Watch a cloud drive (API delta) or a local folder (agent) for file-presence telemetry | Drive/OneDrive/SharePoint metadata; local file-server agent (later) | Read (metadata only) |
| M6 | **Email & calendar connector** | Mailbox + calendar read via Graph/Gmail/Calendar APIs | M365 Outlook, Google Gmail/Calendar | Read-only |
| M7 | **Manual Capture Layer** | Our own smart forms + templated Excel + forward/screenshot capture | First-class; populates everything else can't | **Write (into PracticeLens only)** |

**Note on M3 (read-only DB):** deliberately empty for the MVP. The pilot firm's finance lives in Tally/Excel, and Tally's ODBC BI path is **deprecated from TallyPrime 4.0**. Direct DB access is reserved for the productization tier (e.g., an on-prem Deltek SQL replica) and even then only behind an explicit read-replica + row-level contract. No connector ever writes to a source system in any phase.

---

## 2. DATA SOURCE MAP

What we pull, how, and when. **Classification** ∈ {Real-time (RT, event-driven, <1 min), Near-real-time (NRT, webhook→read-back, minutes), Scheduled (S, polled/batch), Manual-fallback (MF, human-in-loop)}.

| Source | What we pull | Method | Classification | Frequency | MVP? |
|---|---|---|---|---|---|
| **Smart forms (PracticeLens)** | `Decision`, `Approval` (RAJUK LUC/CP, FSCD NOC, DoE ECC, CAAB, utilities), `Milestone` status, `Change`/scope prompts, `SiteReport`, bootstrap `Timesheet`, `Risk`, `Issue` | M7 | MF (event at save) | On user action | **Y** |
| **Templated Excel/CSV import** | `Project` register, `Fee` schedule, `Invoice`/`Payment` ledger, `Expense`, `Budget`, `Drawing`/sheet index, `Consultant`/`Contractor` list, `Opportunity`/`Proposal` log, bootstrap `Timesheet` | M4+M7 | S / MF | Weekly + on-demand upload | **Y** |
| **Forward/screenshot capture** | WhatsApp/voice/paper `Approval`s & `Decision`s turned into structured records | M7 | MF | On user action | **Y** |
| **Tally / TallyPrime** | Ledger balances, vouchers, P&L, receivables/payables, VAT/AIT figures → `Invoice`, `Payment`, `Expense`, `Fee` | M4 (CSV/XLSX export) | S | Weekly (manual export) | **Y (export only)** |
| **Excel / manual finance registers** | Same finance entities where Tally absent | M4 | S | Weekly | **Y** |
| **Google Workspace — Drive** | File-presence telemetry: name, size, last-modified, path, owner → `Document`, `Drawing`, `Model`, `Deliverable`, `Revision` signals | M1+M5 (`changes.watch` + delta) | NRT | Push + 6-hourly reconcile | **Y (if Google firm)** |
| **Google — Gmail** | Message/thread metadata + sent-trail → `Meeting` invites, `Consultant Response Time`, deliverable-sent evidence | M6 (Pub/Sub push) | NRT | Push + daily sweep | **Y (if Google firm)** |
| **Google — Calendar** | Events → `Meeting`, project-tagged scheduling load | M6 | S | Daily delta | **Y (if Google firm)** |
| **Google — Sheets** | Firm's own tracker sheets used as a datasource (read cell ranges) | M1 | S | Daily | **Y (if used)** |
| **Microsoft 365 — SharePoint/OneDrive** | `driveItem` file-presence telemetry (as Drive above) | M1+M5 (Graph delta + change-notif) | NRT | Push + 6-hourly reconcile | **Y (if MS firm)** |
| **Microsoft 365 — Outlook** | Mail/calendar/contacts → `Meeting`, `Consultant Response Time`, sent-trail | M6 (Graph subs) | NRT | Push + daily sweep | **Y (if MS firm)** |
| **Local file servers / individual PCs** | DWG/SKP/PDF deliverable presence | M5 (agent) / M7 (manual) | S / MF | Agent: hourly (Later). MVP: manual | **Partial (manual MVP; agent Later)** |
| **WhatsApp Business Cloud API** | Forward-only inbound + status events (persisted by us) → `Decision`/`Approval`, message-volume metrics | M2 (webhook persist) | NRT | Push | **N (Later)** |
| **AutoCAD / SketchUp / D5** | **No data API.** File-presence only, via the cloud store above | M5 | S | (inherits file store) | **Y as files only** |
| **QuickBooks Online / Xero** | Invoices, payments, AR/AP aging, P&L | M1 (+M2 thin webhooks) | NRT/S | Delta sync | **Later** |
| **Trello / Asana / ClickUp / monday** | `Task`, `Milestone`, time-tracking (ClickUp) | M1+M2 | NRT/S | Per tool | **Later (opportunistic)** |
| **Autodesk APS / Procore / Newforma / Deltek / BQE / Bluebeam / Smartsheet** | Model/RFI/submittal/ERP financials | M1+M2 (+M3 Deltek on-prem) | NRT/S | Per tool | **Later (productization)** |

---

## 3. INTEGRATION MATRIX

Engineering view. **Effort/Risk/Phase** are PracticeLens build judgments. **MVP phase** ∈ {P1 = pilot months 0–3, P2 = pilot months 3–6, Later = productization}.

| Connector | Auth | Read/Write | Cadence | Effort | Risk | MVP phase |
|---|---|---|---|---|---|---|
| **Smart forms** | App SSO + RBAC | Write (ours) | Event | Med | Low (UX/adoption is the risk) | **P1** |
| **Templated Excel/CSV import** | App SSO | Read file | Scheduled + manual | Med | Med (schema drift, Bijoy/ANSI text, dirty cells) | **P1** |
| **Forward/screenshot capture** | App SSO | Write (ours) | Event | Med | Med (human judgment, dedupe) | **P1** |
| **Tally export → importer** | None (local file) | Read file | Weekly | Low–Med | Med (export config consistency, version sensitivity) | **P1** |
| **Excel finance registers** | App SSO | Read file | Weekly | Low | Med (inconsistent formats) | **P1** |
| **Google Workspace (Drive/Gmail/Calendar/Sheets)** | OAuth 2.0 / service acct + DWD | Read-only | Push + delta | Med | Med (scopes/consent, Pub/Sub plumbing, quotas) | **P2** |
| **Microsoft 365 (Graph: files/mail/calendar)** | OAuth 2.0 (Entra ID) | Read-only | Push + delta | Med | Med (admin consent, throttling, OneDrive root-only subs) | **P2** |
| **Local file-server agent** | Machine cert + outbound-only | Read metadata | Hourly | Med–High | Med (deployment on firm PCs, NAT/firewall) | **Later** |
| **WhatsApp Cloud API (persist)** | OAuth / system-user token | Read (inbound) | Push | High | High (no backfill, number migration, <5s 200, template policy) | **Later** |
| **QuickBooks Online** | OAuth 2.0 | Read-only | Delta | Low–Med | Med (read-quota tiers, token rotation) | **Later** |
| **Xero** | OAuth 2.0 + PKCE | Read-only | Delta | Low–Med | Med (5,000 req/day/org cap → forced delta) | **Later** |
| **Trello / Asana / ClickUp / monday** | OAuth 2.0 / token | Read-only | Push + delta | Low–Med | Low–Med (rate ceilings) | **Later** |
| **Autodesk APS** | OAuth 2.0 (2/3-leg) | Read-only | Push + async jobs | High | Med–High (chained APIs, Dec-2025 consumption pricing) | **Later** |
| **Procore / Newforma Konekt** | OAuth 2.0 | Read-only | Push + delta | Med | Med | **Later** |
| **Deltek Vantagepoint** | OAuth 2.0 + Azure AD | Read-only (API; on-prem SQL replica) | Delta | Med–High | Med (version-specific endpoints) | **Later** |
| **BQE Core / Bluebeam / Smartsheet** | OAuth 2.0 | Read-only | Push + delta | Med | Low–Med | **Later** |

**Why so little is in P1/P2.** A single-firm pilot cannot justify brittle bespoke connectors. P1 stands up entirely on the Manual Capture Layer + finance export — meaning **PracticeLens can deliver the MONEY and DELIVERY priorities with zero third-party API dependency**. P2 lights up whichever cloud productivity suite the firm actually runs (Google **or** Microsoft, rarely both fully) for file-presence + email/calendar signals. Everything else is a pluggable connector behind the same `DataSource` abstraction.

---

## 4. The Manual Capture Layer — first-class connector

This is the connector that makes the product work in Dhaka. It is **PracticeLens-native** (we build the whole surface) and exists to digitize the primitives the firm never recorded. It has three modes.

### 4.1 Smart web/mobile forms
Short, single-purpose, bilingual (Bangla/English) forms — the opposite of a heavy data-entry screen. Each is a 20–40 second capture, optimized for a project lead on a phone after a site visit or client call.

- **Approval capture** — type ∈ {RAJUK LUC, RAJUK CP, FSCD NOC, DoE ECC, CAAB height, DESCO/DPDC, WASA, Titas, City Corporation, Client sign-off}, status, dates, query rounds. Drives `Approval`, `Milestone`, `Schedule Variance`, `Client Approval Time`.
- **Decision log** — what was decided, by whom, when, source. Drives `Decision`, scope-baseline reference for `Change Exposure`.
- **Scope-change prompt** — fires when a `Decision` smells like new scope; asks "billable?" → `Change`, `Forecast Project Margin`.
- **Site report** — photo + note + location. → `SiteReport`, `Defect`, `Issue`.
- **Lightweight timesheet** — *the platform bootstrapping the data that doesn't exist.* A 3-tap "what did you work on today" entry (`Project`, `ProjectPhase`, hours band), not a Western-grade timesheet. → `Timesheet`, `Planned vs Actual Hours`, `Utilization Rate`, `EAC`.

### 4.2 Templated Excel/CSV import
The firm already lives in Excel — so we meet them there with **locked, validated, version-stamped templates** that map 1:1 to canonical entities. A round-trip workflow: download template → fill (or paste from existing register) → upload → validation report → confirm. Templates carry a hidden schema version + tenant ID so the importer can reject mismatches and migrate columns.

### 4.3 Forward/screenshot capture
The honest answer to WhatsApp for the pilot. A "forward this approval/decision into PracticeLens" flow (paste text, attach screenshot, optional OCR) that turns a chat fragment into a structured `Decision`/`Approval` with provenance (`source = WhatsApp/phone/paper`, captured-by, captured-at, confidence). Human-in-the-loop confirms the structured extraction before commit.

### 4.4 Entities the Manual Capture Layer backfills

| Entity / KPI | Why only manual capture reaches it |
|---|---|
| `Decision`, `Approval` | Verbal / WhatsApp / phone — never in any API |
| `Milestone` (authority) status | ECPS portal has no API; status lives with the liaison |
| `Change` / scope creep | No scope baseline exists to diff against — must be captured |
| `Timesheet` | **Does not exist** in the firm; platform must create the habit |
| `SiteReport`, `Defect`, `Issue` | WhatsApp photos + verbal site instructions |
| `Client Approval Time` | Approvals are verbal; latency is unmeasured today |
| `Fee` basis / `Contract` scope | In the principal's head or a signed PDF |
| `Opportunity` / `Proposal` | BD is relationship-based, untracked |

**Engineering requirements (apply to all three modes).** Store names/addresses in **both scripts** (no deterministic transliteration); **normalize all input to UTF-8** and **detect+convert legacy Bijoy/ANSI** on ingest (pasted DTP text otherwise stores as garbled Latin); bundle a Unicode Bengali font (Nikosh) for any PDF/report export; budget **human verification for Bengali OCR** output (conjuncts/ligatures depress accuracy). Every captured record is an `IntegrationRecord` with full provenance and feeds `Data Completeness Score` per `Project`.

---

## 5. Bangladesh-specific connectors

### 5.1 Tally / TallyPrime — export, not API (for the pilot)
Tally has an XML-over-HTTP + TDL API, but it is the **wrong shape** for a cloud analytics layer: idiosyncratic XML/TDL, **desktop-bound** (the firm's PC must run an HTTP server reachable on port 9000), **no webhooks**, **no OAuth** (network-level security only), and **ODBC for BI deprecated from TallyPrime 4.0**. Building a live pull for one pilot firm is high-effort and brittle.

**Decision:** ingest Tally via its excellent native **CSV/XLSX export** (masters, vouchers, P&L, receivables/payables) through the templated importer (M4), weekly. A real Tally XML/TDL connector is a **pluggable, post-MVP** item, justified only when several firms share the same Tally setup. Either way, the importer separates **gross `Fee`, 15% NBR VAT, VDS withheld, ~10% AIT/TDS withheld (resident; ~20% non-resident), and net cash received** — because AIT withholding directly suppresses `Collection Rate`.

### 5.2 WhatsApp — the realistic limitation
WhatsApp is the firm's **primary** channel, but it is the hardest analytics source in the entire stack, and the design must not pretend otherwise:

- Meta keeps **no queryable conversation store** for you. There is **no message-history / replay API, no event log, no dead-letter queue.**
- You **cannot retrieve any message sent before your number onboarded** onto the Cloud API, and chats in the consumer/Business *app* are not exposed.
- The only path to analytics is to **persist every raw inbound webhook payload to durable storage the instant it arrives** (raw-event store, before parsing) — Meta will never let you re-fetch it.
- Webhooks must return **200 in <5s** or the number is throttled/disabled after 5 consecutive failures.

**Decision for the pilot:** a full Cloud API onboarding (number migration, template approval, forward-only persistence pipeline) is **too heavy for a 6-month single-firm pilot and captures zero history.** The MVP captures WhatsApp's high-value content through the **forward/screenshot capture** mode above. A real Cloud API webhook-persistence connector (M2) is a **Later** item, switched on only when a firm commits to routing client comms through a PracticeLens-connected number — at which point we persist raw payloads from minute one.

### 5.3 Local file-server agent
Much of the firm's design output lives on **local PCs, network drives, external HDDs, and pen drives** — no API, no cloud. For the MVP these deliverables enter via **manual capture** (drawing/sheet-index template). For productization we ship a **lightweight outbound-only agent** that watches configured folders and emits **file-presence telemetry only** (name, size, last-modified, path hash — never file contents) over an authenticated outbound channel, so it works behind home/office NAT without inbound ports. This respects data minimization (PDPO) and the "don't add a heavy platform" principle.

### 5.4 Google + Microsoft connectors
The pilot lights up **whichever the firm actually uses** (both connectors are pluggable; firms are rarely fully on both). Use **delta/change queries** (Graph) and **`changes.watch`** (Drive) for incremental sync — full crawls waste quota. Watch the 2025–26 throttling shifts: Microsoft halved the per-app/per-user/per-tenant Graph limit (30 Sep 2025); OneDrive-for-Business subscriptions are **root-folder only**; Google Calendar quota changes hit new projects (1 May 2026); Gmail push needs Pub/Sub. We extract **only file-presence telemetry** from file stores as a proxy for `Drawing`/`Deliverable` activity — **never authoritative deliverable status** (that comes from manual capture). Email/calendar feed `Meeting`, `Consultant Response Time`, and the sent-document trail.

### 5.5 Data residency (PDPO 2025 + 2026 amendment)
Localization is now **risk-based**, not blanket. Ordinary firm/project data may be hosted abroad (nearest regions **Mumbai** / **Singapore**); but **sensitive identifiers** (NID, TIN, passport, biometric) trigger **cross-border-transfer approval** and must be **minimized, segregated, or kept in a Bangladesh local mirror**. The integration layer therefore tags every incoming field with a sensitivity class at ingest, and the storage router keeps restricted/CII-class data in the BD mirror. **The cheapest compliance is not ingesting sensitive identifiers at all** — connectors default to excluding them.

---

## 6. ETL/ELT pipeline architecture

PracticeLens uses **ELT into a per-tenant landing zone**, then transforms to the canonical model — because raw payloads must be retained verbatim for provenance, replay, and the WhatsApp "persist-before-parse" rule.

```
[Source] -> (1) INGEST -> (2) RAW LANDING (immutable) -> (3) NORMALIZE
         -> (4) VALIDATE -> (5) MATCH/RESOLVE -> (6) CANONICAL STORE -> (7) SEMANTIC LAYER -> AI/Dashboards
```

1. **Ingest** — connector-specific (M1–M7). Webhooks land their raw body **before any processing**.
2. **Raw landing** — every payload/file stored immutably as an `IntegrationRecord` (source, tenant, observed-at, checksum, schema version). Never mutated; this is the replay + audit source.
3. **Normalize** — UTF-8 + Bijoy/ANSI conversion, BDT/USD currency tagging with FX-at-observation, date/timezone (Asia/Dhaka) normalization, dual-script name fields.
4. **Validate** — schema, type, range, referential, and business-rule checks (section 7).
5. **Match/resolve** — entity resolution via `ProjectCrossReference` (the same `Project` named differently in Tally vs Drive vs a form). Bilingual/mixed-script matching is fuzzy + human-confirmable, never assumed deterministic.
6. **Canonical store** — multi-tenant, row-level tenant isolation; provenance preserved on every field.
7. **Semantic layer** — the only thing the AI/dashboards read; deterministic KPI functions (the LLM never queries the store directly).

All steps are **per-tenant isolated** from day one (multi-tenant-ready) even though the pilot is single-tenant.

---

## 7. Data validation

Validation is layered; a record can be **accepted / accepted-with-warning / quarantined / rejected**.

| Layer | Checks | On failure |
|---|---|---|
| **Structural** | Schema/version match, required columns, types, encoding (UTF-8/Bijoy detection) | Reject file or row; importer returns a line-level report |
| **Domain** | BDT/USD valid currency, FX present for non-BDT, VAT/AIT arithmetic consistency, date sanity, enum membership (e.g. approval type) | Accept-with-warning or quarantine |
| **Referential** | `Project`/`Client`/`Consultant` resolves via `ProjectCrossReference`; orphan detection | Quarantine for human match |
| **Business rule** | `Payment` ≤ `Invoice` outstanding; phase order sane; milestone dates monotonic; duplicate detection | Warn + flag for review |
| **Completeness** | Recompute `Data Completeness Score` per `Project`; below-threshold flags AI degradation | Surface "what to capture" prompt |

Validation results are themselves provenance: a KPI computed from accepted-with-warning data carries a lower confidence chip downstream.

---

## 8. Error handling, retry & idempotency

**Idempotency is mandatory** because thin webhooks (Graph, QBO, Dropbox, Smartsheet) force a notify-then-read pattern and may deliver duplicates, and because Excel re-uploads are common.

- **Idempotency key** per record = `hash(tenant, source, source_record_id, source_revision/etag/checksum)`. Re-ingesting the same payload is a no-op upsert; an Excel re-upload diffs against the prior load rather than duplicating.
- **Webhook fast-ack:** webhook endpoints persist the raw body to the landing zone and return **200 within the vendor SLA** (WhatsApp/Xero <5s; Graph/Dropbox <10s), then process asynchronously off a queue. **Never process synchronously inside the webhook** — that is how numbers get throttled.
- **Retry policy:** transient errors (429/5xx/network) → exponential backoff with jitter, honoring `Retry-After` (Graph, Procore, Xero, Asana, Smartsheet all emit it). Caps per source; respect Xero's **5,000 req/day/org** and ClickUp's **100 req/min** by scheduling delta windows, not retry storms.
- **Dead-letter queue:** records exhausting retries (or failing validation hard) move to a DLQ with the original payload + error trace, visible in the health console, replayable after a fix. Because Meta has **no DLQ of its own**, ours is the only safety net for WhatsApp.
- **Poison-message guard:** repeated failures on the same key trip a circuit breaker for that record, not the whole connector.
- **Manual-capture errors:** surfaced inline to the user at capture time (the cheapest place to fix data) rather than failing silently downstream.

---

## 9. Integration-health monitoring spec

A small firm will not debug a broken connector — so the system must make its own health legible and, where possible, self-heal. Each `DataSource` exposes a **health record**.

| Signal | Definition | Alert threshold (pilot) |
|---|---|---|
| **Freshness / lag** | Now − last successful sync | > 2× expected cadence (e.g. Drive push silent >12h; weekly import >10 days) |
| **Sync success rate** | Successful runs ÷ attempts (rolling 7d) | < 95% |
| **DLQ depth** | Records awaiting human resolution | > 0 visible; > 20 escalates |
| **Validation pass rate** | Accepted ÷ total ingested | < 90% (signals schema drift) |
| **Auth/token status** | OAuth token/refresh validity, days-to-expiry | Expiring < 7 days; expired = critical |
| **Quota headroom** | Remaining vs vendor cap | < 20% remaining |
| **Webhook ack health** | % acked within SLA | any miss (WhatsApp/Xero) is critical |
| **Data Completeness Score** | Per-`Project` coverage of canonical entities | below capability thresholds → AI degrades, prompts capture |

**Surfacing.** A single **Integration Health** panel (owner + admin) shows each connector as green/amber/red with last-sync time, next expected sync, and a plain-language fix ("Reconnect Google — token expired", "Upload this week's Tally export", "3 records need you to match a project"). Token-expiry and webhook-failure alerts also push proactively, because a silent dead connector is worse than a visible one — the AI layer must **never present stale data as current**, so any red/amber source taints downstream KPI freshness chips. Health events are written to the `AuditLog` for the provenance trail.

---

## 10. Summary — the pilot's integration posture

- **Read-only everywhere.** No connector writes to a source system in any phase. PracticeLens writes only into itself (manual capture).
- **Manual capture is the product's spine, not a fallback.** It is the only route to `Decision`, `Approval`, `Change`, `Timesheet`, `Client Approval Time` — the data that determines MONEY and DELIVERY.
- **No brittle bespoke API in the pilot.** Tally → CSV export; WhatsApp → forward/screenshot; finance → templated import. Live APIs limited to Google **or** Microsoft for file-presence + email/calendar (P2).
- **Everything is pluggable** behind the `DataSource`/`IntegrationRecord` abstraction, so productization adds connectors (QBO, Xero, APS, Procore, Deltek, WhatsApp Cloud API) without re-architecting.
- **Provenance + completeness on every record**, raw-landing-before-parse, idempotent upserts, async webhook processing, DLQ + replay, and a legible health console — so a non-technical owner can trust, and a small team can operate, the whole pipeline.
