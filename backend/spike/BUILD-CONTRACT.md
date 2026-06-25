# Spike BUILD-CONTRACT — first vertical slice

> **Reviewer-authored.** The acceptance ledger
> (`backend/test/spike.acceptance.test.mjs`) is RED today and asserts against
> the surface below. This file tells the **builder** exactly what to create so
> those four tests go GREEN — **without** the reviewer implementing it.
>
> Builder writes: `backend/db/migrations/**`, `backend/db/seed/seed_live.mjs`,
> `backend/semantic/**`. Builder MUST NOT edit `backend/test/**`.
>
> Obey every locked decision in `backend/CONTEXT.md` and the pglite hard rules
> (no `gen_random_uuid`/`pgcrypto`, no `citext`; mint UUIDs in app/seed code;
> core-PG only so migrations run byte-identical on Supabase later).

---

## 0. What the harness wires (already built, do not change)

`backend/test/harness.mjs`:
- boots a fresh `PGlite`,
- applies every `backend/db/migrations/NNNN_*.sql` in **filename order**,
  **excluding** `*.down.sql` and `*.supabase.sql`,
- imports `backend/db/seed/seed_live.mjs` **default export** and calls
  `await seed(db)`,
- exports `freshDb()` returning the seeded instance.

It fails cleanly (clear RED message) until your files exist. Fixed constants the
tests rely on (must match your seed/migrations exactly):

| Constant | Value |
|---|---|
| `FIRM_A` company_id | `00000000-0000-0000-0000-00000000aaaa` |
| `FIRM_B` company_id | `00000000-0000-0000-0000-00000000bbbb` |
| pinned `as_of` | `2026-06-22` |
| advanced `as_of` | `2026-06-24` |
| `KPI_VERSION` | `1` |

RLS/JWT emulation (pglite): the tests set, before each query,
`set_config('request.company_id'|'request.user_id'|'request.role', …, false)`.
Your RLS policies / functions read these via `current_setting('request.*', true)`.

Principals the tests use:
- Owner (finance-eligible): `{ companyId: FIRM_A, userId: 'm1', role: 'founder' }`
- Viewer (no finance): `{ companyId: FIRM_A, userId: 'm6', role: 'designer' }`

---

## 1. Schema surface the tests reference (build in migrations)

Build per §7 of `docs/backend-architecture-review-orchestrated.md`, **with the
spike refinements below**. Only the columns/objects named here are load-bearing
for the four tests; the rest of §7 is allowed but not gated by this spike.

### canonical.member
Per §7. Live `m1..m6`, 5-role enum `founder|principal|project_lead|designer|finance`,
`can_check boolean`. (Used by seed + Viewer principal `m6`.)

### canonical.project
Per §7. Live `a1..a8` with `contract_value`. RLS key `company_id`.

### canonical.payment_milestone  — tests read `id`, `company_id`, `due_date`
Per §7 grain. The tax columns are **DEFERRED/DORMANT** (CONTEXT lock ⑤):
- `gross_amount numeric(14,2) not null`
- `received_amount numeric(14,2) not null default 0`
- `due_date date`, `received_date date`, `status payment_status_a`
- `source_system text not null`, `source_record_ref text not null`,
  `observed_at timestamptz not null`  ← provenance, **minted at seed**
- **DEFERRED columns present but NULLABLE and left NULL** (do NOT compute):
  `net_receivable`, `vat`, `vds_withheld`, `ait_withheld`.
  > Spike override of §7: these are **plain nullable columns**, NOT generated/
  > stored, NOT behind a CHECK that forces them. Leave NULL. (§7's generated
  > columns + `reconcile_net` CHECK are for the later `TAX_NET` phase.)
- **overdueAmount sums GROSS**: `gross_amount - received_amount` over overdue
  milestones. The metric carries `confidence='low'`, note mentioning
  "gross, withholding not modeled".

### canonical.client  — test (c) reads `id`, `company_id`
Live `ClientA` (c1..c6 for Firm A). RLS key `company_id`. Money-bearing columns,
if any, are what the Viewer serializer must redact.

### mart.portfolio_summary  — tests read `company_id`, `computed_at`, the metric
The backend analogue of `managementOverview()`. One row per recompute run.
Must include at least:
- `kpi_run_id uuid not null`
- `company_id uuid not null`
- `kpi_version int not null`
- `as_of timestamptz not null`
- `computed_at timestamptz not null default now()`
- `overdueAmount numeric` (column name lower-cased by PG → tests read
  `row.overdueamount`; either casing works since the tests fall back).
