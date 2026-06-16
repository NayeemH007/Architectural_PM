import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { parseISO, format, isSameDay } from "date-fns";
import {
  PencilLine,
  RefreshCw,
  Check,
  FileText,
  GitMerge,
  Receipt,
  AlertTriangle,
  History,
} from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardHeader,
  CardKicker,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { SearchInput } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { SourceChip } from "@/components/data-source";
import { EmptyState } from "@/components/states";
import { relative, shortDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useActivity } from "@/lib/api";
import { projectById } from "@/lib/mock/data";
import type { ActivityEvent, ActivityType } from "@/lib/mock/ops";

const TODAY = parseISO("2026-06-17");

// ---- type → presentation map -------------------------------------------------
type Tone = "neutral" | "blue" | "sage" | "ochre" | "sienna" | "rust" | "ink";

const TYPE_META: Record<
  ActivityType,
  { label: string; icon: typeof PencilLine; tone: Exclude<Tone, "neutral" | "ink">; ring: string; fill: string }
> = {
  capture: { label: "Capture", icon: PencilLine, tone: "sage", ring: "border-sage/30", fill: "bg-sage-tint text-sage" },
  sync: { label: "Sync", icon: RefreshCw, tone: "blue", ring: "border-blue/25", fill: "bg-blue-tint text-blue" },
  approval: { label: "Approval", icon: Check, tone: "sage", ring: "border-sage/30", fill: "bg-sage-tint text-sage" },
  report: { label: "Report", icon: FileText, tone: "blue", ring: "border-blue/25", fill: "bg-blue-tint text-blue" },
  match: { label: "Match", icon: GitMerge, tone: "ochre", ring: "border-ochre/30", fill: "bg-ochre-tint text-ochre" },
  invoice: { label: "Invoice", icon: Receipt, tone: "ochre", ring: "border-ochre/30", fill: "bg-ochre-tint text-ochre" },
  alert: { label: "Alert", icon: AlertTriangle, tone: "rust", ring: "border-rust/30", fill: "bg-rust-tint text-rust" },
};

const ACTIVITY_TYPES = Object.keys(TYPE_META) as ActivityType[];

const typeOptions = [
  { value: "all", label: "All event types" },
  ...ACTIVITY_TYPES.map((t) => ({ value: t, label: TYPE_META[t].label })),
];

// ---- day grouping -------------------------------------------------------------
interface DayGroup {
  key: string; // yyyy-MM-dd
  date: Date;
  label: string; // "Mon, 17 Jun 2026"
  events: ActivityEvent[];
}

function groupByDay(events: ActivityEvent[]): DayGroup[] {
  const map = new Map<string, DayGroup>();
  for (const e of events) {
    const d = parseISO(e.timestamp);
    const key = format(d, "yyyy-MM-dd");
    let group = map.get(key);
    if (!group) {
      group = { key, date: d, label: format(d, "EEE, d MMM yyyy"), events: [] };
      map.set(key, group);
    }
    group.events.push(e);
  }
  const groups = [...map.values()];
  // days descending
  groups.sort((a, b) => (a.key < b.key ? 1 : -1));
  // within a day, newest first
  for (const g of groups) {
    g.events.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  }
  return groups;
}

