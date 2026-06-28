# Backend Build Roadmap (synthesis of 6 reviewer-authored design subsystems)

> **Status:** All 6 subsystems have a RED acceptance ledger + a build contract, authored
> by reviewer-side design agents (builder ≠ reviewer). Slice 2b (migrations `0001_canonical`
> + `0002_mart`, `serialize.mjs`, `GET /api/v1/overview`, the `VITE_USE_BACKEND_AI` seam)
> is already shipped and GREEN. This roadmap orders the remaining build work, dedupes the
> product decisions the orchestrator must resolve first, names the first chunk, and pins the
> production-runtime decision.
>
> **Code is ground truth.** Honors locked decisions: ⑤ tax DEFERRED (finance gross, low),
> ④ coverage RETIRED (margin fee-only low), ⑦ AIOS READ-ONLY-STRICT (propose only, no write
> creds), single clock `as_of = 2026-06-22`. Preserve `ai-*`/`aios-*` query keys and the
> `resolve()`/`fetchOverview` seam shapes.

---

## 0. The subsystems at a glance

| # | Subsystem | Runtime | RED ledger | Contract | Slices |
|---|---|---|---|---|---|
| S1 | **Clock unification** (one server `as_of`) | frontend (vitest) | `app/src/lib/archintel/__tests__/clock-unify.design.test.ts` | `CONTRACT-clock-unify.md` | 1 |
| S2 | **Schema + ENFORCING RLS + auth/claim-reset + full seed** | pglite | `backend/test/schema-rls-auth-seed.design.test.mjs` | `CONTRACT-schema-rls-auth-seed.md` | 5 |
| S3 | **Derived endpoints → semantic fns + Metrics** (finance/profit/aios/arrays) | mixed | `backend/test/derived-endpoints.design.test.mjs` | `CONTRACT-derived-endpoints.md` | 5 |
| S4 | **AIOS write-discipline** (proposal ledger, maker-checker, hash-chain audit) | pglite | `backend/test/aios-write-discipline.design.test.mjs` | `CONTRACT-aios-write-discipline.md` | 5 |
| S5 | **Ingestion + reconciliation + corrections** (etl.*) | pglite | `backend/test/ingestion-reconciliation.design.test.mjs` | `CONTRACT-ingestion-reconciliation.md` | 3 |
| S0 | **Contract guard + production-port plan** (queryKey→endpoint→shape diff) | mixed | `app/src/lib/archintel/__tests__/contract-ci-and-prod-port.design.test.ts` | `CONTRACT-contract-ci-and-prod-port.md` | 3 (guard) + design-only (port) |

---

## 1. DEPENDENCY-ORDERED BUILD SEQUENCE

Order is load-bearing per `PHASE-PLAN.md`: **numbers must not move twice** (clock before
seam/Metric), **seed before semantic functions**, **schema/RLS before everything that reads
canonical under a non-superuser role**.

> ⚠️ **MIGRATION-NUMBER COLLISION — resolve before building.** Four subsystems each authored
> their migration as `0003_*.sql` (S2 `0003_canonical_full` + `0004_app_role`; S3 `0003_mart_derived`;
> S4 `0003_aios`; S5 `0003_ingestion`). The harness applies migrations in **filename order**, so
> they cannot all be `0003`. The builder MUST renumber to the global order below as each lands.
> The contracts are written so the *content* is stable; only the numeric prefix changes. The
> S2 `0004_app_role` (the FORCE-RLS / grant step) must remain **the highest number among
> canonical-touching migrations at the time it lands**, because `grant … on all tables` only
> covers tables that already exist — re-running the grant after later tables land is harmless
> and idempotent, but the builder should re-issue grants (or keep `0004` logically last over
> canonical) whenever a new canonical table is added.

### Recommended global migration numbering

| Build order | Migration file | From subsystem |
|---|---|---|
| (shipped) | `0001_canonical.sql`, `0002_mart.sql` | Slice 2b |
| 1 | `0003_canonical_full.sql` | S2 |
| 2 | `0004_app_role.sql` (FORCE RLS + grants) | S2 |
| 3 | `0005_mart_derived.sql` | S3 |
| 4 | `0006_aios.sql` | S4 |
| 5 | `0007_ingestion.sql` | S5 |

