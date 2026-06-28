# ADVERSARY REPORT — S5 ingestion-reconciliation (`etl.*`)

**Reviewer:** independent adversary (did NOT build S5).
**Date:** 2026-06-26 (clock `as_of=2026-06-22` honoured in all probes).
**Subject:** `backend/db/migrations/0007_ingestion.sql` (+ `.down.sql`, `.supabase.sql`) and the
`etl` back-fill block in `backend/db/seed/seed_live.mjs`.
**Ledger:** `backend/test/ingestion-reconciliation.design.test.mjs` (in-1..in-7).
**Contract:** `backend/spike/CONTRACT-ingestion-reconciliation.md`.

---

## VERDICT: HOLDS (builder is honest) — with TWO residual gaps in the FRESHNESS split.

The core mechanics — idempotency, correction supersession, retraction, reconciliation
anti-silent-drop, alias-conflict no-overwrite, RLS isolation, read-only CHECK — are
genuinely correct and survive hostile inputs beyond what the ledger asserts. The two
residual gaps are confined to the freshness split (in-6): the ledger validates it
**tautologically**, and the shipped seed produces **physically incoherent (negative) ages**
against the locked business clock. Neither breaks an existing suite or the in-6 assertion as
written, so they are gaps, not regressions — owner: orchestrator / S5 builder follow-up.

---

## BASELINE RE-RUN (confirmed honest)

- `ingestion-reconciliation.design.test.mjs`: **7 pass / 0 fail** (in-1..in-7). Confirmed.
- Existing suites, each re-run green: spike.acceptance **4**, adversary.spike **10**,
  schema-rls-auth-seed **10**, adversary.slice2b **11**, slice2b.serializer **6**,
  slice2b.parity **3**, slice2b.http **4**, derived-endpoints **10**. = **58** + ingestion 7 = **65 green / 0 fail**.
- The builder's reported "combined 61" is its own gate's subset; my full re-run is consistent.
- **Pre-existing failure confirmed INDEPENDENT of S5:** `aios-write-discipline.design.test.mjs`
  au-1 fails `syntax error at or near "order"` inside S4's `mart.verify_audit_chain`
  (`0006_aios.sql`). 0007 references no S4/mart/audit object. Not S5's defect. Honest.
- Migration cycle: `up → up (idempotent) → down → up` all clean. Confirmed.

---

## ATTACKS RUN (all PASS unless noted)

| # | Attack | Result |
|---|---|---|
| A1 | Re-ingest the SAME export row **3×** | 1 event total, no drift, no review row. PASS. |
| A2 | Correction (0→200000) | canonical re-projects to 200000; gross unchanged; exactly 1 live sync. PASS. |
| A2b | **Chained** correction (→500000) | received==500000 (NOT 700000-summed); still 1 live sync. PASS. |
| A2c | Re-ingest the already-corrected value | no new events (hash-equal no-op). PASS. |
| A2d | **Back-dated** correction (`data_observed_at` EARLIER than the live sync) | re-projects to the corrected amount anyway — supersession flag, not observed_at order, is the authority. No stale-row bug. PASS. |
| A2e | **Retraction** then re-ingest | receivable drops to 0 (never negative), live sync count 0, then a fresh ingest re-opens the freed ref. PASS. |
| A3 | Two genuine same-amount same-day receipts | BOTH recorded (2 rows), 2nd routes to `needs_review(duplicate_same_amount)`, no silent inflation. PASS. |
| A4 | `source_record_ref` = `null` / `""` / `"   "` | all 3 route to `needs_review(absent_ref)`, zero canonical writes. PASS (empty + whitespace trimmed, not just null). |
| A5 | Alias conflict (`Bashati`→c5 stored, inbound claims c1) | review row, existing alias UNCHANGED, no duplicate alias. PASS. |
| A5b | **Case-insensitive** conflict (`BASHATI`) | still routes to conflict, still no overwrite. PASS. |
| A7 | `mode='write_back'` insert | rejected by CHECK. PASS (read-only-first enforced by DB). |
| A8 | Cross-tenant under `app_user` role | Firm-B (app_user) sees **0** of Firm-A's `etl.ingest_event`. RLS enforces. PASS. |
| A8b/c | `etl.ingest` company stamping | function stamps the caller's `request.company_id`; Firm-A cannot see a Firm-B-ingested ref. PASS. |
| A6 | Freshness split | PASSES the assertion (`data_age > connector_age`) — **but see GAP-1 / GAP-2 below.** |

