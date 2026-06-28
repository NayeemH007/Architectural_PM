# Backend Functional Review — Synthesis

**Date:** 2026-06-28 · **Branch:** feat/frontend-trust-envelope · **Reviewer:** Synthesis (read-only, adversarial)
**Scope:** 5 area reviews (AIOS write-discipline, Ingestion, Security/RLS, Trust model, Frontend) consolidated and spot-re-verified against the live Supabase Postgres (`supabase_db_backend`).

---

## 1. Executive Verdict

**FUNCTIONAL WITH ISSUES.** The trust spine works as designed: every served KPI cites a real source or honestly refuses, money is band-gated, AI narrates qualitative bands instead of fabricating numbers, margins are coverage-aware fee-only, cash is gross-with-withholding-note, maker-checker + append-only tamper-evident audit are enforced at the database (not just app) layer, and the frontend renders all 11 pages on the live backend with ground-truth values. Promises ①②③④⑤⑥⑦ are all **HONORED at the served/UI layer**.

The product is demo-ready and the read path is sound. However, it is **NOT yet production-cutover-ready** because of one **blocker**: the entire `etl.*` ingestion/reconciliation layer (promise ⑤'s write side) is unreachable through the production auth path — the `authenticated` role has zero privileges on schema `etl` and no entrypoint is `SECURITY DEFINER`. Plus one **medium** robustness defect (malformed `company_id` JWT claim → HTTP 500 instead of clean fail-closed) and a set of low-severity polish/seed items.

Re-verified live during this synthesis:
- `etl.freshness()` as role `authenticated` → `permission denied for schema etl`; `has_schema_privilege('authenticated','etl','USAGE')` = **false**; none of ingest/reconcile_receipt/resolve_alias/freshness are `SECURITY DEFINER`. **Blocker confirmed.**
- Malformed claim `company_id='deadbeef-not-a-real-uuid'` → `ERROR: invalid input syntax for type uuid`. **500 root cause confirmed** (fails closed on isolation — no data leaks — but crashes).
- AIOS rows on live DB: `mart.agent_action`=0, `mart.design_approval`=0, `audit.event`=0. **Seed-empty confirmed** (schema/constraints/triggers all present and enforcing).
- `canonical.payment_milestone` tax cols (vat/vds_withheld/ait_withheld/net_receivable) are `GENERATED ALWAYS` and 14/14 populated — "columns NULL" phrasing is inaccurate, but ⑤ still honored (never SELECTed/served).
- `mart.cost_model` SELECT granted to `authenticated` = **true** (cost_model grant follow-up appears applied).
- All maker-checker constraints/triggers/functions present: `design_approval_checker_ne_maker`, `agent_action_executed_needs_receipt`, `agent_action_gated_executed_needs_approver`, `design_approval_decided_consistency`, `audit_event_append_only_trg`, `verify_audit_chain`, `promote_agent_action`.

---

## 2. Per-Promise Verdict

| # | Promise | Verdict | Evidence (one line) |
|---|---------|---------|---------------------|
| ① | Every number cites its source (+confidence, drillable) | **HONORED** | overdueAmount=930000 cites tally:pm10; collectionRate=72 cites 12 Tally sources & reconstructs from DB; recursive scan found zero served-Metrics-with-empty-sources. |
| ② | Refuse, don't fabricate (value:null / insufficient) | **HONORED** | AIOS autonomy → value null / confidence insufficient / sources [] / "Not estimated."; designer money refused not invented; identical on both backends. |
| ③ | AI narrates, never computes | **HONORED** | Fabricated literals (86/64/58/47/72, 1.5) gone from producers; output computed 3.0 from lineage; 11/11 literals-honesty tests pass. |
| ④ | Coverage-gated (RETIRED → fee-only low margin) | **HONORED** | All 8 projects margin confidence low + fee-only note; values reconstruct from canonical.project + mart.cost_model. |
| ⑤ | BD-correct cash (DEFERRED → gross + note) | **PARTIAL** | Served layer fully honored (gross only, withholding note, net never served). BUT write side (`etl.*` ingestion/reconciliation) is UNREACHABLE via the prod auth path — blocker below. Tax cols are GENERATED+populated, not NULL (phrasing nit). |
| ⑥ | Maker-checker on append-only tamper-evident audit | **HONORED** | DB-enforced: maker==checker rejected, non-eligible/cross-company checker blocked, executed-needs-receipt, append-only UPDATE/DELETE rejected, verify_audit_chain catches tamper/forgery. (Seed-empty: 0 live rows.) |
| ⑦ | Swap mock→backend without rewriting React tree | **HONORED** | All 11 pages render on live Node :8788 with ground-truth values, zero console errors, trust popovers show real lineage. (Frontend not yet on FastAPI JWT — cutover item, not defect.) |

---

## 3. Consolidated Issues (blocker → low, deduped)

### BLOCKER
**B1 — `etl.*` ingestion layer unreachable through production auth path.** *(owner: backend)*
`supabase/migrations/0007_ingestion.sql` grants nothing on schema `etl`; no entrypoint is `SECURITY DEFINER`; the prod path (`backend/fastapi/auth.py:102` → `set local role authenticated`) runs as `authenticated`, which has zero etl privileges. Re-confirmed live: `etl.freshness()` as authenticated → `permission denied for schema etl`. The pglite migration (`db/migrations/0007_ingestion.sql:538-541`) grants usage/select/insert/update/execute to app_user, but the Supabase equivalent was never applied. Promise-⑤ write side (idempotency/correction/reconciliation/freshness — all PASS as superuser) is functionally dead in production.
**Fix:** add to `supabase/migrations/0007_ingestion.sql`: `grant usage on schema etl to authenticated;` + `grant execute` on the public entrypoint functions + the table privileges the SECURITY INVOKER functions need under RLS (insert/update/select on etl tables) — OR convert entrypoints to `SECURITY DEFINER` with a pinned `search_path`.

### MEDIUM
**M1 — Malformed (non-UUID) `company_id` claim → HTTP 500 instead of clean fail-closed.** *(owner: backend — `fastapi/auth.py verify_jwt`)*
A validly-signed JWT with `company_id='deadbeef-not-a-real-uuid'` makes all 7 endpoints return 500 because the RLS policy casts `(auth.jwt()->>'company_id')::uuid` and Postgres raises `invalid input syntax for type uuid`. Re-confirmed live. No data leaks (fails closed on isolation; generic handler hides PG detail), but spec requires "no 500-crash". Only reachable with the signing secret (misconfigured legitimate issuer, not external attacker).
**Fix:** validate `company_id` is a UUID in `verify_jwt` and return 401 before opening the RLS session.

### LOW
**L1 — Defense-in-depth for the B1 fix.** *(owner: backend)* If B1 is fixed via `SECURITY DEFINER` (RLS-bypassing), the explicit `etl._company()` JWT scoping becomes the sole isolation barrier — verify completeness and pin `search_path` against schema-shadowing privilege escalation.

**L2 — Tamper-evidence is detectable, not tamper-proof.** *(owner: backend)* The append-only guarantee rests on a trigger a DB superuser can disable; mitigated by `verify_audit_chain` hash-recompute + `authenticated`-role REVOKE on UPDATE/DELETE. Awareness only — "tamper-evident" is the correct guarantee.

**L3 — No AIOS seed data.** *(owner: backend)* `mart.agent_action` / `mart.design_approval` / `audit.event` are all 0 rows live (re-confirmed). Constraints/triggers fully enforce, but no out-of-the-box maker-checker/audit chain for a promise-⑥ demo. Seed one proposed action + a small audit chain.

**L4 — No `etl.*` seed data.** *(owner: backend)* connector/ingest_event/payment_receipt/needs_review/alias all 0 rows; ingestion behavior is invisible until something calls `etl.ingest`.

**L5 — Tax columns are GENERATED ALWAYS + populated, not NULL.** *(owner: backend/db — informational)* `canonical.payment_milestone.vat/vds_withheld/ait_withheld/net_receivable` are 14/14 non-null (re-confirmed). Promise ⑤ still HONORED (never selected/served); only the "columns NULL" phrasing is wrong.

**L6 — Finance month/ytd flow leaves are hardcoded illustrative literals.** *(owner: backend — fastapi/serializers.py + semantic/finance.mjs)* monthIncome/monthExpense/ytd* use synthetic `sample:monthly-flow` source + "Illustrative — not yet reconciled to TallyPrime" note + completeness 60. Honestly labeled (no ①/②/⑤ violation), but the one place a number is authored not derived. Reconcile to Tally.

**L7 — CORS hardcoded to `localhost:5173`.** *(owner: backend/frontend — `backend/server/index.mjs`)* Wrong app port → backend fetch silently CORS-fails → frontend serves MOCK fallback (identical values mask the failure, making a wrong-port demo look real). App dev must run on 5173.

**L8 — Default backend URL ambiguity (8787 vs 8788).** *(owner: frontend — `app/src/lib/archintel/api.ts` + `aios.ts`)* Default `VITE_BACKEND_AI_URL=http://localhost:8787`; documented run port is 8788. Without the env override the app points at 8787 and falls back to mock.

---

## 4. Remaining for a True Production Cutover

1. **(BLOCKER) Fix B1** — grant `etl` privileges to `authenticated` (or SECURITY DEFINER + pinned search_path) so promise-⑤ ingestion/reconciliation is reachable in production. Without this the write side of the cash spine is dead.
2. **(MEDIUM) Fix M1** — UUID-validate the `company_id` claim in `verify_jwt` (401 on malformed) so the RLS cast can't 500.
3. **Re-wire frontend → FastAPI JWT auth** — the app is currently hardwired to the Node header-auth seam (`X-User-Role`/`X-Company-Id`); move it to the FastAPI Supabase-Auth JWT backend (promise ⑦'s production seam). Resolve the CORS (L7) + default-URL (L8) coupling as part of this.
4. **Migration follow-ups:** (a) the `reconcile_net` CHECK on the ingestion path was not found in `supabase/migrations/0007_ingestion.sql` — add/verify it; (b) `mart.cost_model` SELECT grant to `authenticated` is already present (verified true) — confirm it's the committed migration, not ad-hoc.
5. **Seed live demo data (L3/L4)** — at least one proposed `agent_action` + small audit chain, plus etl connector/ingest rows, so ⑤/⑥ are exercisable out-of-the-box.
6. **Reconcile finance month/ytd literals (L6)** to TallyPrime so the last authored numbers become derived.
