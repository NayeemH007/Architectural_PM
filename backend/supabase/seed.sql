-- ============================================================
-- backend/supabase/seed.sql — reproducible Supabase seed for the trust spine.
--
-- Mirrors backend/db/seed/seed_live.mjs (the LIVE ArchIntel arrays + minted
-- provenance) for the REAL Supabase Postgres. Idempotent: every INSERT uses
-- `ON CONFLICT ... DO NOTHING` with FIXED uuids, so `supabase db reset` (or a
-- manual re-apply) is a safe no-op. NO wall clock — all observed_at/asOf derive
-- from the seed date literals.
--
-- Firm A (00000000-0000-0000-0000-00000000aaaa) = the real live entities
--   (m1..m6 with m1,m2 finance_grant+can_check; a1..a8; payments incl pm10
--    a5/930000/overdue; c1..c6; the new entities).
-- Firm B (00000000-0000-0000-0000-00000000bbbb) = synthetic isolation proof.
--
-- Locked decisions honoured:
--   * tax columns are GENERATED on Supabase (0001_*.supabase.sql); we DO NOT
--     insert into them (vat/vds_withheld/ait_withheld/net_receivable are
--     computed) — the seed inserts only gross_amount/received_amount/status.
--   * audit_task t1/t3/t4/t5 human_gate=true (lock ⑦).
--
-- canonical.source: the recompute_* fns JOIN canonical.source on source_system.
--   tallyprime  → portfolio/finance lineage source_id.
--   manual_capture → profitability/aios lineage source_id.
--   (gdrive/whatsapp seeded for completeness of any future lineage join.)
-- Fixed source uuids (deterministic) so a re-seed is a true no-op.
-- ============================================================

-- ─── LOCK ⑤ (tax DEFERRED) — keep the TAX_NET reconcile guard DORMANT ───
-- The 0001_*.supabase.sql migration carries the TAX_NET-phase GENERATED tax
-- columns + a `reconcile_net` CHECK (received_amount <= net_receivable). That
-- guard only holds for NET-mode bookings; the live data books GROSS receipts
-- (received_amount = gross_amount on paid milestones) per CONTEXT lock ⑤
-- ("Finance KPIs emit gross … withholding not modeled"). The reconcile CHECK
-- belongs to the deferred tax phase and must stay dormant until ⑤ re-opens, so
-- we DROP it here (a runtime DB op, NOT a migration-file edit) so gross data can
-- land. The GENERATED tax columns themselves are kept (present-but-unread). No
-- recompute_* function reads net_receivable/vat/vds/ait — they all sum gross.
alter table canonical.payment_milestone drop constraint if exists reconcile_net;

-- ─── GRANT gap fix: authenticated needs cost_model (a recompute_profitability
--     write target). 0004_app_role granted `all tables in schema mart` BEFORE
--     0005 created mart.cost_model, so the blanket grant missed it. Restore the
--     0004 intent (authenticated reads mart + writes the recompute targets) so
--     the SECURITY-INVOKER recompute_profitability can materialise cost_model
--     under the authenticated role (RLS-enforced, not a superuser bypass). ───
grant select, insert, update on mart.cost_model to authenticated;

-- ─── canonical.source (fixed uuids; recompute joins on (company_id, source_system)) ───
insert into canonical.source (id, company_id, source_system, display_name) values
  ('a0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000aaaa','tallyprime',    'TallyPrime (Firm A)'),
  ('a0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000aaaa','manual_capture','manual_capture (Firm A)'),
  ('a0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000aaaa','gdrive',        'gdrive (Firm A)'),
  ('a0000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000aaaa','whatsapp',      'whatsapp (Firm A)'),
  ('b0000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000bbbb','tallyprime',    'TallyPrime (Firm B)'),
  ('b0000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-00000000bbbb','manual_capture','manual_capture (Firm B)'),
  ('b0000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-00000000bbbb','gdrive',        'gdrive (Firm B)'),
  ('b0000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-00000000bbbb','whatsapp',      'whatsapp (Firm B)')
on conflict (id) do nothing;

