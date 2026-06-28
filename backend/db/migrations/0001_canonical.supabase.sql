-- ============================================================
-- 0001_canonical.supabase.sql — Supabase-FAITHFUL DDL variant.
--
-- SYNTAX-AUTHORED ONLY. The harness NEVER runs *.supabase.sql under pglite
-- (it filters them out). This file records the real Postgres/Supabase DDL
-- that DIFFERS from the pglite path:
--   * pgcrypto / gen_random_uuid() for source ids
--   * citext for email (no lower() unique index needed)
--   * auth.uid()-based RLS policies (real JWT, not request.* GUCs)
--   * the TAX_NET phase's GENERATED tax columns + reconcile_net CHECK
--     (on the pglite path these are plain nullable columns left NULL —
--      lock ⑤ DEFERRED).
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists canonical;

do $$ begin
  create type member_role as enum ('founder','principal','project_lead','designer','finance');
exception when duplicate_object then null; end $$;
do $$ begin
  create type payment_status_a as enum ('pending','partial','paid','overdue');
exception when duplicate_object then null; end $$;

create table if not exists canonical.member (
  id          text primary key,
  company_id  uuid not null,
  name        text not null,
  role        member_role not null,
  title       text,
  is_approver boolean not null default false,
  email       citext unique,
  can_check   boolean not null default false
);

create table if not exists canonical.project (
  id             text primary key,
  company_id     uuid not null,
  code           text not null,
  name           text not null,
  client_id      text,
  lead_id        text references canonical.member(id),
  type           text not null,
  status         text not null,
  current_phase  smallint check (current_phase between 1 and 4),
  contract_value numeric(14,2) not null,
  health         text not null,
  blocker        text,
  completeness   smallint default 0,
  unique (company_id, code)
);

create table if not exists canonical.client (
  id             text primary key,
  company_id     uuid not null,
  name           text not null,
  contact_name   text,
  phone          text,
  email          citext,
  whatsapp_group text,
  type           text
);

-- TAX_NET phase: tax columns are GENERATED + reconcile CHECK on Supabase.
create table if not exists canonical.payment_milestone (
  id              text primary key,
  company_id      uuid not null,
  project_id      text not null references canonical.project(id),
  label           text,
  linked_phase    smallint,
  type            text,
  gross_amount    numeric(14,2) not null,
  vat             numeric(14,2) generated always as (round(gross_amount*0.15)) stored,
  vds_withheld    numeric(14,2) generated always as (round(round(gross_amount*0.15)*0.60)) stored,
  ait_withheld    numeric(14,2) generated always as (round(gross_amount*0.10)) stored,
  net_receivable  numeric(14,2) generated always as
     (gross_amount + round(gross_amount*0.15) - round(round(gross_amount*0.15)*0.60) - round(gross_amount*0.10)) stored,
  received_amount numeric(14,2) not null default 0,
  due_date        date,
  received_date   date,
  status          payment_status_a not null,
  source_system    text not null,
  source_record_ref text not null,
  observed_at      timestamptz not null,
  ingested_at      timestamptz not null default now(),
  constraint reconcile_net check (received_amount <= net_receivable + 1),
  unique (company_id, project_id, label, linked_phase)
);
create index if not exists payment_milestone_overdue_ix
  on canonical.payment_milestone (company_id, status, due_date);

create table if not exists canonical.source (
  id            uuid primary key default gen_random_uuid(),
  company_id    uuid not null,
  source_system text not null,
  display_name  text
);

alter table canonical.member             enable row level security;
alter table canonical.project            enable row level security;
alter table canonical.client             enable row level security;
alter table canonical.payment_milestone  enable row level security;

-- Real Supabase policies key off the company_id claim in the JWT.
create policy member_company_isolation on canonical.member
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy project_company_isolation on canonical.project
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy client_company_isolation on canonical.client
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
create policy pm_company_isolation on canonical.payment_milestone
  using (company_id = (auth.jwt() ->> 'company_id')::uuid);
