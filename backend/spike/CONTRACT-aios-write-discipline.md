# Step 6 BUILD-CONTRACT — AIOS write-discipline (proposal-only, maker-checker, tamper-evident audit)

> **Reviewer-authored. Builder ≠ reviewer.** The acceptance ledger
> `backend/test/aios-write-discipline.design.test.mjs` is **RED today** — the
> tables, functions, and serializer surface it asserts against do not exist yet.
> A LATER, DIFFERENT agent (the builder) makes it GREEN by shipping migration
> `0003_aios.sql` (+ down + supabase variant), extending the seed, and adding the
> AIOS serializer. The author of this contract MUST NOT implement that logic.
>
> Closes **F1** (the one Critical) / **promise-6** (maker-checker on an
> append-only tamper-evident audit) / **mc-*** / **pw-1** / **sr-1**.
>
> **This repo holds NO write credential.** It PROPOSES outbound actions and gates
> them behind maker-checker; a SEPARATE AIOS backend repo owns WhatsApp/Drive
> execution. Nothing in `0003_aios.sql` opens a socket, sends a message, or
> stamps a `delivery_receipt` of its own accord — `delivery_receipt` is written
> back ONLY by the external executor, and the `executed` state is UNREACHABLE
> without it (a DB CHECK, not a convention).

---

## §0 — LOCKED INPUTS (do not re-open)

- **CONTEXT lock ⑦ — READ-ONLY-STRICT.** `agent_action` is a **proposal ledger**.
  Default state `proposed`. No execution wiring here. Re-tag live AIOS tasks
  `t1/t3/t4/t5` `humanGate:true` (frontend, `aios.ts`).
- **Single clock `as_of = 2026-06-22`.** `audit.event.occurred_at` is
  **server-stamped** from an injected `as_of` (the recompute/promotion functions
  take `p_as_of timestamptz`); no function reads the wall clock for an asserted
  value. (`recorded_at default now()` is allowed as a non-asserted write stamp,
  mirroring `mart.portfolio_summary.computed_at`.)
- **pglite HARD RULES.** No `pgcrypto`/`gen_random_uuid()` — UUIDs minted in
  seed/app code OR via the established core-PG idiom already used in
  `0002_mart.sql`: `md5(random()::text || clock_timestamp()::text)::uuid`. No
  `citext`. Migrations stay core-PG (`0003_aios.sql`); Supabase-faithful DDL
  (`auth.uid()`, real `REVOKE … FROM authenticated`, real policies) goes in
  `0003_aios.supabase.sql`, syntax-checked only.
- **Superuser bypasses RLS under pglite** (ADVERSARY G3). Tamper-evidence and
  checker≠maker MUST therefore be enforced by **CHECK constraints + triggers +
  REVOKE on a non-superuser app role**, NOT by RLS policy alone. The hash-chain
  and the `decided_by <> submitted_by` CHECK hold even for the superuser; the
  append-only REVOKE is proven on a dedicated non-superuser `app_writer` role.
- **Existing suites stay green.** `0003_aios.sql` is additive (new `mart.*` /
  `audit.*` objects). It MUST NOT alter `canonical.*` / existing `mart.*` or the
  existing seed rows. The harness applies it automatically (filename order →
  `0003_` after `0002_`).

---

## §1 — TREATMENT TABLE (one row per contested item)

