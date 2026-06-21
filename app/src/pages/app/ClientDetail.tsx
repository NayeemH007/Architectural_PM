import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  MessageCircle,
  Phone,
  Send,
  Users,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { Card, CardContent, CardFooter, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { KpiCard } from "@/components/kpi-card";
import { EmptyState } from "@/components/states";
import {
  HealthBadge,
  phaseName,
  phaseShort,
  PhaseBadge,
  SubmissionStatusBadge,
} from "@/components/archintel/badges";
import { useAiClients, projectProgress } from "@/lib/archintel/api";
import {
  activityA,
  clientById,
  memberById,
  paymentsByProject,
  projectsA,
  submissions,
} from "@/lib/archintel/data";
import { bdt, num, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ClientA, ProjectA } from "@/lib/archintel/data";

const TYPE_LABEL: Record<ClientA["type"], string> = {
  residential: "Residential",
  hospitality: "Hospitality",
  corporate: "Corporate",
  retail: "Retail",
  healthcare: "Healthcare",
};

const phaseStatusOf = (p: ProjectA) =>
  p.phases.find((ph) => ph.index === p.currentPhase)?.status ?? "not_started";

const progressTone = (health: ProjectA["health"]) =>
  health === "at_risk" ? "rust" : health === "watch" ? "ochre" : "blue";

/** Outstanding receivable across a project's milestones. */
function outstandingOf(p: ProjectA): number {
  return paymentsByProject(p.id).reduce((s, m) => s + (m.amount - m.receivedAmount), 0);
}

export default function ClientDetail() {
  const { id } = useParams();
  const { isLoading } = useAiClients();
  const client = id ? clientById(id) : undefined;

  if (isLoading) {
    return (
      <Page>
        <Skeleton className="h-5 w-24" />
        <Skeleton className="mt-4 h-9 w-72" />
        <Skeleton className="mt-3 h-5 w-full max-w-md" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-6 h-64 w-full" />
      </Page>
    );
  }

  if (!client) {
    return (
      <Page>
        <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Clients
        </Link>
        <EmptyState
          className="mt-8"
          icon={Users}
          title="Client not found"
          description="This client may have been removed or the link is incorrect."
          action={
            <Link to="/clients">
              <Button variant="outline" size="sm">Back to clients</Button>
            </Link>
          }
        />
      </Page>
    );
  }

  return <ClientView client={client} />;
}

function ClientView({ client }: { client: ClientA }) {
  // This client's projects (active first, then by code).
  const clientProjects = useMemo(
    () =>
      projectsA
        .filter((p) => p.clientId === client.id)
        .sort((a, b) => {
          const rank = (p: ProjectA) => (p.status === "active" ? 0 : 1);
          return rank(a) - rank(b) || a.code.localeCompare(b.code);
        }),
    [client.id],
  );
  const projectIds = useMemo(() => new Set(clientProjects.map((p) => p.id)), [clientProjects]);

  const activeCount = clientProjects.filter((p) => p.status === "active").length;
  const totalContract = clientProjects.reduce((s, p) => s + p.contractValue, 0);
  const outstanding = clientProjects.reduce((s, p) => s + outstandingOf(p), 0);

  // Client approvals = the WhatsApp submission log across all their projects.
  const clientSubs = useMemo(
    () =>
      submissions
        .filter((s) => projectIds.has(s.projectId))
        .sort((a, b) => b.sentDate.localeCompare(a.sentDate)),
    [projectIds],
  );

  const clientActivity = useMemo(
    () =>
      activityA
        .filter((a) => a.projectId && projectIds.has(a.projectId))
        .sort((a, b) => b.date.localeCompare(a.date)),
    [projectIds],
  );

  return (
    <Page>
      <Link to="/clients" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Clients
      </Link>

      <PageHeader
        className="mt-3"
        kicker={`${TYPE_LABEL[client.type]} client`}
        title={client.name}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-medium text-ink">{client.contactName}</span>
            <span className="text-ink-ghost">·</span>
            <a href={`tel:${client.phone}`} className="inline-flex items-center gap-1 hover:text-ink">
              <Phone className="h-3.5 w-3.5" /> {client.phone}
            </a>
            <span className="text-ink-ghost">·</span>
            <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1 hover:text-ink">
              <Mail className="h-3.5 w-3.5" /> {client.email}
            </a>
          </span>
        }
        actions={
          <Button variant="outline" size="md">
            <MessageCircle className="h-4 w-4 text-sage" /> {client.whatsappGroup}
          </Button>
        }
      />

      {/* KPI row */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <KpiCard
          kicker="Active projects"
          value={num(activeCount)}
          footnote={
            <span className="text-xs text-ink-ghost">
              {clientProjects.length} total with this client
            </span>
          }
        />
        <KpiCard
          kicker="Total contract value"
          value={bdt(totalContract, { compact: true })}
          footnote={<span className="text-xs text-ink-ghost">Across all their projects</span>}
        />
        <KpiCard
          kicker="Outstanding"
          value={bdt(outstanding, { compact: true })}
          footnote={
            <span className={cn("text-xs", outstanding > 0 ? "text-sienna" : "text-sage")}>
              {outstanding > 0 ? "Receivable from this client" : "Fully collected"}
            </span>
          }
        />
      </div>

      <Tabs defaultValue="projects" className="mt-8">
        <TabsList className="overflow-x-auto">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="approvals">Client approvals</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <ProjectsTab projects={clientProjects} />
        </TabsContent>
        <TabsContent value="approvals">
          <ApprovalsTab subs={clientSubs} client={client} />
        </TabsContent>
        <TabsContent value="activity">
          <ActivityTab activity={clientActivity} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

/* ---------------- PROJECTS ---------------- */
function ProjectsTab({ projects }: { projects: ProjectA[] }) {
  if (projects.length === 0) {
    return (
      <Card>
        <EmptyState icon={Users} title="No projects yet" description="Projects for this client will appear here." />
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {projects.map((p) => {
        const lead = memberById(p.leadId);
        const pct = projectProgress(p);
        const due = outstandingOf(p);
        return (
          <Link key={p.id} to={`/projects/${p.id}`} className="group block focus:outline-none">
            <Card className="flex h-full flex-col transition-shadow group-hover:shadow-lift group-focus-visible:ring-2 group-focus-visible:ring-blue/25">
              <CardContent className="flex flex-1 flex-col pb-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="label-draft">{p.code} · {TYPE_LABEL[p.type]}</div>
                    <h3 className="mt-1 truncate font-display text-[17px] leading-tight text-ink group-hover:text-blue">
                      {p.name}
                    </h3>
                  </div>
                  <HealthBadge health={p.health} />
                </div>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                      <span className="font-medium text-ink">Phase {p.currentPhase}</span>
                      <span className="text-ink-ghost">·</span>
                      <span>{phaseName(p.currentPhase)}</span>
                    </div>
                    <PhaseBadge status={phaseStatusOf(p)} />
                  </div>
                  <Progress value={pct} tone={progressTone(p.health)} />
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-ghost">
                    <span className="tnum">{pct}% complete</span>
                    <span className="tnum">{bdt(p.contractValue, { compact: true })}</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="mt-auto">
                <div className="flex min-w-0 items-center gap-2">
                  {lead && <Avatar name={lead.name} tone={lead.tone} size="sm" />}
                  <span className="truncate text-[11px] text-ink-faint">
                    {lead ? lead.name.split(" ")[0] : "—"}
                  </span>
                </div>
                {due > 0 ? (
                  <span className="whitespace-nowrap text-[11px] text-sienna tnum">
                    {bdt(due, { compact: true })} due
                  </span>
                ) : (
                  <Badge tone="sage" size="sm">Settled</Badge>
                )}
              </CardFooter>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

/* ---------------- CLIENT APPROVALS (WhatsApp log) ---------------- */
function ApprovalsTab({ subs, client }: { subs: typeof submissions; client: ClientA }) {
  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () => (filter === "all" ? subs : subs.filter((s) => s.status === filter)),
    [subs, filter],
  );

  const approvedCount = subs.filter((s) => s.status === "approved").length;
  const waitingCount = subs.filter((s) => s.status === "sent").length;

  if (subs.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={Send}
          title="Nothing shared yet"
          description="Packages sent to this client over WhatsApp or email will be logged here for approval tracking."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* context banner */}
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <MessageCircle className="mt-0.5 h-5 w-5 shrink-0 text-sage" />
            <div>
              <div className="text-sm font-medium text-ink">Client approval log</div>
              <div className="text-xs text-ink-faint">
                Packages sent to <span className="font-medium text-ink-soft">{client.whatsappGroup}</span> and the
                approval recorded back.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-center">
            <div>
              <div className="font-display text-xl text-sage tnum">{approvedCount}</div>
              <div className="label-draft !text-[10px]">Approved</div>
            </div>
            <div>
              <div className="font-display text-xl text-blue tnum">{waitingCount}</div>
              <div className="label-draft !text-[10px]">Awaiting</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardKicker>WhatsApp / Email</CardKicker>
            <CardTitle>Submissions</CardTitle>
          </div>
          <Select
            size="sm"
            value={filter}
            onValueChange={setFilter}
            options={[
              { value: "all", label: "All statuses" },
              { value: "sent", label: "Sent" },
              { value: "feedback", label: "Feedback received" },
              { value: "revision_requested", label: "Revision requested" },
              { value: "approved", label: "Approved" },
            ]}
          />
        </CardHeader>
        {filtered.length === 0 ? (
          <EmptyState title="No submissions match" description="Try a different status filter." />
        ) : (
          <Table>
            <THead>
              <TR>
                <TH>Package</TH>
                <TH>Project</TH>
                <TH>Ver</TH>
                <TH>Channel</TH>
                <TH>Sent</TH>
                <TH>Feedback</TH>
                <TH>Status</TH>
                <TH>Approved</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((s) => {
                const proj = projectsA.find((p) => p.id === s.projectId);
                return (
                  <TR key={s.id}>
                    <TD className="font-medium">{s.package}</TD>
                    <TD className="text-ink-soft">
                      {proj ? (
                        <Link to={`/projects/${proj.id}`} className="hover:text-blue hover:underline">
                          {proj.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD className="font-mono text-[11px] text-ink-ghost">{s.version}</TD>
                    <TD>
                      <Badge tone={s.sentVia === "whatsapp" ? "sage" : "neutral"} size="sm">
                        {s.sentVia}
                      </Badge>
                    </TD>
                    <TD className="text-ink-soft tnum">{shortDate(s.sentDate)}</TD>
                    <TD className="max-w-[200px] text-ink-soft">
                      {s.feedback ? <span className="italic">“{s.feedback}”</span> : <span className="text-ink-ghost">—</span>}
                    </TD>
                    <TD><SubmissionStatusBadge status={s.status} /></TD>
                    <TD className="text-ink-soft tnum">{s.approvedDate ? shortDate(s.approvedDate) : "—"}</TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ---------------- ACTIVITY ---------------- */
function ActivityTab({ activity }: { activity: typeof activityA }) {
  if (activity.length === 0) {
    return (
      <Card>
        <EmptyState title="No activity" description="Events across this client's projects will be logged here." />
      </Card>
    );
  }
  return (
    <Card>
      <div className="divide-y divide-line">
        {activity.map((a) => {
          const proj = a.projectId ? projectsA.find((p) => p.id === a.projectId) : undefined;
          return (
            <div key={a.id} className="flex items-start gap-3 px-5 py-3.5">
              <Avatar name={a.actor} tone="blue" size="sm" />
              <div className="min-w-0">
                <p className="text-sm text-ink">
                  <span className="font-medium">{a.actor}</span> {a.summary}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                  <Badge tone="neutral" size="sm">{a.type}</Badge>
                  {proj && (
                    <Link to={`/projects/${proj.id}`} className="hover:text-blue hover:underline">
                      {proj.code} · {phaseShort(proj.currentPhase)}
                    </Link>
                  )}
                  <span className="tnum">{shortDate(a.date.slice(0, 10))}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
