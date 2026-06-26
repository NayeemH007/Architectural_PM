-- ============================================================
-- 0006_aios.sql — AIOS write-discipline (S4 / Critical F1).
--
-- The proposal ledger + maker-checker + append-only tamper-evident audit.
-- This repo holds NO write credential: agent_action is a PROPOSAL ledger
-- (default 'proposed'); 'executed' is UNREACHABLE without a delivery_receipt
-- (a DB CHECK), which only the EXTERNAL AIOS executor supplies. Maker-checker
-- (checker != maker + can_check eligibility) and the hash-chain are enforced by
-- CHECK constraints + triggers + REVOKE on a non-superuser role — NOT by RLS
-- alone (pglite's bootstrap superuser bypasses RLS; ADVERSARY G3).
--
-- pglite HARD RULES honoured:
--   * core-PG only; NO pgcrypto / gen_random_uuid (ids minted in seed/app;
--     hash = md5(...), core-PG — the .supabase.sql variant upgrades to sha256).
--   * NO citext.
--   * IDEMPOTENT: "create … if not exists" + DO-block enum/policy guards +
--     "create or replace" functions, so the harness can re-apply harmlessly.
--
-- CRITICAL (BUILD-ROADMAP §1): this adds NEW mart.* / audit.* tables. 0004's
-- grants only covered tables that existed THEN, so we RE-ISSUE app_user grants
-- + ENABLE/FORCE RLS + the company_id policy on every new table here, so the
-- non-superuser role reads them AND RLS enforces.
--
-- Migration numbering: 0006 (S4), per the collision-resolved BUILD-ROADMAP §1
-- (the contract text predates the renumber and still says "0003_aios").
-- ============================================================

create schema if not exists audit;

-- ─────────────────────────────────────────────────────────────
-- app_writer — a SECOND non-superuser role, the boundary on which the
-- append-only REVOKE is proven. The external AIOS executor would own a
-- narrower role still; app_writer models "this repo's writer" and is REVOKEd
-- from UPDATE/DELETE on audit.event and from setting state='executed'.
-- (pglite superuser bypasses grants, so the append-only TRIGGER is the
-- load-bearing enforcement under the test's superuser; the REVOKE is the
-- Supabase-faithful belt-and-suspenders.)
-- ─────────────────────────────────────────────────────────────
do $$ begin
  create role app_writer nologin;
exception when duplicate_object then null; end $$;

-- ============================================================
-- §2 — mart.agent_action (the PROPOSAL ledger).
-- ============================================================
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
  -- maker-checker linkage (maker = who proposed; checker = who approved)
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

-- ============================================================
-- §3 — mart.design_approval (maker-checker, server-enforced).
-- ============================================================
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
create index if not exists design_approval_company_ix
  on mart.design_approval (company_id);

-- Eligibility trigger: a non-null decided_by MUST reference a member with
-- can_check=true AND the same company. This is the can_check eligibility gate
-- (the CHECK above is the self-approval gate). Holds under the pglite superuser.
create or replace function mart.design_approval_eligibility()
returns trigger
language plpgsql
as $$
declare
  v_ok boolean;
begin
  if new.decided_by is not null then
    select (m.can_check and m.company_id = new.company_id)
      into v_ok
      from canonical.member m
     where m.id = new.decided_by;
    if v_ok is distinct from true then
      raise exception
        'checker % is not an eligible can_check decider for company % (eligibility)',
        new.decided_by, new.company_id
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists design_approval_eligibility_trg on mart.design_approval;
create trigger design_approval_eligibility_trg
  before insert or update on mart.design_approval
  for each row execute function mart.design_approval_eligibility();

-- ============================================================
-- §4 — audit.event (append-only, tamper-evident hash-chain).
-- ============================================================
do $$ begin
  create type audit_event_type as enum (
    'file','approval','submission','payment','phase','decision','member',
    'sync','match','correction','retraction','dispatch_approved'
  );
exception when duplicate_object then null; end $$;

create table if not exists audit.event (
  id                  text primary key,                -- minted
  company_id          uuid not null,
  type                audit_event_type not null,
  entity_ref          text not null,                   -- e.g. 'agent_action:g2'
  actor               text references canonical.member(id),
  payload             jsonb not null default '{}'::jsonb,
  occurred_at         timestamptz not null,            -- SERVER-stamped from injected as_of
  recorded_at         timestamptz not null default now(),  -- write stamp (not asserted)
  seq                 bigint not null,                 -- per-company monotonic chain position
  prev_hash           text,                            -- row_hash of the previous chain row (NULL for genesis)
  row_hash            text not null,                   -- chain hash over (prev_hash || canonical payload)
  supersedes_event_id text references audit.event(id), -- corrections/retractions point back; never UPDATE
  constraint audit_event_company_seq_uq unique (company_id, seq)
);
create index if not exists audit_event_entity_ix on audit.event (entity_ref);
create index if not exists audit_event_company_seq_ix on audit.event (company_id, seq);

-- ---- canonical row-hash (md5 core-PG; sha256 in the .supabase variant) ----
create or replace function mart.audit_row_hash(
  p_prev_hash  text,
  p_company    uuid,
  p_seq        bigint,
  p_type       text,
  p_entity_ref text,
  p_actor      text,
  p_payload    jsonb,
  p_occurred_at timestamptz
)
returns text
language sql
immutable
as $$
  select md5(
    coalesce(p_prev_hash, '') ||
    p_company::text || p_seq::text || p_type ||
    p_entity_ref || coalesce(p_actor, '') ||
    p_payload::text || p_occurred_at::text
  );
$$;

-- ---- append-only enforcement: UPDATE/DELETE always RAISE ----
create or replace function mart.audit_append_only()
returns trigger
language plpgsql
as $$
begin
  raise exception 'audit.event is append-only (immutable); % rejected — corrections are new rows', tg_op
    using errcode = 'raise_exception';
  return null;
end;
$$;

drop trigger if exists audit_event_append_only_trg on audit.event;
create trigger audit_event_append_only_trg
  before update or delete on audit.event
  for each row execute function mart.audit_append_only();

-- REVOKE the destructive grants from app roles (Supabase belt; superuser bypasses
-- under pglite — the trigger above is the enforcement there).
revoke update, delete on audit.event from app_user;
revoke update, delete on audit.event from app_writer;

-- ============================================================
-- mart.append_audit_event(...) — append ONE chained row for a company.
--   Mints seq = (max seq for company)+1, prev_hash = prior row's row_hash,
--   row_hash = audit_row_hash(...). occurred_at is SERVER-stamped from the
--   injected p_as_of. Returns the inserted audit.event row.
-- ============================================================
create or replace function mart.append_audit_event(
  p_id         text,
  p_company    uuid,
  p_type       text,
  p_entity_ref text,
  p_actor      text,
  p_payload    jsonb,
  p_as_of      timestamptz,
  p_supersedes text default null
)
returns audit.event
language plpgsql
as $$
declare
  v_seq  bigint;
  v_prev text;
  v_hash text;
  v_row  audit.event;
begin
  select coalesce(max(seq), 0) + 1 into v_seq
    from audit.event where company_id = p_company;

  if v_seq > 1 then
    select row_hash into v_prev
      from audit.event
     where company_id = p_company and seq = v_seq - 1;
  else
    v_prev := null;  -- genesis
  end if;

  v_hash := mart.audit_row_hash(
    v_prev, p_company, v_seq, p_type, p_entity_ref, p_actor,
    coalesce(p_payload, '{}'::jsonb), p_as_of
  );

  insert into audit.event
    (id, company_id, type, entity_ref, actor, payload, occurred_at,
     seq, prev_hash, row_hash, supersedes_event_id)
  values
    (p_id, p_company, p_type::audit_event_type, p_entity_ref, p_actor,
     coalesce(p_payload, '{}'::jsonb), p_as_of,
     v_seq, v_prev, v_hash, p_supersedes)
  returning * into v_row;

  return v_row;
end;
$$;

-- ============================================================
-- mart.verify_audit_chain(p_company) -> boolean
--   Walks the company's rows in seq order, recomputes each row_hash, and returns
--   FALSE if any stored row_hash <> recomputed OR any prev_hash <> the prior
--   row's row_hash. Detects an after-the-fact payload edit even when the
--   superuser could write it (tamper-EVIDENCE).
-- ============================================================
create or replace function mart.verify_audit_chain(p_company uuid)
returns boolean
language plpgsql
stable
as $$
declare
  r        record;
  v_prev   text := null;
  v_first  boolean := true;
  v_recomp text;
begin
  for r in
    select * from audit.event
     where company_id = p_company
     order by seq asc
  loop
    -- prev_hash must link to the prior row's row_hash (NULL at genesis).
    if v_first then
      if r.prev_hash is not null then
        return false;
      end if;
    else
      if r.prev_hash is distinct from v_prev then
        return false;
      end if;
    end if;

    -- recompute the stored hash from the row's own fields.
    v_recomp := mart.audit_row_hash(
      r.prev_hash, r.company_id, r.seq, r.type::text, r.entity_ref,
      r.actor, r.payload, r.occurred_at
    );
    if r.row_hash is distinct from v_recomp then
      return false;
    end if;

    v_prev  := r.row_hash;
    v_first := false;
  end loop;

  return true;
end;
$$;

-- ============================================================
-- §2 transition fn — mart.promote_agent_action(...).
--   Drives ONLY proposed -> approved / rejected (PD-D: executing/executed/failed
--   + delivery_receipt belong to the EXTERNAL executor). On success: bumps
--   lock_version AND emits EXACTLY ONE chained audit.event in the SAME txn (W6).
--   Maker-checker at promotion: actor != proposed_by AND actor.can_check=true.
-- ============================================================
create or replace function mart.promote_agent_action(
  p_id               text,
  p_to               agent_action_state,
  p_actor            text,
  p_expected_version int,
  p_as_of            timestamptz,
  p_delivery_receipt text default null
)
returns mart.agent_action
language plpgsql
as $$
declare
  v_act   mart.agent_action;
  v_can   boolean;
  v_evt   text;
begin
  select * into v_act from mart.agent_action where id = p_id for update;
  if not found then
    raise exception 'agent_action % not found', p_id using errcode = 'no_data_found';
  end if;

  -- W3: optimistic concurrency — reject a stale write.
  if v_act.lock_version <> p_expected_version then
    raise exception 'stale write on agent_action % (expected version %, found %)',
      p_id, p_expected_version, v_act.lock_version using errcode = 'serialization_failure';
  end if;

  -- PD-D: this repo only drives proposed -> approved / rejected. executing /
  -- executed / failed belong to the external executor's role.
  if v_act.state <> 'proposed' then
    raise exception 'promote_agent_action only advances a proposed action (% is %)',
      p_id, v_act.state using errcode = 'check_violation';
  end if;
  if p_to not in ('approved','rejected') then
    raise exception
      'promote_agent_action may only drive proposed->approved/rejected (not %); executing/executed/failed are owned by the external executor',
      p_to using errcode = 'check_violation';
  end if;

  -- Maker-checker at promotion: a checker may not be the maker, and must be
  -- can_check eligible in the same company.
  if p_actor = v_act.proposed_by then
    raise exception 'checker (%) may not be the maker on agent_action % (checker != maker)',
      p_actor, p_id using errcode = 'check_violation';
  end if;
  select (m.can_check and m.company_id = v_act.company_id)
    into v_can from canonical.member m where m.id = p_actor;
  if v_can is distinct from true then
    raise exception 'actor % is not an eligible can_check checker for agent_action %',
      p_actor, p_id using errcode = 'check_violation';
  end if;

  -- apply the transition + bump the concurrency token.
  update mart.agent_action
     set state        = p_to,
         approved_by  = case when p_to = 'approved' then p_actor else approved_by end,
         lock_version = lock_version + 1
   where id = p_id
   returning * into v_act;

  -- W6: emit EXACTLY ONE chained audit row, atomically with the flip.
  v_evt := 'evt_' || md5(random()::text || clock_timestamp()::text);
  perform mart.append_audit_event(
    v_evt,
    v_act.company_id,
    case when p_to = 'approved' then 'dispatch_approved' else 'decision' end,
    'agent_action:' || p_id,
    p_actor,
    jsonb_build_object('from', 'proposed', 'to', p_to::text, 'lock_version', v_act.lock_version),
    p_as_of,
    null
  );

  return v_act;
end;
$$;

-- ============================================================
-- RE-ISSUE app_user / app_writer access + RLS on the NEW tables.
--   0004's "grant … on all tables" snapshot predates these tables.
-- ============================================================
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'app_user') then
    grant usage  on schema mart  to app_user;
    grant usage  on schema audit to app_user;
    grant select on mart.agent_action   to app_user;
    grant select on mart.design_approval to app_user;
    grant select on audit.event          to app_user;
    grant execute on function mart.promote_agent_action(text, agent_action_state, text, int, timestamptz, text) to app_user;
    grant execute on function mart.append_audit_event(text, uuid, text, text, text, jsonb, timestamptz, text) to app_user;
    grant execute on function mart.verify_audit_chain(uuid) to app_user;
  end if;
end $$;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'app_writer') then
    grant usage  on schema mart  to app_writer;
    grant usage  on schema audit to app_writer;
    grant select, insert on mart.agent_action   to app_writer;
    grant select, insert, update on mart.design_approval to app_writer;
    -- app_writer may APPEND audit rows but NOT update/delete (revoked above).
    grant select, insert on audit.event to app_writer;
  end if;
end $$;

-- ---- RLS: enable + force + company_id policy on each new table ----
alter table mart.agent_action    enable row level security;
alter table mart.agent_action    force  row level security;
alter table mart.design_approval enable row level security;
alter table mart.design_approval force  row level security;
alter table audit.event          enable row level security;
alter table audit.event          force  row level security;

do $$ begin
  create policy agent_action_company_isolation on mart.agent_action
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy design_approval_company_isolation on mart.design_approval
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy audit_event_company_isolation on audit.event
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