-- ─── canonical.member (Firm A m1..m6; m1,m2 finance_grant+can_check) + Firm B bm1 ───
insert into canonical.member (id, company_id, name, role, title, is_approver, email, can_check, finance_grant) values
  ('m1','00000000-0000-0000-0000-00000000aaaa','Sharif Raiana Mahmud','founder',     'Chief Interior Architect & Founder', true,  'raiana@spaceesse.com', true,  true ),
  ('m2','00000000-0000-0000-0000-00000000aaaa','Fariha Karim',        'principal',   'Principal Architect & Co-Founder',   false, 'fariha@spaceesse.com', true,  true ),
  ('m3','00000000-0000-0000-0000-00000000aaaa','Tasnia Rahman',       'project_lead','Project Lead',                       false, 'tasnia@spaceesse.com',false, false),
  ('m4','00000000-0000-0000-0000-00000000aaaa','Imran Kabir',         'project_lead','Project Lead',                       false, 'imran@spaceesse.com', false, false),
  ('m5','00000000-0000-0000-0000-00000000aaaa','Nabila Hasan',        'designer',    '3D & Visualization Designer',        false, 'nabila@spaceesse.com',false, false),
  ('m6','00000000-0000-0000-0000-00000000aaaa','Rifat Ahmed',         'designer',    'Junior Designer (Technical)',        false, 'rifat@spaceesse.com', false, false),
  ('bm1','00000000-0000-0000-0000-00000000bbbb','Firm-B Founder',     'founder',     'Founder',                            true,  'founder@firmb.example',true, true )
on conflict (id) do nothing;

-- ─── canonical.client (Firm A) ───
insert into canonical.client (id, company_id, name, contact_name, phone, email, whatsapp_group, type) values
  ('c1','00000000-0000-0000-0000-00000000aaaa','Mr. Rahim (Gulshan)',     'Mr. Abdur Rahim',     '+8801711000101','rahim@gmail.com',       'Gulshan Apt · Space Esse',   'residential'),
  ('c2','00000000-0000-0000-0000-00000000aaaa','Lumen Hospitality',       'Sadia Islam',         '+8801711000102','sadia@lumen.com.bd',    'Lumen Café · Space Esse',    'hospitality'),
  ('c3','00000000-0000-0000-0000-00000000aaaa','MediCare Ltd.',           'Dr. Anwar',           '+8801711000103','anwar@medicare.com.bd', 'MediCare Clinic · Space Esse','healthcare'),
  ('c4','00000000-0000-0000-0000-00000000aaaa','Mrs. Anika (Bashundhara)','Mrs. Anika Chowdhury','+8801711000104','anika@gmail.com',       'Penthouse · Space Esse',     'residential'),
  ('c5','00000000-0000-0000-0000-00000000aaaa','Bashati Group',           'Sohel Bashati',       '+8801711000105','sohel@bashati.com',     'Tejgaon Office · Space Esse','corporate'),
  ('c6','00000000-0000-0000-0000-00000000aaaa','Aura Boutique',           'Farzana Aura',        '+8801711000106','farzana@aura.com.bd',   'Aura Uttara · Space Esse',  'retail')
on conflict (id) do nothing;