- the other `managementOverview()` fields (activeCount, pendingApprovals,
  totalContract, received, billable, collectionRate, …) MAY be present; the
  Viewer serializer redacts the money ones.

### mart.kpi_lineage  — **SPIKE REFINEMENT of §7 (mandatory)**
§7's `mart.kpi_lineage` is `(metric_key, entity_id, kpi_version, source_id,
record_ref, observed_at)`. **Add two columns** so VALUE = Σ LINEAGE is
machine-checkable:

| column | type | meaning |
|---|---|---|
| `kpi_run_id` | `uuid not null` | ties every contribution row to one recompute run |
| `contribution_value` | `numeric not null` | the per-row amount that **sums to the metric** |
| `metric_key` | `text not null` | e.g. `'overdueAmount'` |
| `entity_id` | `text not null` | the contributing canonical row id (e.g. `'pm10'`) |
| `kpi_version` | `int not null` | |
| `source_id` | `uuid not null` | provenance source (NOT NULL — test (b)) |
| `record_ref` | `text not null` | provenance ref (NOT NULL — test (b)) |
| `observed_at` | `timestamptz not null` | provenance observed-at (NOT NULL — test (b)) |
| `company_id` | `uuid not null` | RLS isolation |

PK must include `kpi_run_id` (e.g. `(kpi_run_id, metric_key, entity_id)`), so a
new run does not collide with the previous run's rows.

> **Lineage contract for `overdueAmount`:** one lineage row per overdue
> milestone, `contribution_value = gross_amount - received_amount`,
> `source_id/record_ref/observed_at` copied from that milestone's provenance.
> `SUM(contribution_value)` over a run == `portfolio_summary.overdueAmount` for
> that run. For Firm A at as_of=2026-06-22 the only overdue milestone is `pm10`
> (gross 930000, received 0) → exactly one row, contribution 930000, summary
> overdueAmount 930000.

---

## 2. Functions the tests call (build in migrations / semantic)

### `mart.recompute_portfolio_summary(p_as_of timestamptz, p_kpi_version int)`
- **Returns one row** whose columns include `kpi_run_id` (uuid) and
  `overdueAmount`. (Tests do `select * from … ` and read `row.kpi_run_id` +
  `row.overdueamount`.) Simplest: `returns setof mart.portfolio_summary` and
  insert-then-`RETURN QUERY SELECT` the inserted row.
- **In ONE transaction**, for the caller's `current_setting('request.company_id')`:
  - mint a fresh `kpi_run_id` (uuid). Mint it **inside** the function
    (pglite has no `gen_random_uuid`; use an app-minted uuid passed via a
    `set_config('request.kpi_run_id', …)` the function reads, **or** a
    seed-provided `mart.next_uuid()` helper your migration defines — **your
    choice; document which** — the tests only require it be non-null, fresh per
    call, and identical between the summary row and its lineage rows).
  - write the `mart.portfolio_summary` row tagged with that `kpi_run_id`,
    `as_of=p_as_of`, `kpi_version=p_kpi_version`.
  - write the `mart.kpi_lineage` rows (one per overdue milestone) tagged with
    the SAME `kpi_run_id`, copying provenance from the milestone.
  - **scope every read to the caller's company_id** — Firm B rows must never be
    pulled into Firm A's recompute (test (a) asserts zero Firm-B entities).
- **Deterministic**: depends only on `p_as_of` + seeded data. No `now()` in any
  value that affects `overdueAmount` or days-overdue. (`computed_at default now()`
  is fine — it is not asserted as a value.)
- Each call mints a **distinct** `kpi_run_id` (test (d) asserts pinned-run id ≠
  advanced-run id).

> **kpi_run_id minting — decision required, document it in the migration header.**
> Recommended: the function generates the uuid by reading
> `current_setting('request.kpi_run_id', true)` if the caller set one, else falls
> back to a deterministic-but-unique value built in SQL (e.g.
> `md5(p_as_of::text || clock_timestamp()::text)::uuid`-style, app-safe). The
> tests do NOT pass a kpi_run_id, so the fallback path must produce a fresh uuid
> per call on its own.

### `mart.days_overdue(p_due date, p_as_of timestamptz) returns int`
- `= (p_as_of::date - p_due)` in **calendar days** (positive when overdue).
- For `pm10` (due 2026-06-04): 18 @ as_of 2026-06-22; 20 @ as_of 2026-06-24.
- Pure function of its args — **no wall clock**.

---

## 3. Serializers the tests import (build in `backend/semantic/serialize.mjs`)

ES module, default-importable under Node 23. Two named exports:

### `serializeOverview(row, principal) -> object`
- `row`: a raw `mart.portfolio_summary` row (object with snake/lower-case keys).
- `principal`: `{ companyId, userId, role }`.
- **Finance-eligible** principal (role `founder` or `finance`, or holds a
  finance grant): may include money fields.
- **Non-finance** principal (Viewer, e.g. `designer`): the returned object MUST
  **omit** every money key entirely — `contract_value`, `contractValue`,
  `amount`, `gross_amount`, `net_receivable`, `margin`, `overdueAmount`,
  `overdueamount`, `totalContract`, `received`, `billable` (and casing variants).
  Omitted = key absent, **not** present-with-null.
- If you instead return a money figure as a **Metric** envelope for a non-finance
  principal, it MUST be exactly `{ value: null, confidence: 'insufficient' }`
  (plus any non-money metadata). Never a computed/fake number (promise ②).

### `serializeClients(rows, principal) -> array`
- Same redaction rule applied per client row: non-finance principal gets each
  row with all money keys **omitted**.

> The serializer is the response-filter (doc 14:164), not DOM hiding. RLS gives
> tenant isolation; the serializer enforces the finance **band** within a tenant.
> A real JWT/HTTP layer is a later phase — the tests call the serializer directly.

---

## 4. Seed requirements (`backend/db/seed/seed_live.mjs`, default export)

`export default async function seed(db) { … }`. Mint all UUIDs in JS
(`crypto.randomUUID()`); pass them in. Live facts have NO source refs — **mint
provenance at seed** (required by §8).

**Firm A** (`company_id = 0000-…-aaaa`) — the REAL live entities:
- members `m1..m6` exactly (roles per `data.ts`; `m1` founder/can_check=true,
  `m6` designer/can_check=false).
- projects `a1..a8` with real `contract_value` (`data.ts` `projectsA`).
- the REAL `payments` array incl `pm10` (a5/Tejgaon, `gross_amount=930000`,
  `due_date='2026-06-04'`, `received_amount=0`, `status='overdue'`).
- clients `c1..c6`.
- **provenance minted on every payment_milestone**:
  - `source_system = 'tallyprime'`
  - `source_record_ref = 'tally:' + <milestone id>` (e.g. `'tally:pm10'`)
  - `observed_at` = a fixed ISO derived from the milestone's `received_date`
    (or `due_date` when unreceived) — deterministic, no wall clock.
  - mint a `source_id` (uuid) per source so `mart.kpi_lineage.source_id` is
    NOT NULL.
- the DEFERRED tax columns (`net_receivable/vat/vds_withheld/ait_withheld`) left
  NULL.

**Firm B** (`company_id = 0000-…-bbbb`) — synthetic minimal, isolation proof only:
- 1 project, 2 payment_milestones with **DISTINCT** `source_record_ref`s.
- Exists only to prove Firm A's recompute never pulls Firm B rows (test (a)).
- Its milestones may be overdue or not — irrelevant; they must simply never
  appear in Firm A's lineage.

**Viewer user**: ensure `m6` exists in Firm A as `role='designer'`,
`can_check=false`, with **no** finance grant.

---

## 5. Down + supabase variants (CONTEXT.md)
Every `NNNN_*.sql` up-migration ships a matching `NNNN_*.down.sql` and, where the
DDL differs on Supabase (real `auth.users` FKs, `auth.uid()`, policies,
`gen_random_uuid`), a `NNNN_*.supabase.sql` that is syntax-checked but NOT run
under pglite. The harness applies only the bare `NNNN_*.sql`.

---

## 6. The four assertions this satisfies

| Test | Closes | What must hold |
|---|---|---|
| (a) | F2 / ① | `portfolio_summary.overdueAmount == SUM(kpi_lineage.contribution_value)` over `metric_key='overdueAmount' AND kpi_run_id=<run>`; ≥1 contribution row; no Firm-B entity in the run's lineage. |
| (b) | F2 / ① | every `overdueAmount` lineage row has non-null `source_id`, `record_ref`, `observed_at`. |
| (c) | ⑤ band / C4 | Viewer `serializeOverview`/`serializeClients` OMIT all money keys; any finance Metric is `{value:null, confidence:'insufficient'}`. |
| (d) | F7 / clock | `mart.days_overdue(pm10.due, as_of)` = 18 @2026-06-22, 20 @2026-06-24; `overdueAmount` identical across the two as_of runs; fresh `kpi_run_id` per run; no wall-clock dependency. |
