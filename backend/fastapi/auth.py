# ============================================================
# auth.py — REAL Supabase-Auth JWT enforcement + RLS-bound DB session.
#
# AUTH FLOW (production port §4.4):
#   1. Read `Authorization: Bearer <jwt>`.  Missing -> 401.
#   2. Verify HS256 with the local Supabase JWT secret.  Invalid/expired -> 401.
#      (secret read from env SUPABASE_JWT_SECRET; falls back to the well-known
#       local supabase default — documented, never a production secret.)
#   3. Require a `company_id` claim (adversary A-4: no default-tenant footgun).
#      Absent -> 401.
#   4. Open a DB transaction and, PER REQUEST, txn-locally:
#         SET LOCAL ROLE authenticated;          -- non-superuser -> RLS ENFORCED
#         SET LOCAL request.jwt.claims = '<verified claims json>';
#      so the canonical/mart RLS policies (`company_id = (auth.jwt()->>
#      'company_id')::uuid`) bind to THIS caller's company. The connection runs
#      as `postgres` for connecting, but `SET LOCAL ROLE authenticated` drops to
#      the non-superuser role for all queries (superuser would BYPASS RLS — A-3).
#      `SET LOCAL` resets at COMMIT/ROLLBACK so no claim leaks across requests (A-2).
#
# FINANCE BAND: derived from the JWT — the verified claims may carry `app_role`
# and `finance_grant`; if absent we LOOK UP the member by the JWT `sub` from
# canonical.member (role + finance_grant) inside the same RLS-bound txn. The
# serializer's isFinanceEligible reads {role, finance_grant}. (Documented: claims
# first, DB lookup as the authoritative fallback.)
# ============================================================
from __future__ import annotations

import json
import os
import uuid
from contextlib import contextmanager
from typing import Iterator

import jwt
import psycopg
from psycopg.rows import dict_row

# Well-known LOCAL supabase HS256 secret (NOT a production secret — the local
# default published by the supabase CLI). Overridable via env at runtime.
_LOCAL_DEFAULT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"
JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", _LOCAL_DEFAULT_SECRET)
JWT_ALGS = ["HS256"]

DB_DSN = os.environ.get(
    "SUPABASE_DB_DSN", "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
)

AS_OF_PINNED = "2026-06-22"  # the single injected server clock (CONTEXT.md)
KPI_VERSION = 1


class AuthError(Exception):
    """Raised on any auth failure -> mapped to a generic 401 (A-6: no leak)."""


def verify_jwt(authorization: str | None) -> dict:
    """Verify the Bearer JWT (HS256). Returns the verified claims dict.

    Raises AuthError on: missing header, wrong scheme, bad signature, expired,
    or absent company_id (A-4 — no default tenant).
    """
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AuthError("missing bearer token")
    token = authorization[7:].strip()
    if not token:
        raise AuthError("empty bearer token")
    try:
        claims = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=JWT_ALGS,
            options={"require": ["exp"], "verify_aud": False},
        )
    except jwt.ExpiredSignatureError as e:
        raise AuthError("expired token") from e
    except jwt.InvalidTokenError as e:
        raise AuthError("invalid token") from e

    company_id = claims.get("company_id")
    if not company_id:
        raise AuthError("missing company_id claim")  # A-4
    # M1: the RLS policies cast (auth.jwt()->>'company_id')::uuid — a malformed
    # value raises 22P02 INSIDE the query → HTTP 500. Validate the shape here so a
    # bad claim fails closed as a clean 401, never a crash (no data leak either way).
    try:
        uuid.UUID(str(company_id))
    except (ValueError, TypeError, AttributeError):
        raise AuthError("malformed company_id claim")
    return claims


@contextmanager
def rls_session(claims: dict) -> Iterator[tuple[psycopg.Connection, dict]]:
    """Open an RLS-bound txn for the verified caller; yield (conn, principal).

    The session runs `SET LOCAL ROLE authenticated` (drop superuser -> RLS
    ENFORCED) + `SET LOCAL request.jwt.claims = <claims>` so every query is
    company-isolated by the policies. SET LOCAL is txn-scoped: COMMIT/ROLLBACK
    resets it, so no claim bleeds into the next request (A-2). The principal
    (role + finance_grant for the finance band) is read from the claims, with a
    DB lookup by `sub` as the authoritative fallback.
    """
    claims_json = json.dumps(claims)
    conn = psycopg.connect(DB_DSN, row_factory=dict_row)
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                # Drop to the non-superuser role FIRST so RLS is enforced for
                # the claim-setting read too, then bind the verified claims.
                cur.execute("set local role authenticated")
                cur.execute(
                    "select set_config('request.jwt.claims', %s, true)", (claims_json,)
                )
                principal = _principal_from_claims_or_db(cur, claims)
            yield conn, principal
            # commit happens on context exit (transaction()) -> SET LOCAL resets
    finally:
        conn.close()


def _principal_from_claims_or_db(cur: psycopg.Cursor, claims: dict) -> dict:
    """Finance band identity. Prefer JWT claims; fall back to canonical.member.

    Returns {companyId, userId, role, financeGrant} as the serializer expects.
    """
    company_id = str(claims.get("company_id"))
    user_id = claims.get("sub") or claims.get("user_id") or ""
    role = claims.get("app_role") or claims.get("role")
    finance_grant = claims.get("finance_grant")

    # `role` may be the supabase reserved role ('authenticated') — that is NOT a
    # member role; treat it as absent so we look the real role up from the DB.
    if role in (None, "", "authenticated", "anon", "service_role"):
        role = None

    if role is None or finance_grant is None:
        # Authoritative lookup by the JWT sub inside the RLS-bound txn (so it is
        # itself company-isolated). Only fills the parts the claims didn't carry.
        if user_id:
            cur.execute(
                "select role, finance_grant from canonical.member where id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            if row:
                if role is None:
                    role = row["role"]
                if finance_grant is None:
                    finance_grant = row["finance_grant"]

    return {
        "companyId": company_id,
        "userId": user_id,
        "role": role or "",
        "financeGrant": bool(finance_grant),
    }
