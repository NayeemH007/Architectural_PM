-- ============================================================
-- 0008_auth_hook.sql — Custom Access-Token Hook (staged copy of
-- backend/db/migrations/0008_auth_hook.supabase.sql). THIS is the file the
-- supabase CLI applies to the local stack on `supabase start`.
--
-- Maps a Supabase-Auth user → canonical.member (by email) and injects the
-- company_id / app_role / finance_grant claims that FastAPI's RLS + finance band
-- depend on, so REAL Supabase-issued JWTs work end-to-end (not just minted ones).
-- Unmapped email → claims unchanged → no company_id → FastAPI 401 (fails closed).
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
  -- Resolve the signing-in user's email (event claims first, then auth.users).
  user_email := nullif(claims ->> 'email', '');
  if user_email is null then
    select u.email
      into user_email
      from auth.users u
     where u.id = (event ->> 'user_id')::uuid;
  end if;

  -- Member lookup by email, case-insensitively. Pinned empty search_path hides the
  -- unqualified `citext` type, so compare lower(text) on both sides instead.
  if user_email is not null then
    select mem.company_id, mem.role::text, mem.finance_grant
      into m_company, m_role, m_finance
      from canonical.member mem
     where lower(mem.email::text) = lower(user_email)
     limit 1;
  end if;

  -- Mapped → inject claims; unmapped → return unchanged (no company_id → 401).
  if m_company is not null then
    claims := jsonb_set(claims, '{company_id}',   to_jsonb(m_company::text));
    claims := jsonb_set(claims, '{app_role}',      to_jsonb(m_role));
    claims := jsonb_set(claims, '{finance_grant}', to_jsonb(coalesce(m_finance, false)));
    event  := jsonb_set(event,  '{claims}', claims);
  end if;

  return event;
end;
$$;

grant execute on function public.custom_access_token_hook(jsonb) to supabase_auth_admin;

revoke execute on function public.custom_access_token_hook(jsonb) from public;
revoke execute on function public.custom_access_token_hook(jsonb) from anon, authenticated;

grant usage  on schema canonical to supabase_auth_admin;
grant select on canonical.member to supabase_auth_admin;
grant usage  on schema auth to supabase_auth_admin;
grant select on auth.users to supabase_auth_admin;
