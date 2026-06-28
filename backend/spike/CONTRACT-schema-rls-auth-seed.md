# Step 2 BUILD-CONTRACT — full canonical/mart schema + ENFORCING RLS + auth + full seed

> **Reviewer-authored. Builder ≠ reviewer.** The acceptance ledger
> `backend/test/schema-rls-auth-seed.design.test.mjs` is **RED today** (10/10
> failing: `role "app_user" does not exist`, `relation "canonical.design_approval"
> does not exist`, `serialize.mjs must export serializeProjects`,
> `canonical.project_member must exist`, the self-approval CHECK is absent). This
> file tells the **builder** exactly what to ship so it goes GREEN — **without**
> the reviewer implementing it.
>
> **This is the slice that closes the carried adversary gaps A-3/G3 (RLS not
> enforced under the pglite superuser) and A-2 (no per-request claim reset).**
> It also extends the spike's PARTIAL schema (member/project/client/
> payment_milestone/source + mart) to ALL live entities the app reads.
>
> **Builder creates / edits (and ONLY these):**
> - `backend/db/migrations/0003_canonical_full.sql` (+ `.down.sql` + `.supabase.sql`)
>   — the new canonical tables, the self-approval CHECK, `project_member`, and
>   RLS policies on every new table.
> - `backend/db/migrations/0004_app_role.sql` (+ `.down.sql` + `.supabase.sql`)
>   — the non-superuser `app_user` role + grants + `FORCE ROW LEVEL SECURITY`.
> - `backend/db/seed/seed_live.mjs` — EXTEND to seed ALL live arrays + Firm-B
>   synthetic rows for the new tables; keep idempotency (on-conflict-do-nothing).
> - `backend/semantic/serialize.mjs` — ADD `serializeProjects`, `serializeMilestones`
>   exports (reuse the existing `redactRow` band; do NOT change existing exports).
> - Every existing + new mart function — ADD/keep the `company_id = v_company`
>   predicate (A-3 defense-in-depth).
>
> **Builder MUST NOT edit:** `backend/test/**` (this ledger or any existing test),
> the spike tests, `app/src/lib/archintel/data.ts` / `aios.ts` (the live arrays
> are ground-truth INPUTS — seed FROM them, never edit to fit a count),
> `app/src/lib/types.ts`, the existing `serializeOverview`/`serializeClients`
> signatures (the spike + slice-2b suites depend on them byte-for-byte).
>
> Obey `backend/CONTEXT.md` pglite HARD RULES: **no `gen_random_uuid()`** (mint
> uuids in seed JS), **no `citext`** (`text` + `unique index on lower(...)`),
> migrations stay core-PG so they run byte-identical on Supabase; Supabase-only
> DDL goes in `*.supabase.sql` (syntax-only, never run under pglite). One injected
> `as_of`; never read the wall clock.

---

## What this slice closes

| id | gap | today | after Step 2 |
|----|-----|-------|--------------|
| **A-3 / G3** | RLS rides on per-function discipline; pglite superuser BYPASSES the policies, so isolation was only ever proven via `recompute`'s `company_id` predicate. | `[gap/rls-superuser]` skipped. | A NON-SUPERUSER `app_user` role exists; tests `SET ROLE app_user` and prove Firm A cannot read Firm B **with NO predicate** (the policy filters it), on EVERY canonical table. |
| **A-2** | Single warm pglite connection = shared mutable session; no per-request claim reset; a forgotten `request.*` claim bleeds across requests. | `[state-bleed]` structural risk, untested. | RLS **fails closed** when the company claim is cleared (0 rows), so a reset-then-read can never carry the previous company over. Contract requires the route to reset the FULL claim set per request. |
| **F5 / live schema** | Only member/project/client/payment_milestone seeded; design_approval/file_record/client_submission/decision/activity/audit_task absent. | partial schema. | All live entities exist with the live grain + RLS enabled + full seed. |
| **da-1** | A reviewer could approve their own submission. | no constraint. | `design_approval` CHECK `decided_by <> submitted_by`. |
| **fin-\*** | Finance band only enveloped `overdueAmount`; project/milestone money fields un-gated at the row level. | `serializeOverview` only. | `serializeProjects` / `serializeMilestones` apply the SAME band → Viewer rows OMIT money (absent, not null). |
| **sr-\*** | No `project_member` scoping for the live 5-role model. | none. | `project_member` table, RLS-enabled, seeded from live `leadId` + `teamIds`. |

