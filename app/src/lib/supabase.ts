// ============================================================
// supabase.ts — the browser Supabase-Auth client (production auth cutover).
//
// Flag-gated: the whole real-auth path is behind VITE_USE_SUPABASE_AUTH.
//   OFF (default) → AUTH_ENABLED=false, getSupabase() returns null, NOTHING
//                   here runs at module load. The app behaves EXACTLY as today
//                   (no login, hardcoded principal). `vite build` is unaffected.
//   ON            → a singleton client is created lazily on first use; the
//                   session persists in localStorage (supabase-js default) so a
//                   refresh keeps the user signed in.
//
// The client is created LAZILY (not at import time) so that even importing this
// module on the flag-off path costs nothing and never touches env that isn't set.
// ============================================================
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Master flag. OFF = today's behaviour (no login, no gate, byte-identical). */
export const AUTH_ENABLED = import.meta.env.VITE_USE_SUPABASE_AUTH === "true";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let _client: SupabaseClient | null = null;

/**
 * getSupabase — the lazy singleton accessor.
 *   Returns null when the flag is OFF or env is missing (callers no-op).
 *   Returns the persisted-session client when the flag is ON.
 */
export function getSupabase(): SupabaseClient | null {
  if (!AUTH_ENABLED) return null;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Flag on but misconfigured — fail loud in dev, but don't crash the bundle.
    console.error(
      "[supabase] VITE_USE_SUPABASE_AUTH is on but VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing.",
    );
    return null;
  }
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true, // localStorage (default) — survives refresh
      autoRefreshToken: true,
      detectSessionInUrl: true, // needed for the OAuth redirect callback
    },
  });
  return _client;
}
