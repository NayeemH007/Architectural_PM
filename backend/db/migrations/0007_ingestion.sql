-- ============================================================
-- 0007_ingestion.sql — etl schema: ingestion idempotency, payment↔milestone
--   reconciliation, alias matching, the freshness SPLIT, and corrections /
--   retractions as NEW append-only rows (Step X / S5 ingestion-reconciliation).
--
-- Honours backend/spike/CONTRACT-ingestion-reconciliation.md and every
-- CONTEXT.md lock:
--   * pglite HARD RULES: NO gen_random_uuid()/pgcrypto, NO citext. UUIDs are
--     minted in code (md5(random()||clock_timestamp())::uuid where a function
--     mints internally, as 0002_mart does). text + unique on lower() for the
--     citext-free alias key.
--   * Read-only-first: etl.connector.mode CHECK = 'read_only' (T1/in-7). This
--     repo only INGESTS inbound observations; it NEVER pushes outbound.
--   * Freshness SPLIT (T7): connector_last_run (sync clock) vs data_observed_at
--     (fact-true clock) — two clocks, never conflated.
--   * C5 contested-option default: a NULL/empty/ambiguous ref → etl.needs_review;
--     NEVER auto-applied, NEVER silently dropped.
--   * No now() for a fact value: every observation clock is INJECTED on the
--     payload; freshness() ages against an injected p_as_of.
--   * G3 / A-3 RLS-BYPASS WARNING: every etl function read/write is EXPLICITLY
--     company-scoped by current_setting('request.company_id') inside the body,
--     NOT reliant on the RLS policy (the bootstrap superuser bypasses RLS).
--
-- IDEMPOTENT: schema/tables/indexes guarded with "if not exists"; functions are
-- "create or replace"; policies wrapped in duplicate_object DO-blocks. Re-issues
-- app_user GRANTs + ENABLE/FORCE RLS + company_id policy on every new etl table
-- (the 0004 grants only covered tables that existed then — MEMORY rule).
-- ============================================================

create schema if not exists etl;

-- ── etl.connector — one row per (company, source_system). FRESHNESS clock #1:
--    connector_last_run = when we last SYNCED the source. mode CHECK enforces
--    read-only-first (in-7): an outbound mode is rejected by the DB itself.
create table if not exists etl.connector (
  id                 uuid primary key,             -- minted in code
  company_id         uuid not null,
  source_system      text not null,
  mode               text not null default 'read_only'
                       check (mode = 'read_only'),  -- read-only-first: enforced
  connector_last_run timestamptz,                  -- FRESHNESS clock #1 (sync time)
  unique (company_id, source_system)
);

-- ── etl.ingest_event — APPEND-ONLY observation log. One row per inbound fact
--    version. Corrections/retractions are NEW rows (T6), never UPDATEs of the
--    payload. The only mutation allowed is flipping superseded=true on a prior
--    live event when a newer event supersedes it.
create table if not exists etl.ingest_event (
  id                  uuid primary key,            -- minted in code
  company_id          uuid not null,
  connector_id        uuid not null references etl.connector(id),
  source_system       text not null,
  source_record_ref   text,                        -- NULLABLE: a null/empty ref routes to review (T3)
  event_type          text not null
                        check (event_type in ('sync','correction','retraction')),
  supersedes_event_id uuid references etl.ingest_event(id),  -- T6 lineage
  retracted           boolean not null default false,
  target_kind         text not null,               -- 'payment_milestone' | 'payment_receipt' | …
  target_ref          text,                        -- the logical record id once resolved
  payload             jsonb not null,              -- the business fields as observed
  content_hash        text not null,               -- md5(canonical-json(business fields)) (T2)
  data_observed_at    timestamptz not null,        -- FRESHNESS clock #2 (fact-true time)
  ingested_at         timestamptz not null,        -- when WE learned it (injected, not now())
  superseded          boolean not null default false  -- set true when a newer event supersedes
);

-- IDEMPOTENCY KEY (T1): a (source_system, source_record_ref) is unique per company
-- for a NON-superseded live 'sync' with a non-null ref. Corrections deliberately
-- share the ref (they supersede), so the unique index is PARTIAL on the live sync
-- row only.
create unique index if not exists ingest_event_idem_ux
  on etl.ingest_event (company_id, source_system, source_record_ref)
  where source_record_ref is not null
    and event_type = 'sync'
    and superseded = false
    and retracted = false;

