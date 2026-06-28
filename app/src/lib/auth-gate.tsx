// ============================================================
// auth-gate.tsx — the flag-gated boundary that decides whether the app
// shows the Login or the real application.
//
//   FLAG OFF (default): renders {children} verbatim. No provider, no gate, no
//     supabase import cost beyond the cheap flag check. The deployed app is
//     byte-identical to today.
//   FLAG ON:
//     • wraps the tree in <AuthProvider> (session + token mirror live here);
//     • no session  → renders <Login> (blocks the whole app);
//     • session     → renders {children} (the real app).
//
// Login is lazy-imported so it isn't in the flag-off bundle path at all.
// ============================================================
import { lazy, Suspense } from "react";
import { AUTH_ENABLED } from "./supabase";
import { AuthProvider, useAuth } from "./auth";

const Login = lazy(() => import("@/pages/app/Login"));

function FullscreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center bg-bone">
      <div className="flex items-center gap-2 text-ink-faint">
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue [animation-delay:150ms]" />
        <span className="h-2 w-2 animate-pulse rounded-full bg-blue [animation-delay:300ms]" />
      </div>
    </div>
  );
}

function Gate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return <FullscreenLoader />;
  if (!session) {
    return (
      <Suspense fallback={<FullscreenLoader />}>
        <Login />
      </Suspense>
    );
  }
  return <>{children}</>;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  // Flag OFF → render today's app untouched.
  if (!AUTH_ENABLED) return <>{children}</>;
  return (
    <AuthProvider>
      <Gate>{children}</Gate>
    </AuthProvider>
  );
}
