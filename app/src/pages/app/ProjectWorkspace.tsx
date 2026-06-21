import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  FileText,
  Lock,
  MessageCircle,
  Plus,
  Send,
  Upload,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/states";
import {
  ApprovalStatusBadge,
  DecisionBadge,
  FileStatusBadge,
  HealthBadge,
  PaymentStatusBadge,
  PhaseBadge,
  phaseName,
  phaseShort,
  ProjectStatusBadge,
  StorageChip,
  SubmissionStatusBadge,
} from "@/components/archintel/badges";
import { useAiProject, projectProgress, PHASE_TEMPLATE } from "@/lib/archintel/api";
import {
  approvalsByProject,
  clientById,
  decisionsByProject,
  filesByProject,
  memberById,
  paymentsByProject,
  submissionsByProject,
  activityA,
} from "@/lib/archintel/data";
import { bdt, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ProjectA, ProjectPhase } from "@/lib/archintel/data";

export default function ProjectWorkspace() {
  const { id } = useParams();
  const { data: project, isLoading } = useAiProject(id);

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="h-7 w-28" />
        <Skeleton className="mt-4 h-9 w-80" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64 w-full" />
      </Page>
    );
  }

  if (!project) {
    return (
      <Page>
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Projects
        </Link>
        <EmptyState
          className="mt-8"
          icon={FileText}
          title="Project not found"
          description="This project may have been archived or the link is incorrect."
          action={
            <Link to="/projects">
              <Button variant="outline" size="sm">Back to projects</Button>
            </Link>
          }
        />
      </Page>
    );
  }

  return <Workspace project={project} />;
}

