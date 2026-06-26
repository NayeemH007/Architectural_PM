-- ============================================================
-- 0004_app_role.down.sql — reverses 0004.
-- IDEMPOTENT: "if exists" guards so it runs cleanly even if partially applied.
-- ============================================================

drop policy if exists kpi_lineage_company_isolation       on mart.kpi_lineage;
drop policy if exists portfolio_summary_company_isolation on mart.portfolio_summary;

alter table mart.kpi_lineage       no force row level security;
alter table mart.portfolio_summary no force row level security;
alter table mart.kpi_lineage       disable row level security;
alter table mart.portfolio_summary disable row level security;

alter table canonical.project_member    no force row level security;
alter table canonical.audit_task        no force row level security;
alter table canonical.activity          no force row level security;
alter table canonical.decision          no force row level security;
alter table canonical.client_submission no force row level security;
alter table canonical.file_record       no force row level security;
alter table canonical.design_approval   no force row level security;
alter table canonical.payment_milestone no force row level security;
alter table canonical.client            no force row level security;
alter table canonical.project           no force row level security;
alter table canonical.member            no force row level security;

do $$ begin
  drop owned by app_user;
  drop role app_user;
exception when undefined_object then null; end $$;