The 5-role model is LIVE-EXACT: `founder | principal | project_lead | designer |
finance` (data.ts:21). The synthetic Firm B exists ONLY to prove isolation.

---

## §1 — CANONICAL SCHEMA: the exact surface (migration 0003)

All tables: `schema = canonical`, `company_id uuid not null` (RLS key), text PK
matching the live id (`ap1`, `f1`, `s1`, `d1`, `ac1`, `t1`), idempotent DDL
(`create table if not exists`), and the provenance triple
(`source_system, source_record_ref, observed_at`) on every INGESTED fact
(approvals/files/submissions/decisions/activity carry provenance; `audit_task` is
editorial config — provenance optional). Mint UUIDs in seed, not in DDL.

### canonical.design_approval  (live `DesignApproval`, data.ts:294)
Columns (snake_case): `id text pk`, `company_id uuid not null`, `project_id text
references canonical.project(id)`, `type text` (`concept|design|material|revision|
technical`), `title text`, **`submitted_by text not null`** (live `submittedById`),
**`decided_by text`** (live `reviewerId` — the approver; NULL until decided),
`status text` (`pending|approved|revise|rejected`), `submitted_date date`,
`decided_date date`, `version text`, `phase smallint`, `+ provenance triple`.

> **CHECK (da-1, LOAD-BEARING):**
> `constraint design_approval_no_self_approve check (decided_by is null or decided_by <> submitted_by)`
> — a reviewer may not decide their own submission. Test (5) inserts a
> self-decided row and asserts it RAISES.

(Live `comments[]` is out of MVP scope — drop it, or carry as `jsonb` if trivial;
no test reads it.)

### canonical.file_record  (live `FileRecord`, data.ts:251)
`id`, `company_id`, `project_id`, `name`, `kind text` (FileKind union),
`owner_id text`, `storage text` (`local|gdrive|archintel`), `version text`,
`uploaded_date date`, `status text` (FileStatus union), `phase smallint`,
`ext text`, `+ provenance triple`.

### canonical.client_submission  (live `ClientSubmission`, data.ts:323)
`id`, `company_id`, `project_id`, `package text`, `version text`,
`sent_via text` (`whatsapp|email`), `sent_date date`, `sent_by text`,
`feedback text`, `status text` (`sent|feedback|revision_requested|approved`),
`approved_date date`, `+ provenance triple`.

### canonical.decision  (live `DecisionA`, data.ts:386 — EXTENDED)
`id`, `company_id`, `project_id`, `type text` (`layout_freeze|material_lock|
change_request|decision`), `summary text`, `decided_by text` (live `by`),
`decided_date date` (live `date`), `phase smallint`, **`promoted boolean not null
default false`** (verified into a citable record — the live `DecisionA` has none;
add it per scope), **`promoted_by text`**, **`promoted_at timestamptz`**,
`+ provenance triple`. `promoted_by`/`promoted_at` are NULL until promoted.

### canonical.activity  (live `ActivityA`, data.ts:405)
`id`, `company_id`, `project_id text` (nullable — live allows null), `type text`
(`file|approval|submission|payment|phase|decision|member`), `actor text`,
`summary text`, `occurred_at timestamptz` (live `date`).

### canonical.audit_task  (live `AuditTask`, aios.ts:25)
`id` (`t1..t10`), `company_id`, `title text`, `owner text`, `cadence text`,
`min_per_week int`, `automatable text` (`high|medium`), **`human_gate boolean not
null`**, `behavior text`, `status text` (`automated|assisted|manual`).
> Re-tag per CONTEXT lock ⑦: `t1/t3/t4/t5` seed with `human_gate = true`
> (read-only-strict; this repo proposes, never executes). The live array currently
> has `t1/t3/t4/t5 humanGate:false` — the SEED overrides them to `true`. Do NOT
> edit `aios.ts`; apply the override in `seed_live.mjs`.

### canonical.project_member  (sr-\*, NEW — no live array)
`company_id uuid not null`, `project_id text not null references
canonical.project(id)`, `member_id text not null references canonical.member(id)`,
`role_on_project text` (`lead|team`), `primary key (company_id, project_id,
member_id)`. Seeded from live `ProjectA.leadId` (role `lead`) + each
`ProjectA.teamIds[]` member (role `team`, de-duped against the lead). Spot-check
in test (9): `(a5, m3)` is present.

