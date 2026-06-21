import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity as ActivityIcon,
  FileText,
  Stamp,
  Send,
  Wallet,
  GitBranch,
  Lock,
  UserPlus,
  Check,
  CalendarDays,
} from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/states";
import { useAiActivity } from "@/lib/archintel/api";
import { projectById, members, TODAY } from "@/lib/archintel/data";
import type { ActivityA } from "@/lib/archintel/data";
import { cn } from "@/lib/cn";

type ActType = ActivityA["type"];

// ---- type → icon + label + tone (Atelier accents) ----
const TYPE_CFG: Record<
  ActType,
  { label: string; icon: typeof FileText; tone: string; chip: string }
> = {
  file: { label: "File", icon: FileText, tone: "blue", chip: "border-blue/25 bg-blue-tint text-blue" },
  approval: { label: "Approval", icon: Stamp, tone: "sienna", chip: "border-sienna/25 bg-sienna-tint text-sienna" },
  submission: { label: "Client", icon: Send, tone: "sage", chip: "border-sage/25 bg-sage-tint text-sage" },
  payment: { label: "Payment", icon: Wallet, tone: "ochre", chip: "border-ochre/25 bg-ochre-tint text-ochre" },
  phase: { label: "Phase", icon: GitBranch, tone: "blue", chip: "border-blue/25 bg-blue-tint text-blue" },
  decision: { label: "Decision", icon: Lock, tone: "ink", chip: "border-line bg-bone-2 text-ink-soft" },
  member: { label: "Member", icon: UserPlus, tone: "sage", chip: "border-sage/25 bg-sage-tint text-sage" },
};
const TYPE_ORDER: ActType[] = ["file", "approval", "submission", "payment", "phase", "decision", "member"];

// Actor name (activity stores a display name, not an id) → member tone.
const toneForActor = (actor: string): string => {
  const m = members.find((mm) => mm.name === actor || mm.name.endsWith(actor));
  return m?.tone ?? "blue";
};
const isSystem = (actor: string) => actor.toLowerCase() === "system";