(Each ships its `.down.sql` + `.supabase.sql` variant. After `0006`/`0007` add new canonical
or mart tables, re-issue the `app_user` grants so the non-superuser role can read them.)

### Build sequence (subsystems)

```
            ┌─────────────────────────────────────────────────────────┐
 SHIPPED →  │ Slice 2b: 0001_canonical, 0002_mart, serialize.mjs,     │
            │ GET /api/v1/overview, VITE_USE_BACKEND_AI seam (GREEN)   │
            └─────────────────────────────────────────────────────────┘
                                   │
        ┌──────────────────────────┴──────────────────────────┐
        ▼                                                       ▼
 ┌──────────────┐                                      ┌──────────────────┐
 │ S1 CLOCK     │  (frontend-only; independent of DB)  │ S2 SCHEMA+RLS+   │
 │ UNIFY        │  ── can run in PARALLEL with S2 ──    │ AUTH+FULL SEED   │
 │ (pglite-local│                                       │ (pglite-local)   │
 │  / frontend) │                                       └──────────────────┘
 └──────────────┘                                                │
        │                                                         │ (full canonical +
        │ (one as_of; numbers settle)                             │  enforcing RLS +
        │                                                         │  full seed land)
        └───────────────────────────┬─────────────────────────────┘
                                     ▼
                        ┌──────────────────────────┐
                        │ S3 DERIVED ENDPOINTS →    │  (pglite-local; needs S2 seed +
                        │ SEMANTIC FNS + METRICS    │   RLS, S1 clock for stable values)
                        │ (incl. Trust envelope     │
                        │  step 4 + domain stamps 5)│
                        └──────────────────────────┘
                                     │
            ┌────────────────────────┼────────────────────────┐
            ▼                        ▼                         ▼
   ┌────────────────┐      ┌──────────────────┐      ┌──────────────────┐
   │ S4 AIOS WRITE- │      │ S5 INGESTION +   │      │ S0 CONTRACT GUARD│
   │ DISCIPLINE     │      │ RECONCILIATION   │      │ (a) ← gate AFTER │
   │ (pglite-local) │      │ (pglite-local)   │      │ S1+S3 Metric     │
   └────────────────┘      └──────────────────┘      │ shapes are final │
   needs S2 (member.       needs S2 (full seed,      └──────────────────┘
   can_check, project,     payment_milestone +       (b) prod-port plan =
   FIRM_A/B)               source refs)              design-only, no code
```

### Per-subsystem locality (pglite-local vs needs-real-runtime)

| Subsystem | Locally buildable on pglite/node today? | Notes |
|---|---|---|
| **S1 Clock** | ✅ frontend vitest — no DB at all | Backend F7 oracle already GREEN; pure frontend unification. |
| **S2 Schema+RLS+Auth+Seed** | ✅ pglite — RLS **enforced** via `SET ROLE app_user` (non-superuser, NOLOGIN) | Spike-verified: superuser bypasses RLS, `app_user` enforces `company_id`. Closes A-3/G3 **locally**, no Supabase needed. |
| **S3 Derived endpoints** | ✅ pglite + node:http | Reuses Slice-2b route/serializer pattern; mixed only because frontend seam wiring (slice 5) is vitest. |
| **S4 AIOS write-discipline** | ✅ pglite — tamper-evidence via CHECK/trigger/REVOKE (NOT RLS, since superuser bypasses RLS) | md5 hash-chain on pglite; sha256 in `.supabase.sql`. |
| **S5 Ingestion** | ✅ pglite | `etl.*` schema + functions; read-only-first enforced by `CHECK(mode='read_only')`. |
| **S0(a) Contract guard** | ✅ frontend vitest / node — no server boot needed (static manifest↔producer diff) | Optional layer-2 live cross-check needs a warm pglite (slower); static layer is hermetic. |
| **S0(b) Production-port** | ⚠️ **needs-real-runtime at P2 only** | Supabase Auth/`auth.uid()`/OAuth cannot run on pglite. See §4. |

