# Backend Build — Shared Context (every agent loads this FIRST)

> You are a builder/reviewer sub-agent on the SPACE ESSE · Practice Intelligence backend
> (live app brand: **ArchIntel**). Read this whole file before doing anything. **Code is
> ground truth.** Where doc 13 / the dormant `types.ts` disagree with `app/src/lib/archintel/*`,
> the live archintel code wins.

## What the product IS / IS NOT
A **read-only intelligence/reporting layer** above the firm's existing tools (TallyPrime,
Google Workspace, Trello, RAJUK ECPS, WhatsApp, manual capture). NOT multi-tenant SaaS, NOT
BIM/CAD, NOT a system of record, NOT a PM app. Single firm (we add a synthetic 2nd firm only
to prove RLS isolation).

## The seven promises = the acceptance tests (not prose)
1. Every number cites its source (+confidence/completeness, drillable).
2. Refuse, don't fabricate (`value=NULL`, `confidence='insufficient'`).
3. AI narrates, never computes (deterministic versioned semantic layer; AI only words the numbers).
4. Coverage-gated honesty.
5. BD-correct cash (VAT/VDS/AIT).
6. Maker-checker on an append-only tamper-evident audit.
7. Swap mock→backend without rewriting the React tree (preserve the live `useAi*`/`aios` query keys).

## KICKOFF DECISIONS — LOCKED (do not re-open; do not silently carry doc 13)
- **⑤ Tax — DEFERRED.** Do NOT compute VAT/VDS/AIT now. Carry the tax columns on
  `canonical.payment_milestone` as **dormant/nullable** (present for a later phase, left NULL,
  behind a `TAX_NET` flag). Finance KPIs emit **gross** (face value) stamped
  `confidence='low', note='gross, withholding not modeled'`. Never emit a bare gross number as if it were net cash.
- **④ Coverage — RETIRED (fee-only).** Do NOT build `effort_entry`/timesheet capture. `margin()`
  returns the `PROJECT_COST`-based fee margin **always stamped** `confidence='low',
  note='fee-only, no labour cost'`. Never a bare margin, never `insufficient` (we have a number, just low-trust).
- **⑦ Write-back — READ-ONLY-STRICT; separate repo executes.** THIS repo proposes only:
  `agent_action` ledger holds **proposals** behind maker-checker, holds **no write credentials**,
  **never executes** an outbound send. The separate AIOS backend repo owns WhatsApp/Drive execution,
  gated by the same maker-checker + a shared append-only write-audit. Re-tag live AIOS tasks
  t1/t3/t4/t5 `humanGate:true`. Read layer shows "handled" only when a `delivery_receipt` exists.
- **Clock oracle — `as_of = 2026-06-22`.** Single injected server clock. This reproduces the live
  `"18 days overdue"` literal (pm10 due 2026-06-04 → 18d). Advancing to `2026-06-24` → 20d.
  Delete `format.ts` `new Date("2026-06-17")` and both `TODAY="2026-06-22"` constants during
  clock-unification; thread one `as_of` through every semantic-layer function.

## Read-before-writing (live code = ground truth)
- `docs/backend-architecture-review-orchestrated.md` — the findings (F1–F7), drift table,
  corrected migration sequence (§6), consolidated DDL (§7), smallest-safe-test (§8), punch list (§9).
