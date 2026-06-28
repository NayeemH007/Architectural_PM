-- ============================================================
-- 0007_ingestion.down.sql — drops everything 0007_ingestion.sql creates.
-- IDEMPOTENT: "if exists" guards so it runs cleanly even if partially applied.
-- Drops the etl functions + tables, then the etl schema. Does NOT touch
-- canonical/mart (the projection re-projects into existing canonical columns;
-- their schema is owned by 0001-0006).
-- ============================================================

drop function if exists etl.freshness(uuid, text, timestamptz);
drop function if exists etl.resolve_alias(text, text, text, text);
drop function if exists etl.reconcile_receipt(jsonb);
drop function if exists etl.ingest(jsonb);
drop function if exists etl._project_milestone(uuid, text);
drop function if exists etl._ensure_connector(uuid, text, timestamptz);
drop function if exists etl._content_hash(jsonb);
drop function if exists etl._uuid();
drop function if exists etl._company();

drop policy if exists needs_review_company_isolation    on etl.needs_review;
drop policy if exists alias_company_isolation           on etl.alias;
drop policy if exists payment_receipt_company_isolation on etl.payment_receipt;
drop policy if exists ingest_event_company_isolation    on etl.ingest_event;
drop policy if exists connector_company_isolation       on etl.connector;

drop table if exists etl.needs_review    cascade;
drop table if exists etl.alias           cascade;
drop table if exists etl.payment_receipt cascade;
drop table if exists etl.ingest_event    cascade;
drop table if exists etl.connector       cascade;

drop schema if exists etl cascade;
