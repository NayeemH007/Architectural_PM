-- ============================================================
-- 0003_canonical_full.sql — the REST of the live canonical surface.
--
-- Extends the partial spike schema (member/project/client/payment_milestone/
-- source) to ALL live entities the app reads + the project_member scoping
-- table. Closes F5 (live schema), da-1 (self-approval CHECK), sr-* (member
-- scoping). Adds member.finance_grant + member.can_check is already present.
--
-- pglite HARD RULES honoured:
--   * text PKs match the live ids (ap1/f1/s1/d1/ac1/t1); UUIDs minted in seed.
--   * provenance triple (source_system/source_record_ref/observed_at) on every
--     INGESTED fact (approvals/files/submissions/decisions/activity); audit_task
--     is editorial config — provenance optional.
--   * RLS ENABLED on every new table with the company_id policy (missing_ok
--     `, true` so a cleared claim → NULL → fail-closed).
--
-- IDEMPOTENT: "create table if not exists" + DO-block policy guards so the
-- harness can apply this file twice with no error.
-- ============================================================

-- ---- canonical.source idempotency key ----
-- The seed mints a fresh source UUID per call; without a stable conflict target
-- a re-seed (ledger test 7) would INSERT duplicate (company, source_system) rows,
-- which then DOUBLES the recompute lineage join (duplicate kpi_lineage PK). A
-- unique index on (company_id, source_system) lets the seed do
-- `on conflict (company_id, source_system) do nothing` → truly idempotent.
create unique index if not exists source_company_system_ux
  on canonical.source (company_id, source_system);

-- ---- member.finance_grant (PD-A: per-member finance band grant) ----
-- m1+m2 seeded true; isFinanceEligible keys off this grant. Added here so 0003
-- carries the column; can_check already exists on canonical.member (0001).
alter table canonical.member add column if not exists finance_grant boolean not null default false;

-- ---- canonical.design_approval (live DesignApproval, data.ts:294) ----
create table if not exists canonical.design_approval (
  id              text primary key,
  company_id      uuid not null,                          -- RLS key
  project_id      text references canonical.project(id),
  type            text,                                   -- concept|design|material|revision|technical
  title           text,
  submitted_by    text not null,                          -- live submittedById
  decided_by      text,                                   -- live reviewerId (approver; NULL until decided)
  status          text,                                   -- pending|approved|revise|rejected
  submitted_date  date,
  decided_date    date,
  version         text,
  phase           smallint,
  -- F2/① provenance, minted at seed
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now(),
  -- da-1 (LOAD-BEARING): a reviewer may not decide their own submission.
  constraint design_approval_no_self_approve
    check (decided_by is null or decided_by <> submitted_by)
);

-- ---- canonical.file_record (live FileRecord, data.ts:251) ----
create table if not exists canonical.file_record (
  id              text primary key,
  company_id      uuid not null,                          -- RLS key
  project_id      text references canonical.project(id),
  name            text,
  kind            text,                                   -- FileKind union
  owner_id        text,
  storage         text,                                   -- local|gdrive|archintel
  version         text,
  uploaded_date   date,
  status          text,                                   -- FileStatus union
  phase           smallint,
  ext             text,
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now()
);

-- ---- canonical.client_submission (live ClientSubmission, data.ts:323) ----
create table if not exists canonical.client_submission (
  id              text primary key,
  company_id      uuid not null,                          -- RLS key
  project_id      text references canonical.project(id),
  package         text,
  version         text,
  sent_via        text,                                   -- whatsapp|email
  sent_date       date,
  sent_by         text,
  feedback        text,
  status          text,                                   -- sent|feedback|revision_requested|approved
  approved_date   date,
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now()
);