### RLS on every new table (migration 0003)
```sql
alter table canonical.<t> enable row level security;
create policy <t>_company_isolation on canonical.<t>
  using (company_id = current_setting('request.company_id', true)::uuid);
```
Mirror the existing pattern in `0001_canonical.sql:128-143`. The `, true`
(missing_ok) on `current_setting` is REQUIRED so a cleared claim yields NULL (not
an error) → the policy matches nothing → fail-closed (test 3).

---

## §2 — THE NON-SUPERUSER ROLE (migration 0004) — closes A-3/G3

This is the heart of the slice. **Empirically verified against pglite 0.5.3
(real PG 16):** the bootstrap superuser bypasses RLS, but a NOLOGIN role with
`is_superuser=off` ENFORCES the policies — and an explicit `WHERE company_id =
<FirmB>` returns 0 rows under that role.

```sql
-- 0004_app_role.sql  (core-PG; runs under pglite AND Supabase)
do $$ begin
  create role app_user nologin;
exception when duplicate_object then null; end $$;

grant usage on schema canonical to app_user;
grant usage on schema mart to app_user;
grant select on all tables in schema canonical to app_user;
grant select on all tables in schema mart to app_user;
grant execute on all functions in schema mart to app_user;   -- recompute under the role

-- Defense-in-depth: FORCE RLS so even a table OWNER is subject to policy
-- (guards against a future owner-context read). Superuser still bypasses,
-- which is exactly why the LEDGER sets role to app_user.
alter table canonical.member            force row level security;
alter table canonical.project           force row level security;
-- … FORCE on every canonical table, incl. the 0003 additions + project_member.
```

> **Idempotency:** guard `create role` with the `duplicate_object` DO-block so the
> harness can re-apply. `grant … on all tables` re-runs harmlessly. The 0004
> migration must apply AFTER 0003 so the new tables exist to grant on (filename
> order `0004 > 0003` guarantees it).
>
> **Supabase variant (`0004_app_role.supabase.sql`):** on real Supabase the
> principal is the `authenticated` role and policies use `auth.uid()` /
> `auth.jwt()->>'company_id'`; record that DDL there (syntax-only). The pglite
> path uses `app_user` + `current_setting('request.company_id')`.

The recompute function (and any function the app role EXECUTEs) runs as the
INVOKER under `SET ROLE app_user` (it is `SECURITY INVOKER` by default — keep it
that way so RLS applies inside the function body too).

---

## §3 — AUTH / CLAIM PLUMBING — closes A-2

The pglite "JWT" is three GUCs: `request.company_id`, `request.user_id`,
`request.role`. The contract the builder must honor at the route layer
(`backend/server/index.mjs` is the reference handler):

1. **Every request resets the FULL claim set** before serving — set ALL of
   `request.company_id/user_id/role` (and clear any transient like
   `request.kpi_run_id`). The current handler already sets all three
   (`index.mjs:78-80`); the contract makes it a REQUIRED invariant and forbids a
   future route that sets a new claim without resetting it. Preferred hardening:
   run each request in its own txn with `set_config(..., true)` (txn-local) so the
   session never retains a claim — but the warm-connection `false` form is
   acceptable as long as ALL claims are re-set per request.