| # | Item | Today (live) | **Treatment** | Rule |
|---|---|---|---|---|
| W1 | `agentActions[].status` is `done`/`needs_approval`; `done` means "already sent" | **frontend simulation asserts sends happened** | **6-state proposal ledger; default `proposed`; `executed` requires receipt** | New `mart.agent_action` (§2). State enum `proposed\|approved\|executing\|executed\|failed\|rejected`. CHECK: `state='executed'` ⇒ `delivery_receipt IS NOT NULL`; and (if `human_gated`) `approved_by IS NOT NULL`. Seed maps live `g1..g8` to `proposed` (NOT `executed`) — no live action has a real receipt. |
| W2 | No idempotency — a re-proposal would duplicate a send | absent | **`unique(idempotency_key)`** | `idempotency_key text not null unique`. Re-proposing the same logical action (same key) is a no-op upsert, never a second row → never a double send downstream. |
| W3 | No optimistic concurrency — two checkers could race a proposal | absent | **`lock_version` token** | `lock_version int not null default 0`. Every state transition function takes `p_expected_version`; bumps `lock_version` on success; raises on mismatch (stale write rejected). |
| W4 | "Maker-checker" claimed (promise 6) but **unenforced** | `reviewerId` hardcoded `m1`; no checker≠maker rule | **server-side `decided_by <> submitted_by` CHECK + `can_check` eligibility** | New `mart.design_approval` (§3). CHECK `decided_by IS NULL OR decided_by <> submitted_by`. Trigger: a non-null `decided_by` MUST reference a member with `can_check=true` AND same company. Founder-submitted items route to a *different* `can_check` member (see **NEEDS PRODUCT DECISION D1**). |
| W5 | No audit trail; `done` is unverifiable | absent | **append-only tamper-evident `audit.event` hash-chain** | New `audit.event` (§4). `prev_hash`/`row_hash`, `occurred_at` server-stamped from injected `as_of`, REVOKE update/delete from app roles, type union incl `sync\|match\|correction\|retraction\|dispatch_approved`, `supersedes_event_id` (corrections are NEW rows, never UPDATEs). |
| W6 | One audit row per state promotion, in-txn | absent | **promotion fn emits exactly one chained audit row in the SAME txn** | `mart.promote_agent_action(...)` inserts the audit row + flips the state atomically. If the audit insert fails, the promotion rolls back (and vice-versa). |
| W7 | Read layer shows "handled" for `status='done'` regardless of a real send | `dailyBrief().handled` filters `status==='done'` | **"handled" ONLY when `delivery_receipt IS NOT NULL`** | Serializer `serializeAiosActions` / `serializeDailyBrief` (§5) classify an action as `handled` strictly on `delivery_receipt IS NOT NULL` (equivalently `state='executed'`), NEVER on `delivery_receipt IS NULL`. A `proposed`/`approved` action is "pending", not "handled". |
| W8 | Live `t1/t3/t4/t5` are `humanGate:false` — auto-send framing | `aios.ts:38,40,41,42` | **re-tag `humanGate:true`** | Frontend one-line edits in `aios.ts`; the four auto-send coordination tasks now require a human gate. (Frontend concern — asserted by the frontend ledger note in §6, NOT by the pglite test.) |

---

## §2 — `mart.agent_action` (the proposal ledger)

```sql
-- state machine for a PROPOSED outbound action. This repo never executes.
do $$ begin
  create type agent_action_state as enum
    ('proposed','approved','executing','executed','failed','rejected');
exception when duplicate_object then null; end $$;

create table if not exists mart.agent_action (
  id                text primary key,                 -- minted in seed/app (live g1..g8)
  company_id        uuid not null,                    -- RLS key
  task_id           text not null,                    -- live auditTask id (t1..t10)
  project_id        text,                             -- nullable (live g4)
  state             agent_action_state not null default 'proposed',
  human_gated       boolean not null default true,    -- proposal requires approval to advance
  summary           text not null,
  detail            text,
  -- maker-checker linkage (the maker = who proposed; checker = who approved)
  proposed_by       text not null references canonical.member(id),
  approved_by       text references canonical.member(id),
  -- execution proof, written back ONLY by the external AIOS executor:
  delivery_receipt  text,                             -- NULL until a real send is confirmed
  idempotency_key   text not null,                    -- W2
  lock_version      int  not null default 0,          -- W3 optimistic concurrency
  proposed_at       timestamptz not null,             -- from injected as_of (seed)
  source_system     text not null default 'archintel-aios',
  -- W1: executed REQUIRES a receipt; human-gated executed REQUIRES an approver
  constraint agent_action_executed_needs_receipt
    check (state <> 'executed' or delivery_receipt is not null),
  constraint agent_action_gated_executed_needs_approver
    check (state <> 'executed' or human_gated = false or approved_by is not null),
  -- checker != maker at the row level too (a maker may not self-approve)
  constraint agent_action_checker_ne_maker
    check (approved_by is null or approved_by <> proposed_by),
  constraint agent_action_idem_uq unique (idempotency_key)
);
create index if not exists agent_action_company_state_ix
  on mart.agent_action (company_id, state);
```