// Relative time anchored to the workspace's TODAY (mock data is dated mid-2026,
// so the real wall clock would read wrong). Pure, no date-fns drift.
const anchor = new Date(`${TODAY}T23:59:59`).getTime();
function relativeToToday(iso: string): string {
  const t = new Date(iso).getTime();
  const diffMin = Math.round((anchor - t) / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const h = Math.round(diffMin / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.round(d / 30)}mo ago`;
}

// Day key + friendly label for the date a row falls on.
const dayKey = (iso: string) => iso.slice(0, 10);
function dayLabel(key: string): string {
  const todayKey = TODAY;
  const yKey = new Date(new Date(`${TODAY}T00:00:00`).getTime() - 86400000)
    .toISOString()
    .slice(0, 10);
  if (key === todayKey) return "Today";
  if (key === yKey) return "Yesterday";
  return new Date(`${key}T00:00:00`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
const timeOfDay = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export default function Activity() {
  const { data: all = [], isLoading } = useAiActivity();

  // ---- filters (client state) ----
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [project, setProject] = useState<string>("all");

  // ---- local workflow state: events the user has "reviewed" this session ----
  const [reviewed, setReviewed] = useState<Record<string, boolean>>({});
  const toggleReviewed = (id: string) =>
    setReviewed((s) => ({ ...s, [id]: !s[id] }));

  // Project options drawn only from projects that actually appear in the log.
  const projectOptions = useMemo(() => {
    const ids = Array.from(
      new Set(all.map((a) => a.projectId).filter((id): id is string => !!id)),
    );
    return ids
      .map((id) => projectById(id))
      .filter((p): p is NonNullable<ReturnType<typeof projectById>> => !!p)
      .map((p) => ({ value: p.id, label: p.code }));
  }, [all]);

  // Newest-first, then filtered.
  const filtered = useMemo(() => {
    const sorted = [...all].sort((a, b) => b.date.localeCompare(a.date));
    return sorted.filter((a) => {
      if (type !== "all" && a.type !== type) return false;
      if (project !== "all" && a.projectId !== project) return false;
      if (q) {
        const proj = projectById(a.projectId ?? "");
        const hay = `${a.actor} ${a.summary} ${proj?.name ?? ""} ${proj?.code ?? ""}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
  }, [all, type, project, q]);

  // Group the filtered rows by calendar day, preserving newest-first order.
  const groups = useMemo(() => {
    const map = new Map<string, ActivityA[]>();
    for (const a of filtered) {
      const k = dayKey(a.date);
      const arr = map.get(k);
      if (arr) arr.push(a);
      else map.set(k, [a]);
    }
    return Array.from(map.entries()); // already newest-first from sorted input
  }, [filtered]);

  // ---- KPIs (whole log, not the filtered view) ----
  const kpis = useMemo(() => {
    const today = TODAY;
    const weekStart = new Date(`${TODAY}T00:00:00`).getTime() - 6 * 86400000;
    const eventsToday = all.filter((a) => dayKey(a.date) === today).length;
    const eventsWeek = all.filter(
      (a) => new Date(`${dayKey(a.date)}T00:00:00`).getTime() >= weekStart,
    ).length;
    const filesAdded = all.filter((a) => a.type === "file").length;
    return { eventsToday, eventsWeek, filesAdded };
  }, [all]);

  const hasFilters = q !== "" || type !== "all" || project !== "all";
  const clearFilters = () => {
    setQ("");
    setType("all");
    setProject("all");
  };
  const reviewedCount = filtered.filter((a) => reviewed[a.id]).length;

  return (
    <Page>
      <PageHeader
        kicker="Project control · Audit trail"
        title="Activity"
        description="A single, time-ordered record of everything happening across the studio — files, approvals, client hand-offs, payments, phase moves and locked decisions. One place to catch up and to keep the team accountable."
        actions={
          <Badge tone="neutral" className="gap-1.5">
            <ActivityIcon className="h-3.5 w-3.5" />
            {all.length} events logged
          </Badge>
        }
      />

      {/* ---- KPI row ---- */}
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="mb-2 h-3 w-24" />
              <Skeleton className="h-7 w-14" />
            </Card>
          ))
        ) : (
          <>
            <KpiCard
              kicker="Events today"
              value={kpis.eventsToday}
              footnote={<span className="text-xs text-ink-ghost">as of {dayLabel(TODAY)}</span>}
            />
            <KpiCard
              kicker="This week"
              value={kpis.eventsWeek}
              footnote={<span className="text-xs text-ink-ghost">rolling 7 days</span>}
            />
            <KpiCard
              kicker="Files added"
              value={kpis.filesAdded}
              footnote={<span className="text-xs text-blue">uploads in the log</span>}
            />
          </>
        )}
      </div>

      {/* ---- toolbar ---- */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          placeholder="Search actor, action or project…"
          className="lg:max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          {reviewedCount > 0 && (
            <span className="label-draft text-sage">{reviewedCount} reviewed</span>
          )}
          <Select
            size="sm"
            value={type}
            onValueChange={setType}
            options={[
              { value: "all", label: "All types" },
              ...TYPE_ORDER.map((t) => ({ value: t, label: TYPE_CFG[t].label })),
            ]}
          />
          <Select
            size="sm"
            value={project}
            onValueChange={setProject}
            options={[{ value: "all", label: "All projects" }, ...projectOptions]}
          />
        </div>
      </div>

      {/* ---- timeline ---- */}
      <div className="mt-6">
        {isLoading ? (
          <Card className="p-5">
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex gap-3">
                  <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3.5 w-3/4" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={ActivityIcon}
              title={hasFilters ? "No activity matches" : "Nothing logged yet"}
              description={
                hasFilters
                  ? "Try a different type, project or search term to widen the view."
                  : "As the team works, every file, approval and decision will be recorded here."
              }
              action={
                hasFilters ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="space-y-8">
            {groups.map(([key, rows]) => (
              <section key={key}>
                {/* day heading */}
                <div className="mb-3 flex items-center gap-2.5">
                  <CalendarDays className="h-4 w-4 text-ink-faint" />
                  <h2 className="font-display text-[15px] text-ink">{dayLabel(key)}</h2>
                  <span className="text-xs text-ink-ghost">
                    {rows.length} event{rows.length === 1 ? "" : "s"}
                  </span>
                  <span className="ml-1 h-px flex-1 bg-line" />
                </div>

                {/* events for the day */}
                <ol className="relative ml-[15px] space-y-1 border-l border-line">
                  {rows.map((a) => {
                    const cfg = TYPE_CFG[a.type];
                    const Icon = cfg.icon;
                    const proj = projectById(a.projectId ?? "");
                    const done = !!reviewed[a.id];
                    return (
                      <li key={a.id} className="relative pl-6">
                        {/* node on the rail */}
                        <span
                          className={cn(
                            "absolute -left-[13px] top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full border bg-paper ring-4 ring-paper",
                            cfg.chip,
                          )}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>

                        <div
                          className={cn(
                            "group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-paper-2",
                            done && "opacity-60",
                          )}
                        >
                          {/* actor avatar (system gets a neutral chip) */}
                          {isSystem(a.actor) ? (
                            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-bone-2 font-mono text-[10px] text-ink-faint">
                              SYS
                            </span>
                          ) : (
                            <Avatar
                              name={a.actor}
                              tone={toneForActor(a.actor)}
                              size="sm"
                              className="mt-0.5"
                            />
                          )}

                          <div className="min-w-0 flex-1">
                            <p
                              className={cn(
                                "text-sm leading-snug text-ink",
                                done && "line-through decoration-ink-faint/60",
                              )}
                            >
                              <span className="font-medium">{a.actor}</span>{" "}
                              <span className="text-ink-soft">{a.summary}</span>
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-ghost">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-medium",
                                  cfg.chip,
                                )}
                              >
                                {cfg.label}
                              </span>
                              {proj ? (
                                <Link
                                  to={`/projects/${proj.id}`}
                                  className="text-blue hover:underline"
                                >
                                  {proj.code} · {proj.name}
                                </Link>
                              ) : (
                                <span className="text-ink-faint">Studio-wide</span>
                              )}
                              <span aria-hidden>·</span>
                              <span className="tnum">{timeOfDay(a.date)}</span>
                              <span aria-hidden>·</span>
                              <span className="tnum">{relativeToToday(a.date)}</span>
                            </div>
                          </div>

                          {/* mark-reviewed toggle (local workflow state) */}
                          <Button
                            variant={done ? "subtle" : "ghost"}
                            size="iconSm"
                            aria-pressed={done}
                            aria-label={done ? "Marked reviewed" : "Mark reviewed"}
                            title={done ? "Marked reviewed" : "Mark reviewed"}
                            className={cn(
                              "mt-0.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100",
                              done && "text-sage opacity-100",
                            )}
                            onClick={() => toggleReviewed(a.id)}
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* ---- footer count ---- */}
      {!isLoading && filtered.length > 0 && (
        <p className="mt-6 text-xs text-ink-ghost">
          Showing {filtered.length} of {all.length} event{all.length === 1 ? "" : "s"}
          {hasFilters && (
            <>
              {" · "}
              <button className="text-blue hover:underline" onClick={clearFilters}>
                clear filters
              </button>
            </>
          )}
        </p>
      )}
    </Page>
  );
}
