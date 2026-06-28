-- ============================================================
-- 0007_ingestion.supabase.sql — Supabase-FAITHFUL variant of the etl ingestion /
-- reconciliation / corrections layer (S5). SYNTAX-AUTHORED ONLY (never run under
-- pglite; pglite uses 0007_ingestion.sql).
--
-- Differences from the pglite path:
--   * uuid PKs DEFAULT gen_random_uuid() (pgcrypto present on Supabase) instead of
--     being minted in code / via md5(random()||clock_timestamp())::uuid.
--   * content_hash uses sha256 (PD-I: md5 on pglite, sha256 on Supabase) via
--     encode(digest(...,'sha256'),'hex'); md5() on the pglite path.
--   * RLS policies key off the JWT claim auth.jwt() ->> 'company_id' (not
--     current_setting('request.company_id')).
--   * The etl functions STILL scope reads/writes EXPLICITLY by company_id
--     (defense in depth), resolving the company from the JWT claim.
--   * etl.connector.mode CHECK = 'read_only' is identical (read-only-first).
-- The table + result shapes are identical to the pglite path.
-- ============================================================

create extension if not exists pgcrypto;
create schema if not exists etl;

create table if not exists etl.connector (
  id                 uuid primary key default gen_random_uuid(),
  company_id         uuid not null,
  source_system      text not null,
  mode               text not null default 'read_only' check (mode = 'read_only'),
  connector_last_run timestamptz,
  unique (company_id, source_system)
);

create table if not exists etl.ingest_event (
  id                  uuid primary key default gen_random_uuid(),
  company_id          uuid not null,
  connector_id        uuid not null references etl.connector(id),
  source_system       text not null,
  source_record_ref   text,
  event_type          text not null check (event_type in ('sync','correction','retraction')),
  supersedes_event_id uuid references etl.ingest_event(id),
  retracted           boolean not null default false,
  target_kind         text not null,
  target_ref          text,
  payload             jsonb not null,
  content_hash        text not null,
  data_observed_at    timestamptz not null,
  ingested_at         timestamptz not null,
  superseded          boolean not null default false
);
create unique index if not exists ingest_event_idem_ux
  on etl.ingest_event (company_id, source_system, source_record_ref)
  where source_record_ref is not null
    and event_type = 'sync' and superseded = false and retracted = false;

create table if not exists etl.payment_receipt (
  id                   uuid primary key default gen_random_uuid(),
  company_id           uuid not null,
  project_id           text not null,
  amount               numeric(14,2) not null,
  received_at          date not null,
  source_system        text not null,
  source_record_ref    text,
  matched_milestone_id text,
  match_state          text not null default 'unmatched'
                         check (match_state in ('unmatched','matched','review')),
  data_observed_at     timestamptz not null
);

create table if not exists etl.alias (
  id             uuid primary key default gen_random_uuid(),
  company_id     uuid not null,
  source_system  text not null,
  entity_kind    text not null,
  external_label text not null,
  canonical_id   text not null
);
create unique index if not exists alias_label_lower_ux
  on etl.alias (company_id, source_system, entity_kind, lower(external_label));

create table if not exists etl.needs_review (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  reason        text not null
                  check (reason in ('absent_ref','ambiguous_ref','ambiguous_match',
                                    'alias_conflict','unknown_alias','duplicate_same_amount')),
  source_system text not null,
  source_record_ref text,
  payload       jsonb not null,
  state         text not null default 'open' check (state in ('open','accepted','rejected')),
  created_observed_at timestamptz not null
);

-- ── functions (company resolved from the JWT claim; sha256 content hash) ──
create or replace function etl._company() returns uuid
language sql stable as $$
  select nullif(auth.jwt() ->> 'company_id', '')::uuid
$$;

create or replace function etl._content_hash(p jsonb) returns text
language sql immutable as $$
  select encode(digest(
    coalesce(p->>'gross_amount','')   || '|' ||
    coalesce(p->>'received_amount','')|| '|' ||
    coalesce(p->>'status','')         || '|' ||
    coalesce(p->>'due_date','')
  , 'sha256'), 'hex')
$$;