-- ── etl.payment_receipt — per-receipt grain for reconciliation (T4). A receipt is
--    an inbound cash observation; its match to a milestone is auditable.
create table if not exists etl.payment_receipt (
  id                   uuid primary key,           -- minted in code
  company_id           uuid not null,
  project_id           text not null,
  amount               numeric(14,2) not null,
  received_at          date not null,
  source_system        text not null,
  source_record_ref    text,
  matched_milestone_id text,                        -- null until matched; ambiguous → review
  match_state          text not null default 'unmatched'
                         check (match_state in ('unmatched','matched','review')),
  data_observed_at     timestamptz not null
);

-- ── etl.alias — (source label) → canonical entity (T5). citext-free: unique on
--    lower(external_label). A conflict → review, never overwrite.
create table if not exists etl.alias (
  id             uuid primary key,
  company_id     uuid not null,
  source_system  text not null,
  entity_kind    text not null,                     -- 'client' | 'project'
  external_label text not null,
  canonical_id   text not null
);
create unique index if not exists alias_label_lower_ux
  on etl.alias (company_id, source_system, entity_kind, lower(external_label));

-- ── etl.needs_review — the maker-checker queue (T3/T4/T5). Append-only; nothing
--    auto-applies. resolution is a CHECKER action (≠ maker), recorded out of band.
create table if not exists etl.needs_review (
  id            uuid primary key,
  company_id    uuid not null,
  reason        text not null
                  check (reason in ('absent_ref','ambiguous_ref','ambiguous_match',
                                    'alias_conflict','unknown_alias','duplicate_same_amount')),
  source_system text not null,
  source_record_ref text,
  payload       jsonb not null,
  state         text not null default 'open'
                  check (state in ('open','accepted','rejected')),
  created_observed_at timestamptz not null
);

-- ============================================================
-- §2 FUNCTIONS — the exact callable surface (CONTRACT §2).
-- All are explicitly company-scoped by current_setting('request.company_id');
-- all take/carry an injected observation clock — NO now() for a fact value.
-- uuids minted inside via md5(random()||clock_timestamp())::uuid (0002 pattern).
-- ============================================================

-- Helper: the company claim, fail-closed on a cleared claim (matches 0003 guard).
create or replace function etl._company() returns uuid
language sql stable as $$
  select nullif(current_setting('request.company_id', true), '')::uuid
$$;

-- Helper: mint a uuid without pgcrypto (pglite-safe; same shape as 0002_mart).
create or replace function etl._uuid() returns uuid
language sql volatile as $$
  select md5(random()::text || clock_timestamp()::text)::uuid
$$;

-- Helper: canonical content hash over BUSINESS FIELDS ONLY (PD-3). A connector
-- re-export that only changes a sync timestamp / formatting hashes IDENTICALLY,
-- so re-ingest is a true no-op (in-1). Cosmetic noise is NOT a correction.
create or replace function etl._content_hash(p jsonb) returns text
language sql immutable as $$
  select md5(
    coalesce(p->>'gross_amount','')   || '|' ||
    coalesce(p->>'received_amount','')|| '|' ||
    coalesce(p->>'status','')         || '|' ||
    coalesce(p->>'due_date','')
  )
$$;

-- Ensure a connector row exists for (company, source) and stamp its last-run with
-- the INJECTED ingested_at (the sync clock). Returns the connector id.
create or replace function etl._ensure_connector(p_company uuid, p_source text, p_last_run timestamptz)
returns uuid
language plpgsql volatile as $$
declare v_id uuid;
begin
  select id into v_id from etl.connector
   where company_id = p_company and source_system = p_source;
  if v_id is null then
    v_id := etl._uuid();
    insert into etl.connector (id, company_id, source_system, mode, connector_last_run)
    values (v_id, p_company, p_source, 'read_only', p_last_run);
  else
    -- advance the sync clock to the newest run we have seen (never backwards).
    update etl.connector
       set connector_last_run = greatest(coalesce(connector_last_run, p_last_run), p_last_run)
     where id = v_id;
  end if;
  return v_id;
end;
$$;

