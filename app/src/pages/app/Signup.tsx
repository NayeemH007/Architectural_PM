import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Brand-panel value props — the real ArchIntel pitch for design studios.
// ---------------------------------------------------------------------------
interface ValueProp {
  icon: LucideIcon;
  title: string;
  body: string;
}

const VALUE_PROPS: ValueProp[] = [
  {
    icon: LayoutGrid,
    title: "One workspace per project",
    body: "Brief, drawings, approvals and money — every project in a single, tidy room.",
  },
  {
    icon: ListChecks,
    title: "Phases & checklists",
    body: "Discovery, Concept, Design Dev, Construction Docs — with gates that have to be cleared.",
  },
  {
    icon: Stamp,
    title: "Design & material approvals",
    body: "Route to your final approver, capture the decision, release to the client cleanly.",
  },
  {
    icon: Wallet,
    title: "Phase-based payments",
    body: "Tie milestones to phases so invoicing follows the work, not the other way round.",
  },
  {
    icon: Radar,
    title: "AI risk radar",
    body: "Spot stalls, slipping gates and overdue receivables before they become fires.",
  },
];

const STUDIO_TYPES = [
  { value: "interior", label: "Interior design" },
  { value: "architecture", label: "Architecture" },
  { value: "both", label: "Interior + Architecture" },
];

const TEAM_SIZES = [
  { value: "solo", label: "Just me" },
  { value: "2-5", label: "2–5 people" },
  { value: "6-15", label: "6–15 people" },
  { value: "16-40", label: "16–40 people" },
  { value: "40+", label: "40+ people" },
];

// ---------------------------------------------------------------------------
// Form field wrapper with a drafting-style label.
// ---------------------------------------------------------------------------
function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label-draft mb-1.5 block">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-[11px] text-ink-faint">{hint}</p>}
    </div>
  );
}

interface FormState {
  studio: string;
  name: string;
  email: string;
  password: string;
  studioType: string;
  teamSize: string;
}

