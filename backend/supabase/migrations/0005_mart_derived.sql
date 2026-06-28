-- ============================================================
-- 0005_mart_derived.supabase.sql — Supabase-FAITHFUL variant of the derived
-- KPI recompute layer (S3). SYNTAX-AUTHORED ONLY (never run under pglite).
--
-- Differences from the pglite path:
--   * kpi_run_id mints via gen_random_uuid() (pgcrypto present on Supabase)
--     instead of md5(random()||clock_timestamp())::uuid.
--   * v_company resolves from the JWT claim (auth.jwt() ->> 'company_id')
--     instead of current_setting('request.company_id').
--   * RLS policies on mart.cost_model key off the JWT claim.
--   * The recompute fns STILL scope reads explicitly by company_id (defense in
--     depth, identical lineage shapes).
-- The kpi_lineage table + metric_key shapes are identical to the pglite path.
-- ============================================================

create extension if not exists pgcrypto;
create schema if not exists mart;

create table if not exists mart.cost_model (
  company_id   uuid not null,
  project_id   text not null,
  modeled_cost numeric not null,
  primary key (company_id, project_id)
);
alter table mart.cost_model enable row level security;
create policy cost_model_company_isolation on mart.cost_model
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);

-- ---- mart.recompute_finance ----
create or replace function mart.recompute_finance(
  p_as_of timestamptz, p_kpi_version int
)
returns setof mart.kpi_lineage
language plpgsql
as $$
declare
  v_company uuid := (auth.jwt() ->> 'company_id')::uuid;
  v_run     uuid := gen_random_uuid();
begin
  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select v_run, 'income', pm.id, coalesce(pm.received_amount,0), p_kpi_version,
         src.id, pm.source_record_ref, pm.observed_at, pm.company_id
  from canonical.payment_milestone pm
  join canonical.source src
    on src.company_id = pm.company_id and src.source_system = pm.source_system
  where pm.company_id = v_company;

  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select v_run, 'billable', pm.id, coalesce(pm.gross_amount,0), p_kpi_version,
         src.id, pm.source_record_ref, pm.observed_at, pm.company_id
  from canonical.payment_milestone pm
  join canonical.source src
    on src.company_id = pm.company_id and src.source_system = pm.source_system
  where pm.company_id = v_company;

  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select v_run, 'receivables', pm.id,
         (coalesce(pm.gross_amount,0) - coalesce(pm.received_amount,0)),
         p_kpi_version, src.id, pm.source_record_ref, pm.observed_at, pm.company_id
  from canonical.payment_milestone pm
  join canonical.source src
    on src.company_id = pm.company_id and src.source_system = pm.source_system
  where pm.company_id = v_company and pm.status <> 'paid';

  return query select * from mart.kpi_lineage
   where kpi_run_id = v_run and metric_key in ('income','billable','receivables');
end;
$$;

-- ---- mart.recompute_profitability ----
create or replace function mart.recompute_profitability(
  p_as_of timestamptz, p_kpi_version int
)
returns setof mart.kpi_lineage
language plpgsql
as $$
declare
  v_company uuid := (auth.jwt() ->> 'company_id')::uuid;
  v_run     uuid := gen_random_uuid();
begin
  insert into mart.cost_model (company_id, project_id, modeled_cost)
  values
    (v_company,'a1',980000),(v_company,'a2',720000),(v_company,'a3',1180000),
    (v_company,'a4',1640000),(v_company,'a5',1150000),(v_company,'a6',560000),
    (v_company,'a7',760000),(v_company,'a8',470000)
  on conflict (company_id, project_id) do update
    set modeled_cost = excluded.modeled_cost;

  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select v_run, 'margin', p.id,
    case when coalesce(p.contract_value,0)=0 then 0
         else round(((p.contract_value - coalesce(cm.modeled_cost,0)) / p.contract_value) * 100) end,
    p_kpi_version, src.id, 'project:' || p.id, p_as_of, p.company_id
  from canonical.project p
  join canonical.source src
    on src.company_id = p.company_id and src.source_system = 'manual_capture'
  left join mart.cost_model cm
    on cm.company_id = p.company_id and cm.project_id = p.id
  where p.company_id = v_company and p.status in ('active','archived');

  return query select * from mart.kpi_lineage
   where kpi_run_id = v_run and metric_key = 'margin';
end;
$$;

-- ---- mart.recompute_aios ----
create or replace function mart.recompute_aios(
  p_as_of timestamptz, p_kpi_version int
)
returns setof mart.kpi_lineage
language plpgsql
as $$
declare
  v_company uuid := (auth.jwt() ->> 'company_id')::uuid;
  v_run     uuid := gen_random_uuid();
begin
  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select v_run, 'output', p.id, 1, p_kpi_version,
         src.id, 'project:' || p.id, p_as_of, p.company_id
  from canonical.project p
  join canonical.source src
    on src.company_id = p.company_id and src.source_system = 'manual_capture'
  where p.company_id = v_company and p.status = 'active';

  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select v_run, 'output', m.id, 1, p_kpi_version,
         src.id, 'member:' || m.id, p_as_of, m.company_id
  from canonical.member m
  join canonical.source src
    on src.company_id = m.company_id and src.source_system = 'manual_capture'
  where m.company_id = v_company and m.role = 'designer';

  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select v_run, 'automated', t.id,
         case t.status when 'automated' then 1 when 'assisted' then 0.5 else 0 end,
         p_kpi_version, src.id, 'auditTask:' || t.id, p_as_of, t.company_id
  from canonical.audit_task t
  join canonical.source src
    on src.company_id = t.company_id and src.source_system = 'manual_capture'
  where t.company_id = v_company;

  return query select * from mart.kpi_lineage
   where kpi_run_id = v_run and metric_key in ('output','automated');
end;
$$;
