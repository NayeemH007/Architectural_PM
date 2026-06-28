# BUILD-CONTRACT — Step X · ingestion idempotency · reconciliation · corrections

> **Reviewer-authored. Builder ≠ reviewer.** The acceptance ledger
> `backend/test/ingestion-reconciliation.design.test.mjs` is **RED today** — the
> `etl` schema, its tables, and its functions do not exist. A LATER, DIFFERENT
> agent (the builder) makes the ledger GREEN by shipping the migration +
> functions named below. This file is the exact surface the builder implements.
>
> **Closes:** `in-*`, `etl-*` (PHASE-PLAN.md Step X). Carries the read-only-first
> connector model, idempotency (no-op re-ingest), payment↔milestone reconciliation,
> alias matching with conflict→review, the freshness SPLIT, and the
> correction/retraction flow (new rows via `supersedes_event_id`, never edits).
>
> **Honours every CONTEXT.md lock:** pglite has NO `pgcrypto`/`gen_random_uuid()`
> (mint uuids in seed/app code, pass them in) and NO `citext` (text + unique on
> `lower()`); migrations stay core-PG (Supabase-faithful DDL → `*.supabase.sql`,
> syntax-only); inject `as_of`, never read the wall clock; the contested-option
> default is **C5 — needs_review, NEVER auto-apply, NEVER silent-drop**.

---

## §0 — TREATMENT TABLE (one row per scope item; the locked default per item)

| # | Item | Today (live code) | **Treatment (default)** | Rationale / lock |
|---|---|---|---|---|
| T1 | **Idempotency key** | canonical.payment_milestone is keyed `(company_id, project_id, label, linked_phase)` — a *derived natural key*. There is NO `(source_system, source_record_ref)` UNIQUE. | **`(source_system, source_record_ref)` UNIQUE per company** is the idempotency key. Re-ingesting the same export row is an **UPSERT no-op** (content-hash unchanged → nothing written, no new audit event). | A1/C5. The seed `source_record_ref='tally:'+id` already exists; promote it to the dedup key. |
| T2 | **Content-hash fallback** | none | Each staged row carries `content_hash = md5(canonical-json of the business fields)`. Same `(source,ref)` + **same hash** → no-op. Same `(source,ref)` + **changed hash** → a **correction** (T6), not a duplicate. | A1. Detects "same logical record, changed amount" without diffing every column in app code. |
| T3 | **Ambiguous / absent ref** | a row with no `source_record_ref` could only be inserted by violating NOT NULL; there is no review path. | A staged row whose `source_record_ref` is **NULL/empty** OR is **ambiguous** (matches >1 existing canonical fact) routes to **`etl.needs_review`** (maker-checker). It is **NEVER auto-applied** and **NEVER silently dropped**. | C5 (contested-option). The queue is the safety valve. |
| T4 | **Payment↔milestone reconciliation** | `payment_milestone.received_amount` is a single denormalised column; there is no per-receipt grain and no "this payment settles that milestone" link. | A receipt (a `etl.payment_receipt` row) is **matched** to a milestone by `(project, amount, window)`; a confident match updates the milestone's received tally via a **correction event**; a **non-unique** match (two open milestones could absorb it) routes to review. | etl-*. Keeps `received_amount` as the projection but makes its provenance auditable. |
| T5 | **Alias matching** | client/project names are free text (`ClientA.name`, `ProjectA.name`); a connector export may name "Bashati Group" / "Bashati" / "Tejgaon Office". | `etl.alias` maps `(source_system, external_label) → canonical entity_id`. A **resolved** alias matches silently; an **unknown** label with **>1 candidate** (or 0) routes to review. A **conflicting** alias (same external label already mapped to a *different* entity) routes to review — never overwrites. | etl-*, C5. |
| T6 | **Correction / retraction** | none — a changed amount would overwrite the column in place, losing history. | Corrections are **NEW rows**, never edits. `etl.ingest_event` is **append-only**; a correction carries `supersedes_event_id` pointing at the event it replaces; a retraction carries `supersedes_event_id` + `retracted=true`. The **current** value of a logical record = its newest non-superseded, non-retracted event. | A1, F1. Matches the Step-6 `supersedes_event_id` / event-type union (`sync/match/correction/retraction`). |
| T7 | **Freshness SPLIT** | `payment_milestone.observed_at` (when the fact was true) and `ingested_at` (when we learned it) exist, but there is **no per-connector "when did we last sync"** distinct from "when was the data observed". | TWO clocks, never conflated: **`connector_last_run`** (per `etl.connector` — when we last *synced* the source) vs **`data_observed_at`** (per fact — when the fact was *true* at the source). A KPI can read "connector ran 2 min ago but the newest fact it carries is 9 days old" — a **stale connector** and **stale data** are distinguishable. | in-* (the headline freshness defect). |

