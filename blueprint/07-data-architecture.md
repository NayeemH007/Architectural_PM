# Central Analytics Data Architecture

> The schema and pipeline that turn a Dhaka practice's scattered reality — *principal's head > WhatsApp > email > Excel > paper > the ECPS portal* — into one queryable, provenance-stamped, multi-tenant warehouse that the AI reporting layer can trust. This section defines the canonical model across all 42 entities, the bronze→silver→gold medallion flow, the provenance contract every record carries, the Project Cross-Reference / matching system (the linchpin that lets "Mr. Karim's apartment", `PRJ-024`, the Tally ledger "Karim Residence" and the Drive folder `24_Karim_Banani` all roll up to one Project), and the multi-tenant keying that keeps the pilot single-firm but the platform productizable.

## Design stance (read this first)

Three constraints shape every decision below:

1. **The source of truth stays outside us.** PracticeLens is a read-only-first analytics layer. The warehouse is a *derived* copy; the firm's Tally, Drive, ECPS portal and WhatsApp threads remain authoritative. So the model is optimized for *reconstructing* and *cross-referencing* facts, not for being the transactional system. We never write back.
2. **Most high-value data is missing or informal.** There are no timesheets, no scope baseline, verbal approvals. The schema must (a) represent partial/low-confidence records as first-class, not as errors, and (b) make missingness *measurable* via `Data Completeness Score` so the AI layer can refuse rather than fabricate.
3. **Identity is ambiguous.** The same Project, Client and Employee appear under different names, scripts (Bangla/English), spellings and IDs across five+ systems. **Entity resolution is not a nice-to-have — it is the core engineering problem of this product.** Hence ProjectCrossReference (and its sibling resolvers for Client/Employee/Consultant) gets a disproportionate share of this design.

The store is **column-oriented for gold, row-oriented for silver/operational**. Concretely: silver + operational tables in **PostgreSQL** (Singapore or Mumbai region, see residency note), gold marts materialized in Postgres too for the pilot (data volumes for one 5–30 person firm are tiny — tens of thousands of rows, not millions), with a clean path to push gold into a columnar engine (DuckDB/ClickHouse/BigQuery) at productization. Bronze is object storage (S3-compatible) holding immutable raw payloads.

---

## 1. The medallion architecture (bronze → silver → gold)

| Layer | Store | Contents | Schema discipline | Mutability | Who reads it |
|---|---|---|---|---|---|
| **Bronze (raw)** | Object storage (S3/Spaces), partitioned `tenant_id/source_system/dt/` | Every raw payload exactly as received: WhatsApp webhook JSON, Tally CSV/XLSX rows, Drive `files.list` JSON, M365 driveItem deltas, uploaded Excel sheets, manual-form submissions, OCR'd PDF text | Schema-on-read. No parsing, no joins. | **Append-only, immutable.** Never updated, never deleted (except retention/erasure). | Replay/backfill jobs, audit, the silver parser only |
| **Silver (normalized)** | PostgreSQL, canonical entity tables | The 42 canonical entities, normalized, de-duplicated, type-cast, UTF-8/Unicode-normalized, cross-referenced to canonical IDs, FK-linked | Schema-on-write, strongly typed, FK-enforced | Upserted by idempotent parsers keyed on `(source_system, source_id)` | KPI builders, the matching UI, the semantic layer |
| **Gold (KPI / marts)** | PostgreSQL materialized views + mart tables (columnar later) | The 26 canonical KPIs pre-computed per grain (project / phase / client / employee / firm / month), plus `Data Completeness Score` per project | Versioned calculation logic; each KPI row records `calc_version` | Rebuilt on schedule or on upstream change; fully reproducible from silver | The AI reporting layer (deterministic detectors), dashboards, exports |

**Why bronze is non-negotiable here.** The research is explicit: **WhatsApp Cloud API has no message-history / replay API and no dead-letter queue** — if we do not persist every inbound webhook to durable storage *before* processing, the data is gone forever. The same logic applies defensively to *every* source: thin webhooks (QuickBooks, Smartsheet, Dropbox, Graph) and rate-limited reads (Xero 5,000/day per org) mean we cannot cheaply re-fetch. Bronze is our backfill insurance and our audit substrate. **Rule: nothing reaches a parser that has not first landed, byte-for-byte, in bronze.**

