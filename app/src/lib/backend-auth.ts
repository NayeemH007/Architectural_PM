// ============================================================
// backend-auth.ts — chooses the request headers for the backend fetch.
//
//   FLAG OFF (VITE_USE_SUPABASE_AUTH != "true") → the existing dev headers:
//     { X-Company-Id, X-User-Role } (the Node/pglite + dev FastAPI path).
//     Byte-identical to today.
//   FLAG ON → the Supabase session JWT as `Authorization: Bearer <token>`, which
//     the production FastAPI verifies (ES256) and uses to enforce RLS + the
//     finance band. The dev X-* headers are NOT sent in this mode.
//
// The token is read from the auth module's live mirror (getAccessToken), kept in
// sync by AuthProvider's onAuthStateChange. If the flag is on but there is no
// token yet, we send no auth header (FastAPI returns 401 → the mock fallback in
// the caller keeps the card from blanking).
// ============================================================
import { AUTH_ENABLED } from "@/lib/supabase";
import { getAccessToken } from "@/lib/auth";

/**
 * backendHeaders — the header set for a backend fetch.
 * @param devHeaders the legacy X-Company-Id / X-User-Role pair to use off-path.
 */
export function backendHeaders(devHeaders: Record<string, string>): Record<string, string> {
  if (!AUTH_ENABLED) return devHeaders;
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