> **Read-only-first:** every `etl.*` write in THIS repo is an **ingest** of an
> *inbound* observation (a connector pulled a fact). NOTHING here pushes
> outbound. The correction/retraction events are records of what the source told
> us, not commands to a source. (Outbound write-discipline is Step 6's
> `agent_action`; this subsystem never touches it.)

---

## §1 — SCHEMA the builder ships: `backend/db/migrations/0003_ingestion.sql`

Core-PG only (pglite-safe). Idempotent (`if not exists` / `create or replace`).
Ships `0003_ingestion.down.sql` + `0003_ingestion.supabase.sql` (the Supabase
variant may use `gen_random_uuid()` defaults + real RLS policies; the pglite
variant mints uuids in code and carries the same isolation predicate inside the
functions per the **G3 / A-3 RLS-bypass warning** — every `etl` function read is
**explicitly company-scoped**, NOT reliant on RLS).

```
create schema if not exists etl;

-- ── etl.connector — one row per (company, source_system). Carries the FRESHNESS
--    SPLIT clock #1: when we last synced this source.
create table if not exists etl.connector (
  id                uuid primary key,            -- minted in code
  company_id        uuid not null,
  source_system     text not null,
  mode              text not null default 'read_only'
                      check (mode = 'read_only'),  -- read-only-first: enforced
  connector_last_run timestamptz,                -- FRESHNESS clock #1 (sync time)
  unique (company_id, source_system)
);

-- ── etl.ingest_event — APPEND-ONLY observation log. One row per inbound fact
--    version. Corrections/retractions are NEW rows (T6), never UPDATEs.
create table if not exists etl.ingest_event (
  id                 uuid primary key,           -- minted in code
  company_id         uuid not null,
  connector_id       uuid not null references etl.connector(id),
  source_system      text not null,
  source_record_ref  text,                       -- NULLABLE: a null/empty ref must
                                                 --   route to review (T3), not crash
  event_type         text not null
                       check (event_type in ('sync','correction','retraction')),
  supersedes_event_id uuid references etl.ingest_event(id),  -- T6 lineage
  retracted          boolean not null default false,
  target_kind        text not null,              -- 'payment_milestone' | 'payment_receipt' | …
  target_ref         text,                       -- the logical record id once resolved
  payload            jsonb not null,             -- the business fields as observed
  content_hash       text not null,              -- md5(canonical-json(payload)) (T2)
  data_observed_at   timestamptz not null,       -- FRESHNESS clock #2 (fact-true time)
  ingested_at        timestamptz not null,       -- when WE learned it (injected, not now())
  superseded         boolean not null default false  -- set true when a newer event supersedes
);

-- IDEMPOTENCY KEY (T1): a (source_system, source_record_ref) is unique per company
-- for a NON-superseding 'sync' with a non-null ref. Corrections deliberately share
-- the ref (they supersede), so the unique index is PARTIAL on the live sync row.
create unique index if not exists ingest_event_idem_ux
  on etl.ingest_event (company_id, source_system, source_record_ref)
  where source_record_ref is not null
    and event_type = 'sync'
    and superseded = false
    and retracted = false;

-- ── etl.payment_receipt — per-receipt grain for reconciliation (T4). A receipt is
--    an inbound cash observation; its match to a milestone is auditable.
create table if not exists etl.payment_receipt (
  id                 uuid primary key,           -- minted in code
  company_id         uuid not null,
  project_id         text not null,
  amount             numeric(14,2) not null,
  received_at        date not null,
  source_system      text not null,
  source_record_ref  text,
  matched_milestone_id text,                     -- null until matched; ambiguous → review
  match_state        text not null default 'unmatched'
                       check (match_state in ('unmatched','matched','review')),
  data_observed_at   timestamptz not null
);

-- ── etl.alias — (source label) → canonical entity (T5). Conflict → review, never overwrite.
create table if not exists etl.alias (
  id             uuid primary key,
  company_id     uuid not null,
  source_system  text not null,
  entity_kind    text not null,                  -- 'client' | 'project'
  external_label text not null,
  canonical_id   text not null,
  unique (company_id, source_system, entity_kind, lower(external_label))  -- citext-free
);

-- ── etl.needs_review — the maker-checker queue (T3/T4/T5). Append-only; nothing
--    auto-applies. resolution is a CHECKER action (≠ maker), recorded out of band.
create table if not exists etl.needs_review (
  id            uuid primary key,
  company_id    uuid not null,
  reason        text not null
                  check (reason in ('absent_ref','ambiguous_ref','ambiguous_match',
                                    'alias_conflict','unknown_alias','duplicate_same_amount')),
  source_system text not null,
  source_record_ref text,
  payload       jsonb not null,
  state         text not null default 'open'
                  check (state in ('open','accepted','rejected')),
  created_observed_at timestamptz not null
);
```