**Default propose-only:** the column default is `'proposed'`; the seed inserts
all live `g1..g8` as `'proposed'` with `delivery_receipt = NULL`. There is **no
code path in this repo** that sets `state='executed'` — only the external
executor (a separate repo) may, and only by supplying `delivery_receipt`.

### Transition function (W3/W6 — builder implements)

```
mart.promote_agent_action(
  p_id text, p_to agent_action_state, p_actor text,
  p_expected_version int, p_as_of timestamptz,
  p_delivery_receipt text default null
) returns mart.agent_action
```

- Rejects on `lock_version <> p_expected_version` (stale write).
- `proposed → approved`: requires `p_actor` ≠ `proposed_by` and `p_actor`
  `can_check=true` (maker-checker at promotion); sets `approved_by = p_actor`.
- `* → executed`: requires `p_delivery_receipt` non-null (the CHECK also guards).
  **This function MUST NOT mint a receipt itself** — it only stores one passed
  in by the external executor.
- On every successful transition: bump `lock_version`, AND emit exactly **one**
  `audit.event` row in the same txn (W6) of type `dispatch_approved` (for
  `→approved`) / `decision` (other transitions), `supersedes_event_id = null`.

---

## §3 — `mart.design_approval` (maker-checker, server-enforced)

```sql
do $$ begin
  create type approval_decision as enum ('pending','approved','revise','rejected');
exception when duplicate_object then null; end $$;

create table if not exists mart.design_approval (
  id            text primary key,                     -- live ap1..ap6
  company_id    uuid not null,
  project_id    text not null references canonical.project(id),
  type          text,
  title         text not null,
  submitted_by  text not null references canonical.member(id),   -- the MAKER
  decided_by    text references canonical.member(id),            -- the CHECKER
  decision      approval_decision not null default 'pending',
  submitted_at  timestamptz not null,
  decided_at    timestamptz,
  version       text,
  phase         smallint,
  -- W4: a decision may NEVER be made by the submitter (checker != maker)
  constraint design_approval_checker_ne_maker
    check (decided_by is null or decided_by <> submitted_by),
  -- a decided row MUST carry a decider; a pending row MUST NOT
  constraint design_approval_decided_consistency
    check ((decision = 'pending') = (decided_by is null))
);
```

### Eligibility trigger (builder implements)

A `before insert or update` trigger on `mart.design_approval` raises when
`decided_by` is non-null AND the referenced member does **not** have
`can_check = true` (or belongs to a different company). This is the
**`can_check` eligibility** gate; the CHECK above is the **self-approval** gate.
Both are server-side and hold under the pglite superuser.

> **Live mapping:** `reviewerId` (always `m1`) → `decided_by` only for
> non-pending rows (ap3,ap4,ap6). Pending rows (ap1,ap2,ap5) seed with
> `decided_by = NULL`, `decision='pending'`. `submittedById` → `submitted_by`.
> ap6 (`submitted_by=m2`, `decided_by=m1`) is the natural checker≠maker pass.

---

## §4 — `audit.event` (append-only, tamper-evident hash-chain)

