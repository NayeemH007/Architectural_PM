import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Mail, MessageSquare, Bell, Pencil, Send, ShieldCheck } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
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
import { Switch } from "@/components/ui/switch";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/states";
import { shortDate, relative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSchedules } from "@/lib/api";
import type { ScheduledReport } from "@/lib/mock/ops";
import type { AIReportKind } from "@/lib/types";

type Tone = "neutral" | "blue" | "sage" | "ochre" | "sienna" | "rust" | "ink";

const KIND_META: Record<AIReportKind, { label: string; tone: Tone }> = {
  daily_brief: { label: "Daily brief", tone: "blue" },
  weekly_project: { label: "Weekly project", tone: "sage" },
  monthly_company: { label: "Monthly company", tone: "ochre" },
  risk_summary: { label: "Risk summary", tone: "sienna" },
  cash_warning: { label: "Cash warning", tone: "rust" },
};

const CHANNEL_META: Record<
  ScheduledReport["channel"],
  { label: string; icon: typeof Mail }
> = {
  email: { label: "Email", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageSquare },
  in_app: { label: "In-app", icon: Bell },
};

const AVATAR_TONES = ["blue", "sienna", "sage", "ochre"];

export default function Schedules() {
  const { data, isLoading } = useSchedules();

  // Local interactive state: a copy of the active flags, keyed by id. We seed
  // from the query result and let the user flip them without writing back to
  // the mock data module.
  const [activeById, setActiveById] = useState<Record<string, boolean>>({});

  const rows: ScheduledReport[] = useMemo(
    () =>
      (data ?? []).map((r) => ({
        ...r,
        active: r.id in activeById ? activeById[r.id] : r.active,
      })),
    [data, activeById],
  );

  const toggleActive = (id: string, current: boolean) =>
    setActiveById((prev) => ({ ...prev, [id]: !current }));

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.active);
    const external = rows.filter((r) => r.audience === "external").length;
    const nextRun = active
      .map((r) => r.nextRun)
      .filter(Boolean)
      .sort()[0];
    return { activeCount: active.length, external, nextRun };
  }, [rows]);

  return (
    <Page>
      <PageHeader
        kicker="Intelligence"
        title="Scheduled reports"
        description="Which AI reports go to whom, and when. Owners and admins control cadence, recipients, and the channel each report is delivered through."
        actions={
          <Button variant="primary">
            <Plus className="h-4 w-4" /> New schedule
          </Button>
        }
      />

      {/* stat row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {isLoading ? (
          [0, 1, 2].map((i) => (
            <Card key={i} className="p-4">
              <Skeleton className="mb-2 h-3 w-24" />
              <Skeleton className="h-7 w-20" />
            </Card>
          ))
        ) : (
          <>
            <Stat label="Active schedules" value={stats.activeCount} tone="text-sage" />
            <Stat
              label="Next run"
              value={stats.nextRun ? relative(stats.nextRun) : "—"}
              tone="text-blue"
              small
            />
            <Stat
              label="Client-facing"
              value={stats.external}
              tone="text-sienna"
              hint="external recipients"
            />
          </>
        )}
      </div>

      {/* explainer */}
      <Card className="mt-4 flex items-start gap-3 border-blue/25 bg-blue-tint/40 p-4">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-blue" />
        <p className="text-sm text-ink-soft">
          <span className="font-medium text-ink">Generated from verified records.</span> Every report
          draws on connected, reconciled sources and cites them inline. Client-facing reports never
          send automatically — they pass through the{" "}
          <Link to="/review" className="font-medium text-blue underline-offset-2 hover:underline">
            Review queue
          </Link>{" "}
          for owner sign-off first.
        </p>
      </Card>

      {/* schedules table */}
      <PageSection
        className="mt-8"
        title="Delivery schedule"
        description="Toggle a report off to pause delivery without losing its configuration."
      >
        <Card>
          {isLoading ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={Send}
              title="No scheduled reports"
              description="Create a schedule to start delivering AI reports to your team or clients."
              action={
                <Button variant="subtle" size="sm">
                  <Plus className="h-4 w-4" /> New schedule
                </Button>
              }
            />
          ) : (
            <Table>
              <THead>
                <TR>
                  <TH>Report</TH>
                  <TH>Cadence</TH>
                  <TH>Recipients</TH>
                  <TH>Channel</TH>
                  <TH>Audience</TH>
                  <TH>Next run</TH>
                  <TH>Last run</TH>
                  <TH className="text-center">Active</TH>
                  <TH className="text-right">Edit</TH>
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <ScheduleRow
                    key={r.id}
                    report={r}
                    onToggle={() => toggleActive(r.id, r.active)}
                  />
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </PageSection>

      {/* footer note card */}
      <Card className="mt-8">
        <CardHeader>
          <div>
            <CardKicker>How delivery works</CardKicker>
            <CardTitle>Internal vs. client-facing</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-ink-soft">
          <p>
            <span className="font-medium text-ink">Internal reports</span> publish on schedule to your
            own team — daily briefs, weekly project rollups, the monthly company review, and risk or
            cash warnings.
          </p>
          <p>
            <span className="font-medium text-ink">Client-facing reports</span> are held until an owner
            approves the narrative. This keeps a human in the loop before anything leaves the firm.
          </p>
        </CardContent>
        <CardFooter>
          <span className="text-xs text-ink-faint">
            Every figure is traceable to a source record.
          </span>
          <Link
            to="/review"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-soft transition-colors hover:bg-bone-2 hover:text-ink"
          >
            Open review queue
          </Link>
        </CardFooter>
      </Card>
    </Page>
  );
}