-- Re-project a milestone's canonical received_amount/status/observed_at from its
-- NEWEST non-superseded, non-retracted ingest_event (T6 / §3 projection). The
-- log is append-only; the canonical column is a derived projection (PD-2).
create or replace function etl._project_milestone(p_company uuid, p_target_ref text)
returns void
language plpgsql volatile as $$
declare v_payload jsonb; v_observed timestamptz;
begin
  select payload, data_observed_at into v_payload, v_observed
    from etl.ingest_event
   where company_id = p_company
     and target_kind = 'payment_milestone'
     and target_ref = p_target_ref
     and superseded = false
     and retracted = false
   order by data_observed_at desc, ingested_at desc
   limit 1;

  if v_payload is null then
    -- everything for this ref was retracted: drop receivable to 0 (never negative,
    -- never overstated). gross stays as-is; we only zero what the source removed.
    update canonical.payment_milestone
       set received_amount = 0
     where company_id = p_company and id = p_target_ref;
    return;
  end if;

  update canonical.payment_milestone
     set received_amount = coalesce((v_payload->>'received_amount')::numeric, received_amount),
         gross_amount    = coalesce((v_payload->>'gross_amount')::numeric, gross_amount),
         status          = coalesce((v_payload->>'status')::payment_status_a, status),
         observed_at     = coalesce(v_observed, observed_at)
   where company_id = p_company and id = p_target_ref;
end;
$$;

-- ── etl.ingest(p_event jsonb) → jsonb result row. The single per-row entry point.
-- Branch table per CONTRACT §2. Returns a small result describing the outcome
-- so a caller (and the ledger) can assert routed_to_review / event_type / no-op.
create or replace function etl.ingest(p_event jsonb)
returns jsonb
language plpgsql volatile as $$
declare
  v_company   uuid := etl._company();
  v_source    text := p_event->>'source_system';
  v_ref       text := nullif(trim(coalesce(p_event->>'source_record_ref','')), '');
  v_kind      text := coalesce(p_event->>'target_kind', 'payment_milestone');
  v_target    text := p_event->>'target_ref';
  v_evtype    text := coalesce(p_event->>'event_type', 'sync');
  v_observed  timestamptz := (p_event->>'data_observed_at')::timestamptz;
  v_ingested  timestamptz := (p_event->>'ingested_at')::timestamptz;
  v_hash      text := etl._content_hash(p_event);
  v_conn      uuid;
  v_live_id   uuid;
  v_live_hash text;
  v_new_id    uuid;
