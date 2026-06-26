-- ============================================================
-- 0005_mart_derived.sql — derived KPI recompute fns (S3).
--
-- Extends the Slice-2b mart pattern (mart.recompute_portfolio_summary +
-- mart.kpi_lineage) to the REMAINING derived endpoints:
--   * mart.recompute_finance       → income / billable / receivables lineage
--   * mart.recompute_profitability  → margin lineage (per project, fee-only)
--   * mart.recompute_aios           → output / automated lineage (autonomy REFUSES,
--                                      so it emits NO lineage — absence == refusal)
--
-- All three REUSE the existing mart.kpi_lineage table (no DDL change to it: the
-- new metric_key's slot in) and the cost-model surface (mart.cost_model) added
-- here for the PROJECT_COST modeled input.
--
-- pglite HARD RULES honoured:
--   * core-PG only; NO gen_random_uuid (kpi_run_id minted via
--     md5(random()||clock_timestamp())::uuid — the 0002 pattern).
--   * NO citext.
--   * EXPLICIT company_id predicate on every read (gap A-3: the bootstrap
--     superuser bypasses RLS, so the WHERE clause is the isolation).
--   * IDEMPOTENT: "create … if not exists" + "create or replace".
--
-- CRITICAL (per BUILD-ROADMAP §1): this migration adds a NEW mart object
-- (mart.cost_model). 0004's grants only covered tables that existed THEN, so
-- we RE-ISSUE the app_user grants + ENABLE/FORCE RLS + the company_id policy on
-- cost_model here, so the non-superuser role can still read it AND RLS enforces.
-- ============================================================

create schema if not exists mart;

-- ============================================================
-- mart.cost_model — the modeled per-project direct cost (PROJECT_COST).
--   A DECLARED input, NOT an observed canonical fact (CONTEXT non-migratable
--   literal). Lives in mart (a model surface), cited as model:PROJECT_COST:aN
--   with confidence:'low'. Seeded by the profitability recompute from a declared
--   const if empty (see note below) — but the canonical store of the model is
--   this table so the lineage join is real.
-- ============================================================
create table if not exists mart.cost_model (
  company_id   uuid not null,                 -- RLS key
  project_id   text not null,
  modeled_cost numeric not null,
  primary key (company_id, project_id)
);

-- ============================================================
-- mart.recompute_finance(p_as_of, p_kpi_version) returns setof mart.kpi_lineage
--   Emits, for the caller's request.company_id:
--     income      — one row per milestone, contribution = received_amount
--     billable    — one row per milestone, contribution = gross_amount
--     receivables — one row per NON-paid milestone, contribution =
--                   (gross_amount − received_amount)
--   collectionRate is a RATIO of two Σ's → derived in the serializer from the
--   income/billable sums (no fake per-row lineage for a ratio).
--   Returns the rows it inserted (this run's kpi_run_id) so the serializer reads
--   them back deterministically.
-- ============================================================
create or replace function mart.recompute_finance(
  p_as_of      timestamptz,
  p_kpi_version int
)
returns setof mart.kpi_lineage
language plpgsql
as $$
declare
  v_company uuid := nullif(current_setting('request.company_id', true), '')::uuid;
  v_run     uuid := md5(random()::text || clock_timestamp()::text)::uuid;
begin
  -- income: one row per milestone (contribution = received_amount).
  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select
    v_run, 'income', pm.id, coalesce(pm.received_amount, 0), p_kpi_version,
    src.id, pm.source_record_ref, pm.observed_at, pm.company_id
  from canonical.payment_milestone pm
  join canonical.source src
    on src.company_id = pm.company_id
   and src.source_system = pm.source_system
  where pm.company_id = v_company;

  -- billable: one row per milestone (contribution = gross_amount).
  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select
    v_run, 'billable', pm.id, coalesce(pm.gross_amount, 0), p_kpi_version,
    src.id, pm.source_record_ref, pm.observed_at, pm.company_id
  from canonical.payment_milestone pm
  join canonical.source src
    on src.company_id = pm.company_id
   and src.source_system = pm.source_system
  where pm.company_id = v_company;

  -- receivables: one row per NON-paid milestone (contribution = gross − received).
  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select
    v_run, 'receivables', pm.id, (coalesce(pm.gross_amount,0) - coalesce(pm.received_amount,0)),
    p_kpi_version, src.id, pm.source_record_ref, pm.observed_at, pm.company_id
  from canonical.payment_milestone pm
  join canonical.source src
    on src.company_id = pm.company_id
   and src.source_system = pm.source_system
  where pm.company_id = v_company
    and pm.status <> 'paid';

  return query
    select * from mart.kpi_lineage
     where kpi_run_id = v_run
       and metric_key in ('income','billable','receivables');
end;
$$;

-- ============================================================
-- mart.recompute_profitability(p_as_of, p_kpi_version) returns setof kpi_lineage
--   Emits metric_key='margin', one row PER active+archived project, contribution
--   = round((contract − modeled_cost) / contract × 100). entity_id = project id,
--   record_ref = 'project:aN'. The modeled cost is joined from mart.cost_model;
--   the serializer cites it as the SECOND source (model:PROJECT_COST:aN).
--   Reads cost from mart.cost_model scoped by company_id (A-3 explicit predicate).
-- ============================================================
create or replace function mart.recompute_profitability(
  p_as_of      timestamptz,
  p_kpi_version int
)
returns setof mart.kpi_lineage
language plpgsql
as $$
declare
  v_company uuid := nullif(current_setting('request.company_id', true), '')::uuid;
  v_run     uuid := md5(random()::text || clock_timestamp()::text)::uuid;
begin
  -- PROJECT_COST is a DECLARED modeled input (finance.ts:67), NOT a canonical
  -- fact. Materialise it into mart.cost_model (the model surface) for THIS
  -- company's projects so the margin lineage join is real + drillable. The
  -- const lives here (the model layer), never in canonical (honours the
  -- non-migratable-literal rule). Idempotent upsert: a re-run overwrites.
  insert into mart.cost_model (company_id, project_id, modeled_cost)
  values
    (v_company, 'a1',  980000),
    (v_company, 'a2',  720000),
    (v_company, 'a3', 1180000),
    (v_company, 'a4', 1640000),
    (v_company, 'a5', 1150000),
    (v_company, 'a6',  560000),
    (v_company, 'a7',  760000),
    (v_company, 'a8',  470000)
  on conflict (company_id, project_id) do update
    set modeled_cost = excluded.modeled_cost;

  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select
    v_run,
    'margin',
    p.id,
    case when coalesce(p.contract_value,0) = 0 then 0
         else round(((p.contract_value - coalesce(cm.modeled_cost,0)) / p.contract_value) * 100)
    end,
    p_kpi_version,
    src.id,
    'project:' || p.id,
    p_as_of,
    p.company_id
  from canonical.project p
  join canonical.source src
    on src.company_id = p.company_id
   and src.source_system = 'manual_capture'
  left join mart.cost_model cm
    on cm.company_id = p.company_id
   and cm.project_id = p.id
  where p.company_id = v_company
    and p.status in ('active','archived');

  return query
    select * from mart.kpi_lineage
     where kpi_run_id = v_run
       and metric_key = 'margin';
end;
$$;

-- ============================================================
-- mart.recompute_aios(p_as_of, p_kpi_version) returns setof kpi_lineage
--   output:    one row per ACTIVE project (contribution 1, record_ref project:aN)
--              + one row per DESIGNER member (contribution 1, record_ref member:mN).
--              The serializer computes value = (#active ÷ #designers) from the
--              two lineage sub-counts (6 / 2 = 3.0).
--   automated: one row per audit_task (contribution = the per-task automation
--              credit: 1 for 'automated', 0.5 for 'assisted', 0 for 'manual'),
--              record_ref auditTask:tN. The serializer derives the % from Σ.
--   autonomy: emits NO lineage (REFUSE) — its absence is the structural proof.
--   Each read scoped by company_id (A-3 explicit predicate).
-- ============================================================
create or replace function mart.recompute_aios(
  p_as_of      timestamptz,
  p_kpi_version int
)
returns setof mart.kpi_lineage
language plpgsql
as $$
declare
  v_company uuid := nullif(current_setting('request.company_id', true), '')::uuid;
  v_run     uuid := md5(random()::text || clock_timestamp()::text)::uuid;
begin
  -- output: one row per active project (entity = project id).
  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select
    v_run, 'output', p.id, 1, p_kpi_version,
    src.id, 'project:' || p.id, p_as_of, p.company_id
  from canonical.project p
  join canonical.source src
    on src.company_id = p.company_id and src.source_system = 'manual_capture'
  where p.company_id = v_company
    and p.status = 'active';

  -- output: one row per designer member (entity = member id).
  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select
    v_run, 'output', m.id, 1, p_kpi_version,
    src.id, 'member:' || m.id, p_as_of, m.company_id
  from canonical.member m
  join canonical.source src
    on src.company_id = m.company_id and src.source_system = 'manual_capture'
  where m.company_id = v_company
    and m.role = 'designer';

  -- automated: one row per audit task, contribution = automation credit.
  insert into mart.kpi_lineage
    (kpi_run_id, metric_key, entity_id, contribution_value, kpi_version,
     source_id, record_ref, observed_at, company_id)
  select
    v_run, 'automated', t.id,
    case t.status when 'automated' then 1 when 'assisted' then 0.5 else 0 end,
    p_kpi_version,
    src.id, 'auditTask:' || t.id, p_as_of, t.company_id
  from canonical.audit_task t
  join canonical.source src
    on src.company_id = t.company_id and src.source_system = 'manual_capture'
  where t.company_id = v_company;

  return query
    select * from mart.kpi_lineage
     where kpi_run_id = v_run
       and metric_key in ('output','automated');
end;
$$;

-- ============================================================
-- RE-ISSUE app_user access + RLS on the NEW mart object (cost_model).
--   0004's "grant … on all tables" only covered tables that existed then;
--   cost_model is new, so grant SELECT here. ENABLE + FORCE RLS + the company_id
--   policy (nullif empty-claim guard → cleared claim fails closed, no ''::uuid).
--   The new recompute fns are grant-execute'd (0004 grants execute on ALL mart
--   functions, but that snapshot predates these — re-grant explicitly).
-- ============================================================
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'app_user') then
    grant usage  on schema mart to app_user;
    grant select on mart.cost_model to app_user;
    grant execute on function mart.recompute_finance(timestamptz, int)       to app_user;
    grant execute on function mart.recompute_profitability(timestamptz, int) to app_user;
    grant execute on function mart.recompute_aios(timestamptz, int)          to app_user;
  end if;
end $$;

alter table mart.cost_model enable row level security;
alter table mart.cost_model force  row level security;
do $$ begin
  create policy cost_model_company_isolation on mart.cost_model
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