---

## §2 — FUNCTIONS the builder ships (the exact callable surface)

All take an explicit `p_as_of`/observation clock or carry it on the payload — **no
`now()` for a fact value**. All are **explicitly company-scoped** by
`current_setting('request.company_id')` inside the body (G3/A-3: superuser bypasses
RLS — DO NOT rely on the policy).

### `etl.ingest(p_event jsonb) → etl.ingest_event` (or a small result row)
The single entry point a connector calls per inbound row. Branch table:

| Input condition | Outcome (the contract) |
|---|---|
| `source_record_ref` null/empty | **NO** canonical write; insert `etl.needs_review(reason='absent_ref')`; return a row marking `routed_to_review=true`. (T3) |
| `(source,ref)` exists + **same** `content_hash` | **No-op**: no new `ingest_event`, no canonical change, no review row, no new audit. (T1/T2 — re-ingest is a no-op.) |
| `(source,ref)` exists + **different** `content_hash` | **Correction**: insert a NEW `ingest_event(event_type='correction', supersedes_event_id=<old live event>)`; mark the old event `superseded=true`; re-project the canonical value. **Does NOT duplicate; does NOT overstate.** (T2/T6) |
| `(source,ref)` new + ref **ambiguous** (matches >1 existing canonical fact via alias/amount) | `etl.needs_review(reason='ambiguous_ref')`; no auto-apply. (T3) |
| `(source,ref)` new + unambiguous | Insert `ingest_event(event_type='sync')`; project to canonical. |
| `event_type='retraction'` | Insert `ingest_event(retracted=true, supersedes_event_id=<target>)`; mark target `superseded=true`; re-project so the retracted value is **removed** from the tally (receivables drop, never go negative or stay overstated). (T6) |

### `etl.reconcile_receipt(p_receipt jsonb) → match_state`
| Input condition | Outcome |
|---|---|
| receipt matches **exactly one** open milestone by `(project, amount, due-window)` | `match_state='matched'`; emit a `correction` ingest_event on that milestone's `received_amount`; re-project. |
| receipt matches **>1** candidate milestone | `match_state='review'`; `etl.needs_review(reason='ambiguous_match')`; **NEVER** auto-pick. (T4) |
| receipt matches **0** | `match_state='unmatched'` (held; not dropped). |
| a SECOND genuine receipt, **same project + same amount + same day** as an already-matched one | the second is **NOT silently dropped** — it gets its own `payment_receipt` row and routes to `needs_review(reason='duplicate_same_amount')` for a human to confirm "two real receipts" vs "a double-send". (T4 — the locked anti-silent-drop case.) |

### `etl.resolve_alias(p_source text, p_kind text, p_label text) → text | review`
| Input condition | Outcome |
|---|---|
| `external_label` resolves to exactly one `etl.alias` | return its `canonical_id` (silent). |
| label unknown, fuzzy-matches **>1** candidate (or 0) | `etl.needs_review(reason='unknown_alias')`; return null. (T5) |
| label already mapped to a **different** `canonical_id` than the inbound row claims | `etl.needs_review(reason='alias_conflict')`; **DO NOT overwrite** the existing alias. (T5) |

### `etl.freshness(p_company uuid, p_source text) → (connector_last_run, data_observed_at, connector_age, data_age)`
Returns BOTH clocks (T7) so a caller can render "synced 2 min ago, newest fact 9 days old". `connector_age`/`data_age` are computed against an **injected `as_of`**, not the wall clock. A stale connector (old `connector_last_run`) and stale data (old `max(data_observed_at)`) are **independently** reported.