-- ─── canonical.project (Firm A a1..a8 + Firm B b1). completeness=100 ───
insert into canonical.project (id, company_id, code, name, client_id, lead_id, type, status, current_phase, contract_value, health, blocker, completeness) values
  ('a1','00000000-0000-0000-0000-00000000aaaa','SE-101','Gulshan Apartment',          'c1','m3','residential','active',  3,2800000,'on_track',null,100),
  ('a2','00000000-0000-0000-0000-00000000aaaa','SE-104','Banani Café — Lumen',        'c2','m4','hospitality','active',  2,1900000,'watch',   null,100),
  ('a3','00000000-0000-0000-0000-00000000aaaa','SE-098','Dhanmondi Clinic — MediCare','c3','m3','healthcare', 'active',  4,3400000,'on_track',null,100),
  ('a4','00000000-0000-0000-0000-00000000aaaa','SE-106','Bashundhara Penthouse',      'c4','m4','residential','active',  1,4600000,'on_track',null,100),
  ('a5','00000000-0000-0000-0000-00000000aaaa','SE-103','Tejgaon Office — Bashati',   'c5','m3','corporate',  'active',  2,3100000,'at_risk', 'Layout freeze waiting on Raiana''s approval · Phase-2 payment 18 days overdue',100),
  ('a6','00000000-0000-0000-0000-00000000aaaa','SE-100','Uttara Boutique — Aura',     'c6','m4','retail',     'active',  3,1500000,'on_track',null,100),
  ('a7','00000000-0000-0000-0000-00000000aaaa','SE-088','Mirpur Restaurant — Spice Garden','c2','m4','hospitality','archived',4,2200000,'on_track',null,100),
  ('a8','00000000-0000-0000-0000-00000000aaaa','SE-091','Gulshan Salon — Glow',       'c6','m3','retail',     'archived',4,1300000,'on_track',null,100),
  ('b1','00000000-0000-0000-0000-00000000bbbb','BB-001','Firm-B Demo Project',         null,null,'corporate',  'active',  2,1000000,'at_risk', null,100)
on conflict (id) do nothing;

-- ─── canonical.payment_milestone. tax cols GENERATED → only gross/received/status.
--     linked_phase 0 stands in for NULL (idempotency key never sees NULL).
--     observed_at = received_date (or due_date if unreceived) at T00:00:00Z.
--     source_record_ref = 'tally:'||id. pm10 = a5/930000/overdue. ───
insert into canonical.payment_milestone
  (id, company_id, project_id, label, linked_phase, type, gross_amount, received_amount, due_date, received_date, status, source_system, source_record_ref, observed_at) values
  ('pm1', '00000000-0000-0000-0000-00000000aaaa','a1','Mobilisation (10%)',     1,'phased',  280000, 280000, '2026-02-15','2026-02-14','paid',   'tallyprime','tally:pm1', '2026-02-14T00:00:00Z'),
  ('pm2', '00000000-0000-0000-0000-00000000aaaa','a1','Concept sign-off (30%)', 2,'phased',  840000, 840000, '2026-04-25','2026-04-26','paid',   'tallyprime','tally:pm2', '2026-04-26T00:00:00Z'),
  ('pm3', '00000000-0000-0000-0000-00000000aaaa','a1','Design development (30%)',3,'phased',  840000, 0,      '2026-06-25', null,        'pending','tallyprime','tally:pm3', '2026-06-25T00:00:00Z'),
  ('pm4', '00000000-0000-0000-0000-00000000aaaa','a1','Construction docs (30%)',4,'phased',  840000, 0,      '2026-08-20', null,        'pending','tallyprime','tally:pm4', '2026-08-20T00:00:00Z'),
  ('pm5', '00000000-0000-0000-0000-00000000aaaa','a2','Full payment (upfront)', 0,'upfront',1900000,1900000, '2026-04-05','2026-04-04','paid',   'tallyprime','tally:pm5', '2026-04-04T00:00:00Z'),
  ('pm6', '00000000-0000-0000-0000-00000000aaaa','a3','Mobilisation (20%)',     1,'phased',  680000, 680000, '2025-11-25','2025-11-24','paid',   'tallyprime','tally:pm6', '2025-11-24T00:00:00Z'),
  ('pm7', '00000000-0000-0000-0000-00000000aaaa','a3','Design development (40%)',3,'phased', 1360000,1360000, '2026-04-10','2026-04-12','paid',   'tallyprime','tally:pm7', '2026-04-12T00:00:00Z'),
  ('pm8', '00000000-0000-0000-0000-00000000aaaa','a3','Construction docs (40%)',4,'phased', 1360000, 600000, '2026-06-30','2026-06-18','partial','tallyprime','tally:pm8', '2026-06-18T00:00:00Z'),
  ('pm9', '00000000-0000-0000-0000-00000000aaaa','a5','Mobilisation (20%)',     1,'phased',  620000, 620000, '2026-03-20','2026-03-19','paid',   'tallyprime','tally:pm9', '2026-03-19T00:00:00Z'),
  ('pm10','00000000-0000-0000-0000-00000000aaaa','a5','Concept sign-off (30%)', 2,'phased',  930000, 0,      '2026-06-04', null,        'overdue','tallyprime','tally:pm10','2026-06-04T00:00:00Z'),
  ('pm11','00000000-0000-0000-0000-00000000aaaa','a4','Mobilisation (15%)',     1,'phased',  690000, 690000, '2026-05-30','2026-05-29','paid',   'tallyprime','tally:pm11','2026-05-29T00:00:00Z'),
  ('pm12','00000000-0000-0000-0000-00000000aaaa','a6','Full payment (upfront)', 0,'upfront',1500000,1500000, '2026-01-15','2026-01-14','paid',   'tallyprime','tally:pm12','2026-01-14T00:00:00Z'),
  -- Firm B isolation milestones (distinct refs; bpm1 overdue 500000)
  ('bpm1','00000000-0000-0000-0000-00000000bbbb','b1','Firm-B milestone one',   1,'phased',  500000, 0,      '2026-05-01', null,        'overdue','tallyprime','tally:bpm1','2026-05-01T00:00:00Z'),
  ('bpm2','00000000-0000-0000-0000-00000000bbbb','b1','Firm-B milestone two',   2,'phased',  500000, 0,      '2026-06-01', null,        'overdue','tallyprime','tally:bpm2','2026-06-01T00:00:00Z')
