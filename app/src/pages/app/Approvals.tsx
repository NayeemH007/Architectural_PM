import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2,
  RotateCcw,
  XCircle,
  Inbox,
  MessageSquare,
  ShieldCheck,
  ArrowRight,
  Send,
} from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/states";
import {
  ApprovalStatusBadge,
  SubmissionStatusBadge,
  phaseShort,
} from "@/components/archintel/badges";
import { AgentChip } from "@/components/archintel/agent";
import { useAiApprovals, useAiSubmissions } from "@/lib/archintel/api";
import { approver, memberById, projectById } from "@/lib/archintel/data";
import type {
  ApprovalStatusA,
  ApprovalType,
  ClientSubmission,
  DesignApproval,
} from "@/lib/archintel/data";
import { shortDate } from "@/lib/format";
import { AS_OF_DATE as TODAY } from "@/lib/clock";
import { cn } from "@/lib/cn";

// ---- local decision state laid over the mock approvals ----
type LocalDecision = {
  status: ApprovalStatusA;
  comment: string;
  date: string;
};

const TYPE_TONE: Record<ApprovalType, "blue" | "sage" | "ochre" | "sienna" | "neutral"> = {
  concept: "blue",
  design: "sage",
  material: "ochre",
  revision: "sienna",
  technical: "neutral",
};
const TYPE_LABEL: Record<ApprovalType, string> = {
  concept: "Concept",
  design: "Design",
  material: "Material",
  revision: "Revision",
  technical: "Technical",
};

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "revise", label: "Sent to revise" },
  { value: "rejected", label: "Rejected" },
];

export default function Approvals() {
  const { data: approvals = [], isLoading: loadingA } = useAiApprovals();
  const { data: subs = [], isLoading: loadingS } = useAiSubmissions();

  // local overrides keyed by approval id — demonstrates the review workflow
  const [decisions, setDecisions] = useState<Record<string, LocalDecision>>({});
  const [statusFilter, setStatusFilter] = useState("all");

  const resolved = useMemo(
    () =>
      approvals.map((a) => {
        const local = decisions[a.id];
        return local ? { ...a, status: local.status, decidedDate: local.date } : a;
      }),
    [approvals, decisions],
  );

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let revise = 0;
    for (const a of resolved) {
      if (a.status === "pending") pending++;
      else if (a.status === "approved") approved++;
      else if (a.status === "revise") revise++;
    }
    return { pending, approved, revise };
  }, [resolved]);

  const filtered = useMemo(
    () =>
      resolved.filter((a) => statusFilter === "all" || a.status === statusFilter),
    [resolved, statusFilter],
  );

  const decide = (a: DesignApproval, status: ApprovalStatusA, comment: string) => {
    setDecisions((prev) => ({
      ...prev,
      [a.id]: { status, comment: comment.trim(), date: TODAY },
    }));
  };

  return (
    <Page>
      <PageHeader
        kicker="Approval inbox"
        title="Approvals"
        description="Internal design & material sign-off and the client approval log. The studio flow runs Project Lead prepares → Fariha coordinates → Raiana approves → client receives → docs release."
      />

      {/* approver note */}
      <div className="mt-5 flex items-start gap-2.5 rounded-md border border-sienna/20 bg-sienna-tint/50 px-3.5 py-2.5">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-sienna" />
        <p className="text-[13px] leading-snug text-sienna">
          <span className="font-medium">{approver.name}</span> is the final approver for all
          design &amp; material decisions.
        </p>
        <AgentChip className="ml-auto shrink-0 self-center" label="ArchIntel assembles each package" />
      </div>

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loadingA ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-3 h-3 w-24" />
              <Skeleton className="h-7 w-12" />
            </Card>
          ))
        ) : (
          <>
            <KpiCard
              kicker="Pending review"
              value={counts.pending}
              footnote={
                <span className="text-xs text-ink-ghost">awaiting Raiana</span>
              }
            />
            <KpiCard
              kicker="Approved"
              value={counts.approved}
              footnote={<span className="text-xs text-ink-ghost">this cycle</span>}
            />
            <KpiCard
              kicker="Sent to revise"
              value={counts.revise}
              footnote={<span className="text-xs text-ink-ghost">back with lead</span>}
            />
          </>
        )}
      </div>

      {/* tabs */}
      <div className="mt-7">
        <Tabs defaultValue="design">
          <TabsList>
            <TabsTrigger value="design">Design &amp; Material</TabsTrigger>
            <TabsTrigger value="client">Client approvals</TabsTrigger>
          </TabsList>

          {/* ---------------- DESIGN & MATERIAL ---------------- */}
          <TabsContent value="design">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-ink-soft">
                Internal review queue — Raiana signs off before anything reaches the client.
              </p>
              <Select
                size="sm"
                value={statusFilter}
                onValueChange={setStatusFilter}
                options={STATUS_FILTERS}
                className="sm:w-44"
              />
            </div>

            {loadingA ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-5">
                    <Skeleton className="mb-3 h-4 w-56" />
                    <Skeleton className="mb-2 h-3 w-40" />
                    <Skeleton className="h-9 w-full" />
                  </Card>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Inbox}
                  title="Nothing in this view"
                  description="No approvals match the selected status. Clear the filter to see the full queue."
                  action={
                    <Button variant="outline" size="sm" onClick={() => setStatusFilter("all")}>
                      Show all
                    </Button>
                  }
                />
              </Card>
            ) : (
              <div className="space-y-4">
                {filtered.map((a) => (
                  <ApprovalCard
                    key={a.id}
                    approval={a}
                    localComment={decisions[a.id]?.comment}
                    onDecide={decide}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ---------------- CLIENT APPROVALS ---------------- */}
          <TabsContent value="client">
            <PageSection
              description="Every package sent to a client over WhatsApp or email, with the latest feedback and approval status."
            >
              {loadingS ? (
                <Card className="p-5">
                  <Skeleton className="mb-3 h-4 w-48" />
                  <Skeleton className="mb-2 h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </Card>
              ) : subs.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={Send}
                    title="No client submissions yet"
                    description="Packages shared with clients will be logged here."
                  />
                </Card>
              ) : (
                <ClientSubmissions subs={subs} />
              )}
            </PageSection>
          </TabsContent>
        </Tabs>
      </div>
    </Page>
  );
}

