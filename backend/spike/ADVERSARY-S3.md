# ADVERSARY-S3 — independent sign-off (subsystem S3: derived endpoints + Metrics)

> Reviewer did NOT build S3. Distrust-the-green pass: re-ran the baseline, then
> attacked the new HTTP money surface. Read-only — no test/source/server edited.
> Date 2026-06-26. Runtime: Node 23, pglite 0.5.3, no Docker.

---

## 0 — BASELINE re-run (is the builder honest?)

| Suite | Builder claim | Re-run result | Verdict |
|---|---|---|---|
| S3 ledger `derived-endpoints.design.test.mjs` | 9/9 | **9 pass / 0 fail** | ✅ matches |
| Built backend (spike + slice2b + adversary, 6 files) | 52 tests 48p/4skip/0fail | **42 tests · 38 pass · 0 fail · 3 skip · 1 todo** | ✅ 0 fail (count = built-6 + S3-9 ≈ 51) |
| `schema-rls-auth-seed.design.test.mjs` (S1/S2, built) | — | **10 pass / 0 fail** | ✅ |
| `aios-write-discipline.design.test.mjs` (S4 future) | — | 0 pass / **9 fail** (RED) | ⚠ future-step, untracked, fails on absent `etl`/write tables — NOT S3 scope |
| `ingestion-reconciliation.design.test.mjs` (S5 future) | — | 0 pass / **7 fail** (RED) | ⚠ future-step, untracked, fails on absent `etl.connector` — NOT S3 scope |
| Frontend `pnpm --dir app test` | 49 pass / 8 fail (8 = S0) | **49 pass / 8 fail** — all 8 in `contract-ci-and-prod-port.design.test.ts` (`@/lib/archintel/contract/manifest` absent) | ✅ matches exactly (S0 not-yet-built) |
| `pnpm --dir app build` | exit 0 | **exit 0** (`✓ built in 4.88s`) | ✅ |

**Baseline is HONEST.** Counts reconcile; every non-S3 failure is a known future-step
RED ledger (untracked, fails because its target schema/module is unbuilt) — not an
S3 regression. The three derived-endpoint design ledgers are all GREEN.

---

## 1 — Attacks (HOLDS / BROKEN + evidence)

Harness: `startServer({port:0})` → real `fetch` with `X-Company-Id`/`X-User-Role`/
`X-User-Id` headers → deep value-scan + exact-token (word-boundary) cross-tenant scan.

