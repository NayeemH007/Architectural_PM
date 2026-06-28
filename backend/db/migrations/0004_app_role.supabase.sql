-- ============================================================
-- 0004_app_role.supabase.sql — Supabase-FAITHFUL variant (SYNTAX-ONLY).
--
-- On real Supabase the non-superuser principal is the built-in `authenticated`
-- role (NOT a hand-rolled app_user), and company_id comes from the verified JWT
-- (auth.jwt() / auth.uid()), not request.* GUCs. The harness NEVER runs this
-- file under pglite — the pglite path uses app_user + current_setting().
-- ============================================================

-- `authenticated` already exists on Supabase; grant it read access.
grant usage on schema canonical to authenticated;
grant usage on schema mart      to authenticated;
grant select on all tables    in schema canonical to authenticated;
grant select on all tables    in schema mart      to authenticated;
grant execute on all functions in schema mart      to authenticated;
grant insert on mart.portfolio_summary to authenticated;
grant insert on mart.kpi_lineage       to authenticated;

-- FORCE RLS so even an owner-context read is policy-bound; `authenticated` is
-- a non-superuser so it is ENFORCED by the auth.jwt() policies already declared.
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

alter table mart.portfolio_summary enable row level security;
alter table mart.kpi_lineage       enable row level security;
alter table mart.portfolio_summary force row level security;
alter table mart.kpi_lineage       force row level security;

create policy portfolio_summary_company_isolation on mart.portfolio_summary
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy kpi_lineage_company_isolation on mart.kpi_lineage
  using (company_id = (auth.jwt() ->> 'company_id')::uuid)
  with check (company_id = (auth.jwt() ->> 'company_id')::uuid);