on conflict (id) do nothing;

-- ─── canonical.design_approval. decided_by = reviewer (m1) ONLY when decided
--     (NULL while pending so no-self-approve CHECK never trips). ───
insert into canonical.design_approval
  (id, company_id, project_id, type, title, submitted_by, decided_by, status, submitted_date, decided_date, version, phase, source_system, source_record_ref, observed_at) values
  ('ap1','00000000-0000-0000-0000-00000000aaaa','a5','concept',  'Layout freeze — open-plan workstations','m3', null, 'pending',  '2026-06-19', null,        'v2',2,'manual_capture','manual:ap1','2026-06-19T00:00:00Z'),
  ('ap2','00000000-0000-0000-0000-00000000aaaa','a1','material', 'Material selection — living & dining',  'm3', null, 'pending',  '2026-06-20', null,        'v3',3,'manual_capture','manual:ap2','2026-06-20T00:00:00Z'),
  ('ap3','00000000-0000-0000-0000-00000000aaaa','a2','concept',  'Concept direction & moodboard',         'm4', 'm1', 'revise',   '2026-06-14','2026-06-16','v2',2,'manual_capture','manual:ap3','2026-06-16T00:00:00Z'),
  ('ap4','00000000-0000-0000-0000-00000000aaaa','a3','material', 'Finish schedule — clinic',              'm3', 'm1', 'approved', '2026-05-30','2026-06-02','v2',3,'manual_capture','manual:ap4','2026-06-02T00:00:00Z'),
  ('ap5','00000000-0000-0000-0000-00000000aaaa','a6','design',   '3D visuals — boutique',                 'm5', null, 'pending',  '2026-06-21', null,        'v2',3,'manual_capture','manual:ap5','2026-06-21T00:00:00Z'),
  ('ap6','00000000-0000-0000-0000-00000000aaaa','a3','technical','Technical approval — working drawings Set A','m2','m1','approved','2026-06-18','2026-06-20','v5',4,'manual_capture','manual:ap6','2026-06-20T00:00:00Z'),
  ('bap1','00000000-0000-0000-0000-00000000bbbb','b1','concept', 'Firm-B concept',                        'bm1',null, 'pending',  '2026-06-10', null,        'v1',2,'manual_capture','manual:bap1','2026-06-10T00:00:00Z')
on conflict (id) do nothing;