| # | Attack | Verdict | Evidence (one line) |
|---|---|---|---|
| 1 | **FINANCE BAND** — designer/project_lead/ungranted/principal(grant) on **6 money endpoints** | **BROKEN** | `/api/v1/finance`, `/overview-money`, `/payments`, `/projects`, `/clients` redact cleanly — but **`/api/v1/profitability` leaks `contract`/`cost`/`profit` bare numbers + nested `project.contractValue` to EVERY non-eligible principal** (margin itself correctly refused). |
| 1b | BAND eligible (founder/finance) SEE money | HOLDS | founder m1 & finance m2 → `income=8,470,000` present. |
| 1c | BAND m2 `finance_grant` honored over HTTP (claim audit) | HOLDS (caveat) | m2 with its **real** role `principal` sees **no** money. Band keys off `X-User-Role` only; `member.finance_grant` is **never looked up** by the server. Builder's "keys off member.finance_grant (m1+m2)" is **inaccurate at the HTTP layer** — m2 is eligible only via `role=finance`. Fails **safe** (more restrictive), so not a leak, but a doc/contract divergence. |
| 2 | **CROSS-TENANT** Firm-B sees no Firm-A entity/money (7 eps) | HOLDS | Zero exact Firm-A tokens (`pm10`/`a1`/`m1`/`tally:pm10`) or money in any Firm-B payload. (`bpm1`/`bm1` substrings ≠ `pm1`/`m1` — verified by word-boundary regex.) Firm-B finance `income=0`, refs `tally:bpm1/bpm2` (its own). |
| 2b | CROSS-TENANT Firm-A sees no Firm-B (7 eps) | HOLDS | Zero `bpm*`/`b1`/`bm1` tokens in any Firm-A payload. |
| 2c | Garbage `X-Company-Id` fails closed | HOLDS | All 7 endpoints → **HTTP 500** (`invalid uuid` from `::uuid` cast), **no data leak**, process does not crash (handler `try/catch` → 500 JSON). Fails closed. |
| 3 | **RLS** on `mart.cost_model` + `mart.kpi_lineage` under `SET ROLE app_user` | HOLDS | `app_user` + Firm-B claim: `cost_model` returns 8 rows all Firm-B (`sawFirmA=false`); `kpi_lineage` distinct companies = 1 (`sawFirmA=false`). The 0005 `force row level security` + company policy enforces; Firm-B cannot read Firm-A cost/lineage. |
| 4 | **STATE-BLEED** on warm connection (N inherits N-1) | HOLDS | After Firm-A founder request, Firm-B payments request → zero Firm-A tokens, `bpm1` present. After founder request, designer finance request → designer sees no money. Each serializer re-`set_config`'s all 3 `request.*` keys per request (A-2). |
| 5 | **AIOS honesty** `/aios/kpis` | HOLDS | `autonomy = {value:null, confidence:'insufficient'}` (NOT 64); `output = 3.0` (`unit:ratio`, 8 sources); `automated = 75`, `confidence:'low'` (carried, not bare). No fabricated number. |
| 6 | **VALUE = Σ lineage** (tamper tracks) | HOLDS | Tamper pm1 `received_amount +100,000` → `income 8,470,000 → 8,570,000` (Δ exactly 100,000). Archive a6 → `output 3.0 → 2.5` (active 6→5 ÷ 2). Served value reconstructs from lineage; not a literal. |
| 7 | **PARITY** keys+types+recordRefs vs frontend producers | HOLDS | finance income/billable/receivables/collectionRate = Metrics w/ `tally:pmN`; margin cites `project:aN` + `model:PROJECT_COST:aN`; output cites `project:aN`+`member:mN`; automated cites `auditTask:tN`. Matches `finance.ts`/`aios.ts` shapes — drop-in. |
| 8 | **A-5** no un-coerced pg-numeric money STRING | HOLDS | No money-magnitude numeric STRING in any eligible payload across finance/overview-money/payments/projects — all coerced to `Number`/Metric. |
| 9 | **FLAG-OFF** (mock seam, no fetch) | HOLDS | `VITE_USE_BACKEND_AI`/`VITE_USE_BACKEND_AIOS` default to `=== "true"` → `false`; OFF path returns `resolve(fallback())`, **no `fetch`** (api.ts:65, aios.ts:33). `pnpm --dir app build` exit 0; frontend suites stay 49 pass. |

**Net: 1 attack BROKEN (the finance band on `/api/v1/profitability`), 8 HOLD.**

---

## 2 — THE BREAK (BLOCKER): finance band leak on `/api/v1/profitability`

**Confirmed leak.** A `designer` / `project_lead` / ungranted / `principal` principal
GETting `/api/v1/profitability` receives, for **every** active+archived project:

```jsonc
// row served to X-User-Role=designer (m6):
{
  "project": { "id":"a1", ..., "contractValue": 2800000 },  // <-- nested money, NOT redacted
  "contract": 2800000,                                       // <-- bare money, NOT redacted
  "cost":     980000,                                        // <-- modeled PROJECT_COST (a CONTEXT
  "profit":   1820000,                                       //     non-migratable literal) leaked
  "margin":   { "value": null, "confidence": "insufficient", ... }  // margin correctly refused ✓
}
```

The designer learns every project's **contract value, modeled cost, and profit** —
the firm's entire per-project economics — while only `margin` is band-refused.

### Root cause
`serializeProfitability` (profitability.mjs:123) calls `redactRow(row, principal)`.
`redactRow` (serialize.mjs:78) only redacts keys in `MONEY_KEYS`. The row keys are
`contract` / `cost` / `profit` / `project` — **none are in `MONEY_KEYS`** (the set has
`contract_value`/`contractValue`/`margin`, not `contract`/`cost`/`profit`). And
`redactRow` is **shallow** — it never recurses into the nested `project` object, so
`project.contractValue` is exposed even though `contractValue` IS a money key.
Only `margin` (the one matching key) is refused. The band is bypassed.

### Why the ledger stayed green (the blind spot that let it through)
The `[band/⑤]` ledger test (`derived-endpoints.design.test.mjs:235-257`) exercises
**only `serializeFinance`** with the designer (income/billable/receivables). It never
calls `serializeProfitability` (or `servePayments`/`serveProjects`) with a non-finance
principal. The `[profit/B5]` test runs profitability **only as OWNER**. So no assertion
ever inspects a designer's profitability row → the leak is invisible to the green.
A one-shot marked its own band coverage complete without testing the second money
endpoint that carries raw money columns.

