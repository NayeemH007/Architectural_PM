-- ============================================================
-- 0005_mart_derived.down.sql — drops everything 0005_mart_derived.sql creates.
-- IDEMPOTENT: "if exists" guards. Does NOT drop the mart schema (0002 owns it)
-- nor the shared mart.kpi_lineage table (0002 owns it) — only the 0005 surface.
-- ============================================================

drop function if exists mart.recompute_finance(timestamptz, int);
drop function if exists mart.recompute_profitability(timestamptz, int);
drop function if exists mart.recompute_aios(timestamptz, int);

drop policy if exists cost_model_company_isolation on mart.cost_model;
drop table if exists mart.cost_model cascade;
