-- ============================================================
-- 0002_mart.supabase.sql — Supabase-FAITHFUL variant of the mart layer.
--
-- SYNTAX-AUTHORED ONLY (never run under pglite). Differences from the
-- pglite path:
--   * kpi_run_id mints via gen_random_uuid() (pgcrypto present on Supabase)
--     instead of md5(random()||clock_timestamp())::uuid.
--   * RLS policies + enabled on the mart tables, keyed off the JWT claim.
--   * The recompute function STILL scopes reads explicitly by company_id
--     (defense in depth; the pglite test proves the explicit scope, and
--      Supabase keeps it so SECURITY-DEFINER paths can't leak across tenants).
-- The table/lineage shapes are identical to the pglite path.
-- ============================================================

create extension if not exists pgcrypto;
create schema if not exists mart;

create table if not exists mart.portfolio_summary (
  kpi_run_id      uuid not null default gen_random_uuid(),
  company_id      uuid not null,
  kpi_version     int  not null,
  as_of           timestamptz not null,
  computed_at     timestamptz not null default now(),
  active_count        int,
  completed_count     int,
  pending_approvals   int,
  overdue_count       int,
  blocked_count       int,
  overdueAmount       numeric,
  total_contract      numeric,
  received            numeric,
  billable            numeric,
  collection_rate     int,
  primary key (kpi_run_id)
);

create table if not exists mart.kpi_lineage (
  kpi_run_id         uuid not null,
  metric_key         text not null,
  entity_id          text not null,
  contribution_value numeric not null,
  kpi_version        int  not null,
  source_id          uuid not null,
  record_ref         text not null,
  observed_at        timestamptz not null,
  company_id         uuid not null,
  primary key (kpi_run_id, metric_key, entity_id)
);

alter table mart.portfolio_summary enable row level security;
alter table mart.kpi_lineage       enable row level security;
create policy ps_company_isolation on mart.portfolio_summary
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy kl_company_isolation on mart.kpi_lineage
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);

create or replace function mart.days_overdue(p_due date, p_as_of timestamptz)
returns int language sql immutable as $$
  select (p_as_of::date - p_due)::int;
$$;

create or replace function mart.recompute_portfolio_summary(
  p_as_of timestamptz, p_kpi_version int
)
returns setof mart.portfolio_summary
language plpgsql
as $$
declare
  v_company uuid := (auth.jwt() ->> 'company_id')::uuid;
  v_run     uuid := gen_random_uuid();
  v_overdue_amount numeric;
begin
  select coalesce(sum(pm.gross_amount - pm.received_amount), 0)
    into v_overdue_amount
    from canonical.payment_milestone pm
   where pm.company_id = v_company and pm.status = 'overdue';

  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select v_run, 'overdueAmount', pm.id, (pm.gross_amount - pm.received_amount),
         p_kpi_version, src.id, pm.source_record_ref, pm.observed_at, pm.company_id
  from canonical.payment_milestone pm
  join canonical.source src
    on src.company_id = pm.company_id and src.source_system = pm.source_system
  where pm.company_id = v_company and pm.status = 'overdue';

  insert into mart.portfolio_summary
    (kpi_run_id, company_id, kpi_version, as_of, overdue_count, overdueAmount)
  values
    (v_run, v_company, p_kpi_version, p_as_of,
     (select count(*)::int from canonical.payment_milestone pm
        where pm.company_id = v_company and pm.status = 'overdue'),
     v_overdue_amount);

  return query select * from mart.portfolio_summary where kpi_run_id = v_run;
end;
$$;
