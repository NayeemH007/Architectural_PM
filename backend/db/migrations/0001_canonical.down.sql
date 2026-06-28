-- ============================================================
-- 0001_canonical.down.sql — drops everything 0001_canonical.sql creates.
-- IDEMPOTENT: "if exists" guards so it runs cleanly even if partially applied.
-- ============================================================

drop table if exists canonical.payment_milestone cascade;
drop table if exists canonical.source            cascade;
drop table if exists canonical.client            cascade;
drop table if exists canonical.project           cascade;
drop table if exists canonical.member            cascade;

drop type if exists payment_status_a;
drop type if exists member_role;

drop schema if exists canonical cascade;
