import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isSameDay,
  parseISO,
  addMonths,
  subMonths,
  differenceInCalendarDays,
} from "date-fns";
import { Page, PageHeader, PageSection } from "@/components/page";
import { Card, CardHeader, CardKicker, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusDot } from "@/components/data-source";
import { EmptyState } from "@/components/states";
import { compactDate, daysFromNow } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useMilestones, useApprovals, useMeetings } from "@/lib/api";
import { projectById } from "@/lib/mock/data";
import type { Meeting } from "@/lib/mock/ops";
import type { Milestone, Approval } from "@/lib/types";

// Anchor "today" — never call new Date() with no args for the current date.
const TODAY = new Date("2026-06-17");
const DEFAULT_MONTH = new Date("2026-06-01");

type EventKind = "milestone" | "approval" | "meeting";

interface CalEvent {
  date: Date;
  title: string;
  kind: EventKind;
  projectId: string | null;
  color: string;
}

// Kind → palette token. Milestones = architect's blue, approvals = burnt
// sienna, meetings = sage. Used for chips, dots and the legend.
const KIND_META: Record<
  EventKind,
  { label: string; dotClass: string; chipClass: string; tone: "blue" | "sienna" | "sage" }
> = {
  milestone: {
    label: "Milestone",
    dotClass: "bg-blue",
    chipClass: "border-blue/20 bg-blue-tint text-blue",
    tone: "blue",
  },
  approval: {
    label: "Approval",
    dotClass: "bg-sienna",
    chipClass: "border-sienna/25 bg-sienna-tint text-sienna",
    tone: "sienna",
  },
  meeting: {
    label: "Meeting",
    dotClass: "bg-sage",
    chipClass: "border-sage/25 bg-sage-tint text-sage",
    tone: "sage",
  },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MAX_CHIPS = 3;
const AGENDA_WINDOW_DAYS = 14;

function projectName(projectId: string | null): string | null {
  if (!projectId) return null;
  return projectById(projectId)?.name ?? null;
}

/** Merge milestones, non-null approvals and meetings into one event list. */
function buildEvents(
  milestones: Milestone[],
  approvals: Approval[],
  meetings: Meeting[],
): CalEvent[] {
  const out: CalEvent[] = [];

  for (const m of milestones) {
    out.push({
      date: parseISO(m.dueDate),
      title: m.name,
      kind: "milestone",
      projectId: m.projectId,
      color: KIND_META.milestone.dotClass,
    });
  }

  for (const a of approvals) {
    if (!a.expectedDate) continue; // only plot approvals with an expected date
    out.push({
      date: parseISO(a.expectedDate),
      title: `${a.authority} · ${a.title}`,
      kind: "approval",
      projectId: a.projectId,
      color: KIND_META.approval.dotClass,
    });
  }

  for (const mt of meetings) {
    out.push({
      date: parseISO(mt.date),
      title: mt.title,
      kind: "meeting",
      projectId: mt.projectId,
      color: KIND_META.meeting.dotClass,
    });
  }

  return out;
}

export default function Calendar() {
  const milestones = useMilestones();
  const approvals = useApprovals();
  const meetings = useMeetings();

  const [visibleMonth, setVisibleMonth] = useState<Date>(DEFAULT_MONTH);

  const isLoading = milestones.isLoading || approvals.isLoading || meetings.isLoading;

  const events = useMemo(
    () => buildEvents(milestones.data ?? [], approvals.data ?? [], meetings.data ?? []),
    [milestones.data, approvals.data, meetings.data],
  );

  // Map every visible day (yyyy-MM-dd) → its events, sorted within the day.
  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of events) {
      const key = format(ev.date, "yyyy-MM-dd");
      const bucket = map.get(key);
      if (bucket) bucket.push(ev);
      else map.set(key, [ev]);
    }
    for (const bucket of map.values()) {
      bucket.sort((a, b) => a.date.getTime() - b.date.getTime());
    }
    return map;
  }, [events]);

  // Six-week grid covering the visible month, Sunday → Saturday.
  const gridDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(visibleMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(visibleMonth), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [visibleMonth]);

  // Agenda: events from today through the next 14 days, ascending.
  const agenda = useMemo(() => {
    return events
      .filter((ev) => {
        const delta = differenceInCalendarDays(ev.date, TODAY);
        return delta >= 0 && delta <= AGENDA_WINDOW_DAYS;
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events]);

  return (
    <Page>
      <PageHeader
        kicker="Projects"
        title="Calendar"
        description="Milestones, authority-approval deadlines and meetings across every project — in one view."
      />

      <PageSection className="mt-7">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* MONTH GRID */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div>
                <CardKicker>Month</CardKicker>
                <CardTitle>{format(visibleMonth, "MMMM yyyy")}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="iconSm"
                  aria-label="Previous month"
                  onClick={() => setVisibleMonth((m) => subMonths(m, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVisibleMonth(DEFAULT_MONTH)}
                  className="text-xs"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="iconSm"
                  aria-label="Next month"
                  onClick={() => setVisibleMonth((m) => addMonths(m, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {isLoading ? (
                <div className="grid grid-cols-7 gap-1.5">
                  {Array.from({ length: 42 }).map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : (
                <>
                  <div className="mb-1.5 grid grid-cols-7 gap-1.5">
                    {WEEKDAYS.map((d) => (
                      <div key={d} className="label-draft px-1 text-center !text-[10px]">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {gridDays.map((day) => {
                      const key = format(day, "yyyy-MM-dd");
                      const dayEvents = eventsByDay.get(key) ?? [];
                      const inMonth = isSameMonth(day, visibleMonth);
                      const isToday = isSameDay(day, TODAY);
                      const overflow = dayEvents.length - MAX_CHIPS;
                      return (
                        <div
                          key={key}
                          className={cn(
                            "flex min-h-24 flex-col rounded-md border p-1.5 transition-colors",
                            inMonth ? "border-line bg-paper" : "border-line/60 bg-paper-2",
                            isToday && "border-blue ring-1 ring-blue/40",
                          )}
                        >
                          <div
                            className={cn(
                              "mb-1 flex items-center justify-between text-[11px] tnum",
                              !inMonth && "text-ink-ghost",
                              inMonth && !isToday && "text-ink-faint",
                            )}
                          >
                            <span
                              className={cn(
                                isToday &&
                                  "grid h-5 w-5 place-items-center rounded-full bg-blue font-medium text-paper",
                              )}
                            >
                              {format(day, "d")}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1">
                            {dayEvents.slice(0, MAX_CHIPS).map((ev, i) => {
                              const meta = KIND_META[ev.kind];
                              return (
                                <div
                                  key={`${key}-${i}`}
                                  title={ev.title}
                                  className={cn(
                                    "truncate rounded border px-1.5 py-0.5 text-[10px] leading-tight",
                                    meta.chipClass,
                                  )}
                                >
                                  {ev.title}
                                </div>
                              );
                            })}
                            {overflow > 0 && (
                              <span className="px-1 text-[10px] text-ink-faint">
                                +{overflow} more
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-line pt-3">
                    {(Object.keys(KIND_META) as EventKind[]).map((k) => (
                      <div key={k} className="flex items-center gap-1.5 text-xs text-ink-soft">
                        <span className={cn("h-2 w-2 rounded-full", KIND_META[k].dotClass)} />
                        {KIND_META[k].label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* AGENDA */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <div>
                <CardKicker>Next 14 days</CardKicker>
                <CardTitle>Upcoming</CardTitle>
              </div>
              {!isLoading && (
                <div className="flex items-center gap-1.5 text-xs text-ink-faint">
                  <StatusDot status="connected" />
                  {agenda.length} items
                </div>
              )}
            </CardHeader>

            {isLoading ? (
              <CardContent className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </CardContent>
            ) : agenda.length === 0 ? (
              <EmptyState
                title="Nothing scheduled"
                description="No deadlines or meetings fall within the next two weeks from today."
              />
            ) : (
              <div className="divide-y divide-line border-t border-line">
                {agenda.map((ev, i) => {
                  const meta = KIND_META[ev.kind];
                  const pname = projectName(ev.projectId);
                  const dayDelta = daysFromNow(format(ev.date, "yyyy-MM-dd"));
                  return (
                    <div key={`agenda-${i}`} className="flex items-start gap-3 px-5 py-3">
                      <div className="w-12 shrink-0 pt-0.5">
                        <div className="text-xs font-medium text-ink tnum">{compactDate(format(ev.date, "yyyy-MM-dd"))}</div>
                        {dayDelta !== null && (
                          <div className="text-[10px] text-ink-ghost">
                            {dayDelta === 0 ? "today" : `in ${dayDelta}d`}
                          </div>
                        )}
                      </div>
                      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", meta.dotClass)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-ink" title={ev.title}>
                          {ev.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Badge tone={meta.tone} size="sm">
                            {meta.label}
                          </Badge>
                          {pname && ev.projectId && (
                            <Link
                              to={`/projects/${ev.projectId}`}
                              className="truncate text-[11px] text-ink-faint underline-offset-2 hover:text-blue hover:underline"
                            >
                              {pname}
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </PageSection>
    </Page>
  );
}
