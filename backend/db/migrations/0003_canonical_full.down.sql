-- ============================================================
-- 0003_canonical_full.down.sql — drops everything 0003 creates.
-- IDEMPOTENT: "if exists" guards so it runs cleanly even if partially applied.
-- ============================================================

drop table if exists canonical.project_member     cascade;
drop table if exists canonical.audit_task          cascade;
drop table if exists canonical.activity            cascade;
drop table if exists canonical.decision            cascade;
drop table if exists canonical.client_submission   cascade;
drop table if exists canonical.file_record         cascade;
drop table if exists canonical.design_approval     cascade;

alter table canonical.member drop column if exists finance_grant;
