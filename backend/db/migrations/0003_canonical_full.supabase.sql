-- ============================================================
-- 0003_canonical_full.supabase.sql — Supabase-FAITHFUL DDL variant.
--
-- SYNTAX-AUTHORED ONLY. The harness NEVER runs *.supabase.sql under pglite.
-- Records the real Postgres/Supabase DDL that DIFFERS from the pglite path:
--   * auth.jwt()-based RLS policies (real JWT, not request.* GUCs)
--   * (provenance/text PKs/CHECK are identical to the pglite path)
-- ============================================================

create schema if not exists canonical;

alter table canonical.member add column if not exists finance_grant boolean not null default false;

create table if not exists canonical.design_approval (
  id              text primary key,
  company_id      uuid not null,
  project_id      text references canonical.project(id),
  type            text,
  title           text,
  submitted_by    text not null,
  decided_by      text,
  status          text,
  submitted_date  date,
  decided_date    date,
  version         text,
  phase           smallint,
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now(),
  constraint design_approval_no_self_approve
    check (decided_by is null or decided_by <> submitted_by)
);

create table if not exists canonical.file_record (
  id              text primary key,
  company_id      uuid not null,
  project_id      text references canonical.project(id),
  name            text,
  kind            text,
  owner_id        text,
  storage         text,
  version         text,
  uploaded_date   date,
  status          text,
  phase           smallint,
  ext             text,
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now()
);

create table if not exists canonical.client_submission (
  id              text primary key,
  company_id      uuid not null,
  project_id      text references canonical.project(id),
  package         text,
  version         text,
  sent_via        text,
  sent_date       date,
  sent_by         text,
  feedback        text,
  status          text,
  approved_date   date,
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now()
);

create table if not exists canonical.decision (
  id              text primary key,
  company_id      uuid not null,
  project_id      text references canonical.project(id),
  type            text,
  summary         text,
  decided_by      text,
  decided_date    date,
  phase           smallint,
  promoted        boolean not null default false,
  promoted_by     text,
  promoted_at     timestamptz,
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now()
);

create table if not exists canonical.activity (
  id              text primary key,
  company_id      uuid not null,
  project_id      text,
  type            text,
  actor           text,
  summary         text,
  occurred_at     timestamptz,
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now()
);

create table if not exists canonical.audit_task (
  id              text primary key,
  company_id      uuid not null,
  title           text,
  owner           text,
  cadence         text,
  min_per_week    int,
  automatable     text,
  human_gate      boolean not null,
  behavior        text,
  status          text
);

create table if not exists canonical.project_member (
  company_id       uuid not null,
  project_id       text not null references canonical.project(id),
  member_id        text not null references canonical.member(id),
  role_on_project  text,
  primary key (company_id, project_id, member_id)
);

alter table canonical.design_approval    enable row level security;
alter table canonical.file_record         enable row level security;
alter table canonical.client_submission   enable row level security;
alter table canonical.decision            enable row level security;
alter table canonical.activity            enable row level security;
alter table canonical.audit_task          enable row level security;
alter table canonical.project_member      enable row level security;

-- Real Supabase policies key off the company_id claim in the JWT.
create policy design_approval_company_isolation on canonical.design_approval
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy file_record_company_isolation on canonical.file_record
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy client_submission_company_isolation on canonical.client_submission
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy decision_company_isolation on canonical.decision
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy activity_company_isolation on canonical.activity
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy audit_task_company_isolation on canonical.audit_task
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy project_member_company_isolation on canonical.project_member
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