function Stat({
  label,
  value,
  tone,
  hint,
  small,
}: {
  label: string;
  value: string | number;
  tone: string;
  hint?: string;
  small?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="label-draft">{label}</div>
      <div className={cn("mt-1 font-display tnum", small ? "text-xl" : "text-2xl", tone)}>
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>}
    </Card>
  );
}

function ScheduleRow({
  report,
  onToggle,
}: {
  report: ScheduledReport;
  onToggle: () => void;
}) {
  const kind = KIND_META[report.kind];
  const channel = CHANNEL_META[report.channel];
  const ChannelIcon = channel.icon;
  const external = report.audience === "external";

  return (
    <TR className={cn(!report.active && "opacity-60")}>
      {/* report name + kind */}
      <TD>
        <div className="flex flex-col gap-1">
          <span className="font-medium text-ink">{report.name}</span>
          <div className="flex items-center gap-1.5">
            <Badge tone={kind.tone} size="sm">
              {kind.label}
            </Badge>
            {external && (
              <Badge tone="sienna" size="sm" dot>
                Needs approval
              </Badge>
            )}
          </div>
        </div>
      </TD>

      {/* cadence */}
      <TD>
        <div className="text-ink">{report.schedule}</div>
        <div className="text-xs capitalize text-ink-faint">{report.cadence}</div>
      </TD>

      {/* recipients */}
      <TD>
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1.5">
            {report.recipients.slice(0, 3).map((rec, i) => (
              <Avatar
                key={rec.name}
                name={rec.name}
                tone={AVATAR_TONES[i % AVATAR_TONES.length]}
                size="xs"
                className="ring-2 ring-paper"
              />
            ))}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] text-ink">
              {report.recipients.map((r) => r.name).join(", ")}
            </div>
            <div className="truncate text-xs text-ink-faint">
              {report.recipients.map((r) => r.role).join(" · ")}
            </div>
          </div>
        </div>
      </TD>

      {/* channel */}
      <TD>
        <Badge tone="neutral" size="sm">
          <ChannelIcon className="h-3 w-3" />
          {channel.label}
        </Badge>
      </TD>

      {/* audience */}
      <TD>
        {external ? (
          <Link to="/review">
            <Badge tone="sienna" size="sm">
              Client-facing
            </Badge>
          </Link>
        ) : (
          <Badge tone="neutral" size="sm">
            Internal
          </Badge>
        )}
      </TD>

      {/* next run */}
      <TD>
        {report.active ? (
          <div>
            <div className="text-[13px] text-ink">{shortDate(report.nextRun)}</div>
            <div className="text-xs text-ink-faint">{relative(report.nextRun)}</div>
          </div>
        ) : (
          <span className="text-xs text-ink-faint">Paused</span>
        )}
      </TD>

      {/* last run */}
      <TD>
        <span className="text-[13px] text-ink-soft">
          {report.lastRun ? shortDate(report.lastRun) : "Never"}
        </span>
      </TD>

      {/* active toggle */}
      <TD className="text-center">
        <div className="flex justify-center">
          <Switch
            checked={report.active}
            onCheckedChange={onToggle}
            aria-label={`Toggle ${report.name}`}
          />
        </div>
      </TD>

      {/* edit */}
      <TD className="text-right">
        <Button variant="ghost" size="iconSm" aria-label={`Edit ${report.name}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </TD>
    </TR>
  );
}