**Gold is reproducible by construction.** Because the LLM never computes a number (see the AI Reporting section), every KPI in gold is the output of a named, versioned SQL function over silver. If we find a calculation bug, we bump `calc_version`, rebuild the mart from silver, and every historical report can be regenerated and diffed. Bronze→silver→gold is therefore a *pure, replayable function* — the foundation of the anti-hallucination guarantee.

---

## 2. The provenance contract (every silver + gold record)

Every row in every silver and gold table carries these columns. This is the spine of the anti-hallucination promise: the AI layer can cite *which record, from which system, observed when, with what confidence, last verified by whom*.

```
tenant_id        UUID    NOT NULL   -- multi-tenant partition key (see §6)
source_system    TEXT    NOT NULL   -- 'tally' | 'gdrive' | 'm365' | 'whatsapp' | 'manual_form' | 'excel_import' | 'ecps_manual' | 'derived'
source_id        TEXT               -- native id in that system (Drive fileId, Tally voucher GUID, form submission id); NULL for derived
ingested_at      TIMESTAMPTZ NOT NULL -- when it landed in bronze
observed_at      TIMESTAMPTZ        -- when the fact was true in the real world (invoice date, approval date) — may differ wildly from ingested_at
confidence       NUMERIC(3,2)       -- 0.00–1.00; deterministic API record = 1.00; OCR / fuzzy-matched / inferred < 1.00
last_verified_at TIMESTAMPTZ        -- last time a human confirmed this record in-app
last_verified_by UUID               -- employee_id of confirmer, NULL if never human-verified
provenance       JSONB              -- audit trail: raw bronze pointer(s), parser version, match rationale, calc inputs
is_current       BOOLEAN NOT NULL DEFAULT true  -- SCD-style; superseded records kept for audit
```

Notes that matter for Dhaka:

- **`confidence` is not cosmetic — it gates AI output.** A manually-typed approval date forwarded from WhatsApp carries `confidence ≈ 0.6`; a Drive file's `modifiedTime` carries `1.0`; an OCR'd RAJUK receipt date carries maybe `0.5` (Bengali OCR is materially harder — complex conjuncts, mixed-script addresses). KPI builders propagate the *minimum* confidence of their inputs, and detectors refuse to fire below a per-capability threshold.
- **`observed_at` ≠ `ingested_at` is the norm, not the exception.** An owner enters a verbal client approval three weeks after it happened. We must store *when it was true* (drives `Client Approval Time`, `Schedule Variance`) separately from *when we learned it* (drives freshness/SLA). Conflating them corrupts every schedule KPI.
- **`provenance` JSONB carries match rationale** for cross-referenced records: e.g. `{"matched_via":"fuzzy","score":0.86,"alias":"Karim Residence","confirmed_by":"<uuid>","rule":"trigram+client_anchor"}`. This is what the UI shows when a user asks "why is this Tally ledger attached to this project?"

---

## 3. Canonical model — textual ERD

Cardinalities use crow's-foot wording: `A 1—* B` = one A has many B; `A *—* B` = many-to-many (junction table). All FKs are implicitly composite with `tenant_id` (every FK is `(tenant_id, <id>)`; omitted below for readability — see §6).

### Organization & people backbone

```
Company 1—* Office
Company 1—* Employee            (Employee.office_id -> Office, nullable)
Employee  *—* Role              via EmployeeRole            (RBAC; finance data restricted to Owner + Finance/Admin)
Employee  *—* Team              via TeamMembership
Company 1—* Client
Client    1—* Contact
Consultant and Contractor are external orgs; Consultant 1—* Contact, Contractor 1—* Contact
```

### Pipeline → contract → project spine (priority money/delivery)

