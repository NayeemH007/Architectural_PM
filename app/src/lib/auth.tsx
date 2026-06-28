// ============================================================
// auth.tsx — the session context for the real-auth path (flag-gated).
//
// Responsibilities:
//   • Subscribe to supabase.auth.onAuthStateChange and expose the live session.
//   • Expose the access_token to NON-react code (api.ts/aios.ts) via a module
//     singleton (getAccessToken) so the backend fetch can attach
//     `Authorization: Bearer <token>` without prop-drilling.
//   • Derive a display name / title from the session email by mapping it onto
//     the known studio `members` (email → name/title), with a graceful fallback
//     to the email / user_metadata when no member matches.
//   • Provide signOut.
//
// When the flag is OFF this provider is NEVER mounted (App renders as today),
// so none of this code runs on the deployed/flag-off path.
// ============================================================
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "./supabase";
import { members } from "./archintel/data";

// ── Module-level token mirror (read by the non-react fetch layer) ──
// api.ts / aios.ts are plain modules, not components — they read the current
// access token here. Kept in sync by the provider's auth listener.
let _accessToken: string | null = null;
export function getAccessToken(): string | null {
  return _accessToken;
}

export interface AuthMember {
  name: string;
  title: string;
  email: string;
  initials: string;
  role?: string; // app_role claim if present
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  member: AuthMember;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Map the session onto a known studio member (email), else fall back to email. */
function deriveMember(session: Session | null): AuthMember {
  const email = session?.user?.email ?? "";
  const claimRole =
    ((session?.user?.app_metadata as Record<string, unknown> | undefined)?.app_role as
      | string
      | undefined) ?? undefined;
  const match = members.find((m) => m.email.toLowerCase() === email.toLowerCase());
  if (match) {
    return {
      name: match.name,
      title: match.title,
      email: match.email,
      initials: initialsOf(match.name),
      role: claimRole ?? match.role,
    };
  }
  const metaName =
    ((session?.user?.user_metadata as Record<string, unknown> | undefined)?.full_name as
      | string
      | undefined) ?? email.split("@")[0];
  return {
    name: metaName || email || "Signed in",
    title: claimRole ? claimRole : "Team member",
    email,
    initials: initialsOf(metaName || email || "U"),
    role: claimRole,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = getSupabase();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  // Track the signed-in user across changes so we can clear the React Query
  // cache when the PRINCIPAL changes. The query keys (["ai-overview"], …) are
  // not user-scoped + staleTime is 60s, so without this a designer would see
  // the previous (finance-eligible) user's CACHED, un-redacted money. Clearing
  // the cache on a user switch forces a refetch under the new token's band.
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let mounted = true;
    const apply = (s: Session | null) => {
      _accessToken = s?.access_token ?? null;
      const uid = s?.user?.id ?? null;
      if (uid !== lastUserId.current) {
        // Principal changed (sign-in, sign-out, or switch) → drop cached data so
        // nothing computed under the old token's finance band survives.
        queryClient.clear();
        lastUserId.current = uid;
      }
      setSession(s);
      setLoading(false);
    };
    // Hydrate the current session, then keep it live.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      apply(data.session);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => apply(s));
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, queryClient]);

  const member = useMemo(() => deriveMember(session), [session]);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      member,
      signOut: async () => {
        await supabase?.auth.signOut();
        _accessToken = null;
      },
    }),
    [session, loading, member, supabase],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Hook for components inside the authed app. Safe default off-path. */
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (ctx) return ctx;
  // Off-path (provider not mounted) — return a hardcoded principal so existing
  // components that adopt useAuth still render exactly as today.
  return {
    session: null,
    loading: false,
    member: {
      name: "Fariha Karim",
      title: "Principal Architect · Co-Founder",
      email: "fariha@spaceesse.com",
      initials: "FK",
    },
    signOut: async () => {},
  };
}