**Everything in the MVP build is locally buildable on pglite/node today.** The only
needs-real-runtime item is the S0(b) production port, and only at its P2 phase.

---

## 2. CONSOLIDATED, DEDUPED — PRODUCT DECISIONS NEEDED (resolve before / during build)

Deduped across all 6 subsystems. Several subsystems independently raised the same
maker-checker / finance-band / modeled-literal questions; merged here with one recommendation each.

| # | Decision | Recommendation | Raised by |
|---|---|---|---|
| **PD-A: Finance band for `role='principal'` (Fariha Karim, m2)** — does the principal co-founder see money? | **GRANT.** Add a per-member `finance_grant` boolean, seed `true` for m1+m2; key `isFinanceEligible` off the grant (future-proofs a non-founder finance hire). The live data names Fariha as owner of payment-chasing/approval audit tasks (`aios.ts:39-40`); gating her out breaks the product's own workflow. Ledgers stay green either way (they test designer-vs-founder, not principal). | S2 (PD-1), S3 (band ⑤) |
| **PD-B: Decision/proposal promotion gate — who can promote a decision/agent-action into a citable/dispatchable record?** | **Gate behind `can_check` (founder/finance), consistent with F1 maker-checker.** Seed all decisions `promoted=false`. Unifies S2's decision-promotion and S4's agent-action promotion under one rule so they do not diverge silently. | S2 (PD-2), S4 (D1) |
| **PD-C: Founder sole-checker bootstrap** — only m1 (founder) has `can_check=true`, so a founder-submitted action deadlocks against the `decided_by<>submitted_by` CHECK. | **Grant a 2nd `can_check` member (m2/principal) as co-checker** and route founder-submitted items there. Preserves promise 6 without relaxing self-approval. (This is the seed-side consequence of PD-A/PD-B — resolve together.) | S4 (D1) |
| **PD-D: `delivery_receipt` / execution ownership boundary** | **Only the external AIOS executor writes `delivery_receipt` and flips `state=executed`.** This repo's `app_writer` role is REVOKEd from reaching `executed`; `promote_agent_action` drives only `proposed→approved`/`rejected`. `executing/executed/failed` belong to the external executor. Honors ⑦ READ-ONLY-STRICT. | S4 (D2, D4) |
| **PD-E: Which `aios-*` endpoints get real backend data vs stay mock** | **Backend-back `/aios/kpis`:** `output=3.0` (computed active÷designers), `automated=low` (computed over task audit), `autonomy=REFUSE` (insufficient envelope until a real intervention log exists — never the fabricated 64). Keep `dailyBrief`/`agentActions`/`auditTasks` as frontend mock (no trust-surface number; `agentActions` is additionally ⑦-bound to Step-6). | S3 (D-AIOS-1) |
| **PD-F: `ytd*`/`month*` finance figures (monthlyFlow-derived)** | **Stay frontend mock** with the existing illustrative-low stamp. `monthlyFlow` is illustrative, not reconcilable to milestone lineage. Backend serves only milestone-backed figures (income/billable/receivables/collectionRate/overdue). | S3 (D-FIN-1) |
| **PD-G: A-5 other-money fields (received/total_contract/billable) envelope** | **Full Metric envelope** (gross-low, sources) — consistent trust surface, closes A-5. Forbid a bare pg-string; forbid any number reaching a designer. | S3 (D-FIN-2) |
| **PD-H: Modeled/editorial inputs (`PROJECT_COST`, audit-task statuses)** — seed a table or carry as a const? | **Declared const in `profitability.mjs`/`aios.mjs`**, cited as `model:PROJECT_COST:aN` / `auditTask:tN` with `confidence:'low'`. These are editorial, not observed facts — keeping them out of canonical honors the non-migratable-literal rule; citing them as declared inputs is the honesty mechanism. | S3 (D-PROFIT-1/D-AIOS-2) |
| **PD-I: Hash digest strength for the audit chain** | **md5 on the pglite path, sha256 in `*.supabase.sql`** via `digest()`. Tamper-evidence semantics identical; only collision resistance differs. (Non-blocking impl detail.) | S4 (D3) |
| **PD-J: Clock anchor fix (load-bearing)** — ship corrected `as_of=2026-06-22` so the overdue Badge moves `13d → 18d`, or keep the stale 06-17 anchor? | **SHIP the corrected anchor.** 2026-06-22 is the locked oracle; 06-17 is a pre-pivot leftover. The UI is internally INCONSISTENT today (Badge renders 13d while prose/activity-log/backend all say 18d). This is intended and load-bearing — flagged so a builder cannot keep the wrong value to preserve an old snapshot. | S1 (CLOCK_ANCHOR_FIX) |
| **PD-K: `relative()` time source** — anchor alerts/activity/topbar relative timestamps to `as_of`, or leave on wall clock? | **ANCHOR to `as_of=2026-06-22`.** CONTEXT mandates "inject `as_of`, never read the wall clock"; `relative()` is the last wall-clock authority (A3). A frozen reproducible clock is the point of a demo/intelligence product. | S1 (RELATIVE_TIME_SOURCE) |
| **PD-L: Ingestion — two genuine same-amount same-day receipts** | **Route the 2nd to `needs_review(duplicate_same_amount)`** (never silent-drop). Ledger accepts a review row OR two audited matches but never a single silent absorb. | S5 (PD-1) |
| **PD-M: Production runtime at P2 — Docker+supabase-local vs hosted Supabase** | **Hosted Supabase project at P2** (OAuth redirect URIs + managed `auth.users`/JWT work out of the box; single-firm fits free tier). Keep pglite as the offline test runtime. Provision ONLY at P2. See §4. | S0 (PD-1) |
| **PD-N: Contract-guard coverage scope** | **10 derived/aggregate endpoints now** (the ⑦ swap surface where Metric/scalar drift happens); add raw-array passthrough row-shape audit as a follow-up. | S0 (PD-2) |

