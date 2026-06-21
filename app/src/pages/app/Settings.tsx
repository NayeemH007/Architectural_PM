import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Building2,
  MapPin,
  PencilLine,
  Lock,
  Check,
  CircleCheck,
  CreditCard,
  HardDrive,
  Cloud,
  MessageCircle,
  ArrowRight,
  Users,
  Info,
  Layers,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import {
  Card,
  CardContent,
  CardHeader,
  CardKicker,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { workspace, PHASE_TEMPLATE, members } from "@/lib/archintel/data";
import type { MemberRole, PhaseTemplate, Member } from "@/lib/archintel/data";

const ROLE_LABEL: Record<MemberRole, string> = {
  founder: "Founder",
  principal: "Principal",
  project_lead: "Project Lead",
  designer: "Designer",
  finance: "Finance",
};

const STUDIO_TYPES = [
  "Interior Design Studio",
  "Architecture Practice",
  "Design-Build Firm",
];

// payment preset templates (visual / configurable in real product)
interface PaymentPreset {
  id: string;
  name: string;
  blurb: string;
  splits: { label: string; pct: number; tone: string }[];
  recommended?: boolean;
}
const PAYMENT_PRESETS: PaymentPreset[] = [
  {
    id: "upfront",
    name: "Upfront 100%",
    blurb: "Full design fee collected before discovery begins. Small or fast-turnaround jobs.",
    splits: [{ label: "On signing", pct: 100, tone: "bg-blue" }],
  },
  {
    id: "phased-10-30-30-30",
    name: "Phased 10 / 30 / 30 / 30",
    blurb: "Tied to the four-phase workflow gates. The studio default for full projects.",
    recommended: true,
    splits: [
      { label: "Booking", pct: 10, tone: "bg-blue" },
      { label: "Concept", pct: 30, tone: "bg-sage" },
      { label: "Design Dev", pct: 30, tone: "bg-ochre" },
      { label: "Construction Docs", pct: 30, tone: "bg-sienna" },
    ],
  },
  {
    id: "phased-20-40-40",
    name: "Phased 20 / 40 / 40",
    blurb: "Heavier front-load across three checkpoints. Trusted repeat clients.",
    splits: [
      { label: "Booking", pct: 20, tone: "bg-blue" },
      { label: "Midpoint", pct: 40, tone: "bg-ochre" },
      { label: "Handover", pct: 40, tone: "bg-sienna" },
    ],
  },
];

// integrations (visual toggles — files stay in their own tools)
interface Integration {
  id: string;
  name: string;
  desc: string;
  icon: typeof Cloud;
  tone: string;
  defaultOn: boolean;
}
const INTEGRATIONS: Integration[] = [
  {
    id: "gdrive",
    name: "Google Drive",
    desc: "Link shared drive folders so file records point to the live document — files stay in Drive.",
    icon: Cloud,
    tone: "text-blue",
    defaultOn: true,
  },
  {
    id: "whatsapp",
    name: "WhatsApp",
    desc: "Attach each project's client group so submissions can be logged against the conversation.",
    icon: MessageCircle,
    tone: "text-sage",
    defaultOn: true,
  },
  {
    id: "local",
    name: "Local files",
    desc: "Track working files kept on studio machines (AutoCAD, D5, InDesign) by reference only.",
    icon: HardDrive,
    tone: "text-ochre",
    defaultOn: false,
  },
];

export default function Settings() {
  return (
    <Page>
      <PageHeader
        kicker="SPACE ESSE · Settings"
        title="Workspace settings"
        description="Configure the studio profile, the four-phase workflow template, payment plans, and how ArchIntel connects to the tools you already use."
      />

      <Tabs defaultValue="workspace" className="mt-7">
        <TabsList className="flex-wrap">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="phases">Phase workflow</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace">
          <WorkspaceTab />
        </TabsContent>
        <TabsContent value="phases">
          <PhaseWorkflowTab />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab />
        </TabsContent>
        <TabsContent value="integrations">
          <IntegrationsTab />
        </TabsContent>
        <TabsContent value="team">
          <TeamTab />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

/* ----------------------------- Workspace tab ----------------------------- */
function WorkspaceTab() {
  const [firm, setFirm] = useState(workspace.firm);
  const [city, setCity] = useState(workspace.city);
  const [studioType, setStudioType] = useState(STUDIO_TYPES[0]);
  const [saved, setSaved] = useState(false);

  const dirty =
    firm !== workspace.firm || city !== workspace.city || studioType !== STUDIO_TYPES[0];

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div>
            <CardKicker>Studio profile</CardKicker>
            <CardTitle>Firm identity</CardTitle>
          </div>
          <Badge tone="neutral" size="sm">
            {workspace.product}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field label="Firm name">
            <Input
              value={firm}
              onChange={(e) => {
                setFirm(e.target.value);
                setSaved(false);
              }}
            />
          </Field>
          <Field label="City">
            <div className="relative">
              <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-ghost" />
              <Input
                className="pl-8"
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setSaved(false);
                }}
              />
            </div>
          </Field>
          <Field label="Studio type">
            <div className="flex flex-wrap gap-2">
              {STUDIO_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setStudioType(t);
                    setSaved(false);
                  }}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-[13px] font-medium transition-colors",
                    studioType === t
                      ? "border-blue bg-blue-tint text-blue"
                      : "border-line-strong bg-paper text-ink-soft hover:border-ink-ghost",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          <p className="text-xs text-ink-ghost">
            Legal name on file: <span className="text-ink-soft">{workspace.legalName}</span>
          </p>
        </CardContent>
        <CardFooter>
          <span className="text-xs text-ink-ghost">
            {saved
              ? "Profile updated"
              : dirty
                ? "Unsaved changes"
                : "All changes saved"}
          </span>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="inline-flex items-center gap-1 text-xs text-sage">
                <CircleCheck className="h-3.5 w-3.5" /> Saved
              </span>
            )}
            <Button
              variant="primary"
              size="sm"
              disabled={!dirty}
              onClick={() => setSaved(true)}
            >
              Save profile
            </Button>
          </div>
        </CardFooter>
      </Card>

      <Card drafting>
        <CardHeader>
          <div>
            <CardKicker>Design tools</CardKicker>
            <CardTitle>What the studio works in</CardTitle>
          </div>
          <Layers className="h-4 w-4 text-ink-faint" />
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-ink-soft">
            ArchIntel organises projects around these tools — it does not replace them. Drawings,
            renders and documents stay where your team makes them.
          </p>
          <div className="flex flex-wrap gap-2">
            {workspace.tools.map((tool) => (
              <span
                key={tool}
                className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-paper-2 px-2.5 py-1 text-[13px] text-ink-soft"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-sienna" />
                {tool}
              </span>
            ))}
          </div>
          <Separator />
          <div className="flex items-start gap-2 text-xs text-ink-ghost">
            <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
            <span>
              {workspace.firm} · {workspace.city}. Six tools tracked across {PHASE_TEMPLATE.length}{" "}
              workflow phases.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* --------------------------- Phase workflow tab -------------------------- */
