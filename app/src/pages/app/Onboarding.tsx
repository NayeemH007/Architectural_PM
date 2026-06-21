import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FolderOpen,
  HardDrive,
  Layers,
  MessageCircle,
  Plus,
  ShieldCheck,
  UserPlus,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArchIntelMark } from "@/components/brand";
import { members, workspace, PHASE_TEMPLATE } from "@/lib/archintel/data";
import type { Member, MemberRole } from "@/lib/archintel/data";
import { cn } from "@/lib/cn";

const STEPS = [
  { n: 1, label: "Invite team" },
  { n: 2, label: "Workflow" },
  { n: 3, label: "Tools" },
  { n: 4, label: "First project" },
] as const;

const ROLE_LABEL: Record<MemberRole, string> = {
  founder: "Founder",
  principal: "Principal",
  project_lead: "Project Lead",
  designer: "Designer",
  finance: "Finance",
};

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = (
  Object.keys(ROLE_LABEL) as MemberRole[]
).map((r) => ({ value: r, label: ROLE_LABEL[r] }));

interface Invitee {
  id: string;
  name: string;
  role: MemberRole;
  tone: string;
  existing: boolean;
}

const TOOL_DEFS = [
  {
    id: "gdrive",
    name: "Google Drive",
    desc: "Index shared drives — renders, decks and BOQs stay in Drive.",
    icon: HardDrive,
    tone: "blue",
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    desc: "Link client groups so submissions & approvals are tracked.",
    icon: MessageCircle,
    tone: "sage",
  },
  {
    id: "local",
    name: "Local files",
    desc: "Reference AutoCAD / SketchUp sets kept on studio machines.",
    icon: FolderOpen,
    tone: "ochre",
  },
] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1 — team
  const [team, setTeam] = useState<Invitee[]>(() =>
    members.map((m: Member) => ({
      id: m.id,
      name: m.name,
      role: m.role,
      tone: m.tone,
      existing: true,
    })),
  );
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<MemberRole>("designer");

  // Step 2 — workflow
  const [templateChosen, setTemplateChosen] = useState(false);

  // Step 3 — tools
  const [tools, setTools] = useState<Record<string, boolean>>({
    gdrive: true,
    whatsapp: true,
    local: false,
  });

  // Step 4 — first project
  const [projectName, setProjectName] = useState("");
  const [clientName, setClientName] = useState("");

  const connectedCount = useMemo(
    () => Object.values(tools).filter(Boolean).length,
    [tools],
  );

  function addMember() {
    const name = newName.trim();
    if (!name) return;
    setTeam((t) => [
      ...t,
      {
        id: `new-${Date.now()}`,
        name,
        role: newRole,
        tone: ["sienna", "blue", "sage", "ochre"][t.length % 4],
        existing: false,
      },
    ]);
    setNewName("");
  }

  function removeMember(id: string) {
    setTeam((t) => t.filter((m) => m.id !== id));
  }

  const isLast = step === STEPS.length;
  const nextDisabled = step === 2 && !templateChosen;

  function next() {
    if (isLast) {
      navigate("/");
      return;
    }
    setStep((s) => Math.min(STEPS.length, s + 1));
  }
  function back() {
    setStep((s) => Math.max(1, s - 1));
  }

  return (
    <div className="min-h-screen bg-bone text-ink">
      {/* Header */}
      <header className="border-b border-line bg-paper/70 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <ArchIntelMark className="h-6 w-6 text-blue" />
            <div className="leading-tight">
              <div className="font-display text-[15px] text-ink">{workspace.product}</div>
              <div className="label-draft">{workspace.firm} · {workspace.city}</div>
            </div>
          </div>
          <button
            onClick={() => navigate("/")}
            className="text-[13px] text-ink-faint transition-colors hover:text-ink"
          >
            Skip setup
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 pb-28 pt-8">
        {/* Progress indicator */}
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <span className="label-draft">Step {step} of {STEPS.length}</span>
            <span className="label-draft tnum">{Math.round((step / STEPS.length) * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex flex-1 items-center gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <div
                    className={cn(
                      "h-1 rounded-full transition-colors",
                      s.n < step
                        ? "bg-blue"
                        : s.n === step
                        ? "bg-blue"
                        : "bg-line-strong",
                    )}
                  />
                  <span
                    className={cn(
                      "hidden text-[11px] font-medium sm:block",
                      s.n <= step ? "text-ink-soft" : "text-ink-ghost",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                      s.n < step
                        ? "bg-blue text-paper"
                        : "bg-bone-2 text-ink-ghost",
                    )}
                  >
                    {s.n < step ? <Check className="h-3 w-3" /> : s.n}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step card */}
        <div className="rounded-lg border border-line bg-paper p-6 shadow-card sm:p-8">
          {step === 1 && (
            <Step1
              team={team}
              newName={newName}
              newRole={newRole}
              roleLabel={ROLE_LABEL}
              roleOptions={ROLE_OPTIONS}
              onName={setNewName}
              onRole={setNewRole}
              onAdd={addMember}
              onRemove={removeMember}
            />
          )}

          {step === 2 && (
            <Step2 chosen={templateChosen} onChoose={() => setTemplateChosen(true)} />
          )}

          {step === 3 && (
            <Step3 tools={tools} onToggle={(id, v) => setTools((t) => ({ ...t, [id]: v }))} />
          )}

          {step === 4 && (
            <Step4
              projectName={projectName}
              clientName={clientName}
              onProject={setProjectName}
              onClient={setClientName}
            />
          )}
        </div>

        {/* Nav */}
        <div className="mt-6 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 1}
            className={cn(step === 1 && "invisible")}
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>

          <div className="flex items-center gap-3">
            {step === 4 && (
              <button
                onClick={() => navigate("/")}
                className="text-[13px] text-ink-faint transition-colors hover:text-ink"
              >
                Skip for now
              </button>
            )}
            <Button onClick={next} disabled={nextDisabled} size="lg">
              {isLast ? "Finish setup" : "Continue"}
              {!isLast && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {step === 3 && connectedCount === 0 && (
          <p className="mt-3 text-right text-[12px] text-ink-faint">
            You can connect tools later from Settings.
          </p>
        )}
      </main>
    </div>
  );
}

/* ----------------------------- Step heading ----------------------------- */

function Heading({ kicker, title, desc }: { kicker: string; title: string; desc: string }) {
  return (
    <div className="mb-6">
      <div className="label-draft mb-1.5 text-blue">{kicker}</div>
      <h1 className="font-display text-2xl leading-tight text-ink">{title}</h1>
      <p className="mt-1.5 max-w-lg text-sm text-ink-soft">{desc}</p>
    </div>
  );
}

/* --------------------------------- Step 1 ------------------------------- */

function Step1({
  team,
  newName,
  newRole,
  roleLabel,
  roleOptions,
  onName,
  onRole,
  onAdd,
  onRemove,
}: {
  team: Invitee[];
  newName: string;
  newRole: MemberRole;
  roleLabel: Record<MemberRole, string>;
  roleOptions: { value: MemberRole; label: string }[];
  onName: (v: string) => void;
  onRole: (v: MemberRole) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  return (
    <>
      <Heading
        kicker="Your studio"
        title="Invite your team"
        desc={`We found your ${workspace.firm} members. Add anyone who's missing — roles drive who prepares, coordinates and approves work.`}
      />

      <div className="space-y-2">
        {team.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 rounded-md border border-line bg-paper-2 px-3 py-2.5"
          >
            <Avatar name={m.name} tone={m.tone} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-ink">{m.name}</div>
              <div className="text-[12px] text-ink-faint">{roleLabel[m.role]}</div>
            </div>
            {m.role === "founder" && (
              <Badge tone="sienna" size="sm" dot>
                Approver
              </Badge>
            )}
            <Badge tone={m.existing ? "neutral" : "sage"} size="sm">
              {m.existing ? "On team" : "Invited"}
            </Badge>
            {!m.existing && (
              <button
                onClick={() => onRemove(m.id)}
                className="text-ink-ghost transition-colors hover:text-rust"
                aria-label={`Remove ${m.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <Separator className="my-5" />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <UserPlus className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-ghost" />
          <Input
            value={newName}
            onChange={(e) => onName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            placeholder="Add a teammate by name…"
            className="pl-8"
          />
        </div>
        <select
          value={newRole}
          onChange={(e) => onRole(e.target.value as MemberRole)}
          className="h-9 rounded-md border border-line-strong bg-paper px-2.5 text-sm text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/15"
        >
          {roleOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button variant="outline" onClick={onAdd} disabled={!newName.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </div>
    </>
  );
}

/* --------------------------------- Step 2 ------------------------------- */

function Step2({ chosen, onChoose }: { chosen: boolean; onChoose: () => void }) {
  const phaseTones = ["blue", "sienna", "sage", "ochre"] as const;
  return (
    <>
      <Heading
        kicker="How you work"
        title="Choose your workflow"
        desc="ArchIntel ships with your studio's real 4-phase delivery process. Each phase has its own checklist and a gate that must clear before the next begins."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {PHASE_TEMPLATE.map((p, i) => (
          <div
            key={p.key}
            className="flex flex-col rounded-md border border-line bg-paper-2 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <Badge tone={phaseTones[i]} size="sm">
                Phase {p.index}
              </Badge>
              <span className="label-draft tnum">{p.checklist.length} items</span>
            </div>
            <div className="font-display text-[15px] leading-tight text-ink">{p.name}</div>
            <div className="mt-2 flex items-start gap-1.5 text-[12px] leading-snug text-ink-faint">
              <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-ochre" />
              <span>{p.gateRule}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-col items-center justify-between gap-3 rounded-md border border-line bg-blue-ghost px-4 py-3 sm:flex-row">
        <div className="flex items-center gap-2 text-sm text-ink-soft">
          <Layers className="h-4 w-4 text-blue" />
          <span>Standard 4-phase template · {PHASE_TEMPLATE.reduce((n, p) => n + p.checklist.length, 0)} checklist items</span>
        </div>
        {chosen ? (
          <Badge tone="sage" dot>
            <Check className="h-3.5 w-3.5" /> Template applied
          </Badge>
        ) : (
          <Button variant="primary" size="sm" onClick={onChoose}>
            Use this template
          </Button>
        )}
      </div>
    </>
  );
}

/* --------------------------------- Step 3 ------------------------------- */

function Step3({
  tools,
  onToggle,
}: {
  tools: Record<string, boolean>;
  onToggle: (id: string, v: boolean) => void;
}) {
  return (
    <>
      <Heading
        kicker="Stay in your tools"
        title="Connect your tools"
        desc="ArchIntel organises projects around what you already use. Your files never move — they stay in their tools and we keep a tidy register and audit trail."
      />

      <div className="space-y-3">
        {TOOL_DEFS.map((t) => {
          const Icon = t.icon;
          const on = tools[t.id];
          return (
            <label
              key={t.id}
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-md border px-4 py-3.5 transition-colors",
                on ? "border-blue/40 bg-blue-ghost" : "border-line bg-paper-2",
              )}
            >
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-md",
                  on ? "bg-paper text-blue" : "bg-bone-2 text-ink-faint",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">{t.name}</div>
                <div className="text-[12px] leading-snug text-ink-faint">{t.desc}</div>
              </div>
              <Switch checked={on} onCheckedChange={(v) => onToggle(t.id, v)} />
            </label>
          );
        })}
      </div>

      <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-snug text-ink-faint">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0 text-sage" />
        Read-only by design — your AutoCAD, SketchUp, D5 and InDesign work stays exactly where it is.
      </p>
    </>
  );
}

/* --------------------------------- Step 4 ------------------------------- */

function Step4({
  projectName,
  clientName,
  onProject,
  onClient,
}: {
  projectName: string;
  clientName: string;
  onProject: (v: string) => void;
  onClient: (v: string) => void;
}) {
  const ready = projectName.trim().length > 0;
  return (
    <>
      <Heading
        kicker="Get going"
        title="Create your first project"
        desc="Start a project to see the workflow in action — or skip and add one later from the dashboard."
      />

      <div className="space-y-4">
        <div>
          <label className="label-draft mb-1.5 block">Project name</label>
          <Input
            value={projectName}
            onChange={(e) => onProject(e.target.value)}
            placeholder="e.g. Gulshan Apartment Renovation"
          />
        </div>
        <div>
          <label className="label-draft mb-1.5 block">Client (optional)</label>
          <Input
            value={clientName}
            onChange={(e) => onClient(e.target.value)}
            placeholder="e.g. Mr. Abdur Rahim"
          />
        </div>
      </div>

      <div className="mt-5 rounded-md border border-line bg-paper-2 p-4">
        <div className="label-draft mb-2">Preview</div>
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-tint">
            <FolderOpen className="h-4 w-4 text-blue" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-display text-[15px] text-ink">
              {projectName.trim() || "Untitled project"}
            </div>
            <div className="text-[12px] text-ink-faint">
              {clientName.trim() || "No client yet"} · Starts at Phase 1 · Discovery & Site Analysis
            </div>
          </div>
          <div className="ml-auto">
            <Badge tone={ready ? "sage" : "neutral"} size="sm" dot>
              {ready ? "Ready" : "Draft"}
            </Badge>
          </div>
        </div>
      </div>
    </>
  );
}
