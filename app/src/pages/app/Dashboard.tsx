import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Radar,
  ClipboardCheck,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Sparkles,
} from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton, SkeletonCard } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/states";
import {
  PhaseBadge,
  HealthBadge,
  ApprovalStatusBadge,
  phaseShort,
} from "@/components/archintel/badges";
import {
  useAiOverview,
  useAiProjects,
  useAiApprovals,
  useAiPayments,
  useAiRisks,
  projectProgress,
  memberWorkload,
} from "@/lib/archintel/api";
import {
  clientById,
  memberById,
  approver,
  TODAY,
} from "@/lib/archintel/data";
import type { ProjectA } from "@/lib/archintel/data";
import { bdt, shortDate, daysFromNow } from "@/lib/format";
import { cn } from "@/lib/cn";
import { AiosKpiStrip } from "@/components/archintel/agent";
import { useDailyBrief, useAiosKpis } from "@/lib/archintel/aios";

const BRIEF_DOT: Record<string, string> = { rust: "bg-rust", ochre: "bg-ochre", blue: "bg-blue", sage: "bg-sage" };

// severity dot colour for the Risk Radar
const SEV_DOT: Record<string, string> = {
  critical: "bg-rust",
  high: "bg-sienna",
  medium: "bg-ochre",
  low: "bg-sage",
};
const SEV_TONE: Record<string, "rust" | "sienna" | "ochre" | "sage"> = {
  critical: "rust",
  high: "sienna",
  medium: "ochre",
  low: "sage",
};

// current in-progress phase index for a project (falls back to currentPhase)
function currentPhaseStatus(p: ProjectA) {
  const ph = p.phases.find((x) => x.index === p.currentPhase);
  return ph?.status ?? "not_started";
}