-- ---- canonical.decision (live DecisionA, data.ts:386 — EXTENDED) ----
create table if not exists canonical.decision (
  id              text primary key,
  company_id      uuid not null,                          -- RLS key
  project_id      text references canonical.project(id),
  type            text,                                   -- layout_freeze|material_lock|change_request|decision
  summary         text,
  decided_by      text,                                   -- live `by`
  decided_date    date,                                   -- live `date`
  phase           smallint,
  promoted        boolean not null default false,         -- verified into a citable record
  promoted_by     text,                                   -- NULL until promoted
  promoted_at     timestamptz,                            -- NULL until promoted
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now()
);

-- ---- canonical.activity (live ActivityA, data.ts:405) ----
create table if not exists canonical.activity (
  id              text primary key,
  company_id      uuid not null,                          -- RLS key
  project_id      text,                                   -- nullable (live allows null)
  type            text,                                   -- file|approval|submission|payment|phase|decision|member
  actor           text,
  summary         text,
  occurred_at     timestamptz,                            -- live `date`
  source_system     text not null,
  source_record_ref text not null,
  observed_at       timestamptz not null,
  ingested_at       timestamptz not null default now()
);

-- ---- canonical.audit_task (live AuditTask, aios.ts:25 — editorial config) ----
create table if not exists canonical.audit_task (
  id              text primary key,
  company_id      uuid not null,                          -- RLS key
  title           text,
  owner           text,
  cadence         text,
  min_per_week    int,
  automatable     text,                                   -- high|medium
  human_gate      boolean not null,                       -- lock ⑦: t1/t3/t4/t5 -> true at seed
  behavior        text,
  status          text                                    -- automated|assisted|manual
);

-- ---- canonical.project_member (sr-*, NEW — no live array) ----
create table if not exists canonical.project_member (
  company_id       uuid not null,                         -- RLS key
  project_id       text not null references canonical.project(id),
  member_id        text not null references canonical.member(id),
  role_on_project  text,                                  -- lead|team
  primary key (company_id, project_id, member_id)
);

-- ============================================================
-- RLS — ENABLE + company_id isolation policy on every new table.
--
-- FAIL-CLOSED on a CLEARED claim (A-2 / ledger test 3): a per-request reset
-- sets request.company_id to '' (empty string), NOT unset. `''::uuid` RAISES,
-- so we wrap in nullif(current_setting('request.company_id', true), '')::uuid
-- → an empty/absent claim resolves to NULL → `company_id = NULL` is never true
-- → the policy matches NOTHING (0 rows), exactly the fail-closed behaviour.
--
-- The same nullif() guard is RE-APPLIED to the 0001 policies below (recreated
-- in-place) so canonical.member/project/client/payment_milestone also survive a
-- cleared claim instead of erroring on `''::uuid`.
-- ============================================================
alter table canonical.design_approval    enable row level security;
alter table canonical.file_record         enable row level security;
alter table canonical.client_submission   enable row level security;
alter table canonical.decision            enable row level security;
alter table canonical.activity            enable row level security;
alter table canonical.audit_task          enable row level security;
alter table canonical.project_member      enable row level security;

-- Recreate the 0001 policies with the nullif() empty-claim guard (idempotent).
drop policy if exists member_company_isolation  on canonical.member;
drop policy if exists project_company_isolation on canonical.project;
drop policy if exists client_company_isolation  on canonical.client;
drop policy if exists pm_company_isolation      on canonical.payment_milestone;
create policy member_company_isolation on canonical.member
  using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
create policy project_company_isolation on canonical.project
  using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
create policy client_company_isolation on canonical.client
  using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
create policy pm_company_isolation on canonical.payment_milestone
  using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);

do $$ begin
  create policy design_approval_company_isolation on canonical.design_approval
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy file_record_company_isolation on canonical.file_record
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy client_submission_company_isolation on canonical.client_submission
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy decision_company_isolation on canonical.decision
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy activity_company_isolation on canonical.activity
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy audit_task_company_isolation on canonical.audit_task
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy project_member_company_isolation on canonical.project_member
    using (company_id = nullif(current_setting('request.company_id', true), '')::uuid);
exception when duplicate_object then null; end $$;