- Live code: `app/src/lib/archintel/{api,data,finance,intelligence,aios}.ts`,
  `app/src/lib/types.ts` (the dormant trust model — **revive `Metric`/`Provenance`, don't reinvent**),
  `app/src/lib/format.ts`, consumers in `app/src/pages/app/*`, `app/src/components/**/kpi-card.tsx`.

## Live entity map (what the backend serves — NOT doc 13's Invoice/Employee)
- `ProjectA{code,name,clientId,leadId,phases,contractValue,health,blocker}` — **contractValue only**, no fee breakdown.
- `Member` — 6 people, roles `founder|principal|project_lead|designer|finance`. No utilization/timesheet.
- `PaymentMilestone{amount,receivedAmount,status,...}` — phase-based, **no invoiceNumber, no tax**. (pm10: a5/Tejgaon, ৳930,000, due 2026-06-04, received 0, overdue.)
- `DesignApproval` — INTERNAL design/material sign-off, `reviewerId` hardcoded `m1` (Raiana). No RAJUK/authority.
- `ClientA`, `FileRecord{storage,version,uploadedDate}`, `DecisionA` (no `promoted`/provenance), `activityA`.
- AIOS: `auditTask`, `agentAction` (the contested write-back layer).
- **Two `resolve()` seams**: `api.ts` (LATENCY 240, keys `ai-*`) + `aios.ts` (LATENCY 220, keys `aios-*`).
  Derived endpoints wrap **function calls** (`resolve(managementOverview())`), not arrays → they become
  server aggregates / semantic functions, NOT path swaps.

## Non-migratable literals (NEVER seed these as facts)
`aios.autonomy=64`, `aios.output=1.5`, `predictedRisks[].likelihood` (86/64/58/47/72), `RISK_ANSWERS`
numbers, `monthlyFlow`, `PROJECT_COST`. These are hand-authored prose — they must be recomputed by the
semantic layer or return `confidence='insufficient'`. A `LITERALS_TO_REPLACE` allowlist fails the build
if any reaches a trust surface without a `confidence` field.

## RUNTIME (this machine: no Docker, no psql, no Supabase CLI)
- **pglite** (`@electric-sql/pglite`, real Postgres 16 in-process via Node) is the local test runtime.
  Already proven: generated columns, RLS, `SET ROLE`, `current_setting('request.*')` JWT-claim emulation.
- **pglite constraints (hard rules):**
  - NO `pgcrypto` / `gen_random_uuid()` — **mint UUIDs in app/seed code** (`crypto.randomUUID()`), pass them in.
  - NO `citext` — use `text` + `create unique index ... on (lower(email))`.
  - Keep migrations to **core-PG features** so they run byte-identical on Supabase later.
  - Supabase-only DDL (`auth.users` FKs, `auth.uid()`, real policies) goes in a **separate `*.supabase.sql`**
    file that is syntax-checked but NOT run under pglite; the pglite path uses a local `app_user` table +
    `current_setting('request.company_id'/'request.user_id'/'request.role')` to emulate the JWT.
- Python 3.13 is available → the FastAPI semantic-layer port is a SEQUENCED later step; the **spike** uses
  SQL (recompute functions) + a thin TypeScript Metric/serializer adapter (matches the existing TS seam).
  The stack (Supabase Postgres + FastAPI) is NOT re-opened — only the spike's wrapper language is TS.

## Directory layout (all agents align to this)
```
backend/
  CONTEXT.md                       # this file
  package.json                     # pglite + node:test runner
  db/
    migrations/NNNN_name.sql       # up (idempotent: guarded with if not exists / create or replace)
    migrations/NNNN_name.down.sql  # matching down step
    migrations/NNNN_name.supabase.sql  # Supabase-faithful variant (syntax-checked only), when it differs
    seed/seed_live.mjs|.sql        # seed canonical from the LIVE arrays; MINT idempotency keys + source refs
  semantic/                        # versioned KPI logic (SQL fns) + TS Metric envelope/serializers
  test/
    harness.mjs                    # boot pglite, apply migrations in order, run seed
    *.acceptance.test.mjs          # the executable acceptance ledger (cites the finding id each test closes)
```

## The loop (every manager / sub-agent runs this; builder ≠ reviewer)
1. **Acceptance ledger** — turn owned findings/promises into **currently-failing** executable tests; cite the
   finding id each closes. No test → no build.
2. **Smallest slice** — thinnest vertical that turns them green. Every migration ships its down step + a re-run (idempotent) check.
3. **Gate** — prove the regime guarantee: time-invariant outputs match the mock bit-for-bit on fixed inputs;
   time-dependent outputs pass the pinned-clock test (`as_of=2026-06-22`) and advance correctly (`2026-06-24`);
   forbidden finance fields are **absent** (omitted, not null) for a Viewer; re-ingest is a no-op; checker≠maker rejected.
4. **Adversarial sign-off** — an agent that did NOT write the mechanism tries to break its acceptance test,
   confirms the promise holds end-to-end through the live hook, then ranks residual gaps.

**Hard rule: the agent that writes a mechanism does NOT author or sign off its acceptance test.**
A one-shot generation marks its own homework green.

## Conventions
- TypeScript shapes are the API contract of record (freeze the live `resolve()` output shapes).
- Preserve query keys exactly: `ai-projects/ai-finance/ai-profit/ai-overview`, `aios-audit/aios-kpis/aios-brief/aios-actions`.
- `Metric{value:number|null, unit?, label, confidence, completeness, asOf, deltaPct?, formula?, sources:Provenance[], trend?, note?}` — revive from `types.ts:41-62`. `confidence: 'high'|'medium'|'low'|'insufficient'`.
- `Provenance{sourceId, sourceName, recordRef, observedAt, ingestedAt?}` — from `types.ts:41-47`.
- Every ingested canonical fact carries `source_system, source_record_ref, observed_at`.
- Tests use `node:test` + `node:assert/strict`; deterministic; no wall-clock reads (inject `as_of`).