**Lower-stakes defaults (the contracts already pick a safe default; orchestrator only needs to veto if it disagrees):**
S5 PD-2 correction model = PROJECT+OVERWRITE; S5 PD-3 content-hash = business-fields-only;
S5 PD-4 ambiguous-ref detector = amount-window; S5 PD-5 review-resolution audit = ship etl's own
append-only log now, wire into S4 `audit.event` later; S2 PD-3 / S0 PD-3/PD-4 = Supabase path
split + static-CI-guard + versioned REST (no change requested).

---

## 3. RECOMMENDED FIRST BUILD CHUNK

### Chunk 1 — **S1 Clock-unify  ‖  S2 Schema+RLS+Auth+full seed** (in parallel)

**Why this pair first:**

1. **`PHASE-PLAN.md` mandates clock before seam/Metric** — "numbers must not move twice."
   S1 must land before S3 (and before the S0 contract guard freezes Metric shapes), or every
   downstream value snapshot would have to be re-pinned. S1 is the only subsystem that changes a
   *displayed number* (`13d → 18d` overdue), and it is a pure frontend unification with zero DB
   dependency — it can run start-to-finish in parallel with S2 with no contention.

2. **S2 is the hard gate for everything backend-derived.** S3 (semantic fns), S4 (AIOS ledger
   FKs reference `canonical.member`/`project`), and S5 (ingestion projects onto
   `canonical.payment_milestone`) all require the **full canonical schema + the full seed + the
   enforcing non-superuser RLS role**. Nothing reads canonical safely under `app_user` until S2's
   `0004_app_role` lands. S2 also closes the carried adversary gaps **A-3/G3** (RLS actually
   enforced, not superuser-luck) — the highest-value structural guarantee, proven locally on pglite.

3. **Both are 100% locally buildable on pglite/node today** — no Docker, no Supabase. S2's RLS
   enforcement was already spiked (superuser bypasses; `SET ROLE app_user` enforces `company_id`),
   so the ledger goes green by real enforcement, not by luck.

4. **They unblock the widest fan-out.** After Chunk 1, S3 can start; after S3, the leaves
   (S4, S5, S0-guard) fan out in parallel.