```
Client     1—* Opportunity
Opportunity 1—* Proposal                 (a pursuit can have revised proposals)
Proposal   0..1—1 Contract                (won proposal becomes a contract; Contract.proposal_id nullable for legacy/verbal deals)
Contract   1—* Project                    (usually 1—1 in this market, but a contract can cover phased/multi-building scopes)
Client     1—* Project                    (denormalized client_id on Project for query speed; canonical via Contract)
Project    1—* ProjectPhase              (Concept→Schematic→DD→Authority Approval→CD→Tender→CA→Handover)
Project    *—* Service                   via ProjectService (residential / commercial / interior / institutional mix)
Project    1—1 ProjectCrossReference set (the alias hub — see §4)
```

### Delivery: tasks, milestones, deliverables, documents

```
Project      1—* Task                     (Task.phase_id -> ProjectPhase nullable; Task.assignee_id -> Employee)
Project      1—* Milestone                (phase gates + the authority approvals)
Milestone    1—1 Approval                 (when the milestone IS an authority gate: RAJUK LUC/CP, FSCD NOC, DoE ECC, CAAB, utilities)
Project      1—* Deliverable
Deliverable  1—* Document                 (a deliverable = a set of documents/drawings)
Document     0..1 specializes-as Drawing | Model   (Drawing/Model are typed Documents; doc_type discriminator)
Drawing      1—* Revision                 (filename-versioning reality: _final, _final2, _rev_latest captured as Revisions)
Document     1—* Revision
Project      1—* Meeting
Meeting      1—* Decision                 (Decision.meeting_id nullable — many decisions are verbal/WhatsApp, no meeting)
Project      1—* Decision
Project      1—* Risk
Project      1—* Issue
```

### Authority approvals (Dhaka first-class milestones)

```
Approval.approval_type ∈ {RAJUK_LUC, RAJUK_CP, FSCD_NOC, DOE_ECC, CAAB_HEIGHT, DESCO, DPDC, WASA, TITAS, CITY_CORP, LAND_MUTATION}
Approval 1—* Submittal                    (drawing sets submitted to the authority; RAJUK CP needs 5 sets:
                                           Architectural / Structural / Plumbing / Electrical / Fire)
Approval 1—* Document                     (receipts, query letters, approved drawings)
```
Approvals are modeled as a *specialization of Milestone* with a status machine (`not_started → prepared → submitted → query_raised → resubmitted → approved | rejected`) and dated transitions, because the owner's top schedule concern is *"where exactly is approval stuck, and for how long"* — which requires every transition to be a timestamped, provenance-stamped event.

### Construction administration

```
Project   1—* Consultant       via ProjectConsultant   (structural/MEP, often freelancers)
Project   1—* Contractor       via ProjectContractor
Project   1—* RFI              (RFI.consultant_id / contractor_id; cycle-time => Consultant Response Time)
Project   1—* Submittal
Project   1—* SiteReport       (often a WhatsApp photo + caption → structured)
Project   1—* Change           (scope changes — the silent margin leak; Change.fee_impact, status)
Project   1—* Defect           (snag list)
RFI / Submittal / Change / Defect each 1—* Document
```

### Resourcing & time (priority people — bootstrapped, may not exist yet)

```
Employee     *—* Project        via ResourceAssignment   (ResourceAssignment.phase_id, planned_hours, period)
Employee     1—* Timesheet                              (Timesheet.project_id, phase_id, task_id, hours, date)
Timesheet    *—1 Task                                    (nullable)
```
`Timesheet` is the entity the firm almost certainly lacks. The model keeps it first-class but lets `ResourceAssignment` (assignment counts) act as the proxy grain for `Utilization Rate` / `Resource Capacity` until timesheets exist — the AI layer degrades to "assignment-count proxy" and flags low completeness, rather than inventing labour cost.

### Money (priority #1)