---

## RESIDUAL GAPS (ranked)

### GAP-1 (MEDIUM) — the freshness split is validated TAUTOLOGICALLY; in-6 cannot fail.
The seed hardcodes `connector_last_run = newest_observed_fact + 60s`
(`seed_live.mjs:530`). Therefore `data_age − connector_age` is a **fixed 60 seconds for
every firm, every fact, every injected `as_of`** — by construction, never by a genuine
"fresh connector carrying stale data" arrangement. Measured: `connector_age=-5097660s`,
`data_age=-5097600s` → exactly a 60s gap. The in-6 assertion `data_age > connector_age`
is thus a **structural identity**, not evidence of the split it claims to prove. The test
would pass even if the newest fact were 1 second old (no staleness at all). The headline
narrative the contract sells — *"synced 2 min ago, newest fact 9 days old"* — is **not**
what the seed produces; it produces "two clocks 60 seconds apart." A real adversarial
fixture would seed `connector_last_run = as_of − 2min` AND `newest_fact = as_of − 9days`
(an independently fresh connector and independently stale data). The ledger does not.
**Owner:** S5 builder / reviewer — strengthen the in-6 fixture so the two clocks are set
*independently* (not `newest+60s`). This is a test-strength gap, not a code defect; the
`etl.freshness()` function itself returns both clocks correctly.

### GAP-2 (MEDIUM) — shipped seed places facts in the FUTURE → freshness reports NEGATIVE ages at the locked clock.
The seed's `observedAt()` falls back to `due_date` for future-dated milestones, so the
newest "observed fact" for Firm-A is **pm4 @ 2026-08-20** — two months AFTER the locked
business `as_of=2026-06-22`. Consequently `etl.freshness(..., '2026-06-22')` returns
`connector_age = -59 days` and `data_age = -59 days` (a connector that "last synced 59
days in the future"). Any consumer-facing freshness/staleness KPI rendered from this would
display nonsense negative ages. The contract's intent (T7) is a *staleness* signal; a
future-dated `observed_at` inverts it. in-6 dodges this only because it asserts a relative
inequality, never the sign/magnitude. **Owner:** orchestrator — decide whether
`observed_at` for not-yet-observed (future-due) milestones should be the due_date at all
(an unobserved future milestone arguably has no `data_observed_at`), and whether
`freshness()` should clamp/guard ages ≤ 0. Touches the canonical seed convention, so it is
above the S5 builder's edit scope.

### GAP-3 (LOW) — `etl.resolve_alias` writes `now()` (wall clock) into review-row timestamps.
`0007_ingestion.sql:484,496` insert `etl.needs_review.created_observed_at` using `now()`
for the `alias_conflict` / `unknown_alias` paths (unlike `etl.ingest` and
`etl.reconcile_receipt`, which use the injected observation clock). The CONTEXT lock is
"no `now()` for a fact value"; a review-queue timestamp is arguably metadata, not a fact,
so this is minor and unasserted by the ledger — but it is the one wall-clock read in the
subsystem and makes alias-review rows non-deterministic across replays. **Owner:** S5
builder — thread an injected clock through `resolve_alias` (add a `p_as_of` arg) for full
determinism parity with the other entry points.

---

## NON-FINDINGS (claims I tried to break and could NOT)
- Correction never duplicates / never overstates — held under chaining and back-dating.
- Retraction never drives receivables negative — clamps to 0; ref re-openable afterward.
- Idempotency index is correctly PARTIAL (live-sync only) — corrections share the ref without violating it; the no-op short-circuits on hash equality.
- `content_hash` is business-fields-only (PD-3) — cosmetic re-export noise is a true no-op (A2c).
- RLS + explicit `current_setting` company-scoping are belt-and-suspenders; cross-tenant read returns 0 under the non-superuser role.

---

## SIGN-OFF
S5 ingestion-reconciliation **HOLDS**. The idempotency / correction / retraction /
reconciliation / alias / RLS / read-only core is correct and robust beyond the ledger.
The two MEDIUM gaps are isolated to the **freshness split's test strength and seed data
coherence** (GAP-1 tautological fixture, GAP-2 future-dated `observed_at` → negative ages),
plus one LOW determinism nit (GAP-3 `now()` in alias review rows). None regress an existing
suite; none are introduced as a fix here (reported only, per mandate). Recommend the
orchestrator route GAP-2 (seed convention) and GAP-1 (in-6 fixture) before this subsystem is
relied on for any user-facing freshness/staleness KPI.