-- ─── canonical.file_record (gdrive source) ───
insert into canonical.file_record
  (id, company_id, project_id, name, kind, owner_id, storage, version, uploaded_date, status, phase, ext, source_system, source_record_ref, observed_at) values
  ('f1', '00000000-0000-0000-0000-00000000aaaa','a1','Material Selection Sheet','material_sheet','m3','gdrive',   'v3','2026-06-15','shared',    3,'PDF', 'gdrive','gdrive:f1', '2026-06-15T00:00:00Z'),
  ('f2', '00000000-0000-0000-0000-00000000aaaa','a1','Finish Schedule',         'boq',          'm6','archintel','v2','2026-06-18','draft',     3,'XLSX','gdrive','gdrive:f2', '2026-06-18T00:00:00Z'),
  ('f3', '00000000-0000-0000-0000-00000000aaaa','a1','Living Room Render',      'render',       'm5','gdrive',   'v4','2026-06-12','approved',  3,'JPG', 'gdrive','gdrive:f3', '2026-06-12T00:00:00Z'),
  ('f4', '00000000-0000-0000-0000-00000000aaaa','a1','Concept Presentation',    'presentation', 'm3','local',    'v2','2026-04-20','superseded',2,'INDD','gdrive','gdrive:f4', '2026-04-20T00:00:00Z'),
  ('f5', '00000000-0000-0000-0000-00000000aaaa','a3','Working Drawings — Set A','drawing',       'm6','archintel','v5','2026-06-19','shared',    4,'DWG', 'gdrive','gdrive:f5', '2026-06-19T00:00:00Z'),
  ('f6', '00000000-0000-0000-0000-00000000aaaa','a3','Ceiling Plan',            'drawing',       'm6','archintel','v3','2026-06-17','approved',  4,'DWG', 'gdrive','gdrive:f6', '2026-06-17T00:00:00Z'),
  ('f7', '00000000-0000-0000-0000-00000000aaaa','a3','Final BOQ',               'boq',          'm3','gdrive',   'v4','2026-06-16','shared',    4,'XLSX','gdrive','gdrive:f7', '2026-06-16T00:00:00Z'),
  ('f8', '00000000-0000-0000-0000-00000000aaaa','a5','Furniture Layout',        'drawing',       'm3','local',    'v2','2026-05-28','shared',    2,'DWG', 'gdrive','gdrive:f8', '2026-05-28T00:00:00Z'),
  ('f9', '00000000-0000-0000-0000-00000000aaaa','a5','Concept Visuals',         'render',       'm5','gdrive',   'v3','2026-06-02','shared',    2,'JPG', 'gdrive','gdrive:f9', '2026-06-02T00:00:00Z'),
  ('f10','00000000-0000-0000-0000-00000000aaaa','a2','Moodboard',               'presentation', 'm4','gdrive',   'v2','2026-05-10','approved',  2,'PDF', 'gdrive','gdrive:f10','2026-05-10T00:00:00Z'),
  ('f11','00000000-0000-0000-0000-00000000aaaa','a2','Initial 3D Model',        'render',       'm5','local',    'v1','2026-05-22','draft',     2,'SKP', 'gdrive','gdrive:f11','2026-05-22T00:00:00Z'),
  ('f12','00000000-0000-0000-0000-00000000aaaa','a4','As-built Drawings',       'drawing',       'm4','local',    'v1','2026-06-01','draft',     1,'DWG', 'gdrive','gdrive:f12','2026-06-01T00:00:00Z'),
  ('f13','00000000-0000-0000-0000-00000000aaaa','a4','Client Requirement Document','brief',     'm4','gdrive',   'v1','2026-06-05','shared',    1,'DOCX','gdrive','gdrive:f13','2026-06-05T00:00:00Z'),
  ('f14','00000000-0000-0000-0000-00000000aaaa','a6','Material Selection Sheet','material_sheet','m4','archintel','v1','2026-06-20','draft',     3,'PDF', 'gdrive','gdrive:f14','2026-06-20T00:00:00Z'),
  ('f15','00000000-0000-0000-0000-00000000aaaa','a7','Final Drawing Set',       'final',        'm4','archintel','v6','2025-12-18','archived',  4,'PDF', 'gdrive','gdrive:f15','2025-12-18T00:00:00Z'),
  ('f16','00000000-0000-0000-0000-00000000aaaa','a7','Final BOQ',               'boq',          'm6','archintel','v5','2025-12-15','archived',  4,'XLSX','gdrive','gdrive:f16','2025-12-15T00:00:00Z'),
  ('bf1','00000000-0000-0000-0000-00000000bbbb','b1','Firm-B drawing',          'drawing',       'bm1','local',   'v1','2026-06-10','draft',     2,'DWG', 'gdrive','gdrive:bf1','2026-06-10T00:00:00Z')