```
Contract  1—* Fee                  (Fee = % of construction cost, banded; staged against phases)
Fee       *—1 ProjectPhase         (phase/milestone-triggered billing)
Project   1—* Budget               (Budget per phase; baseline often absent → low completeness)
Project   1—* Expense              (incl. reimbursables: printing, RAJUK fees, model-making, liaison costs)
Project   1—* Invoice
Invoice   *—1 Fee                   (an invoice draws against a fee stage)
Invoice   1—* Payment              (partial payments common)
Invoice line items model: gross_fee, vat_15pct, vds_withheld, ait_tds_withheld, net_receivable, currency, fx_rate
```
**Finance must separate gross fee, 15% NBR VAT, VDS withheld, ~10% AIT/TDS withheld (resident; ~20% non-resident), and net cash received** — because AIT withholding suppresses `Collection Rate` and "expected cash ≠ invoice face value". `currency` defaults BDT; USD invoices to foreign clients capture `fx_rate` at both invoice and settlement.

### Integration & governance (cross-cutting)

```
DataSource    1—* IntegrationRecord     (DataSource = a configured connector instance for this tenant)
IntegrationRecord 1—* <any canonical entity>   (every silver record points back to the IntegrationRecord that produced it)
AuditLog                                  (append-only: who saw/confirmed/exported what — PDPO 2025 trail)
Project       1—1 ProjectCrossReference  (canonical id hub)
ProjectCrossReference 1—* ProjectAlias    (the alias table — §4)
```

---

## 4. Project Cross-Reference & matching system (the linchpin)

This is the hardest and most valuable subsystem. In a Dhaka firm one Project is referenced as: a Tally ledger ("Karim Residence" / "জনাব করিম এর বাসা"), a Drive folder (`24_Karim_Banani_Apt`), an Excel row ("Karim 6-storey Banani"), WhatsApp shorthand ("Karim bhai project"), and an ECPS application number. None share a key. If we get this wrong, **every per-project KPI — Forecast Project Margin, Fee Burn Rate, Schedule Variance — is computed over a fractured or contaminated dataset.** Getting it *visibly, auditably* right is also the product's credibility moment with a skeptical owner.

### 4.1 Canonical Project ID and the alias hub

- Every real-world project gets one **canonical `project_id`** (UUID), minted once — at first ingest or by an owner in the manual-capture UI.
- **`ProjectCrossReference`** is a per-project hub (1—1 with Project). **`ProjectAlias`** rows hang off it — one row per *(source_system, source identifier/name)* observed in the wild.

```
ProjectAlias:
  project_id, tenant_id,
  source_system,           -- 'tally','gdrive','m365','excel_import','whatsapp','ecps_manual',...
  source_id,               -- native id if any (Drive folderId, Tally ledger guid)
  raw_name,                -- exactly as seen, original script
  raw_name_normalized,     -- folded: Unicode-normalized, lowercased, transliterated, noise-stripped
  raw_name_bn, raw_name_en,-- dual-script storage (see Bangla handling)
  match_method,            -- 'deterministic' | 'fuzzy' | 'manual'
  match_score,             -- 0..1
  match_status,            -- 'confirmed' | 'suggested' | 'rejected'
  confirmed_by, confirmed_at,
  + full provenance columns
```
The same alias pattern is reused for **ClientCrossReference, EmployeeCrossReference, ConsultantCrossReference** — identity resolution is a shared service, not project-only. Clients especially need it: the Tally party name, the contract signatory, and the WhatsApp contact are three strings for one Client.

### 4.2 Matching pipeline — deterministic first, fuzzy second, human always available

| Stage | Technique | Example | Outcome |
|---|---|---|---|
| **0. Normalize** | Unicode NFC; detect & convert **Bijoy/ANSI→Unicode** (else garbled Latin); lowercase; strip honorifics (জনাব/Mr/Janab), suffixes (Residence/Bhaban/Apt/Project), road/plot tokens; produce transliteration | "জনাব করিম এর বাসা, বনানী" → `karim banani` | comparable keys |
| **1. Deterministic** | Exact match on a strong key: ECPS application no., shared `source_id` already linked, exact normalized name + same Client anchor | Two Excel rows both "PRJ-024" | auto-link, `confidence 1.0`, `match_status confirmed` |
| **2. Fuzzy** | Trigram similarity (`pg_trgm`) + token-set ratio + **Client anchor** (same resolved client sharply boosts) + **temporal/locality anchors** (same area "Banani", overlapping dates, similar construction cost) | "Karim Residence" (Tally) vs "24_Karim_Banani" (Drive) → score 0.86, both Client=Abdul Karim | if ≥ auto-threshold (≈0.92 *with* a corroborating anchor) auto-suggest-confirm; else queue for human |
| **3. Human-in-the-loop** | Review queue: candidate clusters with score, evidence chips, and side-by-side raw names in both scripts | Owner sees "These 3 sources look like ONE project — link them?" | `match_method='manual'`, `confirmed_by`, written to provenance |

