import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CreditCard,
  Layers,
  ListChecks,
  Lock,
  MapPin,
  Plus,
  Users,
  Sparkles,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { bdt } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAiMembers, useAiClients, PHASE_TEMPLATE } from "@/lib/archintel/api";
import { phaseShort } from "@/components/archintel/badges";
import type { ClientA, Member } from "@/lib/archintel/data";

// ------------------------------------------------------------
// Project-creation wizard — guided, 5 steps, all local state.
// Mock prototype: nothing persists; "Create" routes to a sample project.
// ------------------------------------------------------------

type ProjectType = ClientA["type"];

const STEPS = [
  { key: "basics", label: "Basics", icon: Building2 },
  { key: "client", label: "Client", icon: Users },
  { key: "team", label: "Team", icon: Layers },
  { key: "payment", label: "Payment", icon: CreditCard },
  { key: "workflow", label: "Workflow", icon: ListChecks },
] as const;

const TYPE_OPTIONS: { value: ProjectType; label: string }[] = [
  { value: "residential", label: "Residential" },
  { value: "hospitality", label: "Hospitality" },
  { value: "corporate", label: "Corporate" },
  { value: "retail", label: "Retail" },
  { value: "healthcare", label: "Healthcare" },
];

// Default phase weighting for phased plans (sums to 100).
const PHASE_WEIGHTS = [10, 30, 30, 30];

interface Milestone {
  phase: number;
  label: string;
  pct: number;
}

