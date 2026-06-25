-- ============================================================
-- 0001_canonical.sql  — canonical (live-shape) schema, pglite path
--
-- Reconciled to the LIVE entities (ProjectA, Member, PaymentMilestone,
-- ClientA) per docs/backend-architecture-review-orchestrated.md §7,
-- WITH the BUILD-CONTRACT spike refinements:
--
--   * pglite HARD RULES: no pgcrypto / gen_random_uuid(); no citext.
--     UUIDs are minted in seed/app code. email uses text + a unique
--     index on lower(email) instead of citext.
--   * Tax is DEFERRED (CONTEXT lock ⑤): net_receivable/vat/vds_withheld/
--     ait_withheld are PLAIN NULLABLE columns left NULL on this path —
--     NOT generated/stored, NO reconcile CHECK. The §7 generated columns
--     + reconcile_net CHECK belong to the later TAX_NET phase
--     (see 0001_canonical.supabase.sql for the Supabase-faithful variant).
--
-- IDEMPOTENT: every object guarded with "if not exists" / DO-block so the
-- harness can apply this file twice with no error.
-- ============================================================

create schema if not exists canonical;

-- F5: 5-role enum exactly as live (founder|principal|project_lead|designer|finance)
do $$ begin
  create type member_role as enum ('founder','principal','project_lead','designer','finance');
exception when duplicate_object then null; end $$;

-- live PaymentMilestone status set
do $$ begin
  create type payment_status_a as enum ('pending','partial','paid','overdue');
exception when duplicate_object then null; end $$;

-- ---- canonical.member (live m1..m6) ----
create table if not exists canonical.member (
  id          text primary key,
  company_id  uuid not null,                       -- RLS key
  name        text not null,
  role        member_role not null,
  title       text,
  is_approver boolean not null default false,
  email       text,                                -- citext-free: unique index on lower(email)
  can_check   boolean not null default false       -- F1 maker-checker eligibility (founder|finance true)
);
create unique index if not exists member_email_lower_ux
  on canonical.member (lower(email)) where email is not null;

-- ---- canonical.project (live a1..a8) ----
create table if not exists canonical.project (
  id             text primary key,
  company_id     uuid not null,                    -- RLS key
  code           text not null,
  name           text not null,
  client_id      text,
  lead_id        text references canonical.member(id),
  type           text not null,
  status         text not null,
  current_phase  smallint check (current_phase between 1 and 4),
  contract_value numeric(14,2) not null,           -- live: contractValue only
  health         text not null,
  blocker        text,
  completeness   smallint default 0
);
create unique index if not exists project_company_code_ux
  on canonical.project (company_id, code);

-- ---- canonical.client (live ClientA c1..c6) ----
create table if not exists canonical.client (
  id            text primary key,
  company_id    uuid not null,                     -- RLS key
  name          text not null,
  contact_name  text,
  phone         text,
  email         text,
  whatsapp_group text,
  type          text
);

-- ---- canonical.payment_milestone (F3 grain; tax DEFERRED/DORMANT) ----
create table if not exists canonical.payment_milestone (
  id              text primary key,
  company_id      uuid not null,                   -- RLS key
  project_id      text not null references canonical.project(id),
  label           text,
  linked_phase    smallint,
  type            text,
  gross_amount    numeric(14,2) not null,
  received_amount numeric(14,2) not null default 0,
  due_date        date,
  received_date   date,
  status          payment_status_a not null,
  -- DEFERRED tax columns: present but PLAIN NULLABLE, left NULL (lock ⑤).
  -- NOT generated/stored; NO reconcile CHECK on the pglite path.
  net_receivable  numeric(14,2),
  vat             numeric(14,2),
  vds_withheld    numeric(14,2),
  ait_withheld    numeric(14,2),
  -- F2/① provenance, minted at seed
  source_system    text not null,
  source_record_ref text not null,
  observed_at      timestamptz not null,
  ingested_at      timestamptz not null default now(),
  -- C5 idempotency: a milestone is unique within (company, project, label, phase)
  constraint payment_milestone_idem_uq unique (company_id, project_id, label, linked_phase)
);
create index if not exists payment_milestone_overdue_ix
  on canonical.payment_milestone (company_id, status, due_date);

-- ---- canonical.source registry (so kpi_lineage.source_id is a real uuid) ----
create table if not exists canonical.source (
  id            uuid primary key,                  -- minted in seed
  company_id    uuid not null,
  source_system text not null,
  display_name  text
);

-- ============================================================
-- RLS — ADDED for Supabase faithfulness. NOTE (CONTEXT RLS-BYPASS WARNING):
-- the tests run as pglite's bootstrap SUPERUSER, which BYPASSES RLS, so the
-- recompute function does NOT rely on these policies — it scopes reads
-- EXPLICITLY by current_setting('request.company_id'). These policies exist
-- so the pglite DDL stays byte-compatible and documents the intended band.
-- ============================================================
alter table canonical.member             enable row level security;
alter table canonical.project            enable row level security;
alter table canonical.client             enable row level security;
alter table canonical.payment_milestone  enable row level security;

do $$ begin
  create policy member_company_isolation on canonical.member
    using (company_id = current_setting('request.company_id', true)::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy project_company_isolation on canonical.project
    using (company_id = current_setting('request.company_id', true)::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy client_company_isolation on canonical.client
    using (company_id = current_setting('request.company_id', true)::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy pm_company_isolation on canonical.payment_milestone
    using (company_id = current_setting('request.company_id', true)::uuid);
exception when duplicate_object then null; end $$;