**Thresholds are deliberately conservative.** A false *merge* (two real projects collapsed into one) silently corrupts margins and is hard to detect; a false *split* merely fragments and is visible as "duplicate-looking" projects. So we bias toward *not* auto-merging: fuzzy auto-link requires **both** a high string score **and** at least one independent anchor (client, area, cost, or date). Everything else goes to the human queue. The owner of a 5–30 person firm knows their ~20–60 live projects by heart, so the review queue is small and the confirmations are fast and high-quality — we exploit that.

### 4.3 Human-in-the-loop confirmation UI (behavioral spec)

- **Inbox of suggestions**, ranked by potential impact (a candidate that would attach BDT 4.2 lakh of Tally vouchers ranks above an orphan Drive folder).
- Each card shows: the proposed canonical Project, every candidate alias **rendered in its original script** (Nikosh Bengali font bundled), the match score, and the **evidence chips** ("same client: Abdul Karim", "trigram 0.86", "both Banani", "voucher dates overlap project dates").
- Actions: **Confirm**, **Reject**, **Split** (this alias is actually a *different* project → mint new canonical id), **Merge** (these two canonical projects are one). Every action writes `confirmed_by` + rationale to `provenance` and an `AuditLog` row.
- **Unmatched bucket** ("orphans"): aliases we could not confidently place. These directly *lower the project/firm `Data Completeness Score`* and surface in the AI layer as "X sources not yet linked to a project — link them to improve report accuracy." Missingness is made actionable, not hidden.
- **Re-matching is non-destructive.** Confirmed links are SCD'd (`is_current`); if an owner later splits a wrongly-merged project, gold marts rebuild from silver and historical reports regenerate cleanly.

### 4.4 Inconsistent Bangla/English names — explicit handling

- **Store both scripts** (`raw_name_bn`, `raw_name_en`); never force one. Transliteration is **non-deterministic** (করিম ↔ Karim/Kareem/Korim) so it is a *matching aid*, never a stored canonical key.
- **Normalize to UTF-8/Unicode on ingest; detect and convert Bijoy/ANSI legacy text** — the single biggest data-engineering risk per the research. A Tally export or DTP title block in SutonnyMJ that we *don't* convert lands as garbled Latin and silently never matches.
- Matching runs on **both** the transliterated-Latin key and the Unicode-Bengali key, taking the max similarity, so "Karim Residence" matches "করিম রেসিডেন্স" via the Bengali key and "করিম এর বাসা" via the transliterated key.
- **Mixed-script addresses** (Bengali ward + English plot/road numbers) are tokenized so numeric/Latin locality tokens still anchor even when the name script differs.

---

## 5. Representative DDL sketch (8 core tables)

PostgreSQL. Every table is row-level-security-scoped on `tenant_id` (§6). Provenance columns are shown explicitly on the first table and abbreviated as `<provenance>` thereafter for brevity (they are *not* optional).