export default function Dashboard() {
  const { data: overview, isLoading: loadingOverview } = useAiOverview();
  const { data: projects, isLoading: loadingProjects } = useAiProjects();
  const { data: approvals, isLoading: loadingApprovals } = useAiApprovals();
  const { data: payments, isLoading: loadingPayments } = useAiPayments();
  const { data: risks, isLoading: loadingRisks } = useAiRisks();
  const { data: brief } = useDailyBrief();
  const { data: aiosK = [] } = useAiosKpis();

  // local interactive state: clearing an item off "today" without persistence
  const [cleared, setCleared] = useState<Record<string, boolean>>({});
  const clear = (id: string) => setCleared((s) => ({ ...s, [id]: true }));

  const today = new Date(TODAY);
  const greetingHour = today.getHours();
  const greeting =
    greetingHour < 12 ? "Good morning" : greetingHour < 17 ? "Good afternoon" : "Good evening";

  const activeProjects = useMemo(
    () => (projects ?? []).filter((p) => p.status === "active"),
    [projects],
  );

  const pendingApprovals = useMemo(
    () => (approvals ?? []).filter((a) => a.status === "pending" && !cleared[a.id]),
    [approvals, cleared],
  );

  const overduePayments = useMemo(
    () => (payments ?? []).filter((p) => p.status === "overdue" && !cleared[p.id]),
    [payments, cleared],
  );

  const topRisks = useMemo(() => {
    const order = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return [...(risks ?? [])]
      .sort(
        (a, b) =>
          order[a.severity] - order[b.severity] || b.likelihood - a.likelihood,
      )
      .slice(0, 3);
  }, [risks]);

  const workload = useMemo(() => {
    const rows = memberWorkload().filter((w) => w.led + w.assigned > 0);
    const max = Math.max(1, ...rows.map((w) => w.assigned));
    return { rows, max };
  }, []);

  const attentionCount = pendingApprovals.length + overduePayments.length;

  return (
    <Page>
      <PageHeader
        kicker={`SPACE ESSE · Project control · ${shortDate(TODAY)}`}
        title={`${greeting}, Fariha`}
        description="Your studio at a glance — what needs a decision today, what ArchIntel has flagged, and where every active project stands."
        actions={
          <Link
            to="/intelligence"
            className="inline-flex h-8 items-center gap-2 rounded-md border border-line-strong bg-paper px-3 text-[13px] font-medium text-ink transition-all hover:border-ink-ghost hover:bg-paper-2"
          >
            <Radar className="h-4 w-4" />
            Risk Radar
          </Link>
        }
      />

      {/* ---- AI Daily Brief (AIOS) ---- */}
      {brief && (
        <Card className="mt-6 border-blue/25 bg-blue-ghost">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-blue text-paper">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="label-draft !text-blue">AI Daily Brief · {shortDate(TODAY)}</span>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink">{brief.summary}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {brief.needsYou.map((n) => (
                  <Link
                    key={n.id}
                    to={n.projectId ? `/projects/${n.projectId}` : "/approvals"}
                    className="flex items-start gap-2 rounded-md border border-line bg-paper px-3 py-2 transition-colors hover:border-blue/40"
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", BRIEF_DOT[n.tone])} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-ink">{n.text}</div>
                      <div className="text-xs text-ink-soft">{n.meta}</div>
                    </div>
                  </Link>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
                <Link to="/automation" className="inline-flex items-center gap-1 text-sm font-medium text-blue hover:underline">
                  {brief.handled.length} tasks handled overnight <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <span className="text-xs text-ink-ghost">· propose → approve → execute</span>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ---- AIOS KPIs ---- */}
      {aiosK.length > 0 && (
        <div className="mt-5">
          <AiosKpiStrip kpis={aiosK} />
        </div>
      )}

      {/* ---- KPI row ---- */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {loadingOverview || !overview ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <KpiCard
              kicker="Active projects"
              value={overview.activeCount}
              footnote={
                <span className="text-xs text-ink-ghost">
                  {bdt(overview.totalContract, { compact: true })} contracted
                </span>
              }
            />
            <KpiCard
              kicker="Pending approvals"
              value={overview.pendingApprovals}
              footnote={
                <Link to="/approvals" className="text-xs text-blue hover:underline">
                  Raiana's queue
                </Link>
              }
            />
            <KpiCard
              kicker="Overdue payments"
              value={overview.overdueCount}
              footnote={
                <span className="text-xs text-rust tnum">
                  {bdt(overview.overdueAmount, { compact: true })} outstanding
                </span>
              }
            />
            <KpiCard
              kicker="Blocked projects"
              value={overview.blockedCount}
              footnote={
                <span className="text-xs text-ink-ghost">
                  {overview.collectionRate}% collected
                </span>
              }
            />
          </>
        )}
      </div>

      {/* ---- Risk Radar ---- */}
      <Card className="mt-6 border-blue/25 bg-blue-ghost/40">
        <CardHeader>
          <div>
            <CardKicker className="!text-blue">Risk Radar — flagged now</CardKicker>
            <CardTitle className="flex items-center gap-2">
              <Radar className="h-[18px] w-[18px] text-blue" />
              What ArchIntel thinks is most likely to go wrong
            </CardTitle>
          </div>
          <Link
            to="/intelligence"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-blue hover:underline sm:inline-flex"
          >
            Open Risk Radar <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {loadingRisks ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              {topRisks.map((r) => {
                const proj = r.projectId
                  ? (projects ?? []).find((p) => p.id === r.projectId)
                  : null;
                return (
                  <div
                    key={r.id}
                    className="flex flex-col rounded-md border border-line bg-paper p-3.5 shadow-card"
                  >
                    <div className="flex items-start gap-2">
                      <span
                        className={cn(
                          "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
                          SEV_DOT[r.severity],
                        )}
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Badge tone={SEV_TONE[r.severity]} size="sm">
                            {r.severity}
                          </Badge>
                          <span className="label-draft !text-ink-faint truncate">
                            {r.stage}
                          </span>
                        </div>
                        <p className="mt-1.5 text-sm font-medium leading-snug text-ink">
                          {r.title}
                        </p>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-soft">
                      {r.recommendedAction}
                    </p>
                    <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
                      <span className="text-xs text-ink-ghost tnum">
                        {r.likelihood}% likely
                      </span>
                      {proj ? (
                        <Link
                          to={`/projects/${proj.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue hover:underline"
                        >
                          Open project <ArrowRight className="h-3 w-3" />
                        </Link>
                      ) : (
                        <span className="text-xs text-ink-faint">Studio-wide</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- Two columns ---- */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* LEFT — Needs attention today */}
        <PageSection
          title="Needs attention today"
          description={`${attentionCount} item${attentionCount === 1 ? "" : "s"} waiting on a decision`}
        >
          <Card>
            <CardContent className="pt-4">
              {/* Pending approvals */}
              <div className="mb-1.5 flex items-center gap-2">
                <ClipboardCheck className="h-4 w-4 text-ochre" />
                <span className="label-draft">Approvals awaiting Raiana</span>
                <Badge tone="ochre" size="sm">
                  {pendingApprovals.length}
                </Badge>
              </div>

              {loadingApprovals ? (
                <Skeleton className="h-20 w-full" />
              ) : pendingApprovals.length === 0 ? (
                <div className="flex items-center gap-2 py-3 text-sm text-ink-soft">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  Queue is clear — nothing waiting on approval.
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {pendingApprovals.map((a) => {
                    const proj = (projects ?? []).find((p) => p.id === a.projectId);
                    const by = memberById(a.submittedById);
                    return (
                      <li key={a.id} className="flex items-start gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <ApprovalStatusBadge status={a.status} />
                            <span className="label-draft !text-ink-faint">
                              {a.type} · {a.version}
                            </span>
                          </div>
                          <p className="mt-1 text-sm font-medium leading-snug text-ink">
                            {a.title}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {proj ? (
                              <Link
                                to={`/projects/${proj.id}`}
                                className="text-blue hover:underline"
                              >
                                {proj.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                            {" · "}
                            from {by?.name ?? "—"} → {approver.name.split(" ").slice(-1)[0]}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-xs text-ink-ghost">
                            {shortDate(a.submittedDate)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => clear(a.id)}
                          >
                            Dismiss
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              <Separator className="my-3" />

              {/* Overdue payments */}
              <div className="mb-1.5 flex items-center gap-2">
                <Wallet className="h-4 w-4 text-rust" />
                <span className="label-draft">Overdue payments</span>
                <Badge tone="rust" size="sm">
                  {overduePayments.length}
                </Badge>
              </div>

              {loadingPayments ? (
                <Skeleton className="h-16 w-full" />
              ) : overduePayments.length === 0 ? (
                <div className="flex items-center gap-2 py-3 text-sm text-ink-soft">
                  <CheckCircle2 className="h-4 w-4 text-sage" />
                  No overdue milestones right now.
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {overduePayments.map((pay) => {
                    const proj = (projects ?? []).find((p) => p.id === pay.projectId);
                    const overdueBy = daysFromNow(pay.dueDate);
                    const outstanding = pay.amount - pay.receivedAmount;
                    return (
                      <li key={pay.id} className="flex items-start gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <Badge tone="rust" size="sm" dot>
                              {overdueBy !== null ? `${Math.abs(overdueBy)}d overdue` : "overdue"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm font-medium leading-snug text-ink">
                            {pay.label}
                          </p>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {proj ? (
                              <Link
                                to={`/projects/${proj.id}`}
                                className="text-blue hover:underline"
                              >
                                {proj.name}
                              </Link>
                            ) : (
                              "—"
                            )}
                            {" · due "}
                            {shortDate(pay.dueDate)}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-sm font-medium text-rust tnum">
                            {bdt(outstanding, { compact: true })}
                          </span>
                          <Link
                            to="/finance"
                            className="text-xs text-blue hover:underline"
                          >
                            Open finance
                          </Link>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </PageSection>

        {/* RIGHT — Projects mini list */}
        <PageSection
          title="Projects"
          description={`${activeProjects.length} active`}
          actions={
            <Link
              to="/projects"
              className="inline-flex items-center gap-1 text-sm font-medium text-blue hover:underline"
            >
              All projects <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <Card>
            <CardContent className="p-0">
              {loadingProjects ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full" />
                  ))}
                </div>
              ) : activeProjects.length === 0 ? (
                <EmptyState
                  title="No active projects"
                  description="Every project is archived or on hold."
                />
              ) : (
                <ul className="divide-y divide-line">
                  {activeProjects.map((p) => {
                    const client = clientById(p.clientId);
                    const lead = memberById(p.leadId);
                    const progress = projectProgress(p);
                    const status = currentPhaseStatus(p);
                    return (
                      <li key={p.id} className="px-4 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <Link
                                to={`/projects/${p.id}`}
                                className="truncate font-medium text-ink hover:text-blue hover:underline"
                              >
                                {p.name}
                              </Link>
                              <span className="label-draft !text-ink-faint">{p.code}</span>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-ink-soft">
                              {client?.name ?? "—"}
                            </p>
                          </div>
                          {lead && (
                            <Avatar name={lead.name} tone={lead.tone} size="sm" />
                          )}
                        </div>

                        <div className="mt-2.5 flex items-center gap-2">
                          <PhaseBadge status={status} />
                          <span className="label-draft !text-ink-faint">
                            {phaseShort(p.currentPhase)}
                          </span>
                          <HealthBadge health={p.health} />
                          <span className="ml-auto text-xs text-ink-ghost tnum">
                            {progress}%
                          </span>
                        </div>

                        <Progress
                          value={progress}
                          tone={
                            p.health === "at_risk"
                              ? "rust"
                              : p.health === "watch"
                                ? "ochre"
                                : "blue"
                          }
                          className="mt-2"
                        />

                        {p.blocker && (
                          <div className="mt-2 flex items-start gap-1.5 rounded-md border border-rust/20 bg-rust-tint/50 px-2.5 py-1.5">
                            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rust" />
                            <span className="text-xs leading-snug text-rust">{p.blocker}</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </PageSection>
      </div>

      {/* ---- Team workload ---- */}
      <PageSection
        className="mt-6"
        title="Team workload"
        description="Active projects led and assigned, per member"
        actions={
          <Link
            to="/intelligence"
            className="inline-flex items-center gap-1 text-sm font-medium text-blue hover:underline"
          >
            Capacity & risk <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        <Card>
          <CardContent className="pt-5">
            {loadingProjects ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <div className="space-y-3.5">
                {workload.rows.map(({ member, led, assigned }) => (
                  <div key={member.id} className="flex items-center gap-3">
                    <div className="flex w-44 shrink-0 items-center gap-2">
                      <Avatar name={member.name} tone={member.tone} size="xs" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {member.name.split(" ")[0]}{" "}
                          {member.name.split(" ").slice(-1)[0]}
                        </p>
                        <p className="label-draft !text-ink-faint truncate">
                          {member.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="h-6 w-full overflow-hidden rounded-md bg-bone-2">
                        <div
                          className="flex h-full items-center justify-end rounded-md bg-blue/85 px-2 transition-all duration-500"
                          style={{
                            width: `${Math.max((assigned / workload.max) * 100, assigned ? 12 : 0)}%`,
                          }}
                        >
                          {assigned > 0 && (
                            <span className="text-[11px] font-medium text-paper tnum">
                              {assigned}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex w-28 shrink-0 items-center justify-end gap-1.5">
                      {led > 0 ? (
                        <Badge tone="sienna" size="sm" dot>
                          leads {led}
                        </Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-ink-faint">
                          <Clock className="h-3 w-3" /> support
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageSection>
    </Page>
  );
}
