-- ============================================================
-- 0002_mart.down.sql — drops everything 0002_mart.sql creates.
-- IDEMPOTENT: "if exists" guards.
-- ============================================================

drop function if exists mart.recompute_portfolio_summary(timestamptz, int);
drop function if exists mart.days_overdue(date, timestamptz);

drop table if exists mart.kpi_lineage        cascade;
drop table if exists mart.portfolio_summary  cascade;

drop schema if exists mart cascade;