2. **Fail closed on a missing company claim.** With the company claim cleared,
   RLS returns 0 rows (test 3). The route must therefore set the company claim
   from the verified principal on EVERY request; an absent company claim must
   never silently read a default tenant under the app role (A-4 is a related
   low-sev follow-up — not in this slice's tests, but do not regress it).

Test (3) models this: warm a Firm-A read, then CLEAR all claims, then read again
under `app_user` → must be 0 rows (no carry-over).

---

## §4 — FINANCE BAND AT THE ROW LEVEL — closes fin-\*

`serialize.mjs` already has `redactRow(row, principal)` and the `MONEY_KEYS` set
(includes `contract_value`, `gross_amount`, `received_amount`, `net_receivable`,
`amount`, …). ADD two exports that reuse it — do NOT change `serializeOverview` /
`serializeClients`:

```js
export function serializeProjects(rows, principal) {
  return Array.isArray(rows) ? rows.map((r) => redactRow(r, principal)) : [];
}
export function serializeMilestones(rows, principal) {
  return Array.isArray(rows) ? rows.map((r) => redactRow(r, principal)) : [];
}
```

Band rule (unchanged): finance-eligible (`role ∈ {founder, finance}` OR
`financeGrant === true`) → money passes through; everyone else → money keys
OMITTED (absent, NOT present-with-null). Test (8): Viewer (designer m6) project +
milestone rows omit `contract_value/gross_amount/received_amount/net_receivable/
amount`; Owner (founder m1) retains `contract_value`.

> See the **NEEDS PRODUCT DECISION** section for whether `role='principal'`
> (Fariha) is finance-eligible. The current `isFinanceEligible` returns FALSE for
> `principal` — test (8) does not exercise principal, so the default holds unless
> product flips it.

---

## §5 — SEED: full live arrays + Firm-B synthetic (extend seed_live.mjs)

Keep the existing Firm-A member/client/project/payment seed. ADD, FROM the live
arrays (data.ts / aios.ts — verbatim, never edited):

| table | source array | Firm-A count | idempotency key (on conflict do nothing) |
|-------|--------------|-------------:|------------------------------------------|
| design_approval | `approvalsA` (ap1..ap6) | 6 | `id` (or `(company_id, project_id, type, version)`) |
| file_record | `files` (f1..f16) | 16 | `id` |
| client_submission | `submissions` (s1..s6) | 6 | `id` |
| decision | `decisionsA` (d1..d5) | 5 | `id`; `promoted=false`, `promoted_by/at=NULL` |
| activity | `activityA` (ac1..ac10) | 10 | `id` |
| audit_task | `auditTasks` (t1..t10) | 10 | `id`; OVERRIDE `human_gate=true` for t1/t3/t4/t5 (lock ⑦) |
| project_member | `projectsA[].leadId` + `teamIds[]` | derived | `(company_id, project_id, member_id)` |

Provenance minting (match the existing milestone pattern): `source_system =
'manual_capture'` (or `'gdrive'` for files), `source_record_ref = '<system>:'+id`
(e.g. `'gdrive:f5'`, `'whatsapp:s2'`), `observed_at` = deterministic ISO from the
row's own date field (`submitted_date`/`uploaded_date`/`sent_date`/`decided_date`)
— NO wall clock. Register the new source systems in `canonical.source` so any
future lineage join stays NOT NULL.

**Firm B synthetic:** add ≥1 row per new table under `FIRM_B` with DISTINCT ids
(e.g. `bap1`, `bf1`, `bs1`, `bd1`, `bac1`, plus a Firm-B `audit_task` set, and
`project_member (b1, bm1)`). Firm B already has project `b1` + 2 overdue
milestones; keep them. Seed a Firm-B member `bm1` (role `founder`) so the
symmetry test (2) has a principal. These exist ONLY to prove isolation.

**Idempotency (test 7):** every insert stays `on conflict (<key>) do nothing` so
re-running `seed(db)` on the warm db changes NO row counts.

---

## §6 — DEFENSE-IN-DEPTH: every mart fn repeats the predicate — A-3

Even with RLS now enforced under `app_user`, the contract carries the spike's
discipline: **every mart function ALSO filters `where company_id = v_company`**
(`v_company := current_setting('request.company_id', true)::uuid`). RLS is the
outer guard; the predicate is the inner one. The existing
`recompute_portfolio_summary` already does this (`0002_mart.sql:122,143`) — keep
it, and any NEW mart function must repeat it. Test (10) runs recompute under
`SET ROLE app_user` for Firm A (with Firm B seeded overdue) and asserts ZERO
Firm-B entities in the lineage.

---

## §7 — INTEGRATION / RENDER SITES

This slice is BACKEND-ONLY (schema + role + seed + two serializer exports). It
does NOT re-thread any React call site — the seam swaps (Step 3) and trust
envelope (Step 4) own that. The serializer additions are consumed by the
existing `backend/server/index.mjs` reference handler once Step 3 adds
projects/milestones endpoints; this slice only requires the EXPORTS to exist and
apply the band (test 8). Preserve the `ai-*` / `aios-*` query keys and the
`resolve()` / `fetchOverview` seam shapes untouched (promise ⑦).

---

## §8 — ACCEPTANCE LEDGER MAP (`schema-rls-auth-seed.design.test.mjs`)

| test | closes | asserts |
|------|--------|---------|
| (1) | A-3/G3 | `app_user` exists; under `SET ROLE`, Firm A sees only Firm-A rows on all 10 tables with NO predicate; Firm-B predicate → 0. |
| (2) | A-3/G3 | symmetry — Firm-B principal sees only Firm B; cannot read Firm A. |
| (3) | A-2 | cleared claim set ⇒ RLS fails closed (0 rows); no carry-over. |
| (4) | F5 | all live tables exist with live columns + RLS enabled. |
| (5) | da-1 | `design_approval` CHECK rejects `decided_by == submitted_by`. |
| (6) | seed | full live-array counts (6/6/8/12/6/16/6/5/10/10). |
| (7) | seed-idem | re-running seed is a no-op (no dup rows). |
| (8) | fin-\* | Viewer project+milestone rows OMIT money; Owner retains. |
| (9) | sr-\* | `project_member` exists, RLS-enabled, links m3→a5. |
| (10) | A-3 d-in-d | recompute under app_user is company-scoped (no Firm-B leak). |

RED proof (today): all 10 fail with `role "app_user" does not exist` /
`relation "canonical.design_approval" does not exist` /
`serialize.mjs must export serializeProjects` / `canonical.project_member must
exist` / missing self-approval CHECK. The harness `freshDb()` SUCCEEDS (current
migrations+seed apply), so the failures are purely the absent Step-2 surface.

Run:
```
node --test --test-isolation=none --test-force-exit backend/test/schema-rls-auth-seed.design.test.mjs
```

---

## NEEDS PRODUCT DECISION

### PD-1 (FLAG) — Does `role = 'principal'` (Fariha Karim, m2, co-founder) see finance?

`isFinanceEligible` (serialize.mjs:45) currently grants finance to
`{founder, finance}` ONLY — `principal` is NOT finance-eligible, so Fariha would
NOT see contract values / overdue amounts / margins.

- **Live signal:** Fariha is "Principal Architect & Co-Founder" (data.ts:35),
  `isApprover:false`, `can_check:false` in the maker-checker model. The audit
  tasks repeatedly name "Fariha / Finance" as the owner of payment-chasing and
  approval-nudging coordination (aios.ts:39-40) — implying she DOES handle money.
- **Option A — `founder|finance` (current default):** strict. Fariha sees no
  money. Safer band, but contradicts the audit-task ownership and the co-founder
  reality; she would be blind to the overdue figure she is tasked with chasing.
- **Option B — `founder|finance|principal`:** Fariha (and any future principal)
  sees finance. Matches the "Fariha / Finance" task ownership and co-founder
  status. Widens the band by one role.
- **Recommendation: Option B (`+principal`).** The live data treats Fariha as a
  finance-handling co-founder; gating her out of the overdue/contract figures she
  is the named owner of would break the product's own workflow. Implement by
  adding `role === 'principal'` to `isFinanceEligible`, OR (cleaner) a per-member
  `finance_grant boolean` on `canonical.member` seeded `true` for m1+m2, and key
  `isFinanceEligible` off the grant — this also future-proofs a finance hire who
  is neither founder nor principal. **Until product confirms, the ledger does NOT
  test principal** (test 8 uses designer vs founder only), so either option keeps
  the suite green; this decision only changes what Fariha sees, not a test.

### PD-2 — `decision.promoted` default + who can promote
The live `DecisionA` has no `promoted` field; the contract adds `promoted=false`
default with `promoted_by`/`promoted_at`. Open question for Step 6
(maker-checker): is "promote a decision into a citable record" gated by
`can_check` (founder/finance) like the payment maker-checker, or any project
lead? **Recommendation:** gate promotion behind `can_check` for consistency with
the F1 maker-checker model; seed all decisions `promoted=false` for now (no test
asserts a promoted decision in this slice). Flagged so Step 6 does not silently
pick a different rule.

### PD-3 — Supabase principal mapping (non-blocking, syntax-only)
On real Supabase the non-superuser principal is `authenticated` (not `app_user`)
and `company_id` comes from `auth.jwt()`. The pglite ledger proves enforcement
with `app_user` + `request.company_id`. Record the `authenticated`/`auth.uid()`
policy form in `*.supabase.sql`. **Recommendation:** keep the two paths split
exactly as the spike does; do not try to run Supabase DDL under pglite.