```sql
-- 1. PROJECT (the spine; canonical id is the join target for all matching)
CREATE TABLE project (
  tenant_id        UUID NOT NULL,
  project_id       UUID NOT NULL DEFAULT gen_random_uuid(),
  contract_id      UUID,                         -- FK contract; nullable: verbal/legacy deals
  client_id        UUID NOT NULL,                -- FK client (resolved via ClientCrossReference)
  office_id        UUID,
  name_en          TEXT,
  name_bn          TEXT,                          -- dual-script, both stored
  service_mix      TEXT[],                        -- {'residential','interior',...}
  construction_cost_bdt  NUMERIC(16,2),           -- fee base; re-estimable
  current_phase    TEXT,                          -- enum-ish: concept|schematic|dd|authority|cd|tender|ca|handover
  status           TEXT NOT NULL DEFAULT 'active',
  data_completeness_score NUMERIC(3,2),           -- denormalized from gold for fast filtering
  -- provenance contract --
  source_system    TEXT NOT NULL,
  source_id        TEXT,
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  observed_at      TIMESTAMPTZ,
  confidence       NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  last_verified_at TIMESTAMPTZ,
  last_verified_by UUID,
  provenance       JSONB NOT NULL DEFAULT '{}',
  is_current       BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, project_id),
  FOREIGN KEY (tenant_id, contract_id) REFERENCES contract(tenant_id, contract_id),
  FOREIGN KEY (tenant_id, client_id)   REFERENCES client(tenant_id, client_id)
);

-- 2. PROJECT_ALIAS (the cross-reference / matching hub)
CREATE TABLE project_alias (
  tenant_id        UUID NOT NULL,
  alias_id         UUID NOT NULL DEFAULT gen_random_uuid(),
  project_id       UUID,                          -- nullable while in 'orphan'/'suggested' state
  source_system    TEXT NOT NULL,
  source_id        TEXT,
  raw_name         TEXT NOT NULL,                 -- original script, untouched
  raw_name_bn      TEXT,
  raw_name_en      TEXT,
  raw_name_norm    TEXT,                          -- folded key for matching (indexed w/ pg_trgm)
  match_method     TEXT,                          -- deterministic|fuzzy|manual
  match_score      NUMERIC(4,3),
  match_status     TEXT NOT NULL DEFAULT 'suggested', -- suggested|confirmed|rejected
  confirmed_by     UUID,
  confirmed_at     TIMESTAMPTZ,
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  confidence       NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  provenance       JSONB NOT NULL DEFAULT '{}',
  is_current       BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (tenant_id, alias_id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES project(tenant_id, project_id),
  UNIQUE (tenant_id, source_system, source_id)
);
CREATE INDEX idx_alias_trgm ON project_alias USING gin (raw_name_norm gin_trgm_ops);

-- 3. APPROVAL (authority gates; specialization of milestone)
CREATE TABLE approval (
  tenant_id        UUID NOT NULL,
  approval_id      UUID NOT NULL DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL,
  milestone_id     UUID,                          -- 1-1 with the schedule milestone
  approval_type    TEXT NOT NULL,                 -- RAJUK_LUC|RAJUK_CP|FSCD_NOC|DOE_ECC|CAAB_HEIGHT|DESCO|WASA|TITAS|...
  authority_ref    TEXT,                          -- ECPS application no., NOC no.
  status           TEXT NOT NULL,                 -- not_started|prepared|submitted|query_raised|resubmitted|approved|rejected
  submitted_on     DATE,
  decision_on      DATE,
  validity_expires_on DATE,                        -- e.g. LUC 24-month window
  notes_bn         TEXT,
  notes_en         TEXT,
  <provenance>,
  PRIMARY KEY (tenant_id, approval_id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES project(tenant_id, project_id)
);

-- 4. APPROVAL_EVENT (every status transition is a timestamped, provenance-stamped fact)
CREATE TABLE approval_event (
  tenant_id      UUID NOT NULL,
  event_id       UUID NOT NULL DEFAULT gen_random_uuid(),
  approval_id    UUID NOT NULL,
  from_status    TEXT,
  to_status      TEXT NOT NULL,
  event_on       DATE NOT NULL,                   -- observed_at of the transition
  <provenance>,
  PRIMARY KEY (tenant_id, event_id),
  FOREIGN KEY (tenant_id, approval_id) REFERENCES approval(tenant_id, approval_id)
);

-- 5. INVOICE (BDT-default, VAT/VDS/AIT separated, multi-currency)
CREATE TABLE invoice (
  tenant_id        UUID NOT NULL,
  invoice_id       UUID NOT NULL DEFAULT gen_random_uuid(),
  project_id       UUID NOT NULL,
  fee_id           UUID,                          -- the fee stage billed
  invoice_no       TEXT,
  issued_on        DATE,
  currency         CHAR(3) NOT NULL DEFAULT 'BDT',
  fx_rate_at_issue NUMERIC(14,6) DEFAULT 1.0,     -- to BDT
  gross_fee        NUMERIC(16,2) NOT NULL,
  vat_15pct        NUMERIC(16,2) NOT NULL DEFAULT 0,  -- NBR 15%
  vds_withheld     NUMERIC(16,2) NOT NULL DEFAULT 0,  -- VAT deducted at source by client
  ait_tds_withheld NUMERIC(16,2) NOT NULL DEFAULT 0,  -- ~10% resident / ~20% non-resident
  net_receivable   NUMERIC(16,2) NOT NULL,            -- expected cash ≠ gross
  status           TEXT NOT NULL DEFAULT 'issued',    -- draft|issued|part_paid|paid|written_off
  <provenance>,
  PRIMARY KEY (tenant_id, invoice_id),
  FOREIGN KEY (tenant_id, project_id) REFERENCES project(tenant_id, project_id),
  FOREIGN KEY (tenant_id, fee_id)     REFERENCES fee(tenant_id, fee_id)
);

-- 6. PAYMENT
CREATE TABLE payment (
  tenant_id      UUID NOT NULL,
  payment_id     UUID NOT NULL DEFAULT gen_random_uuid(),
  invoice_id     UUID NOT NULL,
  paid_on        DATE,
  currency       CHAR(3) NOT NULL DEFAULT 'BDT',
  fx_rate_at_settle NUMERIC(14,6) DEFAULT 1.0,
  amount         NUMERIC(16,2) NOT NULL,
  method         TEXT,                            -- bkash|bank_transfer|cheque|cash|wise|payoneer
  <provenance>,
  PRIMARY KEY (tenant_id, payment_id),
  FOREIGN KEY (tenant_id, invoice_id) REFERENCES invoice(tenant_id, invoice_id)
);

-- 7. TIMESHEET (often absent at pilot start; ResourceAssignment is the fallback grain)
CREATE TABLE timesheet (
  tenant_id      UUID NOT NULL,
  timesheet_id   UUID NOT NULL DEFAULT gen_random_uuid(),
  employee_id    UUID NOT NULL,
  project_id     UUID,
  phase_id       UUID,
  task_id        UUID,
  work_date      DATE NOT NULL,
  hours          NUMERIC(5,2) NOT NULL,
  is_billable    BOOLEAN,
  <provenance>,                                   -- source_system often 'manual_form'; confidence < 1.0
  PRIMARY KEY (tenant_id, timesheet_id),
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employee(tenant_id, employee_id),
  FOREIGN KEY (tenant_id, project_id)  REFERENCES project(tenant_id, project_id)
);

-- 8. INTEGRATION_RECORD (governance: every silver row traces to a connector run)
CREATE TABLE integration_record (
  tenant_id        UUID NOT NULL,
  integration_record_id UUID NOT NULL DEFAULT gen_random_uuid(),
  data_source_id   UUID NOT NULL,                 -- FK to data_source (configured connector instance)
  source_system    TEXT NOT NULL,
  bronze_uri       TEXT NOT NULL,                 -- pointer to immutable raw payload in object storage
  payload_hash     TEXT NOT NULL,                 -- dedupe / tamper check
  entity_type      TEXT,                          -- which canonical entity it produced
  entity_id        UUID,                          -- the resulting silver row
  parser_version   TEXT NOT NULL,
  ingested_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status           TEXT NOT NULL DEFAULT 'parsed',-- received|parsed|matched|failed
  error            JSONB,
  PRIMARY KEY (tenant_id, integration_record_id),
  FOREIGN KEY (tenant_id, data_source_id) REFERENCES data_source(tenant_id, data_source_id)
);
```

