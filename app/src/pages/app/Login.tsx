// ============================================================
// Login.tsx — the real Supabase-Auth sign-in (shown only when
// VITE_USE_SUPABASE_AUTH is ON and there is no session). Off-path this
// component is never imported/mounted, so the deployed app is unchanged.
//
// Three sign-in paths:
//   • Email + password  → supabase.auth.signInWithPassword   (the testable path)
//   • Email OTP         → signInWithOtp + verifyOtp          (testable via Mailpit)
//   • Google / Microsoft OAuth → signInWithOAuth provider    (wired; needs
//                          provider creds configured in Supabase for production —
//                          locally they won't complete, which is expected).
//
// Styled to match Signup.tsx (brand panel + drafting-corner card).
// ============================================================
import { useMemo, useState } from "react";
import {
  Compass,
  LayoutGrid,
  ListChecks,
  Stamp,
  Wallet,
  Radar,
  ArrowRight,
  Eye,
  EyeOff,
  Mail,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { getSupabase } from "@/lib/supabase";
import type { LucideIcon } from "lucide-react";

interface ValueProp {
  icon: LucideIcon;
  title: string;
  body: string;
}

const VALUE_PROPS: ValueProp[] = [
  { icon: LayoutGrid, title: "One workspace per project", body: "Brief, drawings, approvals and money — every project in a single, tidy room." },
  { icon: ListChecks, title: "Phases & checklists", body: "Discovery, Concept, Design Dev, Construction Docs — with gates that have to be cleared." },
  { icon: Stamp, title: "Design & material approvals", body: "Route to your final approver, capture the decision, release to the client cleanly." },
  { icon: Wallet, title: "Phase-based payments", body: "Tie milestones to phases so invoicing follows the work, not the other way round." },
  { icon: Radar, title: "AI risk radar", body: "Spot stalls, slipping gates and overdue receivables before they become fires." },
];

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label-draft mb-1.5 block">
        {label}
      </label>
      {children}
    </div>
  );
}

type Mode = "password" | "otp";

