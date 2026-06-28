-- ============================================================
-- 0004_app_role.sql — the NON-SUPERUSER role that ENFORCES RLS.
--
-- Closes carried gap A-3 / G3: the spike only had function-predicate scoping
-- because pglite's bootstrap SUPERUSER bypasses RLS. A NOLOGIN, is_superuser=off
-- role (`app_user`) is subject to the policies — so under `SET ROLE app_user`
-- a Firm-A read returns ZERO Firm-B rows even with NO explicit predicate.
--
-- Empirically verified against pglite 0.5.3 (real PG 16): superuser bypasses,
-- app_user enforces. This migration MUST apply AFTER 0003 so the new tables
-- exist to grant on (filename order 0004 > 0003 guarantees it).
--
-- IDEMPOTENT: create role guarded with a duplicate_object DO-block; the
-- grant ... on all tables / alter ... force re-run harmlessly.
-- ============================================================

do $$ begin
  create role app_user nologin;
exception when duplicate_object then null; end $$;

grant usage on schema canonical to app_user;
grant usage on schema mart      to app_user;
grant select on all tables    in schema canonical to app_user;
grant select on all tables    in schema mart      to app_user;
grant execute on all functions in schema mart      to app_user;   -- recompute under the role
-- recompute (SECURITY INVOKER) writes its summary + lineage rows under app_user.
grant insert on mart.portfolio_summary to app_user;
grant insert on mart.kpi_lineage       to app_user;

-- ============================================================
-- FORCE ROW LEVEL SECURITY on every canonical + mart table so even a table
-- OWNER is subject to the policy (defense-in-depth; superuser still bypasses,
-- which is exactly why the LEDGER sets role to app_user). Re-issued here so
-- 0003's new tables are covered alongside 0001/0002.
-- ============================================================
alter table canonical.member            force row level security;
alter table canonical.project           force row level security;
alter table canonical.client            force row level security;
alter table canonical.payment_milestone force row level security;
alter table canonical.design_approval   force row level security;
alter table canonical.file_record       force row level security;
alter table canonical.client_submission force row level security;
alter table canonical.decision          force row level security;
alter table canonical.activity          force row level security;
alter table canonical.audit_task        force row level security;
alter table canonical.project_member    force row level security;

-- mart tables: enable + force RLS + company_id policy so app_user reads of
-- portfolio_summary / kpi_lineage are also company-scoped (defense-in-depth).
alter table mart.portfolio_summary enable row level security;
alter table mart.kpi_lineage       enable row level security;
alter table mart.portfolio_summary force row level security;
alter table mart.kpi_lineage       force row level security;

-- WITH CHECK matches USING so recompute (SECURITY INVOKER under app_user) can
-- INSERT its own-company summary + lineage rows while still being read-scoped.
-- nullif() empty-claim guard: a cleared claim → NULL → fail-closed (no `''::uuid`).
do $$ begin
  create policy portfolio_summary_company_isolation on mart.portfolio_summary
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy kpi_lineage_company_isolation on mart.kpi_lineage
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid)
    with check (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