---

## §3 — CANONICAL PROJECTION (how `etl` feeds the existing canonical tables)

The builder adds a **projection step** so the existing `canonical.payment_milestone`
(and `mart.recompute_portfolio_summary`) keep working unchanged:

- The **current** value of a milestone's `received_amount`/`gross_amount` is the
  projection of its **newest non-superseded, non-retracted** `ingest_event` of that
  `target_ref`. (A view `etl.current_event` or a projection function.)
- `canonical.payment_milestone.observed_at` ← the live event's `data_observed_at`.
- A correction re-projects (overwrites the canonical column) but the **history
  survives** in `etl.ingest_event`. Receivables therefore **track** a correction
  (down on a retraction, to the corrected amount on a correction) and **never
  double-count** (the superseded event is excluded from the projection).

> The existing spike acceptance + Slice-2b suites read `canonical.payment_milestone`
> and `mart.*`; the projection MUST keep `pm10 = 930000 gross / 0 received / overdue`
> so `overdueAmount=930000 @as_of=2026-06-22` and the 18→20 day clock are unchanged.
> **Existing suites must stay green.**

---

## §4 — INTEGRATION / RENDER SITES

| Site | Change |
|---|---|
| `backend/db/seed/seed_live.mjs` | Builder ADDS: seed one `etl.connector` per (firm, `tallyprime`) with a `connector_last_run`; back-fill one `etl.ingest_event(event_type='sync')` per seeded milestone so the canonical projection has lineage. **MUST NOT** change the live milestone values (existing suites depend on them). |
| `backend/semantic/serialize.mjs` | OPTIONAL (later slice): a `freshness` descriptor on the served overview so the React layer can show "synced N ago / data M old" (closes A-1 mock-fallback-masking direction). Not required for THIS ledger. |
| Frontend `app/src/lib/types.ts` | `Provenance.observedAt` (fact-true) already exists; the freshness split adds a connector-level `ingestedAt`/sync clock — already modelled as `Provenance.ingestedAt`. No new type needed for the MVP slice. |
| query keys | UNCHANGED. This subsystem is below the `ai-*`/`aios-*` seam; it changes how canonical is *populated*, not the served shapes. |

---

## §5 — NEEDS PRODUCT DECISION (orchestrator resolves BEFORE the builder runs)

**PD-1 — Two genuine same-amount receipts, same day: REVIEW (default) vs AUTO-PAIR.**
The lock says the second is "NOT silently dropped (second routes to review)".
Default = **route the second to `needs_review(reason='duplicate_same_amount')`** so
a human confirms "two real receipts" vs "a connector double-send". Alternative =
auto-pair both to two distinct open milestones when exactly two same-amount
milestones are open (fewer review rows, but risks pairing a double-send). **Default:
review.** (The ledger asserts the second is NOT dropped AND does not silently inflate
`received_amount` — it accepts either a review row or two audited matches, but
NEVER a single silent absorb.)