**Decisions that must be resolved BEFORE Chunk 1 starts:** PD-J and PD-K (S1 clock anchors —
these decide the displayed numbers S1 ships), and PD-A + PD-C (S2 seed — finance_grant for m2,
and the 2nd `can_check` member, since the seed is authored in S2 even though S4 consumes it).
Resolve PD-B together with them so decision/agent-action promotion uses one rule.

**Suggested next chunks:** Chunk 2 = **S3** (derived endpoints + Trust envelope + domain stamps).
Chunk 3 (fan-out, parallel) = **S4 ‖ S5 ‖ S0(a) contract guard** — S0(a) runs *after* S1+S3 so it
freezes the trust-final Metric shapes, not interim ones.

---

## 4. PRODUCTION-RUNTIME DECISION (Docker vs hosted Supabase) — WHEN IT BLOCKS

**Decision: a hosted Supabase project (not Docker+supabase-local).** Rationale: OAuth redirect
URIs, managed `auth.users` / JWT signer, and real `auth.uid()` RLS policies work out of the box;
the single-firm product fits the free tier; this machine has no Docker today. Keep **pglite as the
permanent offline test runtime** — it is not replaced, it is the CI/dev DB.

**When it becomes blocking — and only then:**

| Phase | Work | Runtime | Blocking? |
|---|---|---|---|
| **P0 (now → entire MVP)** | All KPI logic on pglite; author every `*.supabase.sql` variant alongside each migration; build S1–S5 + S0(a) contract guard | pglite + node (have it) | **Never blocks.** |
| **P1** | Re-express serializer + routes as FastAPI over the SAME pglite/local-Postgres DB; point `contract-check.mjs` at FastAPI; prove Metric parity | Python 3.13 (have it) + existing DB | **Not blocking** — FastAPI sits over pg-wire/local Postgres; no Supabase yet. |
| **P2** | Stand up real Supabase Postgres; run the `*.supabase.sql` variants; move RLS to `auth.jwt()`; wire Supabase Auth (Google/MS OAuth + email OTP) | **Hosted Supabase project** | **BLOCKING — here and only here.** Real `auth.users` FKs, `auth.uid()` policies, and OAuth callbacks cannot run on pglite. |
| **P3** | Claude as tool-calling read-only-strict narrator over the FastAPI KPI functions | hosted Supabase + Anthropic API | downstream of P2 |

**Net:** the entire test-first MVP (all 6 subsystems' code) ships on pglite/node with no
provisioning. Provision the hosted Supabase project **only when starting P2** (real auth/tenancy
port). Until then it is a documented, non-blocking open infra item — exactly as `PHASE-PLAN.md §39`
states ("not blocking until after Phase 1").

---

## 5. Cross-cutting invariants every build slice must hold (carried from CONTEXT/PHASE-PLAN)

- TS `resolve()` output shapes are the API contract of record; `ai-*`/`aios-*` query keys preserved exactly.
- One injected `as_of`; **no module reads the wall clock** for a KPI value (S1 closes the last A3 offender).
- Every ingested canonical fact carries `source_system, source_record_ref, observed_at`.
- Non-migratable literals (`autonomy=64`, `output=1.5`, `predictedRisks.likelihood[]`, `RISK_ANSWERS`,
  `monthlyFlow`, `PROJECT_COST`) **never seeded as facts** — recomputed or `confidence='insufficient'`.
- **builder ≠ reviewer** on every slice (the agent that writes a mechanism does not sign off its acceptance test).
- pglite hard rules: **no `gen_random_uuid`** (mint UUIDs in seed JS), **no `citext`** (text + `unique(lower())`);
  migrations stay core-PG; Supabase-faithful DDL → `*.supabase.sql` (syntax-only, not run under pglite).
- `current_setting('request.*', true)` missing-ok form so a cleared claim → NULL → policy **fails closed**.
- Run backend tests: `node --test --test-isolation=none --test-force-exit <file>` (kill stray node first;
  never pipe through `Select-Object`). Frontend: `pnpm --dir app test`.
- **Repeat the `company_id` predicate in every new mart/etl read** (defense-in-depth A-3: the pglite
  bootstrap superuser bypasses RLS).