---

## 6. Multi-tenant keys & staying multi-tenant-ready

The pilot is **single-firm**, but the schema is multi-tenant from row one so productization is a config change, not a migration.

- **`tenant_id` (UUID) is the leading column of every PK and every FK.** `Company` is *within* a tenant (one tenant may later hold multiple legal Companies / offices), so `tenant_id` ≠ `company_id`. Composite keys `(tenant_id, <id>)` mean no cross-tenant FK can ever resolve.
- **Shared-schema, pooled-database with PostgreSQL Row-Level Security.** Every silver/gold table has an RLS policy `USING (tenant_id = current_setting('app.tenant_id')::uuid)`. The application sets `app.tenant_id` per connection/session from the authenticated context. This is defense-in-depth on top of always-parameterized `tenant_id` in queries — a forgotten `WHERE tenant_id =` cannot leak data.
- **Bronze is physically partitioned by tenant** (`s3://bucket/<tenant_id>/<source_system>/<dt>/`), which also makes PDPO 2025 data-subject erasure and per-tenant export tractable.
- **Connector credentials and the semantic layer are tenant-scoped.** `DataSource` rows (OAuth tokens, Tally host:port, Drive scopes) are per tenant; matching thresholds and KPI `calc_version` can be overridden per tenant for firms with quirky data.
- **Residency hook.** A `tenant.residency_region` field (`sg` | `mumbai` | `bd_mirror`) drives where bronze/silver physically live. Per the PDPO 2025 + 2026 amendment, ordinary project data may sit in Singapore/Mumbai, but **sensitive identifiers (NID, TIN, passport, biometric) are minimized, segregated into a `sensitive_pii` table, and — where a tenant is classed restricted/CII — a synchronized real-time copy is kept inside Bangladesh.** The tenant key plus a `data_class` tag on PII columns is what makes that selective mirroring enforceable rather than aspirational.
- **Noisy-neighbor & scale path.** One Dhaka firm is tiny (tens of thousands of rows); pooled Postgres is ample for the pilot and dozens of tenants. At productization, the `tenant_id`-leading keys allow (a) hot tenants to be moved to dedicated schemas/databases without app changes, and (b) gold marts to be lifted into a columnar engine partitioned by `tenant_id` for cross-firm benchmarking (utilization, win-rate) without ever co-mingling raw data.

