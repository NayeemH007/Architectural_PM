import { useState } from "react";
import {
  PencilLine,
  Landmark,
  GitPullRequestArrow,
  Clock,
  MapPin,
  MessageSquare,
  Check,
  Sparkles,
  Zap,
} from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardHeader,
  CardKicker,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfidenceBadge, DataCompleteness } from "@/components/trust";
import { SourceChip, StatusDot } from "@/components/data-source";
import { EmptyState } from "@/components/states";
import { shortDate, relative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useDecisions } from "@/lib/api";
import { decisions as decisionsSeed, projects, employees } from "@/lib/mock/data";
import type { Decision } from "@/lib/types";

// ---- capture types -----------------------------------------------------------
type CaptureType =
  | "decision"
  | "approval"
  | "scope"
  | "timesheet"
  | "site"
  | "whatsapp";

const CAPTURE_TYPES: {
  id: CaptureType;
  label: string;
  hint: string;
  icon: typeof PencilLine;
}[] = [
  { id: "decision", label: "Decision", hint: "Who decided what, when", icon: PencilLine },
  { id: "approval", label: "Approval update", hint: "Authority status change", icon: Landmark },
  { id: "scope", label: "Scope change", hint: "Change order / variation", icon: GitPullRequestArrow },
  { id: "timesheet", label: "Quick timesheet", hint: "Log hours fast", icon: Clock },
  { id: "site", label: "Site report", hint: "Field note from site", icon: MapPin },
  { id: "whatsapp", label: "Promote WhatsApp", hint: "Paste a thread", icon: MessageSquare },
];

const TODAY = "2026-06-17";

// reusable option lists
const projectOptions = projects.map((p) => ({ value: p.id, label: p.name }));
const employeeOptions = employees.map((e) => ({ value: e.id, label: e.name }));
const channelOptions = [
  { value: "meeting", label: "Meeting" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "call", label: "Phone call" },
  { value: "site", label: "Site visit" },
];
const authorityOptions = [
  { value: "RAJUK", label: "RAJUK" },
  { value: "FSCD", label: "FSCD (Fire)" },
  { value: "CAAB", label: "CAAB" },
  { value: "DoE", label: "Dept. of Environment" },
  { value: "City Corporation", label: "City Corporation" },
  { value: "DPDC", label: "DPDC" },
];
const approvalStatusOptions = [
  { value: "submitted", label: "Submitted" },
  { value: "in_review", label: "In review" },
  { value: "query_raised", label: "Query raised" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

// ---- field primitives --------------------------------------------------------
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[13px] font-medium text-ink">{label}</span>
        {hint && <span className="text-[11px] text-ink-ghost">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function Textarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  mono = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  mono?: boolean;
}) {
  return (
    <textarea
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full rounded-md border border-line-strong bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-ghost",
        "focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15",
        mono && "font-mono text-[13px] leading-relaxed",
      )}
    />
  );
}