// ======================================================================
// Design / material approval card — interactive review actions
// ======================================================================
function ApprovalCard({
  approval,
  localComment,
  onDecide,
}: {
  approval: DesignApproval;
  localComment?: string;
  onDecide: (a: DesignApproval, status: ApprovalStatusA, comment: string) => void;
}) {
  const project = projectById(approval.projectId);
  const submitter = memberById(approval.submittedById);
  const [comment, setComment] = useState("");

  const lastComment = approval.comments[approval.comments.length - 1];
  const isPending = approval.status === "pending";
  const decidedLocally = localComment !== undefined;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-4">
        {/* header line */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={TYPE_TONE[approval.type]} size="sm">
                {TYPE_LABEL[approval.type]}
              </Badge>
              <span className="label-draft text-ink-ghost">
                {approval.version} · Phase {approval.phase} · {phaseShort(approval.phase)}
              </span>
            </div>
            <h3 className="mt-1.5 font-display text-[17px] leading-tight text-ink">
              {approval.title}
            </h3>
            {project && (
              <Link
                to={`/projects/${project.id}`}
                className="mt-0.5 inline-flex items-center gap-1 text-xs text-blue hover:underline"
              >
                {project.code} · {project.name}
                <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>
          <ApprovalStatusBadge status={approval.status} />
        </div>

        {/* people row */}
        <div className="mt-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-soft">
          <div className="flex items-center gap-1.5">
            <span className="label-draft text-ink-ghost">Submitted by</span>
            {submitter && (
              <span className="flex items-center gap-1.5">
                <Avatar name={submitter.name} tone={submitter.tone} size="xs" />
                <span className="text-ink">{submitter.name.split(" ")[0]}</span>
              </span>
            )}
            <span className="text-ink-ghost">· {shortDate(approval.submittedDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="label-draft text-ink-ghost">Reviewer</span>
            <span className="flex items-center gap-1.5">
              <Avatar name={approver.name} tone={approver.tone} size="xs" />
              <span className="text-ink">{approver.name.split(" ").slice(-1)[0]}</span>
            </span>
            <Badge tone="sienna" size="sm">
              Final approver
            </Badge>
          </div>
        </div>

        {/* latest comment */}
        {lastComment && (
          <div className="mt-3 flex items-start gap-2 rounded-md bg-paper-2 px-3 py-2">
            <MessageSquare className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-faint" />
            <p className="text-[13px] leading-snug text-ink-soft">
              <span className="font-medium text-ink">
                {memberById(lastComment.by)?.name.split(" ")[0] ?? lastComment.by}:
              </span>{" "}
              {lastComment.text}
              <span className="ml-1 text-ink-ghost">· {shortDate(lastComment.date)}</span>
            </p>
          </div>
        )}

        {/* interactive review block (pending only) */}
        {isPending && !decidedLocally && (
          <>
            <Separator className="my-4" />
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="Add a note for the lead (optional)…"
              className={cn(
                "w-full resize-none rounded-md border border-line bg-paper px-3 py-2 text-[13px] text-ink",
                "placeholder:text-ink-ghost focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue/30",
              )}
            />
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="gap-1.5 bg-sage text-paper hover:opacity-90"
                onClick={() => onDecide(approval, "approved", comment)}
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
              <Button
                variant="sienna"
                size="sm"
                className="gap-1.5"
                onClick={() => onDecide(approval, "revise", comment)}
              >
                <RotateCcw className="h-4 w-4" />
                Send to revise
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-rust hover:bg-rust/10 hover:text-rust"
                onClick={() => onDecide(approval, "rejected", comment)}
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </div>
          </>
        )}

        {/* inline success after a local decision */}
        {decidedLocally && (
          <>
            <Separator className="my-4" />
            <div
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2 text-[13px]",
                approval.status === "approved" && "border-sage/30 bg-sage/10 text-sage",
                approval.status === "revise" && "border-sienna/25 bg-sienna-tint/50 text-sienna",
                approval.status === "rejected" && "border-rust/25 bg-rust/10 text-rust",
              )}
            >
              {approval.status === "approved" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              ) : approval.status === "revise" ? (
                <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>
                {approval.status === "approved" && "Approved — ready to send to the client."}
                {approval.status === "revise" && "Sent back to the lead for revision."}
                {approval.status === "rejected" && "Rejected — logged for the lead."}
                {localComment ? (
                  <span className="block text-ink-soft">“{localComment}”</span>
                ) : null}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ======================================================================
// Client submissions — table on desktop, cards on mobile
// ======================================================================
function ClientSubmissions({ subs }: { subs: ClientSubmission[] }) {
  return (
    <>
      {/* desktop table */}
      <Card className="hidden md:block">
        <Table>
          <THead>
            <TR>
              <TH>Package</TH>
              <TH>Project</TH>
              <TH>Sent via</TH>
              <TH>Sent</TH>
              <TH>Feedback</TH>
              <TH>Status</TH>
            </TR>
          </THead>
          <TBody>
            {subs.map((s) => {
              const project = projectById(s.projectId);
              return (
                <TR key={s.id}>
                  <TD>
                    <div className="font-medium text-ink">{s.package}</div>
                    <div className="label-draft text-ink-ghost">{s.version}</div>
                  </TD>
                  <TD>
                    {project ? (
                      <Link
                        to={`/projects/${project.id}`}
                        className="text-blue hover:underline"
                      >
                        {project.name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </TD>
                  <TD>
                    <Badge tone={s.sentVia === "whatsapp" ? "sage" : "blue"} size="sm" dot>
                      {s.sentVia === "whatsapp" ? "WhatsApp" : "Email"}
                    </Badge>
                  </TD>
                  <TD className="whitespace-nowrap text-ink-soft tnum">
                    {shortDate(s.sentDate)}
                  </TD>
                  <TD className="max-w-[240px]">
                    <span className="text-ink-soft">{s.feedback ?? "—"}</span>
                  </TD>
                  <TD>
                    <SubmissionStatusBadge status={s.status} />
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>

      {/* mobile cards */}
      <div className="space-y-3 md:hidden">
        {subs.map((s) => {
          const project = projectById(s.projectId);
          return (
            <Card key={s.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium text-ink">{s.package}</div>
                    <div className="label-draft text-ink-ghost">
                      {s.version} · {shortDate(s.sentDate)}
                    </div>
                  </div>
                  <SubmissionStatusBadge status={s.status} />
                </div>
                {project && (
                  <Link
                    to={`/projects/${project.id}`}
                    className="mt-1 inline-block text-xs text-blue hover:underline"
                  >
                    {project.code} · {project.name}
                  </Link>
                )}
                <div className="mt-2.5 flex items-center gap-2">
                  <Badge tone={s.sentVia === "whatsapp" ? "sage" : "blue"} size="sm" dot>
                    {s.sentVia === "whatsapp" ? "WhatsApp" : "Email"}
                  </Badge>
                </div>
                {s.feedback && (
                  <p className="mt-2.5 text-[13px] leading-snug text-ink-soft">
                    “{s.feedback}”
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