function PhaseWorkflowTab() {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-paper-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue" />
          This is the studio's standard four-phase template. Every new project starts from it; gate
          rules block a phase from advancing until its checkpoint is met.
        </p>
        <Button variant="outline" size="sm" className="shrink-0" disabled>
          <PencilLine className="h-3.5 w-3.5" /> Edit template
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {PHASE_TEMPLATE.map((phase) => (
          <PhaseCard key={phase.key} phase={phase} />
        ))}
      </div>
    </div>
  );
}

function PhaseCard({ phase }: { phase: PhaseTemplate }) {
  const gateIndex = phase.checklist.findIndex((c) => c.gate);
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-ink font-display text-sm text-paper">
            {phase.index}
          </span>
          <div>
            <CardTitle>{phase.name}</CardTitle>
            <div className="mt-1 flex items-center gap-2">
              <Badge tone="neutral" size="sm">
                Owner · {ROLE_LABEL[phase.ownerRole]}
              </Badge>
              <span className="text-xs text-ink-ghost tnum">
                {phase.checklist.length} steps
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex grow flex-col gap-3">
        {/* gate rule — ochre callout */}
        <div className="flex items-start gap-2 rounded-md border border-ochre/30 bg-ochre-tint px-3 py-2">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ochre" />
          <div>
            <div className="label-draft text-ochre">Gate rule</div>
            <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{phase.gateRule}</p>
          </div>
        </div>

        {/* checklist */}
        <ul className="space-y-1">
          {phase.checklist.map((item, i) => {
            const isGate = !!item.gate;
            return (
              <li
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1 text-[13px]",
                  isGate ? "bg-ochre-tint/40 text-ink" : "text-ink-soft",
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                    isGate ? "border-ochre text-ochre" : "border-line-strong text-ink-faint",
                  )}
                >
                  {isGate ? <Lock className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
                </span>
                <span className={cn("flex-1", isGate && "font-medium")}>{item.label}</span>
                {isGate && (
                  <span className="label-draft text-ochre">Gate</span>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
      <CardFooter>
        <span className="text-xs text-ink-ghost">
          Gate at step {gateIndex + 1} of {phase.checklist.length}
        </span>
        <Button variant="ghost" size="sm" disabled>
          <PencilLine className="h-3.5 w-3.5" /> Edit
        </Button>
      </CardFooter>
    </Card>
  );
}

/* ------------------------------ Payments tab ----------------------------- */
function PaymentsTab() {
  const [active, setActive] = useState("phased-10-30-30-30");

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-ink-soft">
        Preset payment plans applied when a project is set up. Milestones are tracked against the
        four-phase workflow so receivables stay in step with delivery.
      </p>
      <div className="grid gap-5 lg:grid-cols-3">
        {PAYMENT_PRESETS.map((preset) => {
          const isActive = active === preset.id;
          return (
            <Card
              key={preset.id}
              className={cn(
                "flex cursor-pointer flex-col transition-colors",
                isActive ? "border-blue ring-1 ring-blue/30" : "hover:border-ink-ghost",
              )}
              onClick={() => setActive(preset.id)}
            >
              <CardHeader>
                <div>
                  <CardKicker>{preset.recommended ? "Studio default" : "Preset"}</CardKicker>
                  <CardTitle>{preset.name}</CardTitle>
                </div>
                {isActive ? (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue text-paper">
                    <Check className="h-3 w-3" />
                  </span>
                ) : (
                  preset.recommended && (
                    <Badge tone="sage" size="sm">
                      Recommended
                    </Badge>
                  )
                )}
              </CardHeader>
              <CardContent className="flex grow flex-col gap-3">
                <p className="text-[13px] leading-snug text-ink-soft">{preset.blurb}</p>
                {/* split bar */}
                <div className="flex h-2.5 w-full overflow-hidden rounded-full">
                  {preset.splits.map((s, i) => (
                    <div
                      key={i}
                      className={cn("h-full", s.tone)}
                      style={{ width: `${s.pct}%` }}
                      title={`${s.label} · ${s.pct}%`}
                    />
                  ))}
                </div>
                <ul className="mt-auto space-y-1">
                  {preset.splits.map((s, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between text-[13px] text-ink-soft"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", s.tone)} />
                        {s.label}
                      </span>
                      <span className="text-ink tnum">{s.pct}%</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <span className="inline-flex items-center gap-1.5 text-xs text-ink-ghost">
                  <CreditCard className="h-3.5 w-3.5" />
                  {preset.splits.length} milestone{preset.splits.length === 1 ? "" : "s"}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    isActive ? "text-blue" : "text-ink-faint",
                  )}
                >
                  {isActive ? "Selected" : "Select"}
                </span>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-ink-ghost">
        Applied to new projects. Existing payment plans are not changed retroactively.
      </p>
    </div>
  );
}

/* ---------------------------- Integrations tab --------------------------- */
function IntegrationsTab() {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(INTEGRATIONS.map((i) => [i.id, i.defaultOn])),
  );
  const connected = Object.values(state).filter(Boolean).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-2 rounded-lg border border-line bg-paper-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-ink-soft">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue" />
          ArchIntel references your files where they already live — nothing is uploaded or moved.
          Each connection only records links and status.
        </p>
        <Badge tone="blue" size="sm">
          {connected} of {INTEGRATIONS.length} on
        </Badge>
      </div>

      <div className="space-y-3">
        {INTEGRATIONS.map((int) => {
          const Icon = int.icon;
          const on = state[int.id];
          return (
            <Card key={int.id}>
              <CardContent className="flex items-start gap-4 pt-5">
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-paper-2",
                    int.tone,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-ink">{int.name}</h3>
                    {on ? (
                      <Badge tone="sage" size="sm" dot>
                        Connected
                      </Badge>
                    ) : (
                      <Badge tone="neutral" size="sm">
                        Off
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 max-w-xl text-[13px] leading-snug text-ink-soft">
                    {int.desc}
                  </p>
                </div>
                <Switch
                  checked={on}
                  onCheckedChange={(v) =>
                    setState((prev) => ({ ...prev, [int.id]: v }))
                  }
                  className="mt-1"
                />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-ink-ghost">
        Files in InDesign, AutoCAD, SketchUp and D5 always remain in their own tools.
      </p>
    </div>
  );
}

/* ------------------------------- Team tab -------------------------------- */
function TeamTab() {
  const approvers = members.filter((m) => m.isApprover);
  const preview = members.slice(0, 5);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div>
            <CardKicker>Studio members</CardKicker>
            <CardTitle>Who is on the team</CardTitle>
          </div>
          <Badge tone="neutral" size="sm" className="tnum">
            {members.length}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-2">
          {preview.map((m) => (
            <MemberRow key={m.id} member={m} />
          ))}
          {members.length > preview.length && (
            <p className="pt-1 text-xs text-ink-ghost">
              +{members.length - preview.length} more on the full team page.
            </p>
          )}
        </CardContent>
        <CardFooter>
          <span className="text-xs text-ink-ghost">Roles & approvers managed in Team</span>
          <Link
            to="/team"
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-tint px-3 text-[13px] font-medium text-blue transition-colors hover:bg-blue-ghost"
          >
            <Users className="h-3.5 w-3.5" /> Manage team
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardFooter>
      </Card>

      <Card drafting>
        <CardHeader>
          <div>
            <CardKicker>Approval flow</CardKicker>
            <CardTitle>Sign-off chain</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="space-y-2 text-[13px]">
            {[
              "Project Lead prepares the package",
              "Fariha coordinates the review",
              "Raiana approves design / material",
              "Client receives & approval recorded",
              "Documents released for execution",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-tint font-mono text-[11px] text-blue">
                  {i + 1}
                </span>
                <span className="text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>
          <Separator />
          <div>
            <div className="label-draft mb-1.5">Final approver</div>
            {approvers.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5">
                <Avatar name={m.name} tone={m.tone} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-ink">{m.name}</div>
                  <div className="truncate text-xs text-ink-faint">{m.title}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-paper-2 px-3 py-2">
      <Avatar name={member.name} tone={member.tone} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-ink">{member.name}</div>
        <div className="truncate text-xs text-ink-faint">{member.title}</div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {member.isApprover && (
          <Badge tone="sienna" size="sm">
            Approver
          </Badge>
        )}
        <Badge tone="neutral" size="sm">
          {ROLE_LABEL[member.role]}
        </Badge>
      </div>
    </div>
  );
}

/* -------------------------------- helpers -------------------------------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label-draft mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