on conflict (id) do nothing;

-- ─── canonical.client_submission (whatsapp source) ───
insert into canonical.client_submission
  (id, company_id, project_id, package, version, sent_via, sent_date, sent_by, feedback, status, approved_date, source_system, source_record_ref, observed_at) values
  ('s1','00000000-0000-0000-0000-00000000aaaa','a1','Concept Presentation',       'v2','whatsapp','2026-04-22','m3','Loved the palette, approved.','approved',          '2026-04-24','whatsapp','whatsapp:s1','2026-04-22T00:00:00Z'),
  ('s2','00000000-0000-0000-0000-00000000aaaa','a1','Material Selection Sheet',   'v3','whatsapp','2026-06-16','m3','Reviewing with family.',    'feedback',           null,        'whatsapp','whatsapp:s2','2026-06-16T00:00:00Z'),
  ('s3','00000000-0000-0000-0000-00000000aaaa','a2','Moodboard & Concept',        'v2','whatsapp','2026-06-12','m4','Wants warmer tones.',       'revision_requested', null,        'whatsapp','whatsapp:s3','2026-06-12T00:00:00Z'),
  ('s4','00000000-0000-0000-0000-00000000aaaa','a3','Working Drawing Set A',      'v5','whatsapp','2026-06-20','m3', null,                       'sent',               null,        'whatsapp','whatsapp:s4','2026-06-20T00:00:00Z'),
  ('s5','00000000-0000-0000-0000-00000000aaaa','a5','Concept Visuals',            'v3','whatsapp','2026-06-03','m3','Approved, proceed to freeze.','approved',         '2026-06-06','whatsapp','whatsapp:s5','2026-06-03T00:00:00Z'),
  ('s6','00000000-0000-0000-0000-00000000aaaa','a4','Client Requirement Document','v1','email',   '2026-06-06','m4', null,                       'sent',               null,        'email',   'email:s6',    '2026-06-06T00:00:00Z'),
  ('bs1','00000000-0000-0000-0000-00000000bbbb','b1','Firm-B package',            'v1','email',   '2026-06-10','bm1',null,                       'sent',               null,        'email',   'email:bs1',   '2026-06-10T00:00:00Z')
on conflict (id) do nothing;

-- ─── canonical.decision (promoted=false; manual_capture source) ───
insert into canonical.decision
  (id, company_id, project_id, type, summary, decided_by, decided_date, phase, promoted, promoted_by, promoted_at, source_system, source_record_ref, observed_at) values
  ('d1','00000000-0000-0000-0000-00000000aaaa','a1','layout_freeze', 'Living/dining layout frozen after revision 2',                          'Tasnia Rahman','2026-04-24',2,false,null,null,'manual_capture','manual:d1','2026-04-24T00:00:00Z'),
  ('d2','00000000-0000-0000-0000-00000000aaaa','a3','material_lock', 'Anti-bacterial flooring & wall finishes locked',                        'Raiana Mahmud','2026-06-02',3,false,null,null,'manual_capture','manual:d2','2026-06-02T00:00:00Z'),
  ('d3','00000000-0000-0000-0000-00000000aaaa','a3','change_request','Client added a reception feature wall — CR raised, cost impact pending','Tasnia Rahman','2026-06-10',4,false,null,null,'manual_capture','manual:d3','2026-06-10T00:00:00Z'),
  ('d4','00000000-0000-0000-0000-00000000aaaa','a6','layout_freeze', 'Retail floor layout frozen',                                            'Imran Kabir',  '2026-03-18',2,false,null,null,'manual_capture','manual:d4','2026-03-18T00:00:00Z'),
  ('d5','00000000-0000-0000-0000-00000000aaaa','a5','decision',      'Open-plan over cabins agreed verbally with client (WhatsApp)',          'Tasnia Rahman','2026-06-18',2,false,null,null,'manual_capture','manual:d5','2026-06-18T00:00:00Z'),
  ('bd1','00000000-0000-0000-0000-00000000bbbb','b1','decision',     'Firm-B decision',                                                       'Firm-B Founder','2026-06-10',2,false,null,null,'manual_capture','manual:bd1','2026-06-10T00:00:00Z')
