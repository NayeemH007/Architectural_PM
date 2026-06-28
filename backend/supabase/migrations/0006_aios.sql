-- ============================================================
-- 0006_aios.supabase.sql — Supabase-FAITHFUL variant (SYNTAX-ONLY).
--
-- The harness NEVER applies this under pglite. Differences vs the pglite path:
--   * hash digest upgrades md5 -> sha256 via pgcrypto digest() (D3).
--   * company_id comes from the verified JWT (auth.jwt() ->> 'company_id'),
--     not request.* GUCs.
--   * the non-superuser principal is the built-in `authenticated` role; the
--     append-only REVOKE is real (UPDATE/DELETE on audit.event revoked).
-- Semantics (proposal-only, checker != maker, append-only, tamper-evidence)
-- are identical.
-- ============================================================

create extension if not exists pgcrypto;
create schema if not exists audit;

-- ---- §2 mart.agent_action ----
do $$ begin
  create type agent_action_state as enum
    ('proposed','approved','executing','executed','failed','rejected');
exception when duplicate_object then null; end $$;

create table if not exists mart.agent_action (
  id                text primary key,
  company_id        uuid not null,
  task_id           text not null,
  project_id        text,
  state             agent_action_state not null default 'proposed',
  human_gated       boolean not null default true,
  summary           text not null,
  detail            text,
  proposed_by       text not null references canonical.member(id),
  approved_by       text references canonical.member(id),
  delivery_receipt  text,
  idempotency_key   text not null,
  lock_version      int  not null default 0,
  proposed_at       timestamptz not null,
  source_system     text not null default 'archintel-aios',
  constraint agent_action_executed_needs_receipt
    check (state <> 'executed' or delivery_receipt is not null),
  constraint agent_action_gated_executed_needs_approver
    check (state <> 'executed' or human_gated = false or approved_by is not null),
  constraint agent_action_checker_ne_maker
    check (approved_by is null or approved_by <> proposed_by),
  constraint agent_action_idem_uq unique (idempotency_key)
);
create index if not exists agent_action_company_state_ix
  on mart.agent_action (company_id, state);

-- ---- §3 mart.design_approval ----
do $$ begin
  create type approval_decision as enum ('pending','approved','revise','rejected');
exception when duplicate_object then null; end $$;

create table if not exists mart.design_approval (
  id            text primary key,
  company_id    uuid not null,
  project_id    text not null references canonical.project(id),
  type          text,
  title         text not null,
  submitted_by  text not null references canonical.member(id),
  decided_by    text references canonical.member(id),
  decision      approval_decision not null default 'pending',
  submitted_at  timestamptz not null,
  decided_at    timestamptz,
  version       text,
  phase         smallint,
  constraint design_approval_checker_ne_maker
    check (decided_by is null or decided_by <> submitted_by),
  constraint design_approval_decided_consistency
    check ((decision = 'pending') = (decided_by is null))
);

create or replace function mart.design_approval_eligibility()
returns trigger language plpgsql as $$
declare v_ok boolean;
begin
  if new.decided_by is not null then
    select (m.can_check and m.company_id = new.company_id) into v_ok
      from canonical.member m where m.id = new.decided_by;
    if v_ok is distinct from true then
      raise exception 'checker % is not an eligible can_check decider (eligibility)', new.decided_by
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists design_approval_eligibility_trg on mart.design_approval;
create trigger design_approval_eligibility_trg
  before insert or update on mart.design_approval
  for each row execute function mart.design_approval_eligibility();

-- ---- §4 audit.event (sha256 chain) ----
do $$ begin
  create type audit_event_type as enum (
    'file','approval','submission','payment','phase','decision','member',
    'sync','match','correction','retraction','dispatch_approved'
  );
exception when duplicate_object then null; end $$;

create table if not exists audit.event (
  id                  text primary key,
  company_id          uuid not null,
  type                audit_event_type not null,
  entity_ref          text not null,
  actor               text references canonical.member(id),
  payload             jsonb not null default '{}'::jsonb,
  occurred_at         timestamptz not null,
  recorded_at         timestamptz not null default now(),
  seq                 bigint not null,
  prev_hash           text,
  row_hash            text not null,
  supersedes_event_id text references audit.event(id),
  constraint audit_event_company_seq_uq unique (company_id, seq)
);

-- sha256 digest (pgcrypto) — stronger collision resistance than the pglite md5.
create or replace function mart.audit_row_hash(
  p_prev_hash text, p_company uuid, p_seq bigint, p_type text,
  p_entity_ref text, p_actor text, p_payload jsonb, p_occurred_at timestamptz
) returns text language sql immutable as $$
  select encode(digest(
    coalesce(p_prev_hash,'') || p_company::text || p_seq::text || p_type ||
    p_entity_ref || coalesce(p_actor,'') || p_payload::text || p_occurred_at::text,
    'sha256'), 'hex');
$$;

create or replace function mart.audit_append_only()
returns trigger language plpgsql as $$
begin
  raise exception 'audit.event is append-only (immutable); % rejected', tg_op
    using errcode = 'raise_exception';
  return null;
