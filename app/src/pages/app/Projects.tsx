import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LayoutGrid, Rows3, Plus, AlertTriangle, MapPin, Wallet } from "lucide-react";
import { Page, PageHeader } from "@/components/page";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { EmptyState } from "@/components/states";
import {
  PhaseBadge,
  HealthBadge,
  phaseShort,
  phaseName,
} from "@/components/archintel/badges";
import { useAiProjects, projectProgress } from "@/lib/archintel/api";
import { clientById, memberById } from "@/lib/archintel/data";
import type { ProjectA } from "@/lib/archintel/data";
import { bdt } from "@/lib/format";
import { cn } from "@/lib/cn";

const TYPE_LABELS: Record<ProjectA["type"], string> = {
  residential: "Residential",
  hospitality: "Hospitality",
  corporate: "Corporate",
  retail: "Retail",
  healthcare: "Healthcare",
};

const phaseStatusOf = (p: ProjectA) =>
  p.phases.find((ph) => ph.index === p.currentPhase)?.status ?? "not_started";

const progressTone = (pct: number, health: ProjectA["health"]) =>
  health === "at_risk" ? "rust" : health === "watch" ? "ochre" : pct >= 75 ? "sage" : "blue";

export default function Projects() {
  const { data: all = [], isLoading } = useAiProjects();
  const nav = useNavigate();

  const [q, setQ] = useState("");
  const [phase, setPhase] = useState("all");
  const [health, setHealth] = useState("all");
  const [lead, setLead] = useState("all");
  const [view, setView] = useState<"grid" | "table">("grid");

  // Only active workspaces belong on this page.
  const active = useMemo(() => all.filter((p) => p.status === "active"), [all]);

  // Leads who actually run an active project — drives the filter options.
  const leadOptions = useMemo(() => {
    const ids = Array.from(new Set(active.map((p) => p.leadId)));
    return ids
      .map((id) => memberById(id))
      .filter((m): m is NonNullable<ReturnType<typeof memberById>> => !!m)
      .map((m) => ({ value: m.id, label: m.name.split(" ")[0] }));
  }, [active]);

  const filtered = useMemo(
    () =>
      active.filter((p) => {
        const client = clientById(p.clientId)?.name ?? "";
        if (q && !`${p.name} ${p.code} ${client} ${p.address}`.toLowerCase().includes(q.toLowerCase()))
          return false;
        if (phase !== "all" && p.currentPhase !== Number(phase)) return false;
        if (health !== "all" && p.health !== health) return false;
        if (lead !== "all" && p.leadId !== lead) return false;
        return true;
      }),
    [active, q, phase, health, lead],
  );

  // ---- summary strip figures (across all active, not the filtered view) ----
  const inDesign = active.filter((p) => p.currentPhase === 2 || p.currentPhase === 3).length;
  const atRisk = active.filter((p) => p.health === "at_risk").length;
  const totalContract = active.reduce((s, p) => s + p.contractValue, 0);

  const stats = [
    { label: "Active projects", value: String(active.length), tone: "" },
    { label: "In concept / design", value: String(inDesign), tone: "" },
    { label: "At risk", value: String(atRisk), tone: atRisk > 0 ? "text-rust" : "" },
    { label: "Contract value", value: bdt(totalContract, { compact: true }), tone: "" },
  ];

  const hasFilters = q !== "" || phase !== "all" || health !== "all" || lead !== "all";
  const clearFilters = () => {
    setQ("");
    setPhase("all");
    setHealth("all");
    setLead("all");
  };

  return (
    <Page>
      <PageHeader
        kicker="Project control"
        title="Projects"
        description="Every active project workspace, organised around the studio's four-phase workflow."
        actions={
          <Button onClick={() => nav("/projects/new")} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New project
          </Button>
        }
      />

      {/* summary strip */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="p-4">
                <Skeleton className="mb-2 h-3 w-20" />
                <Skeleton className="h-7 w-16" />
              </Card>
            ))
          : stats.map((s) => (
              <Card key={s.label} className="p-4">
                <div className="label-draft">{s.label}</div>
                <div className={cn("mt-1 font-display text-2xl text-ink tnum", s.tone)}>{s.value}</div>
              </Card>
            ))}
      </div>

      {/* toolbar */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SearchInput
          placeholder="Search projects, clients, codes…"
          className="lg:max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="sm"
            value={phase}
            onValueChange={setPhase}
            options={[
              { value: "all", label: "All phases" },
              { value: "1", label: `1 · ${phaseShort(1)}` },
              { value: "2", label: `2 · ${phaseShort(2)}` },
              { value: "3", label: `3 · ${phaseShort(3)}` },
              { value: "4", label: `4 · ${phaseShort(4)}` },
            ]}
          />
          <Select
            size="sm"
            value={health}
            onValueChange={setHealth}
            options={[
              { value: "all", label: "All health" },
              { value: "on_track", label: "On track" },
              { value: "watch", label: "Watch" },
              { value: "at_risk", label: "At risk" },
            ]}
          />
          <Select
            size="sm"
            value={lead}
            onValueChange={setLead}
            options={[{ value: "all", label: "All leads" }, ...leadOptions]}
          />
          <div className="flex rounded-md border border-line-strong bg-paper p-0.5">
            <button
              aria-label="Grid view"
              className={cn(
                "rounded p-1.5 transition-colors",
                view === "grid" ? "bg-blue-tint text-blue" : "text-ink-faint hover:text-ink",
              )}
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              aria-label="Table view"
              className={cn(
                "rounded p-1.5 transition-colors",
                view === "table" ? "bg-blue-tint text-blue" : "text-ink-faint hover:text-ink",
              )}
              onClick={() => setView("table")}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="mt-5">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="p-5">
                <Skeleton className="mb-3 h-3 w-16" />
                <Skeleton className="mb-2 h-5 w-40" />
                <Skeleton className="mb-4 h-3 w-28" />
                <Skeleton className="mb-3 h-1.5 w-full" />
                <Skeleton className="h-7 w-24" />
              </Card>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <Card>
            <EmptyState
              icon={MapPin}
              title={hasFilters ? "No projects match" : "No active projects"}
              description={
                hasFilters
                  ? "Try clearing a filter or search term to widen the view."
                  : "New project workspaces will appear here once they start."
              }
              action={
                hasFilters ? (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => nav("/projects/new")}>
                    New project
                  </Button>
                )
              }
            />
          </Card>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((p) => (
              <ProjectGridCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Project</TH>
                  <TH>Phase</TH>
                  <TH className="text-right">Progress</TH>
                  <TH>Health</TH>
                  <TH>Lead</TH>
                  <TH>Payment</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((p) => {
                  const pct = projectProgress(p);
                  const leadM = memberById(p.leadId);
                  return (
                    <TR key={p.id} interactive onClick={() => nav(`/projects/${p.id}`)}>
                      <TD>
                        <div className="font-medium text-ink">{p.name}</div>
                        <div className="text-xs text-ink-faint">
                          {p.code} · {clientById(p.clientId)?.name}
                        </div>
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <span className="text-ink-soft">
                            P{p.currentPhase} · {phaseShort(p.currentPhase)}
                          </span>
                          <PhaseBadge status={phaseStatusOf(p)} />
                        </div>
                      </TD>
                      <TD className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="tnum text-ink-soft">{pct}%</span>
                          <Progress value={pct} tone={progressTone(pct, p.health)} className="w-16" />
                        </div>
                      </TD>
                      <TD>
                        <HealthBadge health={p.health} />
                      </TD>
                      <TD>
                        {leadM ? (
                          <div className="flex items-center gap-2">
                            <Avatar name={leadM.name} tone={leadM.tone} size="sm" />
                            <span className="text-ink-soft">{leadM.name.split(" ")[0]}</span>
                          </div>
                        ) : (
                          "—"
                        )}
                      </TD>
                      <TD className="capitalize text-ink-soft">{p.paymentPlan}</TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}
      </div>

      {!isLoading && filtered.length > 0 && (
        <p className="mt-4 text-xs text-ink-ghost">
          Showing {filtered.length} of {active.length} active {active.length === 1 ? "project" : "projects"}
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

function ProjectGridCard({ p }: { p: ProjectA }) {
  const client = clientById(p.clientId);
  const lead = memberById(p.leadId);
  const pct = projectProgress(p);
  const team = p.teamIds
    .map((id) => memberById(id))
    .filter((m): m is NonNullable<ReturnType<typeof memberById>> => !!m);

  return (
    <Link to={`/projects/${p.id}`} className="group block focus:outline-none">
      <Card className="flex h-full flex-col transition-shadow group-hover:shadow-lift group-focus-visible:ring-2 group-focus-visible:ring-blue/25">
        <CardContent className="flex flex-1 flex-col pb-4 pt-4">
          {/* header */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="label-draft">
                {p.code} · {TYPE_LABELS[p.type]}
              </div>
              <h3 className="mt-1 truncate font-display text-[17px] leading-tight text-ink group-hover:text-blue">
                {p.name}
              </h3>
              <div className="mt-0.5 truncate text-xs text-ink-faint">{client?.name}</div>
            </div>
            <HealthBadge health={p.health} />
          </div>

          {/* phase + progress */}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                <span className="font-medium text-ink">Phase {p.currentPhase}</span>
                <span className="text-ink-ghost">·</span>
                <span>{phaseName(p.currentPhase)}</span>
              </div>
              <PhaseBadge status={phaseStatusOf(p)} />
            </div>
            <Progress value={pct} tone={progressTone(pct, p.health)} />
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-ghost">
              <span className="tnum">{pct}% complete</span>
              <span className="tnum">{bdt(p.contractValue, { compact: true })}</span>
            </div>
          </div>

          {/* blocker chip */}
          {p.blocker && (
            <div className="mt-3 flex items-start gap-1.5 rounded-md border border-sienna/20 bg-sienna-tint/50 px-2.5 py-1.5">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sienna" />
              <span className="text-[11px] leading-snug text-sienna">{p.blocker}</span>
            </div>
          )}
        </CardContent>

        <CardFooter className="mt-auto">
          <div className="flex min-w-0 items-center gap-2">
            {lead && <Avatar name={lead.name} tone={lead.tone} size="sm" />}
            {team.length > 0 && (
              <AvatarStack names={team.map((m) => m.name)} tones={team.map((m) => m.tone)} />
            )}
          </div>
          <span className="flex items-center gap-1 whitespace-nowrap text-[11px] text-ink-faint">
            <Wallet className="h-3 w-3" />
            <span className="capitalize">{p.paymentPlan}</span>
          </span>
        </CardFooter>
      </Card>
    </Link>
  );
}