on conflict (id) do nothing;

-- ─── canonical.activity (occurred_at carries a time; manual_capture source) ───
insert into canonical.activity
  (id, company_id, project_id, type, actor, summary, occurred_at, source_system, source_record_ref, observed_at) values
  ('ac1', '00000000-0000-0000-0000-00000000aaaa','a5','approval',  'Tasnia Rahman','Submitted layout freeze for Raiana''s approval',              '2026-06-19T16:20:00Z','manual_capture','manual:ac1', '2026-06-19T16:20:00Z'),
  ('ac2', '00000000-0000-0000-0000-00000000aaaa','a3','approval',  'Raiana Mahmud','Issued technical approval — Working Drawings Set A',          '2026-06-20T11:05:00Z','manual_capture','manual:ac2', '2026-06-20T11:05:00Z'),
  ('ac3', '00000000-0000-0000-0000-00000000aaaa','a1','submission','Tasnia Rahman','Sent Material Selection Sheet v3 to client via WhatsApp',     '2026-06-16T18:40:00Z','manual_capture','manual:ac3', '2026-06-16T18:40:00Z'),
  ('ac4', '00000000-0000-0000-0000-00000000aaaa','a3','payment',   'System',       'Partial payment ৳6.0L received — Construction docs milestone','2026-06-18T10:00:00Z','manual_capture','manual:ac4', '2026-06-18T10:00:00Z'),
  ('ac5', '00000000-0000-0000-0000-00000000aaaa','a3','file',      'Rifat Ahmed',  'Uploaded Working Drawings Set A v5 to ArchIntel',             '2026-06-19T14:30:00Z','manual_capture','manual:ac5', '2026-06-19T14:30:00Z'),
  ('ac6', '00000000-0000-0000-0000-00000000aaaa','a5','payment',   'System',       'Concept sign-off payment is 18 days overdue (৳9.3L)',          '2026-06-22T08:00:00Z','manual_capture','manual:ac6', '2026-06-22T08:00:00Z'),
  ('ac7', '00000000-0000-0000-0000-00000000aaaa','a2','approval',  'Raiana Mahmud','Sent concept moodboard back for revision (warmer palette)',   '2026-06-16T09:30:00Z','manual_capture','manual:ac7', '2026-06-16T09:30:00Z'),
  ('ac8', '00000000-0000-0000-0000-00000000aaaa','a1','decision',  'Tasnia Rahman','Logged layout freeze for Phase 2',                            '2026-04-24T12:00:00Z','manual_capture','manual:ac8', '2026-04-24T12:00:00Z'),
  ('ac9', '00000000-0000-0000-0000-00000000aaaa','a4','phase',     'Imran Kabir',  'Started Discovery & Site Analysis',                           '2026-05-25T09:00:00Z','manual_capture','manual:ac9', '2026-05-25T09:00:00Z'),
  ('ac10','00000000-0000-0000-0000-00000000aaaa','a3','decision',  'Tasnia Rahman','Raised change request — reception feature wall',              '2026-06-10T15:10:00Z','manual_capture','manual:ac10','2026-06-10T15:10:00Z'),
  ('bac1','00000000-0000-0000-0000-00000000bbbb','b1','decision',  'Firm-B Founder','Firm-B logged a decision',                                   '2026-06-10T10:00:00Z','manual_capture','manual:bac1','2026-06-10T10:00:00Z')
on conflict (id) do nothing;