function Workspace({ project: p }: { project: ProjectA }) {
  const client = clientById(p.clientId);
  const lead = memberById(p.leadId);
  const team = p.teamIds.map((tid) => memberById(tid)).filter(Boolean) as NonNullable<ReturnType<typeof memberById>>[];
  const overall = projectProgress(p);

  const files = filesByProject(p.id);
  const approvals = approvalsByProject(p.id);
  const submissions = submissionsByProject(p.id);
  const paymentsList = paymentsByProject(p.id);
  const decisions = decisionsByProject(p.id);
  const activity = useMemo(
    () => activityA.filter((a) => a.projectId === p.id).sort((a, b) => b.date.localeCompare(a.date)),
    [p.id],
  );

  return (
    <Page>
      <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Projects
      </Link>

      <PageHeader
        className="mt-3"
        kicker={`${p.code} · ${phaseName(p.currentPhase)}`}
        title={p.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink">{client?.name ?? "—"}</span>
            <span className="text-ink-ghost">·</span>
            <span>{p.address}</span>
          </span>
        }
        actions={
          <a href={p.whatsappLink} target="_blank" rel="noreferrer">
            <Button variant="outline" size="md">
              <MessageCircle className="h-4 w-4 text-sage" /> WhatsApp group
            </Button>
          </a>
        }
      />

      {/* status row */}
      <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <ProjectStatusBadge status={p.status} />
          <HealthBadge health={p.health} />
          <Badge tone="neutral" size="sm">{p.type}</Badge>
          <span className="text-xs text-ink-faint tnum">
            {shortDate(p.startDate)} → {shortDate(p.targetDate)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {lead && (
            <div className="flex items-center gap-2">
              <Avatar name={lead.name} tone={lead.tone} size="sm" />
              <div className="leading-tight">
                <div className="text-sm font-medium text-ink">{lead.name.split(" ")[0]}</div>
                <div className="label-draft !text-[10px]">Lead</div>
              </div>
            </div>
          )}
          {team.length > 0 && <AvatarStack names={team.map((m) => m.name)} tones={team.map((m) => m.tone)} />}
        </div>
      </div>

      {/* overall progress */}
      <div className="mt-4 flex items-center gap-3">
        <Progress value={overall} tone="blue" className="flex-1" />
        <span className="text-sm font-medium text-ink tnum">{overall}%</span>
      </div>

      {/* blocker banner */}
      {p.blocker && (
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-rust/25 bg-rust-tint px-4 py-3">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-rust" />
          <div>
            <div className="label-draft !text-rust">Blocker</div>
            <p className="mt-0.5 text-sm text-ink">{p.blocker}</p>
          </div>
        </div>
      )}

      <Tabs defaultValue="overview" className="mt-7">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="approvals">Approvals</TabsTrigger>
          <TabsTrigger value="client">Client</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab p={p} client={client} lead={lead} decisions={decisions} />
        </TabsContent>
        <TabsContent value="phases">
          <PhasesTab p={p} />
        </TabsContent>
        <TabsContent value="files">
          <FilesTab files={files} />
        </TabsContent>
        <TabsContent value="approvals">
          <ApprovalsTab approvals={approvals} />
        </TabsContent>
        <TabsContent value="client">
          <ClientTab p={p} submissions={submissions} />
        </TabsContent>
        <TabsContent value="payments">
          <PaymentsTab payments={paymentsList} plan={p.paymentPlan} contract={p.contractValue} />
        </TabsContent>
        <TabsContent value="decisions">
          <DecisionsTab decisions={decisions} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab activity={activity} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

/* ---------------- OVERVIEW ---------------- */
function OverviewTab({
  p,
  client,
  lead,
  decisions,
}: {
  p: ProjectA;
  client: ReturnType<typeof clientById>;
  lead: ReturnType<typeof memberById>;
  decisions: ReturnType<typeof decisionsByProject>;
}) {
  const facts: [string, string][] = [
    ["Client", client?.name ?? "—"],
    ["Contact", client?.contactName ?? "—"],
    ["Lead", lead?.name ?? "—"],
    ["Contract value", bdt(p.contractValue, { compact: true })],
    ["Payment plan", p.paymentPlan === "phased" ? "Phased (per milestone)" : "Upfront"],
    ["Target handover", shortDate(p.targetDate)],
  ];
  const next = nextActions(p);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div>
            <CardKicker>Workflow</CardKicker>
            <CardTitle>4-phase delivery</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="flex min-w-[620px] items-center">
            {PHASE_TEMPLATE.map((tpl, i) => {
              const ph = p.phases[i];
              const done = ph.status === "complete";
              const active = ph.status === "in_progress" || ph.status === "blocked";
              const blocked = ph.status === "blocked";
              return (
                <div key={tpl.key} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center gap-1.5 text-center">
                    <div
                      className={cn(
                        "grid h-8 w-8 place-items-center rounded-full border text-xs font-medium",
                        done && "border-sage bg-sage text-paper",
                        active && !blocked && "border-blue bg-blue text-paper",
                        blocked && "border-rust bg-rust text-paper",
                        !done && !active && "border-line-strong bg-paper text-ink-ghost",
                      )}
                    >
                      {done ? <CheckCircle2 className="h-4 w-4" /> : tpl.index}
                    </div>
                    <span className={cn("max-w-[120px] text-[11px] leading-tight", active ? "font-medium text-ink" : "text-ink-faint")}>
                      {tpl.name}
                    </span>
                  </div>
                  {i < PHASE_TEMPLATE.length - 1 && (
                    <div className={cn("mx-2 h-px flex-1", done ? "bg-sage" : "bg-line-strong")} />
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Key facts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {facts.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-ink-soft">{k}</span>
                <span className="text-right font-medium text-ink tnum">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Next actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {next.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <Circle className="mt-1 h-3 w-3 shrink-0 text-blue" />
                <span className="text-sm text-ink">{a}</span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent decisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {decisions.length === 0 && <p className="text-sm text-ink-faint">No decisions logged yet.</p>}
            {decisions.slice(0, 4).map((d) => (
              <div key={d.id} className="border-l-2 border-line pl-3">
                <div className="mb-1">
                  <DecisionBadge type={d.type} />
                </div>
                <p className="text-sm text-ink">{d.summary}</p>
                <div className="mt-1 text-[11px] text-ink-faint">
                  {d.by} · {shortDate(d.date)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function nextActions(p: ProjectA): string[] {
  const out: string[] = [];
  if (p.blocker) out.push(p.blocker);
  const ph = p.phases[p.currentPhase - 1];
  const tpl = PHASE_TEMPLATE[p.currentPhase - 1];
  if (ph && tpl) {
    const firstOpen = tpl.checklist.findIndex((_, i) => !ph.done[i]);
    if (firstOpen >= 0) out.push(`${tpl.name}: ${tpl.checklist[firstOpen].label}`);
    const gateIdx = tpl.checklist.findIndex((c) => c.gate);
    if (gateIdx >= 0 && !ph.done[gateIdx]) out.push(`Gate pending: ${tpl.checklist[gateIdx].label}`);
  }
  if (out.length === 0) out.push("Phase on track — continue with the checklist.");
  return out.slice(0, 4);
}

/* ---------------- PHASES ---------------- */
function PhasesTab({ p }: { p: ProjectA }) {
  // seed local checkbox state from project.phases[i].done
  const [state, setState] = useState<boolean[][]>(() => p.phases.map((ph) => [...ph.done]));

  const toggle = (pi: number, ci: number) =>
    setState((prev) => prev.map((row, i) => (i === pi ? row.map((v, j) => (j === ci ? !v : v)) : row)));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {PHASE_TEMPLATE.map((tpl, pi) => {
        const ph: ProjectPhase = p.phases[pi];
        const gateIdx = tpl.checklist.findIndex((c) => c.gate);
        const gateChecked = gateIdx >= 0 ? state[pi][gateIdx] : true;
        const ownerLabel = tpl.ownerRole.replace("_", " ");
        return (
          <Card key={tpl.key}>
            <CardHeader>
              <div>
                <CardKicker>Phase {tpl.index} · owner: {ownerLabel}</CardKicker>
                <CardTitle>{tpl.name}</CardTitle>
              </div>
              <PhaseBadge status={ph.status} />
            </CardHeader>
            <CardContent className="space-y-3">
              {/* gate-rule callout */}
              <div className="flex items-start gap-2 rounded-md border border-ochre/25 bg-ochre-tint px-3 py-2">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ochre" />
                <div>
                  <div className="label-draft !text-ochre">Gate rule</div>
                  <p className="mt-0.5 text-[13px] text-ink">{tpl.gateRule}</p>
                </div>
              </div>

              {/* checklist */}
              <ul className="space-y-1">
                {tpl.checklist.map((item, ci) => {
                  const checked = state[pi][ci];
                  return (
                    <li key={ci}>
                      <label className="flex cursor-pointer items-start gap-2.5 rounded px-1 py-1 hover:bg-paper-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(pi, ci)}
                          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-blue"
                        />
                        <span className={cn("text-sm", checked ? "text-ink-faint line-through" : "text-ink")}>
                          {item.label}
                        </span>
                        {item.gate && <Badge tone="ochre" size="sm">Gate</Badge>}
                      </label>
                    </li>
                  );
                })}
              </ul>

              <Button variant="primary" size="sm" disabled={!gateChecked} className="w-full">
                <ArrowRight className="h-4 w-4" />
                {gateChecked ? "Advance to next phase" : "Clear the gate to advance"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- FILES ---------------- */
function FilesTab({ files }: { files: ReturnType<typeof filesByProject> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>File register</CardTitle>
        <UploadDialog />
      </CardHeader>
      {files.length === 0 ? (
        <EmptyState icon={FileText} title="No files yet" description="Drawings, renders and BOQs will appear here." />
      ) : (
        <Table>
          <THead>
            <TR>
              <TH>File</TH>
              <TH>Kind</TH>
              <TH>Ver</TH>
              <TH>Owner</TH>
              <TH>Storage</TH>
              <TH>Status</TH>
              <TH>Uploaded</TH>
            </TR>
          </THead>
          <TBody>
            {files.map((f) => {
              const owner = memberById(f.ownerId);
              return (
                <TR key={f.id}>
                  <TD className="font-medium">
                    {f.name} <span className="ml-1 font-mono text-[11px] text-ink-ghost">.{f.ext.toLowerCase()}</span>
                  </TD>
                  <TD className="text-ink-soft">{f.kind.replace("_", " ")}</TD>
                  <TD className="tnum">{f.version}</TD>
                  <TD className="text-ink-soft">{owner?.name.split(" ")[0] ?? "—"}</TD>
                  <TD><StorageChip storage={f.storage} /></TD>
                  <TD><FileStatusBadge status={f.status} /></TD>
                  <TD className="text-ink-soft tnum">{shortDate(f.uploadedDate)}</TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

function UploadDialog() {
  const [done, setDone] = useState(false);
  return (
    <Dialog onOpenChange={(o) => !o && setDone(false)}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Upload className="h-4 w-4" /> Upload file</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload file</DialogTitle>
          <DialogDescription>Register a drawing, render or BOQ to this project.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4">
          <div className="grid place-items-center rounded-md border border-dashed border-line-strong bg-paper-2 px-6 py-8 text-center text-sm text-ink-faint">
            <Upload className="mb-2 h-5 w-5 text-ink-ghost" />
            Drag a file here or browse
          </div>
          {done && (
            <p className="rounded-md border border-sage/25 bg-sage-tint px-3 py-2 text-sm text-sage">
              File registered to ArchIntel (prototype — not persisted).
            </p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Cancel</Button>
            </DialogClose>
            <Button variant="primary" size="sm" onClick={() => setDone(true)}>Upload</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- APPROVALS ---------------- */
function ApprovalsTab({ approvals }: { approvals: ReturnType<typeof approvalsByProject> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">
          Design & material approvals — <span className="font-medium text-ink">Raiana</span> is the final approver.
        </p>
        <SimpleDialog
          trigger={<Button variant="outline" size="sm"><Send className="h-4 w-4" /> Submit for approval</Button>}
          title="Submit for approval"
          description="Route a concept, design or material decision to Raiana for final sign-off."
          confirmLabel="Submit to Raiana"
          successText="Submitted — pending Raiana's review (prototype)."
        />
      </div>
      {approvals.length === 0 ? (
        <Card><EmptyState title="No approvals" description="Submit a concept, design or material for review." /></Card>
      ) : (
        approvals.map((a) => {
          const submitter = memberById(a.submittedById);
          return (
            <Card key={a.id}>
              <CardHeader>
                <div className="min-w-0">
                  <CardKicker>{a.type} · {a.version} · {phaseShort(a.phase)}</CardKicker>
                  <CardTitle>{a.title}</CardTitle>
                </div>
                <ApprovalStatusBadge status={a.status} />
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-faint">
                  <span>Submitted by {submitter?.name ?? "—"}</span>
                  <span className="text-ink-ghost">·</span>
                  <span>{shortDate(a.submittedDate)}</span>
                  <span className="text-ink-ghost">·</span>
                  <span>Reviewer: Raiana</span>
                </div>
                {a.comments.length > 0 && (
                  <div className="space-y-2 border-l-2 border-line pl-3">
                    {a.comments.map((c, i) => (
                      <div key={i}>
                        <p className="text-sm text-ink">{c.text}</p>
                        <div className="text-[11px] text-ink-faint">
                          {memberById(c.by)?.name.split(" ")[0] ?? c.by} · {shortDate(c.date)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}

/* ---------------- CLIENT ---------------- */
function ClientTab({ p, submissions }: { p: ProjectA; submissions: ReturnType<typeof submissionsByProject> }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <MessageCircle className="h-5 w-5 text-sage" />
            <div>
              <div className="text-sm font-medium text-ink">Client WhatsApp group</div>
              <div className="text-xs text-ink-faint">Submissions & approvals are recorded here.</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href={p.whatsappLink} target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm"><MessageCircle className="h-4 w-4 text-sage" /> Open group</Button>
            </a>
            <SimpleDialog
              trigger={<Button variant="primary" size="sm"><Send className="h-4 w-4" /> Share to WhatsApp</Button>}
              title="Share to WhatsApp"
              description="Send the latest package to the client group and log it below."
              confirmLabel="Share package"
              successText="Shared to the client group and logged (prototype)."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Submission log</CardTitle>
        </CardHeader>
        {submissions.length === 0 ? (
          <EmptyState title="Nothing shared yet" description="Packages sent to the client will appear here." />
        ) : (
          <div className="divide-y divide-line border-t border-line">
            {submissions.map((s) => (
              <div key={s.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-ink">{s.package}</span>
                    <span className="font-mono text-[11px] text-ink-ghost">{s.version}</span>
                    <Badge tone={s.sentVia === "whatsapp" ? "sage" : "neutral"} size="sm">{s.sentVia}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-faint">
                    Sent {shortDate(s.sentDate)}
                    {s.feedback && <span className="text-ink-soft"> · “{s.feedback}”</span>}
                  </div>
                </div>
                <SubmissionStatusBadge status={s.status} />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ---------------- PAYMENTS ---------------- */
function PaymentsTab({
  payments,
  plan,
  contract,
}: {
  payments: ReturnType<typeof paymentsByProject>;
  plan: ProjectA["paymentPlan"];
  contract: number;
}) {
  const billable = payments.reduce((s, m) => s + m.amount, 0);
  const received = payments.reduce((s, m) => s + m.receivedAmount, 0);
  const outstanding = billable - received;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardKicker>Plan: {plan} · Contract {bdt(contract, { compact: true })}</CardKicker>
          <CardTitle>Payment milestones</CardTitle>
        </div>
      </CardHeader>
      {payments.length === 0 ? (
        <EmptyState title="No milestones" description="Payment milestones will appear here." />
      ) : (
        <>
          <Table>
            <THead>
              <TR>
                <TH>Milestone</TH>
                <TH>Phase</TH>
                <TH>Type</TH>
                <TH className="text-right">Amount</TH>
                <TH>Due</TH>
                <TH className="text-right">Received</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {payments.map((m) => (
                <TR key={m.id}>
                  <TD className="font-medium">{m.label}</TD>
                  <TD className="text-ink-soft">{m.linkedPhase ? phaseShort(m.linkedPhase) : "—"}</TD>
                  <TD className="text-ink-soft">{m.type}</TD>
                  <TD className="text-right tnum">{bdt(m.amount, { compact: true })}</TD>
                  <TD className="text-ink-soft tnum">{shortDate(m.dueDate)}</TD>
                  <TD className="text-right tnum">{m.receivedAmount ? bdt(m.receivedAmount, { compact: true }) : "—"}</TD>
                  <TD><PaymentStatusBadge status={m.status} /></TD>
                </TR>
              ))}
            </TBody>
          </Table>
          <div className="grid grid-cols-3 divide-x divide-line border-t border-line">
            {[
              ["Billable", bdt(billable, { compact: true }), "text-ink"],
              ["Received", bdt(received, { compact: true }), "text-sage"],
              ["Outstanding", bdt(outstanding, { compact: true }), outstanding > 0 ? "text-sienna" : "text-ink"],
            ].map(([label, val, cls]) => (
              <div key={label} className="px-5 py-3.5">
                <div className="label-draft">{label}</div>
                <div className={cn("mt-1 font-display text-xl tnum", cls)}>{val}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

/* ---------------- DECISIONS ---------------- */
function DecisionsTab({ decisions }: { decisions: ReturnType<typeof decisionsByProject> }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-soft">Freezes, locks and change requests on the record.</p>
        <SimpleDialog
          trigger={<Button variant="outline" size="sm"><Plus className="h-4 w-4" /> Log decision</Button>}
          title="Log a decision"
          description="Record a layout freeze, material lock, change request or general decision."
          confirmLabel="Log decision"
          successText="Decision logged to the project record (prototype)."
        />
      </div>
      {decisions.length === 0 ? (
        <Card><EmptyState title="No decisions yet" description="Freezes and change requests will appear here." /></Card>
      ) : (
        <Card>
          <div className="divide-y divide-line">
            {decisions.map((d) => (
              <div key={d.id} className="flex items-start gap-3 px-5 py-4">
                <div className="mt-0.5"><DecisionBadge type={d.type} /></div>
                <div className="min-w-0">
                  <p className="text-sm text-ink">{d.summary}</p>
                  <div className="mt-1 text-[11px] text-ink-faint">
                    {d.by} · {shortDate(d.date)} · {phaseShort(d.phase)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

/* ---------------- ACTIVITY ---------------- */
function ActivityTab({ activity }: { activity: typeof activityA }) {
  if (activity.length === 0) {
    return <Card><EmptyState title="No activity" description="Project events will be logged here." /></Card>;
  }
  return (
    <Card>
      <div className="divide-y divide-line">
        {activity.map((a) => (
          <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
            <Avatar name={a.actor} tone="blue" size="sm" />
            <div className="min-w-0">
              <p className="text-sm text-ink">
                <span className="font-medium">{a.actor}</span> {a.summary}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-[11px] text-ink-faint">
                <Badge tone="neutral" size="sm">{a.type}</Badge>
                <span>{shortDate(a.date.slice(0, 10))}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------------- shared visual action dialog ---------------- */
function SimpleDialog({
  trigger,
  title,
  description,
  confirmLabel,
  successText,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  successText: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <Dialog onOpenChange={(o) => !o && setDone(false)}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4">
          {done ? (
            <p className="flex items-center gap-2 rounded-md border border-sage/25 bg-sage-tint px-3 py-2 text-sm text-sage">
              <CheckCircle2 className="h-4 w-4" /> {successText}
            </p>
          ) : (
            <p className="text-sm text-ink-soft">This is a prototype action — it updates local state only and is not persisted.</p>
          )}
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="ghost" size="sm">Close</Button>
            </DialogClose>
            <Button variant="primary" size="sm" onClick={() => setDone(true)} disabled={done}>
              {confirmLabel}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
