-- ============================================================
-- 0002_mart.sql — mart (KPI summary + lineage) + semantic functions.
--
-- pglite path. IDEMPOTENT: tables guarded with "if not exists";
-- functions use "create or replace".
--
-- ─────────────────────────────────────────────────────────────
-- kpi_run_id MINTING STRATEGY (decision, documented per BUILD-CONTRACT §2):
--   The recompute function mints ONE run id at the top of the call into a
--   local variable and reuses it for BOTH the summary row and every lineage
--   row, via core-PG only (NO pgcrypto):
--
--       v_run uuid := md5(random()::text || clock_timestamp()::text)::uuid;
--
--   md5() and random()/clock_timestamp() are core Postgres. The run id is a
--   fresh, unique IDENTIFIER per call (clock_timestamp advances within the
--   txn); it is NOT an asserted VALUE — overdueAmount/days-overdue depend only
--   on (p_as_of, seed). Test (d) asserts pinned-run id <> advanced-run id, which
--   this satisfies because each call mints anew. The caller may override by
--   setting current_setting('request.kpi_run_id') (not used by the tests).
-- ─────────────────────────────────────────────────────────────
-- ============================================================

create schema if not exists mart;

-- ---- mart.portfolio_summary — one row per recompute run ----
-- Backend analogue of managementOverview(). Money fields carried here are
-- redacted for non-finance principals by the serializer (not by the table).
create table if not exists mart.portfolio_summary (
  kpi_run_id      uuid not null,
  company_id      uuid not null,
  kpi_version     int  not null,
  as_of           timestamptz not null,
  computed_at     timestamptz not null default now(),
  -- managementOverview() field set (lower-cased by PG; tests read row.<lower>)
  active_count        int,
  completed_count     int,
  pending_approvals   int,
  overdue_count       int,
  blocked_count       int,
  overdueAmount       numeric,            -- folds to overdueamount; tests fall back on either
  total_contract      numeric,
  received            numeric,
  billable            numeric,
  collection_rate     int,
  primary key (kpi_run_id)
);
create index if not exists portfolio_summary_company_ix
  on mart.portfolio_summary (company_id, computed_at desc);

-- ---- mart.kpi_lineage — SPIKE REFINEMENT of §7 ----
-- VALUE = Σ LINEAGE made machine-checkable: each contribution row carries the
-- per-row amount (contribution_value) plus full provenance. PK includes
-- kpi_run_id so a new run never collides with a previous run's rows.
create table if not exists mart.kpi_lineage (
  kpi_run_id         uuid not null,
  metric_key         text not null,
  entity_id          text not null,
  contribution_value numeric not null,
  kpi_version        int  not null,
  source_id          uuid not null,            -- provenance (NOT NULL — test (b))
  record_ref         text not null,            -- provenance (NOT NULL — test (b))
  observed_at        timestamptz not null,     -- provenance (NOT NULL — test (b))
  company_id         uuid not null,            -- RLS isolation
  primary key (kpi_run_id, metric_key, entity_id)
);
create index if not exists kpi_lineage_metric_ix
  on mart.kpi_lineage (metric_key, entity_id);

-- ============================================================
-- mart.days_overdue(p_due, p_as_of) -> int
--   Calendar days overdue = (as_of::date - due). Positive when overdue.
--   IMMUTABLE, pure function of its args — NO now()/wall clock.
--   pm10 (due 2026-06-04): 18 @2026-06-22, 20 @2026-06-24.
-- ============================================================
create or replace function mart.days_overdue(p_due date, p_as_of timestamptz)
returns int
language sql
immutable
as $$
  select (p_as_of::date - p_due)::int;
$$;

-- ============================================================
-- mart.recompute_portfolio_summary(p_as_of timestamptz, p_kpi_version int)
--   returns setof mart.portfolio_summary (RETURN QUERY the inserted row).
--
--   In ONE call, for the caller's current_setting('request.company_id'):
--     * mint a fresh kpi_run_id (see strategy note above),
--     * compute overdueAmount = Σ(gross_amount - received_amount) over
--       milestones with status='overdue', EXPLICITLY scoped to the company
--       (CONTEXT RLS-BYPASS WARNING: superuser bypasses RLS, so we scope by
--       company_id in the WHERE clause — Firm B rows are never pulled in),
--     * insert the summary row + one kpi_lineage row per overdue milestone,
--       contribution_value = gross_amount - received_amount, provenance copied
--       from the milestone's source.
--   Deterministic: depends only on (p_as_of, seed). computed_at default now()
--   is fine (not asserted as a value).
-- ============================================================
create or replace function mart.recompute_portfolio_summary(
  p_as_of      timestamptz,
  p_kpi_version int
)
returns setof mart.portfolio_summary
language plpgsql
as $$
declare
  v_company uuid := current_setting('request.company_id', true)::uuid;
  v_run     uuid;
  v_overdue_amount numeric;
begin
  -- kpi_run_id: caller override (request.kpi_run_id) else fresh core-PG mint.
  v_run := coalesce(
    nullif(current_setting('request.kpi_run_id', true), '')::uuid,
    md5(random()::text || clock_timestamp()::text)::uuid
  );

  -- overdueAmount over GROSS (gross - received) for THIS company's overdue rows.
  select coalesce(sum(pm.gross_amount - pm.received_amount), 0)
    into v_overdue_amount
    from canonical.payment_milestone pm
   where pm.company_id = v_company
     and pm.status = 'overdue';

  -- lineage: one row per overdue milestone, contribution sums to overdueAmount.
  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select
    v_run,
    'overdueAmount',
    pm.id,
    (pm.gross_amount - pm.received_amount),
    p_kpi_version,
    src.id,
    pm.source_record_ref,
    pm.observed_at,
    pm.company_id
  from canonical.payment_milestone pm
  join canonical.source src
    on src.company_id = pm.company_id
   and src.source_system = pm.source_system
  where pm.company_id = v_company
    and pm.status = 'overdue';

  -- summary row tagged with the SAME run id.
  insert into mart.portfolio_summary
    (kpi_run_id, company_id, kpi_version, as_of,
     active_count, completed_count, pending_approvals, overdue_count, blocked_count,
     overdueAmount, total_contract, received, billable, collection_rate)
  select
    v_run, v_company, p_kpi_version, p_as_of,
    (select count(*)::int from canonical.project p
       where p.company_id = v_company and p.status = 'active'),
    (select count(*)::int from canonical.project p
       where p.company_id = v_company and p.status = 'archived'),
    null,  -- pending_approvals: design_approval not in this slice
    (select count(*)::int from canonical.payment_milestone pm
       where pm.company_id = v_company and pm.status = 'overdue'),
    (select count(*)::int from canonical.project p
       where p.company_id = v_company and p.status = 'active' and p.health = 'at_risk'),
    v_overdue_amount,
    (select coalesce(sum(p.contract_value),0) from canonical.project p
       where p.company_id = v_company and p.status = 'active'),
    (select coalesce(sum(pm.received_amount),0) from canonical.payment_milestone pm
       where pm.company_id = v_company),
    (select coalesce(sum(pm.gross_amount),0) from canonical.payment_milestone pm
       where pm.company_id = v_company),
    (select case when coalesce(sum(pm.gross_amount),0) = 0 then 0
                 else round(100.0 * sum(pm.received_amount) / sum(pm.gross_amount))::int end
       from canonical.payment_milestone pm
       where pm.company_id = v_company);

  return query
    select * from mart.portfolio_summary where kpi_run_id = v_run;
end;
$$;