export default function Login() {
  const supabase = getSupabase();
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const canPassword = isEmail(email) && password.length >= 1;
  const canSendOtp = isEmail(email);
  const canVerifyOtp = otpSent && otp.trim().length >= 6;

  const oauthRedirect = useMemo(() => window.location.origin, []);

  function fail(msg: string) {
    setError(msg);
    setBusy(false);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !canPassword || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return fail(error.message);
    // onAuthStateChange in AuthProvider flips the gate — no manual redirect needed.
    setBusy(false);
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !canSendOtp || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false },
    });
    if (error) return fail(error.message);
    setOtpSent(true);
    setInfo("We emailed you a 6-digit code. Check your inbox (Mailpit locally).");
    setBusy(false);
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase || !canVerifyOtp || busy) return;
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp.trim(),
      type: "email",
    });
    if (error) return fail(error.message);
    setBusy(false);
  }

  async function handleOAuth(provider: "google" | "azure") {
    if (!supabase || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: oauthRedirect },
    });
    // On success the browser redirects away; only surface failures.
    if (error) fail(error.message);
  }

  return (
    <div className="min-h-screen bg-bone text-ink lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ============================ LEFT — brand panel ============================ */}
      <aside className="relative hidden overflow-hidden bg-blue text-paper lg:flex lg:flex-col">
        <div className="bg-grid-lg absolute inset-0 opacity-[0.18]" aria-hidden />
        <div
          className="absolute inset-0 opacity-60"
          aria-hidden
          style={{ background: "radial-gradient(120% 90% at 12% 8%, rgba(43,93,134,0.55), transparent 60%)" }}
        />
        <div className="relative flex h-full flex-col p-10 xl:p-14">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-paper/10 ring-1 ring-paper/20">
              <Compass className="h-5 w-5 text-paper" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">ArchIntel</span>
          </div>
          <div className="mt-16 max-w-md xl:mt-20">
            <div className="label-draft text-paper/55">Project control system</div>
            <h1 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.12] tracking-tight xl:text-[2.5rem]">
              Welcome back to your studio
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-paper/70">
              Sign in to pick up where the work — and the money — left off.
            </p>
          </div>
          <ul className="mt-10 space-y-4">
            {VALUE_PROPS.map((v) => (
              <li key={v.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-md bg-paper/10 ring-1 ring-paper/15">
                  <v.icon className="h-4 w-4 text-paper" />
                </span>
                <div>
                  <div className="text-sm font-medium text-paper">{v.title}</div>
                  <div className="mt-0.5 text-[13px] leading-snug text-paper/60">{v.body}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-auto pt-10">
            <div className="flex items-center gap-2 text-[12px] text-paper/55">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              SPACE ESSE · Dhaka
            </div>
          </div>
        </div>
      </aside>

      {/* ============================ RIGHT — sign-in ============================ */}
      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8">
        <div className="mb-7 flex items-center gap-2.5 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-blue text-paper">
            <Compass className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">ArchIntel</span>
        </div>

        <div className="w-full max-w-md">
          <div className="relative rounded-xl border border-line bg-paper p-6 shadow-card sm:p-8">
            <div className="drafting-corners pointer-events-none absolute inset-0" aria-hidden />

            <div className="label-draft text-blue">Sign in</div>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink">
              Welcome back
            </h2>
            <p className="mt-1.5 text-[13px] text-ink-soft">
              Use your studio email to access ArchIntel.
            </p>

            {/* mode toggle */}
            <div className="mt-5 inline-flex rounded-md border border-line bg-bone p-0.5 text-[13px]">
              <button
                type="button"
                onClick={() => { setMode("password"); setError(null); setInfo(null); }}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors",
                  mode === "password" ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                )}
              >
                <KeyRound className="h-3.5 w-3.5" /> Password
              </button>
              <button
                type="button"
                onClick={() => { setMode("otp"); setError(null); setInfo(null); }}
                className={cn(
                  "flex items-center gap-1.5 rounded px-3 py-1.5 font-medium transition-colors",
                  mode === "otp" ? "bg-paper text-ink shadow-sm" : "text-ink-soft hover:text-ink",
                )}
              >
                <Mail className="h-3.5 w-3.5" /> Email code
              </button>
            </div>

            {/* ---- PASSWORD ---- */}
            {mode === "password" && (
              <form onSubmit={handlePassword} className="mt-5 space-y-4" noValidate>
                <Field label="Work email" htmlFor="email">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@spaceesse.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </Field>
                <Field label="Password" htmlFor="password">
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      placeholder="Your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label={showPw ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-ghost hover:text-ink-soft"
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </Field>
                <Button type="submit" variant="primary" size="lg" disabled={!canPassword || busy} className="w-full">
                  {busy ? "Signing in…" : (<>Sign in <ArrowRight className="h-4 w-4" /></>)}
                </Button>
              </form>
            )}

            {/* ---- EMAIL OTP ---- */}
            {mode === "otp" && (
              <div className="mt-5 space-y-4">
                <form onSubmit={handleSendOtp} className="space-y-4" noValidate>
                  <Field label="Work email" htmlFor="otp-email">
                    <Input
                      id="otp-email"
                      type="email"
                      autoComplete="email"
                      placeholder="you@spaceesse.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={otpSent}
                    />
                  </Field>
                  {!otpSent && (
                    <Button type="submit" variant="primary" size="lg" disabled={!canSendOtp || busy} className="w-full">
                      {busy ? "Sending…" : (<><Mail className="h-4 w-4" /> Email me a code</>)}
                    </Button>
                  )}
                </form>
                {otpSent && (
                  <form onSubmit={handleVerifyOtp} className="space-y-4" noValidate>
                    <Field label="6-digit code" htmlFor="otp-code">
                      <Input
                        id="otp-code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        placeholder="123456"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                      />
                    </Field>
                    <Button type="submit" variant="primary" size="lg" disabled={!canVerifyOtp || busy} className="w-full">
                      {busy ? "Verifying…" : (<>Verify & sign in <ArrowRight className="h-4 w-4" /></>)}
                    </Button>
                    <button
                      type="button"
                      onClick={() => { setOtpSent(false); setOtp(""); setInfo(null); }}
                      className="w-full text-center text-[12px] text-ink-soft hover:text-ink"
                    >
                      Use a different email
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* ---- messages ---- */}
            {error && <p className="mt-4 rounded-md border border-rust/30 bg-rust-tint px-3 py-2 text-[12px] text-rust">{error}</p>}
            {info && <p className="mt-4 rounded-md border border-blue/30 bg-blue-ghost px-3 py-2 text-[12px] text-blue">{info}</p>}

            {/* ---- OAuth ---- */}
            <div className="mt-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-line" />
              <span className="label-draft text-ink-faint">or continue with</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-md border border-line-strong bg-paper px-3 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-ink-ghost hover:bg-paper-2 disabled:opacity-50"
              >
                <GoogleMark /> Google
              </button>
              <button
                type="button"
                onClick={() => handleOAuth("azure")}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-md border border-line-strong bg-paper px-3 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-ink-ghost hover:bg-paper-2 disabled:opacity-50"
              >
                <MicrosoftMark /> Microsoft
              </button>
            </div>
            <p className="mt-3 text-center text-[11px] leading-relaxed text-ink-faint">
              Google &amp; Microsoft require provider credentials configured in Supabase.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

function MicrosoftMark() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 23 23" aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M12 1h10v10H12z" />
      <path fill="#00A4EF" d="M1 12h10v10H1z" />
      <path fill="#FFB900" d="M12 12h10v10H12z" />
    </svg>
  );
}