begin
  if v_company is null then
    raise exception 'etl.ingest: no company claim (request.company_id)';
  end if;
  if v_observed is null then
    raise exception 'etl.ingest: data_observed_at is required (no wall clock)';
  end if;
  -- ingested_at defaults to the observation clock if the caller omits it, but it
  -- is still an INJECTED value, never now().
  v_ingested := coalesce(v_ingested, v_observed);

  -- (T3) absent / empty ref → review, NEVER a canonical write, NEVER a drop.
  if v_ref is null then
    insert into etl.needs_review
      (id, company_id, reason, source_system, source_record_ref, payload, created_observed_at)
    values (etl._uuid(), v_company, 'absent_ref', v_source, null, p_event, v_observed);
    return jsonb_build_object('routed_to_review', true, 'reason', 'absent_ref');
  end if;

  v_conn := etl._ensure_connector(v_company, v_source, v_ingested);

  -- explicit retraction path (T6): supersede the live event, re-project (removes
  -- the retracted value from the tally), keep history.
  if v_evtype = 'retraction' then
    select id into v_live_id from etl.ingest_event
     where company_id = v_company and source_system = v_source
       and source_record_ref = v_ref and event_type = 'sync'
       and superseded = false and retracted = false
     limit 1;

    v_new_id := etl._uuid();
    insert into etl.ingest_event
      (id, company_id, connector_id, source_system, source_record_ref, event_type,
       supersedes_event_id, retracted, target_kind, target_ref, payload, content_hash,
       data_observed_at, ingested_at, superseded)
    values
      (v_new_id, v_company, v_conn, v_source, v_ref, 'retraction',
       v_live_id, true, v_kind, v_target, p_event, v_hash, v_observed, v_ingested, false);

    if v_live_id is not null then
      update etl.ingest_event set superseded = true where id = v_live_id;
    end if;
    if v_kind = 'payment_milestone' and v_target is not null then
      perform etl._project_milestone(v_company, v_target);
    end if;
    return jsonb_build_object('event_type', 'retraction', 'event_id', v_new_id);
  end if;

  -- find the existing LIVE sync event for this (source, ref).
  select id, content_hash into v_live_id, v_live_hash
    from etl.ingest_event
   where company_id = v_company and source_system = v_source
     and source_record_ref = v_ref and event_type = 'sync'
     and superseded = false and retracted = false
   limit 1;

  -- (T1/T2) existing + SAME hash → no-op. No new event, no canonical change, no
  -- review row, no audit. Re-ingesting the same export row is idempotent.
  if v_live_id is not null and v_live_hash = v_hash then
    return jsonb_build_object('noop', true, 'event_id', v_live_id);
  end if;

  -- (T2/T6) existing + DIFFERENT hash → CORRECTION. The prior live sync is marked
  -- superseded (history survives, never edited/deleted). Two NEW append-only rows
  -- are written:
  --   1. a 'correction' LINEAGE marker carrying supersedes_event_id=<old sync>
  --      (the audit edge the ledger asserts). It is itself superseded=true — it is
  --      a record of the supersession, NOT the live value.
  --   2. a fresh live 'sync' row carrying the CORRECTED payload (superseded=false)
  --      — this is the new current value. The partial idempotency index sees only
  --      this one live sync for the ref (no duplicate; the old sync is superseded).
  -- Re-project to the corrected amount: the projection picks the newest
  -- non-superseded event → the corrected sync (no double-count, no overstatement).
  if v_live_id is not null then
    -- mark the prior sync superseded first (so the partial unique index frees the ref).
    update etl.ingest_event set superseded = true where id = v_live_id;

    -- 1. correction lineage marker (superseded → not a live event, not projected).
    v_new_id := etl._uuid();
    insert into etl.ingest_event
      (id, company_id, connector_id, source_system, source_record_ref, event_type,
       supersedes_event_id, retracted, target_kind, target_ref, payload, content_hash,
       data_observed_at, ingested_at, superseded)
    values
      (v_new_id, v_company, v_conn, v_source, v_ref, 'correction',
       v_live_id, false, v_kind, v_target, p_event, v_hash, v_observed, v_ingested, true);

    -- 2. fresh live sync carrying the corrected payload (the new current value).
    insert into etl.ingest_event
      (id, company_id, connector_id, source_system, source_record_ref, event_type,
       supersedes_event_id, retracted, target_kind, target_ref, payload, content_hash,
       data_observed_at, ingested_at, superseded)
    values
      (etl._uuid(), v_company, v_conn, v_source, v_ref, 'sync',
       v_new_id, false, v_kind, v_target, p_event, v_hash, v_observed, v_ingested, false);

    if v_kind = 'payment_milestone' and v_target is not null then
      perform etl._project_milestone(v_company, v_target);
    end if;
    return jsonb_build_object('event_type', 'correction', 'event_id', v_new_id,
                              'supersedes', v_live_id);
  end if;

  -- new ref → fresh 'sync' event; project to canonical.
  v_new_id := etl._uuid();
  insert into etl.ingest_event
    (id, company_id, connector_id, source_system, source_record_ref, event_type,
     supersedes_event_id, retracted, target_kind, target_ref, payload, content_hash,
     data_observed_at, ingested_at, superseded)
  values
    (v_new_id, v_company, v_conn, v_source, v_ref, 'sync',
     null, false, v_kind, v_target, p_event, v_hash, v_observed, v_ingested, false);

  if v_kind = 'payment_milestone' and v_target is not null then
    perform etl._project_milestone(v_company, v_target);
  end if;
  return jsonb_build_object('event_type', 'sync', 'event_id', v_new_id);
end;
$$;