export default function ProjectSetup() {
  const navigate = useNavigate();
  const { data: members = [], isLoading: mLoading } = useAiMembers();
  const { data: clients = [], isLoading: cLoading } = useAiClients();
  const loading = mLoading || cLoading;

  const [step, setStep] = useState(0);

  // ---- step 1: basics ----
  const [name, setName] = useState("");
  const [type, setType] = useState<ProjectType>("residential");
  const [address, setAddress] = useState("");
  const [targetDate, setTargetDate] = useState("");

  // ---- step 2: client ----
  const [newClient, setNewClient] = useState(false);
  const [clientId, setClientId] = useState("");
  const [ncName, setNcName] = useState("");
  const [ncContact, setNcContact] = useState("");
  const [ncPhone, setNcPhone] = useState("");
  const [ncWhatsapp, setNcWhatsapp] = useState("");

  // ---- step 3: team ----
  const [leadId, setLeadId] = useState("");
  const [teamIds, setTeamIds] = useState<string[]>([]);

  // ---- step 4: payment ----
  const [plan, setPlan] = useState<"upfront" | "phased">("phased");
  const [contractValue, setContractValue] = useState<number>(2_800_000);
  const [milestones, setMilestones] = useState<Milestone[]>(() =>
    PHASE_TEMPLATE.map((p, i) => ({
      phase: p.index,
      label: `${phaseShort(p.index)} (${PHASE_WEIGHTS[i]}%)`,
      pct: PHASE_WEIGHTS[i],
    })),
  );

  const [creating, setCreating] = useState(false);

  const leadOptions = useMemo(
    () =>
      members
        .filter((m) => m.role === "project_lead" || m.role === "principal")
        .map((m) => ({ value: m.id, label: `${m.name} · ${m.title}` })),
    [members],
  );

  const selectedClient = clients.find((c) => c.id === clientId);
  const lead = members.find((m) => m.id === leadId);
  const team = members.filter((m) => teamIds.includes(m.id));

  const milestoneTotal = milestones.reduce((s, m) => s + m.pct, 0);

  // ---- per-step validation gating "Next" ----
  const stepValid = (s: number): boolean => {
    switch (s) {
      case 0:
        return name.trim().length > 1 && !!type && address.trim().length > 1 && !!targetDate;
      case 1:
        return newClient
          ? ncName.trim().length > 1 && ncPhone.trim().length > 4
          : !!clientId;
      case 2:
        return !!leadId;
      case 3:
        return (
          contractValue > 0 &&
          (plan === "upfront" || milestoneTotal === 100)
        );
      case 4:
        return true;
      default:
        return false;
    }
  };

  const canNext = stepValid(step);
  const isLast = step === STEPS.length - 1;

  const toggleTeam = (id: string) =>
    setTeamIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const setMilestonePct = (phase: number, pct: number) =>
    setMilestones((prev) =>
      prev.map((m) =>
        m.phase === phase ? { ...m, pct: Math.max(0, Math.min(100, pct)) } : m,
      ),
    );

  const handleCreate = () => {
    setCreating(true);
    // mock: pretend to persist, then open a sample project workspace
    setTimeout(() => navigate("/projects/a1"), 700);
  };

  if (loading) {
    return (
      <Page>
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-6 h-16 w-full" />
        <Skeleton className="mt-6 h-[460px] w-full" />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        kicker="New project"
        title="Set up a project"
        description="Five guided steps — basics, client, team, payment structure, then confirm the studio's 4-phase workflow. Nothing is locked; you can revisit any step before creating."
      />

      {/* Stepper */}
      <Stepper current={step} onJump={(i) => i < step && setStep(i)} />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form column */}
        <div className="lg:col-span-2">
          <Card>
            <CardContent className="p-5 sm:p-6">
              {step === 0 && (
                <Field.Group title="Project basics" hint="What and where.">
                  <Field label="Project name" required>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Gulshan Apartment"
                      autoFocus
                    />
                  </Field>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Project type" required>
                      <Select
                        value={type}
                        onValueChange={(v) => setType(v as ProjectType)}
                        options={TYPE_OPTIONS}
                        className="w-full"
                      />
                    </Field>
                    <Field label="Target completion" required>
                      <Input
                        type="date"
                        value={targetDate}
                        onChange={(e) => setTargetDate(e.target.value)}
                      />
                    </Field>
                  </div>
                  <Field label="Site address" required>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="e.g. Gulshan 2, Dhaka"
                    />
                  </Field>
                </Field.Group>
              )}

              {step === 1 && (
                <Field.Group
                  title="Client"
                  hint="Link an existing client or add a new one."
                  action={
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-soft">
                      <span className="label-draft">New client</span>
                      <Switch checked={newClient} onCheckedChange={setNewClient} />
                    </label>
                  }
                >
                  {!newClient ? (
                    <Field label="Existing client" required>
                      <Select
                        value={clientId}
                        onValueChange={setClientId}
                        placeholder="Select a client…"
                        options={clients.map((c) => ({ value: c.id, label: c.name }))}
                        className="w-full"
                      />
                      {selectedClient && <ClientPreview client={selectedClient} />}
                    </Field>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Client / account name" required>
                        <Input
                          value={ncName}
                          onChange={(e) => setNcName(e.target.value)}
                          placeholder="e.g. Mr. Rahim (Gulshan)"
                        />
                      </Field>
                      <Field label="Contact person">
                        <Input
                          value={ncContact}
                          onChange={(e) => setNcContact(e.target.value)}
                          placeholder="e.g. Mr. Abdur Rahim"
                        />
                      </Field>
                      <Field label="Phone" required>
                        <Input
                          value={ncPhone}
                          onChange={(e) => setNcPhone(e.target.value)}
                          placeholder="+8801711…"
                        />
                      </Field>
                      <Field label="WhatsApp group link">
                        <Input
                          value={ncWhatsapp}
                          onChange={(e) => setNcWhatsapp(e.target.value)}
                          placeholder="https://chat.whatsapp.com/…"
                        />
                      </Field>
                    </div>
                  )}
                </Field.Group>
              )}

              {step === 2 && (
                <Field.Group title="Team" hint="Project lead owns delivery; team members get access.">
                  <Field label="Project lead" required>
                    <Select
                      value={leadId}
                      onValueChange={(v) => {
                        setLeadId(v);
                        setTeamIds((prev) => (prev.includes(v) ? prev : [...prev, v]));
                      }}
                      placeholder="Choose a lead…"
                      options={leadOptions}
                      className="w-full"
                    />
                  </Field>
                  <Field label="Team members" hint={`${teamIds.length} selected`}>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {members.map((m) => (
                        <MemberCheck
                          key={m.id}
                          member={m}
                          checked={teamIds.includes(m.id)}
                          isLead={m.id === leadId}
                          onToggle={() => m.id !== leadId && toggleTeam(m.id)}
                        />
                      ))}
                    </div>
                  </Field>
                </Field.Group>
              )}

              {step === 3 && (
                <Field.Group title="Payment structure" hint="How the contract value is billed.">
                  <Field label="Contract value (BDT)" required>
                    <Input
                      type="number"
                      value={contractValue || ""}
                      onChange={(e) => setContractValue(Number(e.target.value) || 0)}
                      placeholder="2800000"
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <PlanRadio
                      active={plan === "upfront"}
                      onClick={() => setPlan("upfront")}
                      title="Upfront"
                      desc="Single payment before work begins."
                    />
                    <PlanRadio
                      active={plan === "phased"}
                      onClick={() => setPlan("phased")}
                      title="Phased"
                      desc="Billed against the 4 workflow phases."
                    />
                  </div>

                  {plan === "phased" && (
                    <div className="rounded-lg border border-line">
                      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                        <span className="label-draft">Milestones · linked to phases</span>
                        <Badge tone={milestoneTotal === 100 ? "sage" : "rust"} size="sm">
                          {milestoneTotal}% allocated
                        </Badge>
                      </div>
                      <div className="divide-y divide-line">
                        {milestones.map((m) => (
                          <div
                            key={m.phase}
                            className="flex items-center gap-3 px-4 py-3"
                          >
                            <Badge tone="blue" size="sm">
                              P{m.phase}
                            </Badge>
                            <span className="min-w-0 flex-1 truncate text-sm text-ink">
                              {phaseShort(m.phase)}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                value={m.pct || ""}
                                onChange={(e) =>
                                  setMilestonePct(m.phase, Number(e.target.value) || 0)
                                }
                                className="h-8 w-16 text-right tnum"
                              />
                              <span className="text-sm text-ink-faint">%</span>
                            </div>
                            <span className="w-24 shrink-0 text-right text-sm font-medium text-ink tnum">
                              {bdt(Math.round((contractValue * m.pct) / 100), { compact: true })}
                            </span>
                          </div>
                        ))}
                      </div>
                      {milestoneTotal !== 100 && (
                        <p className="border-t border-line px-4 py-2 text-xs text-rust">
                          Allocations must total 100% to continue.
                        </p>
                      )}
                    </div>
                  )}

                  {plan === "upfront" && (
                    <div className="rounded-lg border border-line bg-paper-2 px-4 py-3 text-sm text-ink-soft">
                      One invoice for{" "}
                      <span className="font-medium text-ink tnum">{bdt(contractValue)}</span>, due
                      before mobilisation.
                    </div>
                  )}
                </Field.Group>
              )}

              {step === 4 && (
                <Field.Group
                  title="Phase workflow"
                  hint="The studio's standard 4-phase process applies to every project."
                >
                  <div className="space-y-2.5">
                    {PHASE_TEMPLATE.map((p) => (
                      <div key={p.index} className="rounded-lg border border-line p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink text-[12px] font-semibold text-paper tnum">
                              {p.index}
                            </span>
                            <div>
                              <div className="font-display text-[15px] text-ink">{p.name}</div>
                              <div className="text-xs text-ink-faint">
                                {p.checklist.length} checklist items · owner: {p.ownerRole.replace("_", " ")}
                              </div>
                            </div>
                          </div>
                          <Badge tone="neutral" size="sm" dot>
                            Standard
                          </Badge>
                        </div>
                        <div className="mt-2.5 flex items-start gap-1.5 rounded-md bg-blue-ghost px-2.5 py-1.5 text-xs text-ink-soft">
                          <Lock className="mt-0.5 h-3 w-3 shrink-0 text-blue" />
                          <span>{p.gateRule}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Field.Group>
              )}

              {/* Nav */}
              <div className="mt-6 flex items-center justify-between border-t border-line pt-5">
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setStep((s) => Math.max(0, s - 1))}
                  disabled={step === 0}
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                {!isLast ? (
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => canNext && setStep((s) => s + 1)}
                    disabled={!canNext}
                  >
                    Next <ArrowRight className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button variant="sienna" size="md" onClick={handleCreate} disabled={creating}>
                    {creating ? (
                      <>
                        <Sparkles className="h-4 w-4 animate-pulse" /> Creating…
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4" /> Create project
                      </>
                    )}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live summary rail */}
        <div>
          <Card drafting className="lg:sticky lg:top-6">
            <CardContent className="p-5">
              <div className="label-draft mb-3">Summary</div>
              <SummaryRow label="Project" value={name || "—"} />
              <SummaryRow
                label="Type"
                value={TYPE_OPTIONS.find((t) => t.value === type)?.label ?? "—"}
              />
              <SummaryRow label="Site" value={address || "—"} icon={MapPin} />
              <SummaryRow
                label="Client"
                value={newClient ? ncName || "New client" : selectedClient?.name ?? "—"}
              />
              <SummaryRow label="Lead" value={lead?.name ?? "—"} />
              <SummaryRow
                label="Team"
                value={team.length ? `${team.length} member${team.length > 1 ? "s" : ""}` : "—"}
              />
              <SummaryRow
                label="Contract"
                value={contractValue ? bdt(contractValue, { compact: true }) : "—"}
              />
              <SummaryRow
                label="Billing"
                value={plan === "upfront" ? "Upfront" : "Phased · 4 milestones"}
              />

              {team.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                  {team.map((m) => (
                    <span
                      key={m.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-2 py-0.5 text-xs text-ink-soft"
                    >
                      <Avatar name={m.name} tone={m.tone} size="xs" />
                      {m.name.split(" ")[0]}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-2 rounded-md bg-paper-2 px-3 py-2 text-xs text-ink-faint">
                <CheckCircle2 className="h-3.5 w-3.5 text-sage" />
                Approval flow: Lead → Fariha → Raiana → Client
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}

// ============================================================
// Stepper
// ============================================================
function Stepper({ current, onJump }: { current: number; onJump: (i: number) => void }) {
  return (
    <div className="mt-6 overflow-x-auto">
      <div className="flex min-w-max items-center gap-2">
        {STEPS.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const Icon = s.icon;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onJump(i)}
                disabled={i >= current}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
                  active && "border-blue bg-blue text-paper",
                  done && "cursor-pointer border-sage/40 bg-sage-tint text-ink hover:border-sage",
                  !active && !done && "border-line bg-paper text-ink-faint",
                )}
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[11px] font-semibold tnum",
                    active && "bg-paper/20",
                    done && "bg-sage text-paper",
                    !active && !done && "bg-paper-2",
                  )}
                >
                  {done ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <span
                  className={cn("h-px w-5 sm:w-8", done ? "bg-sage/50" : "bg-line")}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// Field primitives
// ============================================================
function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[13px] font-medium text-ink">
          {label}
          {required && <span className="ml-0.5 text-rust">*</span>}
        </label>
        {hint && <span className="text-xs text-ink-ghost tnum">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

Field.Group = function Group({
  title,
  hint,
  action,
  children,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg text-ink">{title}</h3>
          {hint && <p className="mt-0.5 text-sm text-ink-faint">{hint}</p>}
        </div>
        {action}
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
};

function ClientPreview({ client }: { client: ClientA }) {
  return (
    <div className="mt-2 rounded-md border border-line bg-paper-2 px-3 py-2 text-xs text-ink-soft">
      <span className="font-medium text-ink">{client.contactName}</span> · {client.phone}
      <div className="text-ink-ghost">{client.whatsappGroup}</div>
    </div>
  );
}

function MemberCheck({
  member,
  checked,
  isLead,
  onToggle,
}: {
  member: Member;
  checked: boolean;
  isLead: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isLead}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
        checked ? "border-blue/40 bg-blue-ghost" : "border-line bg-paper hover:border-ink-ghost",
        isLead && "cursor-not-allowed opacity-90",
      )}
    >
      <Avatar name={member.name} tone={member.tone} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{member.name}</div>
        <div className="truncate text-xs text-ink-faint">{member.title}</div>
      </div>
      {isLead ? (
        <Badge tone="blue" size="sm">
          Lead
        </Badge>
      ) : (
        <span
          className={cn(
            "grid h-5 w-5 place-items-center rounded border",
            checked ? "border-blue bg-blue text-paper" : "border-line-strong bg-paper",
          )}
        >
          {checked && <Check className="h-3 w-3" />}
        </span>
      )}
    </button>
  );
}

function PlanRadio({
  active,
  onClick,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3.5 text-left transition-colors",
        active ? "border-blue bg-blue-ghost" : "border-line bg-paper hover:border-ink-ghost",
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "grid h-4 w-4 place-items-center rounded-full border-2",
            active ? "border-blue" : "border-line-strong",
          )}
        >
          {active && <span className="h-2 w-2 rounded-full bg-blue" />}
        </span>
        <span className="text-sm font-medium text-ink">{title}</span>
      </div>
      <p className="mt-1 pl-6 text-xs text-ink-faint">{desc}</p>
    </button>
  );
}

function SummaryRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line/60 py-1.5 last:border-0">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="flex items-center gap-1 text-right text-[13px] font-medium text-ink">
        {Icon && <Icon className="h-3 w-3 text-ink-ghost" />}
        <span className="line-clamp-1">{value}</span>
      </span>
    </div>
  );
}