// ---- loading skeleton ---------------------------------------------------------
function TimelineSkeleton() {
  return (
    <div className="space-y-8">
      {[0, 1].map((d) => (
        <div key={d}>
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="space-y-5 border-l border-line pl-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-7 w-7 shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- a single timeline row ----------------------------------------------------
function EventRow({ event }: { event: ActivityEvent }) {
  const meta = TYPE_META[event.type];
  const Icon = meta.icon;
  const project = event.projectId ? projectById(event.projectId) : undefined;
  const chipName = `${event.sourceName}${event.recordRef ? ` · ${event.recordRef}` : ""}`;

  return (
    <li className="relative pl-12">
      {/* left rail node */}
      <span
        className={cn(
          "absolute left-0 top-0 grid h-8 w-8 -translate-x-1/2 place-items-center rounded-full border",
          meta.ring,
          meta.fill,
        )}
        aria-hidden
      >
        <Icon className="h-4 w-4" />
      </span>

      <div className="pt-0.5">
        <p className="text-sm leading-snug text-ink-soft">
          <span className="font-semibold text-ink">{event.actor}</span>{" "}
          {event.summary}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[11px] text-ink-faint">
          <Badge tone={meta.tone} size="sm" dot>
            {meta.label}
          </Badge>
          {project && (
            <Link
              to={`/projects/${event.projectId}`}
              className="font-medium text-blue hover:underline"
            >
              {project.name}
            </Link>
          )}
          <SourceChip name={chipName} />
          <span className="text-ink-ghost" title={shortDate(event.timestamp)}>
            {relative(event.timestamp)}
          </span>
        </div>
      </div>
    </li>
  );
}

// ---- the page -----------------------------------------------------------------
export default function ActivityLog() {
  const { data, isLoading } = useActivity();

  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const events = useMemo<ActivityEvent[]>(() => data ?? [], [data]);

  // ---- KPI stats (computed on the full, unfiltered set) ----
  const stats = useMemo(() => {
    const eventsToday = events.filter((e) => isSameDay(parseISO(e.timestamp), TODAY)).length;
    const weekAgo = new Date(TODAY);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const capturesThisWeek = events.filter(
      (e) => e.type === "capture" && parseISO(e.timestamp) >= weekAgo,
    ).length;
    const lastSync = events
      .filter((e) => e.type === "sync")
      .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))[0];
    return {
      eventsToday,
      capturesThisWeek,
      lastSync: lastSync ? relative(lastSync.timestamp) : "—",
      lastSyncName: lastSync?.sourceName,
    };
  }, [events]);

  // ---- filtered + grouped ----
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = events.filter((e) => {
      if (typeFilter !== "all" && e.type !== typeFilter) return false;
      if (!q) return true;
      return (
        e.summary.toLowerCase().includes(q) || e.actor.toLowerCase().includes(q)
      );
    });
    return groupByDay(filtered);
  }, [events, typeFilter, query]);

  const totalShown = groups.reduce((n, g) => n + g.events.length, 0);
  const hasFilters = typeFilter !== "all" || query.trim().length > 0;

  return (
    <Page>
      <PageHeader
        kicker="Data & setup"
        title="Activity & audit log"
        description="An append-only, provenance-stamped trail of every capture, sync, approval, report and match — so every number in Space Esse can be traced back to who recorded it, when, and from where."
        actions={
          <span className="hidden items-center gap-2 rounded-md border border-line bg-paper-2 px-3 py-1.5 text-[12px] text-ink-soft sm:inline-flex">
            <History className="h-3.5 w-3.5 text-ink-faint" />
            Owner &amp; Admin view
          </span>
        }
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          kicker="Events today"
          value={isLoading ? "—" : String(stats.eventsToday)}
          footnote={
            <span className="text-[11px] text-ink-ghost">Recorded {shortDate("2026-06-17")}</span>
          }
        />
        <KpiCard
          kicker="Captures this week"
          value={isLoading ? "—" : String(stats.capturesThisWeek)}
          footnote={
            <Badge tone="sage" size="sm" dot>
              Manual records
            </Badge>
          }
        />
        <KpiCard
          kicker="Last sync"
          value={isLoading ? "—" : stats.lastSync}
          footnote={
            stats.lastSyncName ? (
              <SourceChip name={stats.lastSyncName} status="connected" />
            ) : (
              <span className="text-[11px] text-ink-ghost">No sync recorded</span>
            )
          }
        />
      </div>

      {/* filters + timeline */}
      <PageSection
        className="mt-8"
        title="Event timeline"
        description="Newest first, grouped by day. Each entry carries its actor, source and a relative timestamp."
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={typeFilter}
              onValueChange={setTypeFilter}
              options={typeOptions}
              size="sm"
              className="w-44"
            />
            <SearchInput
              placeholder="Search summary or actor…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-56"
            />
          </div>
        }
      >
        <Card>
          <CardHeader>
            <div>
              <CardKicker>Audit trail</CardKicker>
              <CardTitle>
                {isLoading ? "Loading events…" : `${totalShown} event${totalShown === 1 ? "" : "s"}`}
                {!isLoading && hasFilters && (
                  <span className="ml-2 text-[13px] font-normal text-ink-faint">
                    of {events.length} total
                  </span>
                )}
              </CardTitle>
            </div>
            <Badge tone="ink" size="sm" dot>
              Append-only
            </Badge>
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <TimelineSkeleton />
            ) : groups.length === 0 ? (
              <EmptyState
                icon={History}
                title="No matching events"
                description={
                  hasFilters
                    ? "No events match this filter. Try a different type or clear your search."
                    : "Activity will appear here as captures, syncs, approvals and reports are recorded."
                }
              />
            ) : (
              <div className="space-y-9">
                {groups.map((group) => {
                  const isToday = isSameDay(group.date, TODAY);
                  return (
                    <div key={group.key}>
                      {/* day header */}
                      <div className="mb-4 flex items-center gap-3">
                        <h3 className="font-display text-[15px] text-ink">{group.label}</h3>
                        {isToday && (
                          <Badge tone="blue" size="sm">
                            Today
                          </Badge>
                        )}
                        <span className="font-mono text-[11px] text-ink-ghost tnum">
                          {group.events.length} event{group.events.length === 1 ? "" : "s"}
                        </span>
                        <span className="h-px flex-1 bg-line" />
                      </div>

                      {/* vertical rail */}
                      <ol className="relative ml-4 space-y-6 border-l border-line">
                        {group.events.map((event) => (
                          <EventRow key={event.id} event={event} />
                        ))}
                      </ol>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* tamper-evidence note */}
        <div className="mt-4 flex items-start gap-2.5 rounded-md border border-dashed border-line-strong bg-paper-2 px-4 py-3">
          <History className="mt-0.5 h-4 w-4 shrink-0 text-ink-faint" />
          <p className="text-[12px] leading-relaxed text-ink-soft">
            <span className="font-medium text-ink">Append-only — tamper-evident.</span> Entries are
            never edited or deleted in place; corrections are recorded as new events. This is the
            audit trail of record for the firm.
          </p>
        </div>
      </PageSection>
    </Page>
  );
}
