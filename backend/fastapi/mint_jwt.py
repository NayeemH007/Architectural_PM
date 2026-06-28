# ============================================================
# mint_jwt.py — mint LOCAL test JWTs for the FastAPI semantic layer.
#
# Mints a Supabase-Auth-shaped HS256 token signed with the local JWT secret so
# the FastAPI auth layer (auth.verify_jwt) accepts it and RLS binds to the
# claimed company. The claims carry: sub (member id), company_id, app_role,
# finance_grant, role='authenticated' (the supabase reserved role), exp.
#
# The secret is the well-known LOCAL supabase default (NOT a production secret);
# overridable via SUPABASE_JWT_SECRET. The default appears here only because it
# is the published local-dev default.
#
# Usage:
#   python mint_jwt.py founder    # m1 / Firm-A / finance-eligible
#   python mint_jwt.py designer   # m5 / Firm-A / NOT finance
#   python mint_jwt.py firmb      # bm1 / Firm-B / founder (isolation proof)
#   python mint_jwt.py expired    # m1 / Firm-A / already-expired (401 proof)
# Prints ONLY the token to stdout (so `$(python mint_jwt.py founder)` works).
# ============================================================
from __future__ import annotations

import os
import sys
import time

import jwt

_LOCAL_DEFAULT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"
JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET", _LOCAL_DEFAULT_SECRET)

FIRM_A = "00000000-0000-0000-0000-00000000aaaa"
FIRM_B = "00000000-0000-0000-0000-00000000bbbb"

# label -> (sub, company_id, app_role, finance_grant, ttl_seconds)
PROFILES = {
    # Firm-A founder (m1): finance-eligible (role founder + finance_grant true).
    "founder": ("m1", FIRM_A, "founder", True, 3600),
    # Firm-A designer (m5): NOT finance — the band redacts money for this caller.
    "designer": ("m5", FIRM_A, "designer", False, 3600),
    # Firm-B founder (bm1): proves tenant isolation (no Firm-A entities visible).
    "firmb": ("bm1", FIRM_B, "founder", True, 3600),
    # Already-expired Firm-A founder: proves the 401-on-expired path.
    "expired": ("m1", FIRM_A, "founder", True, -3600),
}


def mint(profile: str) -> str:
    sub, company_id, app_role, finance_grant, ttl = PROFILES[profile]
    now = int(time.time())
    claims = {
        "sub": sub,
        "company_id": company_id,
        "app_role": app_role,
        "finance_grant": finance_grant,
        "role": "authenticated",  # supabase reserved DB role
        "aud": "authenticated",
        "iat": now,
        "exp": now + ttl,
    }
    return jwt.encode(claims, JWT_SECRET, algorithm="HS256")


if __name__ == "__main__":
    profile = sys.argv[1] if len(sys.argv) > 1 else "founder"
    if profile not in PROFILES:
        sys.stderr.write(f"unknown profile {profile!r}; choose from {list(PROFILES)}\n")
        sys.exit(2)
    sys.stdout.write(mint(profile))
