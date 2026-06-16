import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Landmark,
  PencilLine,
  Sparkles,
} from "lucide-react";
import { Page } from "@/components/page";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ApprovalBadge,
  DeliverableBadge,
  HealthBadge,
  MilestoneBadge,
  STAGE_LABELS,
  STAGE_ORDER,
  TYPE_LABELS,
} from "@/components/status";
import { ConfidenceBadge, DataCompleteness, ProvenancePopover } from "@/components/trust";
import { InsufficientData } from "@/components/states";
import { SourceChip, StatusDot } from "@/components/data-source";
import { bdt, daysFromNow, pct, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useProjectBundle } from "@/lib/api";
import { employeeById } from "@/lib/mock/data";
import type { ProjectStage } from "@/lib/types";

export default function ProjectDetail() {
  const { id } = useParams();
  const { data, isLoading } = useProjectBundle(id);

  if (isLoading || !data)
    return (
      <Page>
        <Skeleton className="h-8 w-64" />
        <div className="mt-6 grid grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </Page>
    );

  const p = data.project;
  if (!p)
    return (
      <Page>
        <p className="text-ink-soft">Project not found.</p>
      </Page>
    );

  const currentStageIdx = STAGE_ORDER.indexOf(p.stage as ProjectStage);
  const taxTotals = data.invoices.reduce(
    (acc, i) => ({
      gross: acc.gross + i.grossFee,
      vat: acc.vat + i.vat,
      vds: acc.vds + i.vdsWithheld,
      ait: acc.ait + i.aitWithheld,
      net: acc.net + i.netReceivable,
      received: acc.received + i.amountReceived,
    }),
    { gross: 0, vat: 0, vds: 0, ait: 0, net: 0, received: 0 },
  );

  return (
    <Page>
      <Link to="/portfolio" className="inline-flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> Portfolio
      </Link>

      {/* header */}
      <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="label-draft">{p.code}</div>
          <h1 className="mt-1 font-display text-[28px] leading-tight text-ink">{p.name}</h1>
          {p.nameBn && <div className="bn mt-0.5 text-base text-ink-soft">{p.nameBn}</div>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="blue">{TYPE_LABELS[p.type]}</Badge>
            <Badge tone="neutral">{STAGE_LABELS[p.stage]}</Badge>
            <HealthBadge band={p.health} size="sm" />
            <span className="text-sm text-ink-soft">· {p.client} · {p.city}</span>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="md">
            <PencilLine className="h-4 w-4" /> Capture
          </Button>
          <Button variant="outline" size="md">
            <FileText className="h-4 w-4" /> Weekly report
          </Button>
          <Button variant="primary" size="md">
            <Sparkles className="h-4 w-4" /> Ask about this project
          </Button>
        </div>
      </div>

      {/* phase stepper */}
      <Card className="mt-6 overflow-x-auto p-5">
        <div className="flex min-w-[640px] items-center">
          {STAGE_ORDER.map((s, i) => {
            const done = i < currentStageIdx;
            const active = i === currentStageIdx;
            return (
              <div key={s} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      "grid h-7 w-7 place-items-center rounded-full border text-[11px] font-medium",
                      done && "border-sage bg-sage text-paper",
                      active && "border-blue bg-blue text-paper",
                      !done && !active && "border-line-strong bg-paper text-ink-ghost",
                    )}
                  >
                    {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                  </div>
                  <span className={cn("whitespace-nowrap text-[11px]", active ? "font-medium text-ink" : "text-ink-faint")}>
                    {STAGE_LABELS[s]}
                  </span>
                </div>
                {i < STAGE_ORDER.length - 1 && (
                  <div className={cn("mx-2 h-px flex-1", done ? "bg-sage" : "bg-line-strong")} />
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* KPI strip */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="label-draft">Health score</span>
            <ProvenancePopover metric={p.healthScore} trigger={<button className="text-ink-ghost hover:text-blue">ⓘ</button>} />
          </div>
          <div className="mt-1 font-display text-3xl text-ink tnum">{p.healthScore.value ?? "—"}</div>
          <Progress value={p.healthScore.value ?? 0} tone={p.health === "critical" ? "rust" : p.health === "at_risk" ? "sienna" : p.health === "watch" ? "ochre" : "sage"} className="mt-2" />
          {p.healthScore.note && <p className="mt-2 text-[11px] text-ink-faint">{p.healthScore.note}</p>}
        </Card>
        <Card className="p-4">
          <span className="label-draft">Complete</span>
          <div className="mt-1 font-display text-3xl text-ink tnum">{p.pctComplete}%</div>
          <Progress value={p.pctComplete} tone="blue" className="mt-2" />
          <p className={cn("mt-2 text-[11px]", p.scheduleVarianceDays < 0 ? "text-sienna" : "text-sage")}>
            Schedule {p.scheduleVarianceDays > 0 ? "+" : ""}
            {p.scheduleVarianceDays}d vs plan
          </p>
        </Card>
        <Card className="p-4">
          <span className="label-draft">Forecast margin</span>
          {p.forecastMargin.value === null ? (
            <div className="mt-1 text-sm text-ink-faint">Insufficient data</div>
          ) : (
            <>
              <div className="mt-1 font-display text-3xl text-ink tnum">{pct(p.forecastMargin.value)}</div>
              <div className="mt-2">
                <ConfidenceBadge level={p.forecastMargin.confidence} />
              </div>
            </>
          )}
          <p className="mt-2 text-[11px] text-ink-faint">{p.forecastMargin.note ?? "Fee-based forecast."}</p>
        </Card>
        <Card className="p-4">
          <span className="label-draft">Collected / contract</span>
          <div className="mt-1 font-display text-2xl text-ink tnum">{bdt(p.feeCollected, { compact: true })}</div>
          <div className="text-xs text-ink-ghost tnum">of {bdt(p.feeContract, { compact: true })}</div>
          <Progress value={p.feeContract ? (p.feeCollected / p.feeContract) * 100 : 0} tone="sage" className="mt-2" />
        </Card>
      </div>

      {/* tabs */}
      <Tabs defaultValue="overview" className="mt-8">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="schedule">Schedule & Approvals</TabsTrigger>
          <TabsTrigger value="deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="financials">Financials</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="decisions">Decisions</TabsTrigger>
          <TabsTrigger value="risks">Risks</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div>
                  <CardKicker>Matched sources</CardKicker>
                  <CardTitle>Where this project's data comes from</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {p.crossRefs.map((x) => (
                  <div key={x.sourceId} className="flex items-center justify-between rounded-md border border-line bg-paper-2 px-3 py-2">
                    <div className="flex items-center gap-2.5">
                      <StatusDot status={x.matched ? "connected" : "manual"} />
                      <span className="text-sm font-medium text-ink">{x.sourceName}</span>
                      <span className="font-mono text-xs text-ink-faint">"{x.alias}"</span>
                    </div>
                    {x.matched ? (
                      <Badge tone="sage" size="sm">Matched</Badge>
                    ) : (
                      <Badge tone="ochre" size="sm">Needs match</Badge>
                    )}
                  </div>
                ))}
                <div className="flex items-center justify-between pt-1">
                  <DataCompleteness value={p.completeness} />
                  <span className="text-xs text-ink-faint">canonical id: {p.id}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent decisions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.decisions.slice(0, 4).map((d) => (
                  <div key={d.id} className="border-l-2 border-line pl-3">
                    <p className="text-sm text-ink">{d.summary}</p>
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-ink-faint">
                      <span>{d.decidedBy}</span>·<span>{shortDate(d.date)}</span>
                      <Badge tone={d.channel === "whatsapp" ? "sage" : "neutral"} size="sm">
                        {d.channel}
                      </Badge>
                    </div>
                  </div>
                ))}
                {data.decisions.length === 0 && <p className="text-sm text-ink-faint">No decisions captured yet.</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* SCHEDULE */}
        <TabsContent value="schedule">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Milestones</CardTitle>
              </CardHeader>
              <div className="divide-y divide-line border-t border-line">
                {data.milestones.map((m) => {
                  const d = daysFromNow(m.dueDate);
                  return (
                    <div key={m.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div>
                        <div className="text-sm text-ink">{m.name}</div>
                        <div className="text-xs text-ink-faint">
                          {shortDate(m.dueDate)}
                          {m.status !== "done" && d !== null && (
                            <span className={cn(d < 0 ? "text-rust" : "text-ink-ghost")}> · {d < 0 ? `${-d}d overdue` : `${d}d left`}</span>
                          )}
                        </div>
                      </div>
                      <MilestoneBadge status={m.status} />
                    </div>
                  );
                })}
                {data.milestones.length === 0 && <div className="px-5 py-6 text-sm text-ink-faint">No milestones.</div>}
              </div>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-ink-faint" />
                  <CardTitle>Authority approvals</CardTitle>
                </div>
              </CardHeader>
              <div className="divide-y divide-line border-t border-line">
                {data.approvals.map((a) => {
                  const overdue = a.statutoryDays !== null && a.daysInStage > a.statutoryDays && a.status !== "approved";
                  return (
                    <div key={a.id} className="px-5 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-ink">
                          {a.authority} · {a.title}
                        </span>
                        <ApprovalBadge status={a.status} />
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-ink-faint">
                        {a.submittedDate ? `Submitted ${shortDate(a.submittedDate)}` : "Not submitted"}
                        {overdue && <span className="font-medium text-rust">· {a.daysInStage}d / {a.statutoryDays}d statutory</span>}
                        {a.blocking && <Badge tone="rust" size="sm">Blocking</Badge>}
                      </div>
                      <div className="mt-1.5">
                        <SourceChip name={`${a.source.sourceName} · ${a.source.recordRef}`} />
                      </div>
                    </div>
                  );
                })}
                {data.approvals.length === 0 && <div className="px-5 py-6 text-sm text-ink-faint">No approvals tracked.</div>}
              </div>
            </Card>
          </div>
        </TabsContent>

        {/* DELIVERABLES */}
        <TabsContent value="deliverables">
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Deliverable</TH>
                  <TH>Discipline</TH>
                  <TH>Rev</TH>
                  <TH>Status</TH>
                  <TH>Due</TH>
                  <TH>Source</TH>
                </TR>
              </THead>
              <TBody>
                {data.deliverables.map((d) => (
                  <TR key={d.id}>
                    <TD className="font-medium">{d.name}</TD>
                    <TD className="text-ink-soft">{d.discipline}</TD>
                    <TD className="tnum">
                      {d.revision}
                      {d.revisionCount > 3 && <span className="ml-1 text-sienna" title="High revision count">⚠</span>}
                    </TD>
                    <TD>
                      <DeliverableBadge status={d.status} />
                    </TD>
                    <TD className="text-ink-soft">{shortDate(d.dueDate)}</TD>
                    <TD>
                      <SourceChip name={d.source} status={d.fileRef ? "connected" : "manual"} />
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        </TabsContent>

        {/* FINANCIALS */}
        <TabsContent value="financials">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle>Fee & cash</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5 text-sm">
                {[
                  ["Contract fee", bdt(p.feeContract)],
                  ["Billed", bdt(p.feeBilled)],
                  ["Collected (net)", bdt(p.feeCollected)],
                  ["Work-in-progress", bdt(p.feeWip)],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-ink-soft">{k}</span>
                    <span className="font-medium text-ink tnum">{v}</span>
                  </div>
                ))}
                <div className="mt-2 border-t border-line pt-3">
                  <div className="label-draft mb-2">Withholding (NBR)</div>
                  {[
                    ["Gross billed", bdt(taxTotals.gross)],
                    ["+ VAT 15%", bdt(taxTotals.vat)],
                    ["− VDS withheld", `-${bdt(taxTotals.vds)}`],
                    ["− AIT/TDS ~10%", `-${bdt(taxTotals.ait)}`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-0.5 text-[13px]">
                      <span className="text-ink-soft">{k}</span>
                      <span className="text-ink tnum">{v}</span>
                    </div>
                  ))}
                  <div className="mt-1 flex items-center justify-between border-t border-line pt-1.5 text-sm font-medium">
                    <span className="text-ink">Expected net cash</span>
                    <span className="text-ink tnum">{bdt(taxTotals.net)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Invoices</CardTitle>
              </CardHeader>
              <Table>
                <THead>
                  <TR>
                    <TH>Invoice</TH>
                    <TH>Issued</TH>
                    <TH className="text-right">Net receivable</TH>
                    <TH className="text-right">Received</TH>
                    <TH>Status</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.invoices.map((i) => (
                    <TR key={i.id}>
                      <TD className="font-mono text-xs">{i.number}</TD>
                      <TD className="text-ink-soft">{shortDate(i.issueDate)}</TD>
                      <TD className="text-right tnum">{bdt(i.netReceivable, { compact: true })}</TD>
                      <TD className="text-right tnum text-ink-soft">{bdt(i.amountReceived, { compact: true })}</TD>
                      <TD>
                        <Badge tone={i.status === "overdue" ? "rust" : i.status === "paid" ? "sage" : i.status === "part_paid" ? "ochre" : "neutral"} size="sm">
                          {i.status === "overdue" ? `${i.agingDays}d overdue` : i.status.replace("_", " ")}
                        </Badge>
                      </TD>
                    </TR>
                  ))}
                  {data.invoices.length === 0 && (
                    <TR>
                      <TD colSpan={5}>
                        <span className="text-sm text-ink-faint">No invoices for this project yet.</span>
                      </TD>
                    </TR>
                  )}
                </TBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        {/* TEAM */}
        <TabsContent value="team">
          <Card>
            <div className="divide-y divide-line">
              {p.teamIds.map((tid) => {
                const e = employeeById(tid);
                if (!e) return null;
                return (
                  <div key={tid} className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} tone={e.avatarTone} />
                      <div>
                        <div className="text-sm font-medium text-ink">{e.name}</div>
                        <div className="text-xs text-ink-faint">{e.title}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      {e.utilization.value === null ? (
                        <span className="text-xs text-ink-faint">No time logged</span>
                      ) : (
                        <>
                          <div className="font-display text-base text-ink tnum">{pct(e.utilization.value)}</div>
                          <div className="label-draft !text-[10px]">utilization</div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* DECISIONS */}
        <TabsContent value="decisions">
          <Card>
            <div className="divide-y divide-line">
              {data.decisions.map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm text-ink">{d.summary}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-ink-faint">
                      <span>{d.decidedBy}</span>·<span>{shortDate(d.date)}</span>
                      <Badge tone={d.channel === "whatsapp" ? "sage" : "neutral"} size="sm">{d.channel}</Badge>
                      <SourceChip name={`${d.source.sourceName} · ${d.source.recordRef}`} />
                    </div>
                  </div>
                  {d.promoted ? (
                    <Badge tone="sage" size="sm" dot>Verified</Badge>
                  ) : (
                    <Badge tone="ochre" size="sm">Unverified</Badge>
                  )}
                </div>
              ))}
              {data.decisions.length === 0 && (
                <div className="p-5">
                  <InsufficientData metric="Decision history" hint="nothing has been captured for this project yet." />
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* RISKS */}
        <TabsContent value="risks">
          <Card>
            <div className="divide-y divide-line">
              {data.risks.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="text-sm text-ink">{r.title}</p>
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-ink-faint">
                      <Badge tone="neutral" size="sm">{r.category}</Badge>
                      <span>Owner: {r.owner}</span>·<span>{shortDate(r.raisedDate)}</span>
                    </div>
                  </div>
                  <Badge
                    tone={r.likelihood === "high" && r.impact === "high" ? "rust" : r.impact === "high" ? "sienna" : "ochre"}
                    size="sm"
                  >
                    {r.likelihood}/{r.impact}
                  </Badge>
                </div>
              ))}
              {data.risks.length === 0 && <div className="px-5 py-6 text-sm text-ink-faint">No open risks.</div>}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </Page>
  );
}