-- ─── canonical.audit_task. lock ⑦: t1/t3/t4/t5 human_gate=true ───
insert into canonical.audit_task
  (id, company_id, title, owner, cadence, min_per_week, automatable, human_gate, behavior, status) values
  ('t1', '00000000-0000-0000-0000-00000000aaaa','Chase client for approval on WhatsApp + log the reply',          'Project Lead',    'Per submission', 90, 'high',  true,  'Sends the reminder, captures the reply into the client-approval record, advances status.','automated'),
  ('t2', '00000000-0000-0000-0000-00000000aaaa','Nudge Raiana''s pending queue + assemble the approval package', 'Fariha / Lead',   'Daily',          75, 'high',  false, 'Compiles the design/material package and queues it for Raiana. Never decides.','automated'),
  ('t3', '00000000-0000-0000-0000-00000000aaaa','Chase overdue payments + flag ''progressing without payment''', 'Fariha / Finance','Weekly',         60, 'high',  true,  'Detects overdue milestones, drafts a polite reminder, flags the project gate.','automated'),
  ('t4', '00000000-0000-0000-0000-00000000aaaa','Keep the file register current + version + move finished files central','Everyone','Continuous',  120,'high',  true,  'Watches Drive, versions files, registers them, flags local-only / single-person files.','automated'),
  ('t5', '00000000-0000-0000-0000-00000000aaaa','Phase-gate checklist nudges to the owner',                      'Project Lead',    'Per phase',      45, 'high',  true,  'Nudges on incomplete gate items; blocks advance until the gate clears.','automated'),
  ('t6', '00000000-0000-0000-0000-00000000aaaa','Draft the weekly client update / status',                       'Project Lead',    'Weekly',         80, 'high',  false, 'Drafts from the week''s activity; a human reviews and sends.','assisted'),
  ('t7', '00000000-0000-0000-0000-00000000aaaa','Compile requirement doc / finish schedule / BOQ draft',         'Lead / Fariha',   'Per project',    110,'medium',false, 'Drafts the first version from inputs; a human refines (creative execution, accelerated).','assisted'),
  ('t8', '00000000-0000-0000-0000-00000000aaaa','Capture decisions / scope changes from WhatsApp & calls',       'Project Lead',    'Continuous',     70, 'high',  false, 'Extracts into a structured Decision / Change record; a human confirms.','assisted'),
  ('t9', '00000000-0000-0000-0000-00000000aaaa','Status meetings just to stay informed',                         'All',             'Weekly',         150,'high',  false, 'Replaced by the AI Daily Brief — no meeting needed to stay informed.','automated'),
  ('t10','00000000-0000-0000-0000-00000000aaaa','New-assignment + due-date notifications',                       'Project Lead',    'Per task',       30, 'high',  false, 'Auto-notifies the assignee with context and due date.','manual'),
  ('bt1','00000000-0000-0000-0000-00000000bbbb','Firm-B recurring task',                                         'Firm-B',          'Weekly',         30, 'high',  true,  'Firm-B behavior','automated')
on conflict (id) do nothing;

-- ─── canonical.project_member (lead + de-duped team, role 'lead'|'team') ───
insert into canonical.project_member (company_id, project_id, member_id, role_on_project) values
  ('00000000-0000-0000-0000-00000000aaaa','a1','m3','lead'),
  ('00000000-0000-0000-0000-00000000aaaa','a1','m5','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a1','m6','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a2','m4','lead'),
  ('00000000-0000-0000-0000-00000000aaaa','a2','m5','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a3','m3','lead'),
  ('00000000-0000-0000-0000-00000000aaaa','a3','m6','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a4','m4','lead'),
  ('00000000-0000-0000-0000-00000000aaaa','a4','m5','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a5','m3','lead'),
  ('00000000-0000-0000-0000-00000000aaaa','a5','m6','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a5','m5','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a6','m4','lead'),
  ('00000000-0000-0000-0000-00000000aaaa','a6','m5','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a7','m4','lead'),
  ('00000000-0000-0000-0000-00000000aaaa','a7','m5','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a7','m6','team'),
  ('00000000-0000-0000-0000-00000000aaaa','a8','m3','lead'),
  ('00000000-0000-0000-0000-00000000aaaa','a8','m5','team'),
  ('00000000-0000-0000-0000-00000000bbbb','b1','bm1','lead')
on conflict (company_id, project_id, member_id) do nothing;