```sql
create schema if not exists audit;

do $$ begin
  create type audit_event_type as enum (
    'file','approval','submission','payment','phase','decision','member',
    'sync','match','correction','retraction','dispatch_approved'
  );
exception when duplicate_object then null; end $$;

create table if not exists audit.event (
  id                 text primary key,                -- minted
  company_id         uuid not null,
  type               audit_event_type not null,
  entity_ref         text not null,                   -- e.g. 'agent_action:g2'
  actor              text references canonical.member(id),
  payload            jsonb not null default '{}'::jsonb,
  occurred_at        timestamptz not null,            -- SERVER-stamped from injected as_of
  recorded_at        timestamptz not null default now(),  -- write stamp (not asserted)
  seq                bigint not null,                 -- per-company monotonic chain position
  prev_hash          text,                            -- row_hash of the previous chain row (NULL for genesis)
  row_hash           text not null,                   -- = sha-chain over (prev_hash || canonical payload)
  supersedes_event_id text references audit.event(id),-- corrections/retractions point back; never UPDATE
  constraint audit_event_company_seq_uq unique (company_id, seq)
);
```

### Hash-chain contract (builder implements via `mart.append_audit_event(...)`)

- `row_hash = md5(coalesce(prev_hash,'') || company_id || seq || type ||
  entity_ref || coalesce(actor,'') || payload::text || occurred_at::text)`
  (md5 is core-PG; a stronger digest may be substituted in the supabase variant).
- `prev_hash` = the `row_hash` of the row at `seq-1` for the same company
  (NULL at `seq=1`, the genesis row).
- **APPEND-ONLY:** a `before update or delete` trigger on `audit.event` RAISES
  unconditionally (tamper attempt → error), AND the supabase variant REVOKEs
  `UPDATE, DELETE` from `authenticated`/`app_writer`. Corrections are **new
  rows** with `type='correction'` (or `retraction`) and
  `supersedes_event_id = <the row being corrected>` — the original row is never
  mutated.
- **Tamper-evidence verifier** `mart.verify_audit_chain(p_company uuid)
  returns boolean`: walks the company's rows in `seq` order, recomputes each
  `row_hash`, and returns FALSE if any stored `row_hash` ≠ recomputed, or any
  `prev_hash` ≠ the prior row's `row_hash`. (This is how the RED ledger detects
  a hand-edited payload even though the superuser could write it.)

---

## §5 — Serializer surface (`backend/semantic/serialize_aios.mjs` — builder adds)

Mirrors `serialize.mjs`. Pure JS, takes raw rows + principal.

- `serializeAiosActions(rows, principal)` → array; each item:
  `{ id, projectId, taskId, summary, detail, state, handled, at }` where
  **`handled === (row.delivery_receipt != null)`** (W7). NEVER `true` for a
  `delivery_receipt IS NULL` row. Preserve the `aios-actions` query-key shape.
- `serializeDailyBrief(rows, principal)` → `{ date, summary, needsYou[], handled[] }`
  where `handled[]` is built **only** from rows with `delivery_receipt != null`.
  A `proposed`/`needs_approval` row appears in `needsYou`, never `handled`.

> **Integration / render sites (builder re-threads, preserving query keys):**
> `app/src/lib/archintel/aios.ts` `useAgentActions` (`aios-actions`) and
> `useDailyBrief` (`aios-brief`) call the serializer when `USE_BACKEND_AIOS` is
> on; `dailyBrief().handled` filter changes from `status==='done'` to the
> receipt rule. The frontend `AgentAction.status` derives from `state`
> (`executed`→done, else `needs_approval`). **`aios.ts` t1/t3/t4/t5 →
> `humanGate:true`** (W8).

---

## §6 — ACCEPTANCE LEDGER (what `aios-write-discipline.design.test.mjs` asserts)

All RED today (objects absent). Each cites the finding it closes.