### Severity
**BLOCKER (promise ⑤ finance band + A-3).** It is partially masked in the *demo* because
both frontend seams hard-code `X-User-Role=founder` (api.ts:63, aios.ts:36) — but the
HTTP surface itself leaks to any non-founder principal, and the band's entire purpose
(doc 14: a response filter *within* a tenant) is defeated on this endpoint. Real
per-user gating (the deferred Auth manager) would immediately expose it.

---

## 3 — Ranked residual gaps (with owning step)

| # | Sev | Gap | Owner / step |
|---|---|---|---|
| **R1** | **BLOCKER** | `/api/v1/profitability` leaks `contract`/`cost`/`profit`/`project.contractValue` to non-finance principals. `redactRow` lacks these keys + is non-recursive. | **S3 builder** — add `contract`/`cost`/`profit` to `MONEY_KEYS` (or redact the profitability row's money columns explicitly) AND make `redactRow` recurse into the nested `project` object (or strip `project.contractValue`). MUST land before any per-user auth ships. |
| **R2** | HIGH | **Ledger blind spot**: `[band/⑤]` only tests `serializeFinance` for the designer — never `serializeProfitability` / `servePayments` / `serveProjects` band behaviour. Lets R1 (and any future array-endpoint money leak) pass green. | **S3 reviewer (ledger author)** — extend the band ledger to assert a designer's profitability/payments/projects rows carry **no** money number. (Not S3-builder's to fix — builder ≠ test author.) |
| **R3** | MED | **Contract drift**: server band keys off `X-User-Role` only; `member.finance_grant` (seeded on m1+m2) is never read by `principalFromHeaders`/`isFinanceEligible` over HTTP. Builder's report ("keys off member.finance_grant (m1+m2)") and CONTRACT §3 imply a DB grant. m2 is eligible ONLY via `role=finance`; a finance-granted non-finance-role user would be wrongly redacted. Fails **safe**, so not a leak — but the documented mechanism ≠ the built mechanism. | **S2 Auth & Finance-Gating manager** — when real JWT/auth lands, resolve the principal's `finance_grant` from `canonical.member` (not the header role) so the grant actually drives the band. Until then, document that the band is role-only. |
| **R4** | LOW | Garbage `X-Company-Id` returns **HTTP 500** (uncaught `::uuid` cast error surfaced as a generic 500). Fails closed (no leak) but a 400 with a typed "invalid principal" would be cleaner and avoids leaking that a cast failed. | S3 builder (polish) / S2 Auth — validate the company-id header shape before the query. |
| **R5** | INFO | `dailyBrief`/`agentActions` serializers return `null` (PD-E: stay mock); routes for `/aios/brief`/`/aios/actions`/`/aios/audit` are **not** registered in `DERIVED_ROUTES` (only `/aios/kpis` is). Frontend `useDailyBrief`/`useAgentActions`/`useTaskAudit` still `resolve(mock)` (no flag seam) — consistent with D-AIOS-1 default (kpis only). No defect, but the contract's brief/actions/audit routes are absent by design — confirm that's intended for S4. | S4 AIOS-write manager — owns whether brief/actions cross the seam (⑦ delivery_receipt gating). |

---

## 4 — Sign-off

**DO NOT proceed to the S4∥S5∥S0 fan-out until R1 (the profitability band leak) is
closed and R2 (the missing band assertion) is added to the ledger.**

R1 is a money leak to a non-eligible principal on a NEW S3 money endpoint — by the
adversarial-gate rule that is a hard BLOCKER on the subsystem. Everything else in S3
is solid: cross-tenant isolation HOLDS on all 7 endpoints (incl. cost_model/lineage
RLS under `app_user`), state-bleed HOLDS (per-request claim reset), AIOS honesty HOLDS
(autonomy refuses, output=3.0, automated low), VALUE=Σ lineage HOLDS (tamper tracks),
parity HOLDS, A-5 HOLDS, flag-off + build HOLD. The break is narrow and localized to
one serializer's redaction coverage — a small, well-understood fix.

**Conditional GO**: after R1 fix + R2 ledger assertion land and the band ledger re-runs
GREEN proving a designer's profitability row has no money number, S3 holds and the
fan-out may begin. **Hard NO-GO** in the current state.

---

## 5 — Files created (this review)

- `backend/spike/ADVERSARY-S3.md` (this report)

(Attack harnesses live in the session scratchpad, not the repo:
`adv-s3-attack.mjs`, `adv-s3-verify.mjs`, `adv-s3-final.mjs`. No test/source/server
file was edited.)