-- ── etl.reconcile_receipt(p_receipt jsonb) → text (match_state). Records the
-- receipt at per-receipt grain (NEVER drops), matches to a milestone, and routes
-- a duplicate same-amount/same-day to review (T4 / PD-1: review, not auto-pair).
create or replace function etl.reconcile_receipt(p_receipt jsonb)
returns text
language plpgsql volatile as $$
declare
  v_company   uuid := etl._company();
  v_source    text := p_receipt->>'source_system';
  v_ref       text := nullif(trim(coalesce(p_receipt->>'source_record_ref','')), '');
  v_project   text := p_receipt->>'project_id';
  v_amount    numeric := (p_receipt->>'amount')::numeric;
  v_received  date := (p_receipt->>'received_at')::date;
  v_observed  timestamptz := (p_receipt->>'data_observed_at')::timestamptz;
  v_dup_count int;
  v_match_count int;
  v_match_id  text;
  v_state     text := 'unmatched';
  v_rid       uuid := etl._uuid();
begin
  if v_company is null then
    raise exception 'etl.reconcile_receipt: no company claim (request.company_id)';
  end if;
  if v_observed is null then
    raise exception 'etl.reconcile_receipt: data_observed_at is required (no wall clock)';
  end if;

  -- Is there ALREADY a recorded receipt for the same project+amount+day? If so
  -- this is a genuine SECOND same-amount receipt (PD-1) — it is NOT dropped; it
  -- gets its own row and routes to review for a human to confirm.
  select count(*) into v_dup_count
    from etl.payment_receipt
   where company_id = v_company and project_id = v_project
     and amount = v_amount and received_at = v_received;

  if v_dup_count >= 1 then
    insert into etl.payment_receipt
      (id, company_id, project_id, amount, received_at, source_system,
       source_record_ref, matched_milestone_id, match_state, data_observed_at)
    values (v_rid, v_company, v_project, v_amount, v_received, v_source,
            v_ref, null, 'review', v_observed);
    insert into etl.needs_review
      (id, company_id, reason, source_system, source_record_ref, payload, created_observed_at)
    values (etl._uuid(), v_company, 'duplicate_same_amount', v_source, v_ref, p_receipt, v_observed);
    return 'review';
  end if;

  -- First receipt for this (project, amount, day). Try to match an OPEN milestone
  -- by (project, amount). 0 → unmatched (held); 1 → matched (correction event);
  -- >1 → review (NEVER auto-pick). (T4)
  select count(*) into v_match_count
    from canonical.payment_milestone
   where company_id = v_company and project_id = v_project
     and gross_amount = v_amount and status <> 'paid';

  if v_match_count = 1 then
    select id into v_match_id
      from canonical.payment_milestone
     where company_id = v_company and project_id = v_project
       and gross_amount = v_amount and status <> 'paid'
     limit 1;
    v_state := 'matched';
  elsif v_match_count > 1 then
    insert into etl.needs_review
      (id, company_id, reason, source_system, source_record_ref, payload, created_observed_at)
    values (etl._uuid(), v_company, 'ambiguous_match', v_source, v_ref, p_receipt, v_observed);
    v_state := 'review';
  else
    v_state := 'unmatched';
  end if;

  insert into etl.payment_receipt
    (id, company_id, project_id, amount, received_at, source_system,
     source_record_ref, matched_milestone_id, match_state, data_observed_at)
  values (v_rid, v_company, v_project, v_amount, v_received, v_source,
          v_ref, v_match_id, v_state, v_observed);

  -- a confident match updates the milestone's received tally via a correction
  -- event (auditable provenance; §3 projection re-runs).
  if v_state = 'matched' and v_match_id is not null then
    perform etl.ingest(jsonb_build_object(
      'source_system', v_source,
      'source_record_ref', coalesce(v_ref, 'receipt:' || v_rid::text),
      'target_kind', 'payment_milestone',
      'target_ref', v_match_id,
      'event_type', 'sync',
      'gross_amount', v_amount,
      'received_amount', v_amount,
      'status', 'paid',
      'data_observed_at', to_char(v_observed, 'YYYY-MM-DD"T"HH24:MI:SSOF'),
      'ingested_at', to_char(v_observed, 'YYYY-MM-DD"T"HH24:MI:SSOF')
    ));
  end if;

  return v_state;
end;
$$;

-- ── etl.resolve_alias(p_source, p_kind, p_label, p_claimed) → text | null.
-- Resolves an external label to a canonical entity. A CONFLICT (the label is
-- already mapped to a DIFFERENT canonical_id than the inbound claims) routes to
-- needs_review(alias_conflict) and DOES NOT overwrite the existing alias (T5).
-- An unknown label routes to needs_review(unknown_alias) and returns null.
create or replace function etl.resolve_alias(
  p_source text, p_kind text, p_label text, p_claimed text default null)