**PD-2 — Correction re-projection: OVERWRITE canonical column (default) vs
EVENT-SOURCE the read.** Default = keep `canonical.payment_milestone` as a
**projection** the correction overwrites (cheapest; existing `mart` reads unchanged),
with full history in `etl.ingest_event`. Alternative = make `mart` read the event
log directly (purer, but rewrites the spike's recompute). **Default: project +
overwrite**, history in the append-only log. (Honours "corrections are new rows" —
the *log* is append-only; the *projection* is derived.)

**PD-3 — Content-hash scope: business fields only (default) vs whole payload.**
Default = hash a **canonical-json of the business fields** (`amount`, `received`,
`status`, `due_date`) so a connector re-export that only changes a sync timestamp /
formatting is a **no-op**. Hashing the whole raw payload would make cosmetic
connector noise look like a correction (false corrections, audit spam). **Default:
business-field hash.** (The ledger's "re-ingest same export = no-op" assertion
depends on this — a whole-payload hash would fail it if the connector stamps a new
export time.)

**PD-4 — Ambiguity detector strength for `ambiguous_ref`.** Default = an inbound
new ref is "ambiguous" if its `(project, amount, window)` could match **>1** open
canonical milestone. A stricter variant also flags fuzzy **name** collisions.
Default = amount/window only (deterministic, testable). **Decide: amount-window
(default) or +fuzzy-name.** Cosmetic to the ledger (it asserts the >1-candidate case
routes to review, not the detector internals).

**PD-5 — Where the maker-checker resolution lives.** `etl.needs_review` carries
`state` but the *resolution action* (checker accepts/rejects) is a maker-checker
write. Default = **reuse Step-6's `audit.event` hash-chain** for the resolution
record (so review-resolutions share the tamper-evident audit) once Step 6 lands;
until then `etl.needs_review.state` is updated in a checker≠maker-guarded function.
**Decide: own resolution audit now vs depend on Step-6 `audit.event`.** (This is the
`dependsOn` edge — see below. The MVP ledger does not assert the resolution path; it
asserts rows LAND in the queue and are never auto-applied.)

---

## §6 — DEPENDS-ON / SEQUENCING

- **Upstream (soft):** Step 6 (AIOS write-discipline) defines `audit.event` +
  `supersedes_event_id` + the `sync/match/correction/retraction` type union. This
  subsystem **mirrors that union** in `etl.ingest_event.event_type` and SHOULD share
  the hash-chain audit for review-resolutions once Step 6 lands (PD-5). The MVP
  ingestion slice can ship its own `etl.ingest_event` append-only log first and wire
  to `audit.event` later — so the hard dependency is **only on the existing
  `0001_canonical.sql` + `0002_mart.sql` + seed**, which exist today.
- **Downstream:** none block on this for the spike; the projection keeps canonical
  values byte-identical, so Steps 2–5 are unaffected.

---

## §7 — RUN / RED-PROOF

```powershell
# kill strays first:
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'ingestion|--test' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

node --test --test-isolation=none --test-force-exit backend/test/ingestion-reconciliation.design.test.mjs
```

**RED today (the expected failure):** `freshDb()` boots (existing migrations + seed
apply), but every assertion that touches `etl.*` fails because the `etl` schema, its
tables and its functions **do not exist** (`relation "etl.ingest_event" does not
exist` / `function etl.ingest(jsonb) does not exist`). That clean "absent
implementation" failure IS the RED state. **GREEN target:** the builder ships
`0003_ingestion.sql` + the §2 functions + the §4 seed back-fill, and every
acceptance row below holds.

**Existing suites MUST STAY green** (this ledger adds a file; it edits NOTHING):
`spike.acceptance.test.mjs` (4), the Slice-2b suite (27/2), `pnpm --dir app test`.

---

## §8 — ACCEPTANCE ROWS (what the ledger asserts; cite the closes-id)

| Test | Closes | Asserts |
|---|---|---|
| `in-1 re-ingest no-op` | in-* / A1 | ingesting the SAME export row twice writes **exactly one** live `ingest_event`; canonical `received_amount` unchanged; zero new review rows. |
| `in-2 correction supersedes` | A1 / etl-* | same `(source,ref)`, changed amount → a NEW `correction` event with `supersedes_event_id` set; old event `superseded=true`; canonical re-projects to the corrected amount; **count of live events for that ref == 1** (no duplicate); receivables reflect the corrected (not summed) amount (no overstatement). |
| `in-3 two same-amount receipts not dropped` | etl-* / C5 | two genuine receipts (same project, same amount, same day) → **two** `payment_receipt` rows; the second is NOT silently absorbed — it lands in `needs_review(reason='duplicate_same_amount')` (or is an audited second match); canonical `received_amount` is **not** silently inflated by a phantom double. |
| `in-4 absent ref → review, never apply` | C5 / in-* | an inbound row with null/empty `source_record_ref` creates **0** canonical writes and **1** `needs_review(reason='absent_ref')` row. |
| `in-5 alias conflict → review, no overwrite` | etl-* / C5 | an inbound label already mapped to a *different* `canonical_id` creates a `needs_review(reason='alias_conflict')` and the existing `etl.alias` row is **unchanged**. |
| `in-6 freshness split` | in-* | `etl.freshness()` returns a **fresh** `connector_last_run` AND a **stale** `max(data_observed_at)` for a connector that synced recently but whose newest fact is old — the two ages are **distinct**, proving a stale-connector vs stale-data distinction; both ages computed against the injected `as_of`, not the wall clock. |
| `in-7 read-only-first` | A1 | every `etl.connector.mode` is `'read_only'` (the CHECK rejects any other) — this repo ingests, never pushes. |