// ---- the page ----------------------------------------------------------------
export default function Capture() {
  const { data: live } = useDecisions();
  const recent: Decision[] = (live ?? decisionsSeed)
    .slice()
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const [type, setType] = useState<CaptureType>("decision");

  // shared form state
  const [projectId, setProjectId] = useState<string>("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(TODAY);
  const [citeMe, setCiteMe] = useState(true);

  // type-specific
  const [decidedBy, setDecidedBy] = useState("");
  const [channel, setChannel] = useState("meeting");
  const [authority, setAuthority] = useState("RAJUK");
  const [approvalStatus, setApprovalStatus] = useState("submitted");
  const [employeeId, setEmployeeId] = useState("");
  const [hours, setHours] = useState("");
  const [costImpact, setCostImpact] = useState("");
  const [paste, setPaste] = useState("");

  const [confirmed, setConfirmed] = useState<null | { label: string; project: string }>(null);

  const active = CAPTURE_TYPES.find((t) => t.id === type)!;
  const projectName = projects.find((p) => p.id === projectId)?.name ?? "Unassigned project";

  function reset() {
    setNote("");
    setPaste("");
    setHours("");
    setCostImpact("");
    setDecidedBy("");
    setConfirmed(null);
  }

  function chooseType(t: CaptureType) {
    setType(t);
    setConfirmed(null);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setConfirmed({ label: active.label, project: projectName });
  }

  // minimal validity gate so the button feels real
  const ready =
    !!projectId &&
    (type === "timesheet"
      ? !!employeeId && !!hours
      : type === "whatsapp"
        ? paste.trim().length > 0
        : note.trim().length > 0);

  return (
    <Page>
      <PageHeader
        kicker="Data & setup"
        title="Quick capture"
        description="The highest-value data — decisions, approvals, scope changes, effort — has no API. Capture it here in under a minute, and it lands in the project record, cited to you."
        actions={
          <Button variant="outline" size="md">
            <Sparkles className="h-4 w-4" /> Ask about captures
          </Button>
        }
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          kicker="Captures this week"
          value="18"
          footnote={<span className="text-[11px] text-ink-ghost">6 of 10 staff contributing</span>}
        />
        <KpiCard
          kicker="Pending promotions"
          value="2"
          footnote={<Badge tone="ochre" size="sm">Unverified decisions</Badge>}
        />
        <KpiCard
          kicker="Timesheet coverage"
          value="64%"
          footnote={<span className="text-[11px] text-sienna">Low — capacity answers blocked</span>}
        />
        <KpiCard
          kicker="Avg capture time"
          value="42s"
          footnote={<span className="text-[11px] text-sage">Faster than a phone call</span>}
        />
      </div>

      {/* capture type selector */}
      <PageSection
        className="mt-8"
        title="What are you capturing?"
        description="Manual capture is a first-class connector here — not a fallback. Pick a type to load the right form."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {CAPTURE_TYPES.map((t) => {
            const Icon = t.icon;
            const selected = t.id === type;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => chooseType(t.id)}
                className={cn(
                  "group flex flex-col items-start gap-2 rounded-lg border p-3 text-left transition-all",
                  selected
                    ? "border-blue bg-blue-tint shadow-card"
                    : "border-line bg-paper hover:border-ink-ghost hover:bg-paper-2",
                )}
              >
                <span
                  className={cn(
                    "grid h-8 w-8 place-items-center rounded-md transition-colors",
                    selected ? "bg-blue text-paper" : "bg-bone-2 text-ink-faint group-hover:text-ink",
                  )}
                >
                  <Icon className="h-4 w-4" />
                </span>
                <span className={cn("text-[13px] font-medium", selected ? "text-blue" : "text-ink")}>
                  {t.label}
                </span>
                <span className="text-[11px] leading-tight text-ink-faint">{t.hint}</span>
              </button>
            );
          })}
        </div>
      </PageSection>

      {/* form + whatsapp callout */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* THE FORM */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div>
              <CardKicker>New {active.label.toLowerCase()}</CardKicker>
              <CardTitle>{active.label}</CardTitle>
            </div>
            <SourceChip name="Manual capture" status="manual" />
          </CardHeader>

          {confirmed ? (
            <CardContent>
              <div className="flex items-start gap-3 rounded-md border border-sage/30 bg-sage-tint p-4">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sage text-paper">
                  <Check className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink">
                    Captured — {confirmed.label} added to {confirmed.project}.
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">
                    Recorded {shortDate(date)}
                    {citeMe ? ", cited to you" : ", uncredited"}. It is now a citable record the
                    assistant can use — marked unverified until a teammate promotes it.
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Badge tone="sage" size="sm" dot>
                      Captured
                    </Badge>
                    <Badge tone="ochre" size="sm">
                      Unverified
                    </Badge>
                    <SourceChip name={`Manual capture · ${shortDate(date)}`} />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <Button variant="primary" size="sm" onClick={reset}>
                      <PencilLine className="h-4 w-4" /> Capture another
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmed(null)}>
                      Review entry
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          ) : (
            <form onSubmit={submit}>
              <CardContent className="space-y-4">
                {/* project — common to all */}
                <Field label="Project" hint="canonical record">
                  <Select
                    value={projectId}
                    onValueChange={setProjectId}
                    options={projectOptions}
                    placeholder="Select a project…"
                    className="w-full"
                  />
                </Field>

                {/* DECISION */}
                {type === "decision" && (
                  <>
                    <Field label="Decision summary" hint="one line is enough">
                      <Textarea
                        value={note}
                        onChange={setNote}
                        placeholder="e.g. Client approved upgraded reception stone — cost impact pending"
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Decided by">
                        <Input
                          value={decidedBy}
                          onChange={(e) => setDecidedBy(e.target.value)}
                          placeholder="Name or client"
                        />
                      </Field>
                      <Field label="Channel">
                        <Select
                          value={channel}
                          onValueChange={setChannel}
                          options={channelOptions}
                          className="w-full"
                        />
                      </Field>
                    </div>
                  </>
                )}

                {/* APPROVAL UPDATE */}
                {type === "approval" && (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Authority">
                        <Select
                          value={authority}
                          onValueChange={setAuthority}
                          options={authorityOptions}
                          className="w-full"
                        />
                      </Field>
                      <Field label="New status">
                        <Select
                          value={approvalStatus}
                          onValueChange={setApprovalStatus}
                          options={approvalStatusOptions}
                          className="w-full"
                        />
                      </Field>
                    </div>
                    <Field label="What changed?" hint="ref no., query detail, next step">
                      <Textarea
                        value={note}
                        onChange={setNote}
                        placeholder="e.g. FSCD raised a query on refuge floor area; resubmit by 20 Jun"
                      />
                    </Field>
                  </>
                )}

                {/* SCOPE CHANGE */}
                {type === "scope" && (
                  <>
                    <Field label="Scope change / variation">
                      <Textarea
                        value={note}
                        onChange={setNote}
                        placeholder="e.g. Added two extra meeting pods on level 3 at client's request"
                      />
                    </Field>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Est. cost impact (BDT)" hint="optional">
                        <Input
                          value={costImpact}
                          inputMode="numeric"
                          onChange={(e) => setCostImpact(e.target.value)}
                          placeholder="140000"
                        />
                      </Field>
                      <Field label="Requested by">
                        <Input
                          value={decidedBy}
                          onChange={(e) => setDecidedBy(e.target.value)}
                          placeholder="Client / consultant"
                        />
                      </Field>
                    </div>
                  </>
                )}

                {/* QUICK TIMESHEET */}
                {type === "timesheet" && (
                  <>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <Field label="Team member">
                        <Select
                          value={employeeId}
                          onValueChange={setEmployeeId}
                          options={employeeOptions}
                          placeholder="Who logged time?"
                          className="w-full"
                        />
                      </Field>
                      <Field label="Hours" hint="this entry">
                        <Input
                          value={hours}
                          inputMode="decimal"
                          onChange={(e) => setHours(e.target.value)}
                          placeholder="6.5"
                        />
                      </Field>
                    </div>
                    <Field label="What was worked on?" hint="optional">
                      <Textarea
                        value={note}
                        rows={2}
                        onChange={setNote}
                        placeholder="e.g. Façade detailing + MEP coordination"
                      />
                    </Field>
                    <p className="text-[11px] text-ink-faint">
                      Coverage is 64% — every entry here lifts the confidence on capacity and
                      margin answers.
                    </p>
                  </>
                )}

                {/* SITE REPORT */}
                {type === "site" && (
                  <Field label="Site note" hint="what you saw on the ground">
                    <Textarea
                      value={note}
                      rows={4}
                      onChange={setNote}
                      placeholder="e.g. Slab pour level 4 complete; reinforcement for level 5 staged. Contractor flagged rebar shortage."
                    />
                  </Field>
                )}

                {/* PROMOTE WHATSAPP */}
                {type === "whatsapp" && (
                  <>
                    <div className="rounded-md border border-dashed border-line-strong bg-paper-2 p-3 text-[13px] text-ink-soft">
                      Paste a forwarded WhatsApp thread below. Space Esse extracts a{" "}
                      <span className="font-medium text-ink">draft Decision</span> — you confirm
                      before it becomes a record. Nothing is auto-published.
                    </div>
                    <Field label="Pasted thread">
                      <Textarea
                        value={paste}
                        rows={5}
                        mono
                        onChange={setPaste}
                        placeholder={"[10:42] Mr. Sohel: ok go ahead with the marble\n[10:43] You: noted, will confirm cost impact"}
                      />
                    </Field>
                    {paste.trim().length > 0 && (
                      <div className="rounded-md border border-blue/20 bg-blue-tint p-3">
                        <div className="label-draft mb-1 !text-blue">Extracted draft</div>
                        <p className="text-sm text-ink">
                          {paste.trim().split("\n").slice(-1)[0]?.slice(0, 120) ||
                            "Decision drafted from thread"}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <ConfidenceBadge level="low" />
                          <span className="text-[11px] text-ink-faint">Confirm to record</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* date — common */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Date">
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </Field>
                  <div className="flex items-end">
                    <label className="flex w-full items-center justify-between rounded-md border border-line bg-paper-2 px-3 py-2">
                      <span className="text-[13px] text-ink">Cite this to me</span>
                      <Switch checked={citeMe} onCheckedChange={setCiteMe} />
                    </label>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <span className="text-[11px] text-ink-faint">
                  Saved as an unverified record — promotable to a citable source.
                </span>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={reset}>
                    Clear
                  </Button>
                  <Button type="submit" variant="primary" size="sm" disabled={!ready}>
                    <Check className="h-4 w-4" /> Capture
                  </Button>
                </div>
              </CardFooter>
            </form>
          )}
        </Card>

        {/* WHATSAPP CALLOUT */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-sage-tint text-sage">
                  <MessageSquare className="h-4 w-4" />
                </span>
                <CardTitle>Why WhatsApp is paste-only</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-[13px] leading-relaxed text-ink-soft">
              <p>
                WhatsApp Business has no history API — there is no way to read past chats
                programmatically. So forwarding, pasting, or screenshotting a thread is the
                capture path.
              </p>
              <p className="text-ink">
                This is by design, not a limitation we hide. The most consequential decisions
                happen in chat; we make capturing them a one-tap habit instead of pretending an
                integration exists.
              </p>
              <div className="flex items-center gap-2 rounded-md border border-line bg-paper-2 px-3 py-2">
                <StatusDot status="manual" />
                <span className="text-[12px] text-ink-soft">
                  Treated as a first-class source, with provenance and confidence.
                </span>
              </div>
              <Button
                variant="subtle"
                size="sm"
                onClick={() => chooseType("whatsapp")}
                className="w-full"
              >
                <Zap className="h-4 w-4" /> Promote a WhatsApp thread
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Capture health</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ink-soft">Manual records this week</span>
                <span className="font-display text-base text-ink tnum">18</span>
              </div>
              <DataCompleteness value={64} />
              <p className="text-[11px] text-ink-faint">
                Coverage gates every confidence score. Lift it, and the assistant stops saying
                "insufficient data".
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* RECENT CAPTURES */}
      <PageSection
        className="mt-8"
        title="Recent captures"
        description="The live record stream — each entry carries who, when, the channel, and whether it has been verified."
      >
        <Card>
          {recent.length === 0 ? (
            <EmptyState
              icon={PencilLine}
              title="Nothing captured yet"
              description="Decisions, approvals and site notes you record will appear here as citable records."
            />
          ) : (
            <div className="divide-y divide-line">
              {recent.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{d.summary}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                      <span className="text-ink-soft">{d.decidedBy}</span>
                      <span>·</span>
                      <span>{shortDate(d.date)}</span>
                      <span className="text-ink-ghost">({relative(d.date)})</span>
                      <Badge tone={d.channel === "whatsapp" ? "sage" : "neutral"} size="sm">
                        {d.channel}
                      </Badge>
                      <SourceChip name={`${d.source.sourceName} · ${d.source.recordRef}`} />
                    </div>
                  </div>
                  {d.promoted ? (
                    <Badge tone="sage" size="sm" dot>
                      Verified
                    </Badge>
                  ) : (
                    <Badge tone="ochre" size="sm">
                      Unverified
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </PageSection>
    </Page>
  );
}