---

## 7. How this serves the priority order

| Priority | Entities that carry it | Gold marts / KPIs | The data-reality caveat baked into the model |
|---|---|---|---|
| **1 MONEY** | Contract, Fee, Budget, Expense, Invoice, Payment | Fee Burn Rate, EAC, Forecast Project Margin, WIP, Unbilled Revenue, Invoice Aging, Collection Rate | Margin needs labour cost → flagged low-confidence until Timesheet exists; VAT/VDS/AIT separated so Collection Rate is honest |
| **2 DELIVERY** | ProjectPhase, Milestone, Approval, ApprovalEvent, Deliverable, Document, Drawing, Revision, Task | Schedule Variance, Milestone Completion Rate, Deliverable Completion Rate, Drawing Revision Rate, Client Approval Time | Approval transitions are timestamped events → cycle-time on RAJUK/FSCD/CAAB becomes measurable for the first time |
| **3 PEOPLE** | Employee, ResourceAssignment, Timesheet, Task | Utilization Rate, Billable Utilization, Resource Capacity, Planned vs Actual Hours | Degrades to ResourceAssignment-count proxy when Timesheet absent; the platform *bootstraps* timesheets via manual capture |
| **4 PIPELINE** | Opportunity, Proposal, Contract | Pipeline Value, Weighted Pipeline, Proposal Win Rate | Lightest; pipeline data is the most informal (principal's head) → highest reliance on manual capture, lowest completeness early |

Every gold row carries the propagated `confidence` and feeds `Data Completeness Score`, so the AI layer's promise — *cite sources, show calculation logic, refuse when data is missing* — is enforced by the schema itself, not by hoping the model behaves.
