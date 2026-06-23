import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Clock, Send, ShieldCheck, Workflow, Zap } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { AgentChip, AiosKpiStrip } from "@/components/archintel/agent";
import { cn } from "@/lib/cn";
import { relative } from "@/lib/format";
import { auditSummary, useAgentActions, useAiosKpis, useTaskAudit } from "@/lib/archintel/aios";
import type { AgentAction, AuditTask, TaskStatus } from "@/lib/archintel/aios";
import { projectById } from "@/lib/archintel/data";

const STATUS: Record<TaskStatus, { label: string; tone: any }> = {
  automated: { label: "Automated", tone: "sage" },
  assisted: { label: "AI drafts → you approve", tone: "blue" },
  manual: { label: "Manual", tone: "neutral" },
};

export default function Automation() {
  const { data: auditData } = useTaskAudit();
  const { data: kpis = [] } = useAiosKpis();
  const { data: actionData } = useAgentActions();

  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [actions, setActions] = useState<AgentAction[]>([]);
  useEffect(() => { if (auditData) setTasks(auditData); }, [auditData]);
  useEffect(() => { if (actionData) setActions(actionData); }, [actionData]);

  const summary = useMemo(() => auditSummary(tasks), [tasks]);
  const liveKpis = useMemo(
    () => kpis.map((k) => (k.key === "automated" ? { ...k, value: summary.pct, sub: `${summary.automated} of ${summary.total} recurring tasks · ~${summary.hrsSaved} hrs/wk saved` } : k)),
    [kpis, summary],
  );

  const automate = (id: string) => setTasks((t) => t.map((x) => (x.id === id ? { ...x, status: "automated" } : x)));
  const resolveAction = (id: string) => setActions((a) => a.map((x) => (x.id === id ? { ...x, status: "done" } : x)));

  const handled = actions.filter((a) => a.status === "done");
  const waiting = actions.filter((a) => a.status === "needs_approval");

  if (!auditData) {
    return (
      <Page>
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 grid grid-cols-3 gap-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader
        kicker="AIOS · Automation layer"
        title="Automation"
        description="Every recurring coordination task, audited and handed to ArchIntel — one at a time. The studio keeps the design decisions; the operating layer runs the busywork."
        actions={<Button variant="outline"><Workflow className="h-4 w-4" /> Run task audit</Button>}
      />

      <Card className="mt-5 flex items-start gap-3 border-blue/20 bg-blue-ghost p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue" />
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">Preview of the operating layer.</span> Real sending, drafting and
          capturing run on the backend; here ArchIntel's actions are simulated over your live project data. Anything
          that touches a client or a design decision always waits for a human — <span className="font-medium text-ink">propose → approve → execute.</span>
        </p>
      </Card>

      <div className="mt-6">
        <AiosKpiStrip kpis={liveKpis} />
      </div>

      {/* what AI did + what needs you */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div>
              <CardKicker>Overnight</CardKicker>
              <CardTitle>What ArchIntel handled</CardTitle>
            </div>
            <Badge tone="sage" size="sm" dot>{handled.length} done</Badge>
          </CardHeader>
          <div className="divide-y divide-line border-t border-line">
            {handled.map((a) => (
              <div key={a.id} className="flex gap-3 px-5 py-3">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-sage-tint text-sage"><Check className="h-3.5 w-3.5" /></span>
                <div className="min-w-0">
                  <div className="text-sm text-ink">{a.summary}</div>
                  <div className="mt-0.5 text-xs text-ink-soft">{a.detail}</div>
                  <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-ghost">
                    <span>{relative(a.at)}</span>
                    {a.projectId && <Link to={`/projects/${a.projectId}`} className="font-medium text-blue hover:underline">{projectById(a.projectId)?.name}</Link>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardKicker>Assisted · propose → approve</CardKicker>
              <CardTitle>Waiting on you</CardTitle>
            </div>
            <Badge tone="ochre" size="sm" dot>{waiting.length}</Badge>
          </CardHeader>
          <div className="divide-y divide-line border-t border-line">
            {waiting.length === 0 && <div className="px-5 py-8 text-center text-sm text-ink-faint">All clear — nothing waiting on you.</div>}
            {waiting.map((a) => (
              <div key={a.id} className="px-5 py-3.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium text-ink">{a.summary}</div>
                  <AgentChip variant="pending" />
                </div>
                <div className="mt-0.5 text-xs text-ink-soft">{a.detail}</div>
                <div className="mt-2 flex items-center gap-2">
                  <Button variant="primary" size="sm" onClick={() => resolveAction(a.id)}><Send className="h-3.5 w-3.5" /> Approve</Button>
                  <Button variant="ghost" size="sm">Review</Button>
                  {a.projectId && <Link to={`/projects/${a.projectId}`} className="ml-auto text-[11px] font-medium text-blue hover:underline">{projectById(a.projectId)?.name} →</Link>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* the task audit */}
      <PageSection
        className="mt-8"
        title="Task Audit"
        description={`${summary.automated} automated · ${summary.assisted} assisted · ${summary.manual} still manual — ~${summary.hrsSaved} hrs/week recovered.`}
      >
        <Card>
          <Table>
            <THead>
              <TR>
                <TH>Recurring task</TH>
                <TH>Owner</TH>
                <TH>Cadence</TH>
                <TH className="text-right">Time/wk</TH>
                <TH>Human gate</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {tasks.map((t) => (
                <TR key={t.id}>
                  <TD>
                    <div className="font-medium text-ink">{t.title}</div>
                    <div className="mt-0.5 max-w-md text-xs text-ink-faint">{t.behavior}</div>
                  </TD>
                  <TD className="whitespace-nowrap text-ink-soft">{t.owner}</TD>
                  <TD className="whitespace-nowrap text-ink-soft">{t.cadence}</TD>
                  <TD className="text-right tnum text-ink-soft">{t.minPerWeek}m</TD>
                  <TD>{t.humanGate ? <Badge tone="ochre" size="sm">Human approves</Badge> : <span className="text-xs text-ink-ghost">—</span>}</TD>
                  <TD>
                    {t.status === "manual" ? (
                      <Button variant="subtle" size="sm" onClick={() => automate(t.id)}><Zap className="h-3.5 w-3.5" /> Automate</Button>
                    ) : (
                      <Badge tone={STATUS[t.status].tone} size="sm" dot={t.status === "automated"}>
                        {t.status === "assisted" && <Clock className="mr-0.5 h-3 w-3" />}
                        {STATUS[t.status].label}
                      </Badge>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
        <p className="mt-3 text-xs text-ink-ghost">
          Scored by frequency × time × automatability. Human-gated tasks (client-facing or design decisions) stay
          assisted — ArchIntel drafts, a person approves. Real execution arrives with the backend.
        </p>
      </PageSection>
    </Page>
  );
}