create or replace function etl._ensure_connector(p_company uuid, p_source text, p_last_run timestamptz)
returns uuid language plpgsql volatile as $$
declare v_id uuid;
begin
  select id into v_id from etl.connector where company_id = p_company and source_system = p_source;
  if v_id is null then
    insert into etl.connector (company_id, source_system, mode, connector_last_run)
    values (p_company, p_source, 'read_only', p_last_run) returning id into v_id;
  else
    update etl.connector
       set connector_last_run = greatest(coalesce(connector_last_run, p_last_run), p_last_run)
     where id = v_id;
  end if;
  return v_id;
end; $$;

create or replace function etl._project_milestone(p_company uuid, p_target_ref text)
returns void language plpgsql volatile as $$
declare v_payload jsonb; v_observed timestamptz;
begin
  select payload, data_observed_at into v_payload, v_observed
    from etl.ingest_event
   where company_id = p_company and target_kind = 'payment_milestone'
     and target_ref = p_target_ref and superseded = false and retracted = false
   order by data_observed_at desc, ingested_at desc limit 1;
  if v_payload is null then
    update canonical.payment_milestone set received_amount = 0
     where company_id = p_company and id = p_target_ref;
    return;
  end if;
  update canonical.payment_milestone
     set received_amount = coalesce((v_payload->>'received_amount')::numeric, received_amount),
         gross_amount    = coalesce((v_payload->>'gross_amount')::numeric, gross_amount),
         status          = coalesce((v_payload->>'status')::payment_status_a, status),
         observed_at     = coalesce(v_observed, observed_at)
   where company_id = p_company and id = p_target_ref;
end; $$;

create or replace function etl.ingest(p_event jsonb)
returns jsonb language plpgsql volatile as $$
declare
  v_company uuid := etl._company();
  v_source text := p_event->>'source_system';
  v_ref text := nullif(trim(coalesce(p_event->>'source_record_ref','')), '');
  v_kind text := coalesce(p_event->>'target_kind', 'payment_milestone');
  v_target text := p_event->>'target_ref';
  v_evtype text := coalesce(p_event->>'event_type', 'sync');
  v_observed timestamptz := (p_event->>'data_observed_at')::timestamptz;
  v_ingested timestamptz := (p_event->>'ingested_at')::timestamptz;
  v_hash text := etl._content_hash(p_event);
  v_conn uuid; v_live_id uuid; v_live_hash text; v_new_id uuid;