const EMPTY: FormState = {
  studio: "",
  name: "",
  email: "",
  password: "",
  studioType: "interior",
  teamSize: "2-5",
};

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [showPw, setShowPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Required-field validation drives the disabled state on the CTA.
  const valid = useMemo(() => {
    return (
      form.studio.trim().length >= 2 &&
      form.name.trim().length >= 2 &&
      isEmail(form.email) &&
      form.password.length >= 6 &&
      !!form.studioType &&
      !!form.teamSize
    );
  }, [form]);

  // Lightweight password-strength read-out (mock, client-only).
  const pwStrength = useMemo(() => {
    const p = form.password;
    if (!p) return 0;
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
    if (/\d/.test(p) || /[^A-Za-z0-9]/.test(p)) s++;
    return s; // 0..4
  }, [form.password]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || submitting) return;
    // Mock create — no backend. Brief pending state, then onboarding.
    setSubmitting(true);
    setTimeout(() => navigate("/onboarding"), 240);
  };

  return (
    <div className="min-h-screen bg-bone text-ink lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* ============================ LEFT — brand panel ============================ */}
      <aside className="relative hidden overflow-hidden bg-blue text-paper lg:flex lg:flex-col">
        <div className="bg-grid-lg absolute inset-0 opacity-[0.18]" aria-hidden />
        <div
          className="absolute inset-0 opacity-60"
          aria-hidden
          style={{
            background:
              "radial-gradient(120% 90% at 12% 8%, rgba(43,93,134,0.55), transparent 60%)",
          }}
        />

        <div className="relative flex h-full flex-col p-10 xl:p-14">
          {/* Wordmark */}
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-md bg-paper/10 ring-1 ring-paper/20">
              <Compass className="h-5 w-5 text-paper" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">ArchIntel</span>
          </div>

          {/* Hero copy */}
          <div className="mt-16 max-w-md xl:mt-20">
            <div className="label-draft text-paper/55">Project control system</div>
            <h1 className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.12] tracking-tight xl:text-[2.5rem]">
              Project control for design studios
            </h1>
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-paper/70">
              Keep every project moving through its phases — without replacing the tools your
              designers already love.
            </p>
          </div>

          {/* Value bullets */}
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

          {/* Footer note */}
          <div className="mt-auto pt-10">
            <div className="flex items-center gap-2 text-[12px] text-paper/55">
              <span className="h-1.5 w-1.5 rounded-full bg-sage" />
              Trusted by studios in Dhaka — SPACE ESSE and growing.
            </div>
          </div>
        </div>
      </aside>

      {/* ============================ RIGHT — form ============================ */}
      <main className="flex min-h-screen flex-col items-center justify-center px-5 py-10 sm:px-8">
        {/* Mobile wordmark */}
        <div className="mb-7 flex items-center gap-2.5 lg:hidden">
          <span className="grid h-9 w-9 place-items-center rounded-md bg-blue text-paper">
            <Compass className="h-5 w-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            ArchIntel
          </span>
        </div>

        <div className="w-full max-w-md">
          <div className="relative rounded-xl border border-line bg-paper p-6 shadow-card sm:p-8">
            <div className="drafting-corners pointer-events-none absolute inset-0" aria-hidden />

            <div className="label-draft text-blue">Get started</div>
            <h2 className="mt-1.5 font-display text-2xl font-semibold tracking-tight text-ink">
              Create your workspace
            </h2>
            <p className="mt-1.5 text-[13px] text-ink-soft">
              Set up your studio in under a minute. No card required.
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
              <Field label="Studio name" htmlFor="studio">
                <Input
                  id="studio"
                  placeholder="e.g. SPACE ESSE"
                  autoComplete="organization"
                  value={form.studio}
                  onChange={(e) => set("studio", e.target.value)}
                />
              </Field>

              <Field label="Your name" htmlFor="name">
                <Input
                  id="name"
                  placeholder="Raiana Hossain"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>

              <Field label="Work email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  placeholder="you@studio.com"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  className={cn(
                    form.email && !isEmail(form.email) && "border-rust focus:border-rust focus:ring-rust/15",
                  )}
                />
                {form.email && !isEmail(form.email) && (
                  <p className="mt-1 text-[11px] text-rust">Enter a valid email address.</p>
                )}
              </Field>

              <Field label="Password" htmlFor="password">
                <div className="relative">
                  <Input
                    id="password"
                    type={showPw ? "text" : "password"}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => set("password", e.target.value)}
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
                {form.password.length > 0 && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-colors",
                            i < pwStrength
                              ? pwStrength <= 1
                                ? "bg-rust"
                                : pwStrength === 2
                                  ? "bg-ochre"
                                  : "bg-sage"
                              : "bg-line",
                          )}
                        />
                      ))}
                    </div>
                    <span className="label-draft text-ink-faint">
                      {pwStrength <= 1 ? "Weak" : pwStrength === 2 ? "Okay" : "Strong"}
                    </span>
                  </div>
                )}
              </Field>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Studio type" htmlFor="studio-type">
                  <Select
                    value={form.studioType}
                    onValueChange={(v) => set("studioType", v)}
                    options={STUDIO_TYPES}
                    className="w-full"
                  />
                </Field>
                <Field label="Team size" htmlFor="team-size">
                  <Select
                    value={form.teamSize}
                    onValueChange={(v) => set("teamSize", v)}
                    options={TEAM_SIZES}
                    className="w-full"
                  />
                </Field>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={!valid || submitting}
                className="mt-1 w-full"
              >
                {submitting ? (
                  <>
                    <Check className="h-4 w-4" /> Setting up…
                  </>
                ) : (
                  <>
                    Create workspace
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>

              <p className="text-center text-[11px] leading-relaxed text-ink-faint">
                By creating a workspace you agree to ArchIntel's Terms and Privacy Policy.
              </p>
            </form>
          </div>

          <p className="mt-5 text-center text-[13px] text-ink-soft">
            Already have an account?{" "}
            <Link
              to="/signup"
              className="font-medium text-blue underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
