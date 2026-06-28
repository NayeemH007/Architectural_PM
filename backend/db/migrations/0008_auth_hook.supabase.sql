-- ============================================================
-- 0008_auth_hook.supabase.sql — Custom Access-Token Hook: map a Supabase-Auth
-- user → canonical.member (by email) and inject the tenant + finance claims
-- that the FastAPI RLS + finance band depend on.
--
-- WHY: real Supabase-issued JWTs only carry sub/email/role('authenticated')/aud
-- — NOT company_id / app_role / finance_grant. FastAPI (auth.verify_jwt) 401s any
-- token with no company_id (adversary A-4: no default tenant). This GoTrue hook
-- runs at token-issue time, looks the signed-in user up in canonical.member by
-- email, and merges the three claims into the access token so the EXISTING
-- HS256 verification + RLS policies ((auth.jwt()->>'company_id')::uuid) + finance
-- band (app_role + finance_grant) all bind correctly for REAL logins.
--
-- MAPPING: auth user --email--> canonical.member  (member.email is citext UNIQUE).
--   * company_id := member.company_id::text   (RLS tenant)
--   * app_role   := member.role               (finance band role)
--   * finance_grant := member.finance_grant   (finance band grant)
-- UNMAPPED USER (email not in canonical.member): claims returned UNCHANGED — the
--   token gets NO company_id, so FastAPI 401s them. Unknown users have no tenant;
--   this fails CLOSED by design (an unrecognised login cannot see anyone's data).
--
-- SECURITY: SECURITY DEFINER owned by postgres, search_path pinned to ''
-- (fully-qualified names only — no search_path hijack). GoTrue runs hooks as the
-- supabase_auth_admin role; we GRANT EXECUTE to it and (defense-in-depth) the
-- SELECTs the function body needs. The function reads canonical.member directly
-- as the definer (postgres) so it is NOT subject to canonical.member's RLS — it
-- must see the row to resolve the tenant before any company_id claim exists.
--
-- IDEMPOTENT: create or replace function; grants re-run harmlessly; the revoke
-- of EXECUTE from public/anon/authenticated is also idempotent.
-- ============================================================

create or replace function public.custom_access_token_hook(event jsonb)
  returns jsonb
  language plpgsql
  stable
  security definer
  set search_path = ''
as $$
declare
  claims      jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  user_email  text;
  m_company   uuid;
  m_role      text;
  m_finance   boolean;
begin
  -- Resolve the signing-in user's email. Prefer the email already on the event's
  -- claims; fall back to joining auth.users on the event's user_id.
  user_email := nullif(claims ->> 'email', '');
  if user_email is null then
    select u.email
      into user_email
      from auth.users u
     where u.id = (event ->> 'user_id')::uuid;
  end if;

  -- Look the member up by email, case-insensitively. member.email is citext, but
  -- under the pinned empty search_path the unqualified `citext` type is invisible,
  -- so we compare lower(text) on both sides (equivalent to the citext semantics)
  -- without referencing the extension type name.
  if user_email is not null then
    select mem.company_id, mem.role::text, mem.finance_grant
      into m_company, m_role, m_finance
      from canonical.member mem
     where lower(mem.email::text) = lower(user_email)
     limit 1;
  end if;

  -- Mapped → merge the tenant + finance claims into the token.
  -- Unmapped (m_company is null) → leave claims UNCHANGED → no company_id → 401.
  if m_company is not null then
    claims := jsonb_set(claims, '{company_id}',   to_jsonb(m_company::text));
    claims := jsonb_set(claims, '{app_role}',      to_jsonb(m_role));
    claims := jsonb_set(claims, '{finance_grant}', to_jsonb(coalesce(m_finance, false)));
    event  := jsonb_set(event,  '{claims}', claims);
  end if;

  return event;
end;
$$;

-- GoTrue runs the hook as supabase_auth_admin: it must be able to EXECUTE it.
grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

-- Lock the hook down: it must NOT be callable by the data-API roles. (SECURITY
-- DEFINER means whoever runs it runs as postgres, so restrict who can run it.)
revoke execute on function public.custom_access_token_hook(jsonb) from public;
revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated;

-- Defense-in-depth: even though SECURITY DEFINER (postgres) already grants the
-- function body its reads, explicitly let supabase_auth_admin reach the tables
-- the hook joins, so the grant is self-documenting and survives an owner change.
grant usage on schema canonical to supabase_auth_admin;
grant select on canonical.member to supabase_auth_admin;
grant usage on schema auth to supabase_auth_admin;
grant select on auth.users to supabase_auth_admin;