| Test | Asserts | Closes |
|---|---|---|
| `(mc-1) checker=maker REJECTED` | inserting/deciding a `design_approval` with `decided_by = submitted_by` RAISES (CHECK); ap6 (`m2`/`m1`) inserts fine | F1 / mc-1 |
| `(mc-2) ineligible checker REJECTED` | deciding with a `decided_by` whose `can_check=false` RAISES (trigger) | mc-2 |
| `(w-1) executed-without-receipt REJECTED` | updating an `agent_action` to `state='executed'` with `delivery_receipt IS NULL` RAISES (CHECK) | F1 / pw-1 |
| `(w-2) seeded propose-only` | every seeded `agent_action` (g1..g8) has `state='proposed'` and `delivery_receipt IS NULL` — none `executed` | F1 |
| `(w-3) idempotency_key unique` | inserting a 2nd `agent_action` with an existing `idempotency_key` RAISES (unique) | C5 / pw-1 |
| `(au-1) hash-chain tamper DETECTED` | after appending ≥2 chained events, hand-mutating one row's `payload` makes `mart.verify_audit_chain(company)` return FALSE; an untouched chain returns TRUE | F1 / sr-1 |
| `(au-2) append-only` | `update`/`delete` on `audit.event` RAISES (trigger), proving corrections must be new rows | sr-1 |
| `(au-3) one audit row per promotion in-txn` | `mart.promote_agent_action(...)` from `proposed→approved` inserts EXACTLY one `audit.event` row for that entity in the same txn; a forced rollback leaves zero | F1 / mc-* |
| `(w-4) handled iff receipt` | `serializeAiosActions` marks `handled=true` ONLY for rows with a `delivery_receipt`; a `proposed` row is `handled=false` | F1 / W7 |

> **Frontend note (NOT in the pglite test):** `aios.ts` t1/t3/t4/t5
> `humanGate:true` (W8) is a one-line source edit verified by reading the
> diff / a follow-up frontend ledger; it is out of scope for the pglite runtime
> and is therefore asserted by inspection, not by this `.mjs` suite.

---

## §7 — NEEDS PRODUCT DECISION

- **D1 — Founder self-approval / sole-checker bootstrap.** In the live seed
  **only `m1` (founder, Raiana) has `can_check=true`.** The scope says
  "founder-submitted items route to a `can_check` member" — but if the founder
  is the *only* eligible checker, a founder-submitted action has **no eligible
  checker** and would be permanently blocked (the `decided_by <> submitted_by`
  CHECK forbids self-approval). Options:
  - **(a) [recommended] Grant a second `can_check` member** — set `can_check=true`
    on the `finance` or a `principal` member (CONTEXT says "founder|finance
    true"; the seed currently has no `finance`-role member, so promote `m2`
    Fariha/principal as co-checker). Founder-submitted items route to that
    member; every action always has an eligible non-self checker.
  - **(b) Allow founder self-approval with a logged exception** — relax the CHECK
    to permit `decided_by = submitted_by` when the submitter is the sole
    `can_check` member, recording a `correction`/exception audit event. Weakens
    promise 6; not recommended.
  - **(c) Block founder-submitted dispatch entirely** until a 2nd checker exists
    (hard gate). Safest, most restrictive.
- **D2 — `delivery_receipt` ownership boundary.** This repo never writes a
  receipt. Confirm the external AIOS executor writes `delivery_receipt` +
  flips `state='executed'` via a dedicated narrow grant (its own DB role), and
  that THIS repo's `app_writer` role is REVOKEd from setting `state='executed'`
  (only `proposed/approved/rejected` reachable here). Default assumed: yes.
- **D3 — Hash digest strength.** pglite path uses `md5` (core-PG, no pgcrypto).
  Confirm the Supabase variant upgrades to `sha256` via `digest()` (pgcrypto is
  available on Supabase). Tamper-evidence semantics are identical; only collision
  resistance differs. Default assumed: md5 local / sha256 prod.
- **D4 — `executing`/`failed` transitions ownership.** `executing` and `failed`
  are states the **external executor** drives (it picks up an `approved` action,
  marks `executing`, then `executed`+receipt or `failed`). Confirm this repo's
  `promote_agent_action` only drives `proposed→approved` and `→rejected`, and
  leaves `executing/executed/failed` to the executor's role. Default assumed: yes.
```