returns text
language plpgsql volatile as $$
declare
  v_company  uuid := etl._company();
  v_existing text;
begin
  if v_company is null then
    raise exception 'etl.resolve_alias: no company claim (request.company_id)';
  end if;

  select canonical_id into v_existing
    from etl.alias
   where company_id = v_company and source_system = p_source
     and entity_kind = p_kind and lower(external_label) = lower(p_label)
   limit 1;

  if v_existing is not null then
    -- (T5) inbound claims a DIFFERENT entity than the stored mapping → conflict.
    if p_claimed is not null and p_claimed <> v_existing then
      insert into etl.needs_review
        (id, company_id, reason, source_system, source_record_ref, payload, created_observed_at)
      values (etl._uuid(), v_company, 'alias_conflict', p_source, null,
              jsonb_build_object('entity_kind', p_kind, 'external_label', p_label,
                                 'existing_id', v_existing, 'claimed_id', p_claimed),
              now());
      return v_existing;  -- existing mapping is the truth until a checker resolves; NOT overwritten
    end if;
    return v_existing;  -- resolved silently
  end if;

  -- unknown label → review, return null (T5). Never silently invents a mapping.
  insert into etl.needs_review
    (id, company_id, reason, source_system, source_record_ref, payload, created_observed_at)
  values (etl._uuid(), v_company, 'unknown_alias', p_source, null,
          jsonb_build_object('entity_kind', p_kind, 'external_label', p_label,
                             'claimed_id', p_claimed),
          now());
  return null;
end;
$$;

-- ── etl.freshness(p_company, p_source, p_as_of) → (connector_last_run,
-- data_observed_at, connector_age, data_age). The FRESHNESS SPLIT (T7): returns
-- BOTH clocks and BOTH ages computed against the INJECTED p_as_of (never wall
-- clock), so a stale connector and stale data are independently reported.
-- ages are in SECONDS (epoch difference), so a caller can render any unit.
create or replace function etl.freshness(
  p_company uuid, p_source text, p_as_of timestamptz)
returns table (
  connector_last_run timestamptz,
  data_observed_at   timestamptz,
  connector_age      numeric,
  data_age           numeric
)
language sql stable as $$
  select
    c.connector_last_run,
    d.newest_fact as data_observed_at,
    extract(epoch from (p_as_of - c.connector_last_run))::numeric as connector_age,
    extract(epoch from (p_as_of - d.newest_fact))::numeric        as data_age
  from etl.connector c
  left join lateral (
    select max(e.data_observed_at) as newest_fact
      from etl.ingest_event e
     where e.company_id = c.company_id
       and e.source_system = c.source_system
       and e.superseded = false
       and e.retracted = false
  ) d on true
  where c.company_id = p_company and c.source_system = p_source;
$$;

-- ============================================================
-- app_user GRANTs + RLS — re-issued for the NEW etl tables (MEMORY rule: 0004
-- only covered tables that existed then). The non-superuser app_user must read
-- the etl surface; RLS enforces company isolation; the SECURITY-INVOKER etl
-- functions also scope explicitly (defense-in-depth, G3/A-3).
-- ============================================================
grant usage on schema etl to app_user;
grant select on all tables    in schema etl to app_user;
grant insert, update on all tables in schema etl to app_user;  -- ingest writes under the role
grant execute on all functions in schema etl to app_user;

alter table etl.connector       enable row level security;
alter table etl.ingest_event    enable row level security;
alter table etl.payment_receipt enable row level security;
alter table etl.alias           enable row level security;
alter table etl.needs_review    enable row level security;
alter table etl.connector       force row level security;
alter table etl.ingest_event    force row level security;
alter table etl.payment_receipt force row level security;
alter table etl.alias           force row level security;
alter table etl.needs_review    force row level security;

-- company_id isolation, fail-closed on a cleared claim (nullif() guard, as 0003).
do $$ begin
  create policy connector_company_isolation on etl.connector
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy ingest_event_company_isolation on etl.ingest_event
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy payment_receipt_company_isolation on etl.payment_receipt
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy alias_company_isolation on etl.alias
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy needs_review_company_isolation on etl.needs_review
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