begin
  if v_company is null then raise exception 'etl.ingest: no company claim'; end if;
  if v_observed is null then raise exception 'etl.ingest: data_observed_at required'; end if;
  v_ingested := coalesce(v_ingested, v_observed);

  if v_ref is null then
    insert into etl.needs_review (company_id, reason, source_system, source_record_ref, payload, created_observed_at)
    values (v_company, 'absent_ref', v_source, null, p_event, v_observed);
    return jsonb_build_object('routed_to_review', true, 'reason', 'absent_ref');
  end if;

  v_conn := etl._ensure_connector(v_company, v_source, v_ingested);

  if v_evtype = 'retraction' then
    select id into v_live_id from etl.ingest_event
     where company_id = v_company and source_system = v_source and source_record_ref = v_ref
       and event_type = 'sync' and superseded = false and retracted = false limit 1;
    insert into etl.ingest_event
      (company_id, connector_id, source_system, source_record_ref, event_type,
       supersedes_event_id, retracted, target_kind, target_ref, payload, content_hash,
       data_observed_at, ingested_at, superseded)
    values (v_company, v_conn, v_source, v_ref, 'retraction', v_live_id, true, v_kind, v_target,
            p_event, v_hash, v_observed, v_ingested, false) returning id into v_new_id;
    if v_live_id is not null then update etl.ingest_event set superseded = true where id = v_live_id; end if;
    if v_kind = 'payment_milestone' and v_target is not null then perform etl._project_milestone(v_company, v_target); end if;
    return jsonb_build_object('event_type', 'retraction', 'event_id', v_new_id);
  end if;

  select id, content_hash into v_live_id, v_live_hash from etl.ingest_event
   where company_id = v_company and source_system = v_source and source_record_ref = v_ref
     and event_type = 'sync' and superseded = false and retracted = false limit 1;

  if v_live_id is not null and v_live_hash = v_hash then
    return jsonb_build_object('noop', true, 'event_id', v_live_id);
  end if;

  if v_live_id is not null then
    update etl.ingest_event set superseded = true where id = v_live_id;
    insert into etl.ingest_event
      (company_id, connector_id, source_system, source_record_ref, event_type,
       supersedes_event_id, retracted, target_kind, target_ref, payload, content_hash,
       data_observed_at, ingested_at, superseded)
    values (v_company, v_conn, v_source, v_ref, 'correction', v_live_id, false, v_kind, v_target,
            p_event, v_hash, v_observed, v_ingested, true) returning id into v_new_id;
    insert into etl.ingest_event
      (company_id, connector_id, source_system, source_record_ref, event_type,
       supersedes_event_id, retracted, target_kind, target_ref, payload, content_hash,
       data_observed_at, ingested_at, superseded)
    values (v_company, v_conn, v_source, v_ref, 'sync', v_new_id, false, v_kind, v_target,
            p_event, v_hash, v_observed, v_ingested, false);
    if v_kind = 'payment_milestone' and v_target is not null then perform etl._project_milestone(v_company, v_target); end if;
    return jsonb_build_object('event_type', 'correction', 'event_id', v_new_id, 'supersedes', v_live_id);
  end if;

  insert into etl.ingest_event
    (company_id, connector_id, source_system, source_record_ref, event_type,
     supersedes_event_id, retracted, target_kind, target_ref, payload, content_hash,
     data_observed_at, ingested_at, superseded)
  values (v_company, v_conn, v_source, v_ref, 'sync', null, false, v_kind, v_target,
          p_event, v_hash, v_observed, v_ingested, false) returning id into v_new_id;
  if v_kind = 'payment_milestone' and v_target is not null then perform etl._project_milestone(v_company, v_target); end if;
  return jsonb_build_object('event_type', 'sync', 'event_id', v_new_id);
end; $$;

create or replace function etl.reconcile_receipt(p_receipt jsonb)
returns text language plpgsql volatile as $$
declare
  v_company uuid := etl._company();
  v_source text := p_receipt->>'source_system';
  v_ref text := nullif(trim(coalesce(p_receipt->>'source_record_ref','')), '');
  v_project text := p_receipt->>'project_id';
  v_amount numeric := (p_receipt->>'amount')::numeric;
  v_received date := (p_receipt->>'received_at')::date;
  v_observed timestamptz := (p_receipt->>'data_observed_at')::timestamptz;
  v_dup_count int; v_match_count int; v_match_id text; v_state text := 'unmatched'; v_rid uuid;
