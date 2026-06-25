# Backend Build — Phase Plan (orchestrator)

Sequenced fan-out for the six builder managers. Order is load-bearing: numbers must not
move twice, so clock-unify precedes seam-swap, seed precedes semantic functions, etc.
Every manager runs the loop in `CONTEXT.md` (failing ledger → smallest slice → gate →
adversarial sign-off, builder ≠ reviewer).

## How the four locked decisions shrink the original §6 sequence
- **⑤ tax DEFERRED** → the §6 `TAX_NET` step is **dropped from MVP**. Tax columns ship dormant/nullable; finance KPIs emit gross stamped `confidence='low'`. (Re-opens later behind `TAX_NET` flag.)
- **④ coverage RETIRED** → the §6 `COVERAGE_GATE` step (effort_entry + 80% gate) is **not built**. `margin()` ships with a permanent `confidence='low', note='fee-only'` stamp.
- **⑦ read-only-strict** → the §6 AIOS step builds the **proposal ledger + maker-checker + audit only**; NO execution wiring (separate repo owns sends). Re-tag t1/t3/t4/t5 `humanGate:true`.
- **clock `as_of=2026-06-22`** → the parity oracle for every Regime-B gate is pinned 06-22 (advance 06-24).

## Phase 1 — KPI provenance-lineage spike  *(IN PROGRESS)*
Proves the trust spine end-to-end before scaling. Acceptance = the 4-test ledger
(`backend/test/spike.acceptance.test.mjs`). Cuts across Schema + Semantic + Auth/Finance.
Gate: value=Σlineage · real refs · Viewer money-redaction · pinned clock 18→20.

## Phase 2 — sequenced manager fan-out (after the spike holds)

| Step | Owner manager(s) | Builds | Gate (failing test first) | Closes |
|---|---|---|---|---|
| **0. Contract reconcile** | Frontend Seam & Parity | mapping table `queryKey→endpoint→row-shape` for 6 `ai-*` + 4 `aios-*`; CI shape-diff guard; mark `mock/*` superseded | CI fails when a hook's TS shape diverges from served JSON | F5, F6 |
| **1. Clock-unify** | Semantic Layer & Provenance | one server `as_of`; delete `format.ts` 06-17 + both `TODAY`; aging/overdue computed in semantic layer | contract test forbids literal date anchors; pinned-clock snapshot reproduces 06-22 values | F7 |
| **2. DB + RLS + Auth + full seed** | Schema & Migrations + Auth & Finance Gating | canonical/mart for ALL live entities; seed from live arrays w/ minted idempotency keys; RLS on `company_id`; JWT carries `company_id`; field-level finance gating (forbidden fields ABSENT); `project_member` scoping | pgTAP/SQL: RLS isolates two firms; Viewer payload omits money; re-ingest is a no-op | F5, sr-*, fin-* |
| **3. Two seam swaps, two parity gates** | Frontend Seam & Parity + Semantic Layer | `api.ts`(240) + `aios.ts`(220) as separate units behind `USE_BACKEND_AI`/`USE_BACKEND_AIOS`; each derived endpoint → semantic fn returning same JSON; shared `transport()` | frozen-clock value snapshot per seam + `LITERALS_TO_REPLACE` allowlist fails build on un-confidence'd literal | F6 |
| **4. Trust envelope** | Semantic Layer & Provenance + Frontend Seam | functions return `Metric{value,confidence,completeness,as_of,formula,sources[]}`; `mart.kpi_lineage` for all headline KPIs; re-thread every `KpiCard` `value=`→`metric=`; lint-forbid `value=` on fact cards | every headline KPI renders with a registered lineage; refusal branch reachable | F2, da-1, kpi-* |
| **5. Domain stamps (REDUCED)** | Schema & Migrations + Semantic Layer | tax columns dormant (deferred); `margin()` low-confidence fee-only stamp; finance-band serializer generalized from the spike | margin never bare; gross never labeled net; tax cols NULL | F3(deferred), F4(retired) |
| **6. AIOS write-discipline (proposal-only)** | AIOS Write-back & Maker-Checker | `agent_action` proposal ledger (`state='executed'` requires `delivery_receipt`); checker≠maker server-side; append-only hash-chain `audit.event` (+ `sync/match/correction/retraction/dispatch_approved` type union, `supersedes_event_id`); re-tag t1/t3/t4/t5; read layer shows "handled" only w/ receipt; NO write credentials here | checker=maker rejected; audit row emitted in-txn per promotion; tamper-evidence holds; no execution path | F1, pw-1, sr-1, mc-* |
| **X. Ingestion (MVP slice)** | Ingestion & Reconciliation | seed idempotency-key minting (live facts have none); `(source,ref)` upsert + content-hash fallback→`needs_review`; freshness split (`connector_last_run` vs `data_observed_at`); correction/retraction event types | re-ingest no-op; ambiguous ref routes to review, never silent-drop | in-*, etl-* |

## Cross-cutting invariants every step must hold
- TS `resolve()` output shapes are the API contract of record; query keys `ai-*`/`aios-*` preserved exactly.
- Every ingested canonical fact carries `source_system, source_record_ref, observed_at`.
- One injected `as_of`; no module reads the wall clock for a KPI value.
- Non-migratable literals (`autonomy=64`, `output=1.5`, `predictedRisks.likelihood[]`, `RISK_ANSWERS`, `monthlyFlow`, `PROJECT_COST`) never seeded as facts.
- builder ≠ reviewer on every slice.

## Open infra decision (not blocking until after Phase 1)
Production-faithful runtime (real Supabase Auth JWT, `auth.users`, hosted RLS) needs either
Docker Desktop or a hosted Supabase project. The spike + Steps 0–6 are authored to run on
pglite locally; the Supabase-faithful DDL ships as `*.supabase.sql` variants, syntax-checked,
run against a real Postgres when the user provisions one.
