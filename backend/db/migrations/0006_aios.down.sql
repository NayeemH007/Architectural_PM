-- ============================================================
-- 0006_aios.down.sql — reverse 0006_aios.sql.
-- Drops the AIOS write-discipline surface (functions, triggers, tables, types,
-- audit schema, app_writer role). Idempotent (if exists / drop cascade).
-- ============================================================

drop function if exists mart.promote_agent_action(text, agent_action_state, text, int, timestamptz, text);
drop function if exists mart.verify_audit_chain(uuid);
drop function if exists mart.append_audit_event(text, uuid, text, text, text, jsonb, timestamptz, text);

drop trigger if exists audit_event_append_only_trg on audit.event;
drop function if exists mart.audit_append_only();
drop function if exists mart.audit_row_hash(text, uuid, bigint, text, text, text, jsonb, timestamptz);

drop trigger if exists design_approval_eligibility_trg on mart.design_approval;
drop function if exists mart.design_approval_eligibility();

drop table if exists audit.event cascade;
drop table if exists mart.design_approval cascade;
drop table if exists mart.agent_action cascade;

drop type if exists audit_event_type;
drop type if exists approval_decision;
drop type if exists agent_action_state;

drop schema if exists audit cascade;

do $$ begin
  drop role if exists app_writer;
exception when others then null; end $$;