begin
  if v_company is null then raise exception 'etl.reconcile_receipt: no company claim'; end if;
  if v_observed is null then raise exception 'etl.reconcile_receipt: data_observed_at required'; end if;

  select count(*) into v_dup_count from etl.payment_receipt
   where company_id = v_company and project_id = v_project and amount = v_amount and received_at = v_received;

  if v_dup_count >= 1 then
    insert into etl.payment_receipt
      (company_id, project_id, amount, received_at, source_system, source_record_ref,
       matched_milestone_id, match_state, data_observed_at)
    values (v_company, v_project, v_amount, v_received, v_source, v_ref, null, 'review', v_observed)
    returning id into v_rid;
    insert into etl.needs_review (company_id, reason, source_system, source_record_ref, payload, created_observed_at)
    values (v_company, 'duplicate_same_amount', v_source, v_ref, p_receipt, v_observed);
    return 'review';
  end if;

  select count(*) into v_match_count from canonical.payment_milestone
   where company_id = v_company and project_id = v_project and gross_amount = v_amount and status <> 'paid';

  if v_match_count = 1 then
    select id into v_match_id from canonical.payment_milestone
     where company_id = v_company and project_id = v_project and gross_amount = v_amount and status <> 'paid' limit 1;
    v_state := 'matched';
  elsif v_match_count > 1 then
    insert into etl.needs_review (company_id, reason, source_system, source_record_ref, payload, created_observed_at)
    values (v_company, 'ambiguous_match', v_source, v_ref, p_receipt, v_observed);
    v_state := 'review';
  else
    v_state := 'unmatched';
  end if;

  insert into etl.payment_receipt
    (company_id, project_id, amount, received_at, source_system, source_record_ref,
     matched_milestone_id, match_state, data_observed_at)
  values (v_company, v_project, v_amount, v_received, v_source, v_ref, v_match_id, v_state, v_observed)
  returning id into v_rid;

  if v_state = 'matched' and v_match_id is not null then
    perform etl.ingest(jsonb_build_object(
      'source_system', v_source,
      'source_record_ref', coalesce(v_ref, 'receipt:' || v_rid::text),
      'target_kind', 'payment_milestone', 'target_ref', v_match_id, 'event_type', 'sync',
      'gross_amount', v_amount, 'received_amount', v_amount, 'status', 'paid',
      'data_observed_at', to_char(v_observed, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
      'ingested_at', to_char(v_observed, 'YYYY-MM-DD"T"HH24:MI:SSOF')));
  end if;
  return v_state;
end; $$;

create or replace function etl.resolve_alias(p_source text, p_kind text, p_label text, p_claimed text default null)
returns text language plpgsql volatile as $$
declare v_company uuid := etl._company(); v_existing text;
begin
  if v_company is null then raise exception 'etl.resolve_alias: no company claim'; end if;
  select canonical_id into v_existing from etl.alias
   where company_id = v_company and source_system = p_source and entity_kind = p_kind
     and lower(external_label) = lower(p_label) limit 1;
  if v_existing is not null then
    if p_claimed is not null and p_claimed <> v_existing then
      insert into etl.needs_review (company_id, reason, source_system, source_record_ref, payload, created_observed_at)
      values (v_company, 'alias_conflict', p_source, null,
              jsonb_build_object('entity_kind', p_kind, 'external_label', p_label,
                                 'existing_id', v_existing, 'claimed_id', p_claimed), now());
      return v_existing;
    end if;
    return v_existing;
  end if;
  insert into etl.needs_review (company_id, reason, source_system, source_record_ref, payload, created_observed_at)
  values (v_company, 'unknown_alias', p_source, null,
          jsonb_build_object('entity_kind', p_kind, 'external_label', p_label, 'claimed_id', p_claimed), now());
  return null;
end; $$;

create or replace function etl.freshness(p_company uuid, p_source text, p_as_of timestamptz)
returns table (connector_last_run timestamptz, data_observed_at timestamptz,
               connector_age numeric, data_age numeric)
language sql stable as $$
  select c.connector_last_run, d.newest_fact,
         extract(epoch from (p_as_of - c.connector_last_run))::numeric,
         extract(epoch from (p_as_of - d.newest_fact))::numeric
  from etl.connector c
  left join lateral (
    select max(e.data_observed_at) as newest_fact from etl.ingest_event e
     where e.company_id = c.company_id and e.source_system = c.source_system
       and e.superseded = false and e.retracted = false
  ) d on true
  where c.company_id = p_company and c.source_system = p_source;
$$;

-- ── RLS — real Supabase policies keyed off the JWT claim ──
alter table etl.connector       enable row level security;
alter table etl.ingest_event    enable row level security;
alter table etl.payment_receipt enable row level security;
alter table etl.alias           enable row level security;
alter table etl.needs_review    enable row level security;

create policy connector_company_isolation on etl.connector
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy ingest_event_company_isolation on etl.ingest_event
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy payment_receipt_company_isolation on etl.payment_receipt
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy alias_company_isolation on etl.alias
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy needs_review_company_isolation on etl.needs_review
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- ── grants (B1 fix) — the production `authenticated` role reaches etl through
-- these. The pglite variant granted app_user; the supabase variant omitted
-- `authenticated`, so the FastAPI auth path (SET LOCAL ROLE authenticated) hit
-- 'permission denied for schema etl' and ⑤'s ingestion write-side was dead in
-- production. The RLS policies above keep every grant tenant-isolated; the
-- functions are SECURITY INVOKER so they enforce the caller's company via RLS.
grant usage on schema etl to authenticated;
grant select on all tables in schema etl to authenticated;
grant insert, update on all tables in schema etl to authenticated;
grant execute on all functions in schema etl to authenticated;