end; $$;
drop trigger if exists audit_event_append_only_trg on audit.event;
create trigger audit_event_append_only_trg
  before update or delete on audit.event
  for each row execute function mart.audit_append_only();

-- real REVOKE on the built-in non-superuser role.
revoke update, delete on audit.event from authenticated;

create or replace function mart.append_audit_event(
  p_id text, p_company uuid, p_type text, p_entity_ref text, p_actor text,
  p_payload jsonb, p_as_of timestamptz, p_supersedes text default null
) returns audit.event language plpgsql as $$
declare v_seq bigint; v_prev text; v_hash text; v_row audit.event;
begin
  select coalesce(max(seq),0)+1 into v_seq from audit.event where company_id = p_company;
  if v_seq > 1 then
    select row_hash into v_prev from audit.event where company_id = p_company and seq = v_seq-1;
  else v_prev := null; end if;
  v_hash := mart.audit_row_hash(v_prev, p_company, v_seq, p_type, p_entity_ref,
    p_actor, coalesce(p_payload,'{}'::jsonb), p_as_of);
  insert into audit.event
    (id, company_id, type, entity_ref, actor, payload, occurred_at, seq, prev_hash, row_hash, supersedes_event_id)
  values (p_id, p_company, p_type::audit_event_type, p_entity_ref, p_actor,
    coalesce(p_payload,'{}'::jsonb), p_as_of, v_seq, v_prev, v_hash, p_supersedes)
  returning * into v_row;
  return v_row;
end; $$;

create or replace function mart.verify_audit_chain(p_company uuid)
returns boolean language plpgsql stable as $$
declare r record; v_prev text := null; v_first boolean := true; v_recomp text;
begin
  for r in select * from audit.event where company_id = p_company order by seq asc loop
    if v_first then
      if r.prev_hash is not null then return false; end if;
    else
      if r.prev_hash is distinct from v_prev then return false; end if;
    end if;
    v_recomp := mart.audit_row_hash(r.prev_hash, r.company_id, r.seq, r.type::text,
      r.entity_ref, r.actor, r.payload, r.occurred_at);
    if r.row_hash is distinct from v_recomp then return false; end if;
    v_prev := r.row_hash; v_first := false;
  end loop;
  return true;
end; $$;

create or replace function mart.promote_agent_action(
  p_id text, p_to agent_action_state, p_actor text, p_expected_version int,
  p_as_of timestamptz, p_delivery_receipt text default null
) returns mart.agent_action language plpgsql as $$
declare v_act mart.agent_action; v_can boolean; v_evt text;
begin
  select * into v_act from mart.agent_action where id = p_id for update;
  if not found then raise exception 'agent_action % not found', p_id using errcode='no_data_found'; end if;
  if v_act.lock_version <> p_expected_version then
    raise exception 'stale write on agent_action %', p_id using errcode='serialization_failure'; end if;
  if v_act.state <> 'proposed' then
    raise exception 'promote only advances a proposed action' using errcode='check_violation'; end if;
  if p_to not in ('approved','rejected') then
    raise exception 'promote may only drive proposed->approved/rejected (executor owns executed)' using errcode='check_violation'; end if;
  if p_actor = v_act.proposed_by then
    raise exception 'checker != maker' using errcode='check_violation'; end if;
  select (m.can_check and m.company_id = v_act.company_id) into v_can
    from canonical.member m where m.id = p_actor;
  if v_can is distinct from true then
    raise exception 'actor % not an eligible can_check checker', p_actor using errcode='check_violation'; end if;
  update mart.agent_action
     set state = p_to,
         approved_by = case when p_to='approved' then p_actor else approved_by end,
         lock_version = lock_version + 1
   where id = p_id returning * into v_act;
  v_evt := 'evt_' || encode(digest(random()::text || clock_timestamp()::text, 'sha256'), 'hex');
  perform mart.append_audit_event(v_evt, v_act.company_id,
    case when p_to='approved' then 'dispatch_approved' else 'decision' end,
    'agent_action:' || p_id, p_actor,
    jsonb_build_object('from','proposed','to',p_to::text,'lock_version',v_act.lock_version),
    p_as_of, null);
  return v_act;
end; $$;

-- ---- grants + RLS (JWT-scoped) ----
grant usage  on schema mart  to authenticated;
grant usage  on schema audit to authenticated;
grant select on mart.agent_action    to authenticated;
grant select on mart.design_approval to authenticated;
grant select on audit.event          to authenticated;
grant execute on function mart.promote_agent_action(text, agent_action_state, text, int, timestamptz, text) to authenticated;
grant execute on function mart.verify_audit_chain(uuid) to authenticated;

alter table mart.agent_action    enable row level security;
alter table mart.agent_action    force  row level security;
alter table mart.design_approval enable row level security;
alter table mart.design_approval force  row level security;
alter table audit.event          enable row level security;
alter table audit.event          force  row level security;

create policy agent_action_company_isolation on mart.agent_action
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy design_approval_company_isolation on mart.design_approval
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy audit_event_company_isolation on audit.event
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
