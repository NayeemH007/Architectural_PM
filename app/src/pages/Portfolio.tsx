import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, Rows3 } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { Card, CardContent, CardHeader, CardKicker, CardTitle } from "@/components/ui/card";
import { BarSeries, Donut, CHART } from "@/components/charts";
import { SearchInput } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { ProjectCard } from "@/components/project-card";
import { HealthBadge, STAGE_LABELS, TYPE_LABELS } from "@/components/status";
import { EmptyState } from "@/components/states";
import { bdt, pct } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useProjects } from "@/lib/api";

export default function Portfolio() {
  const { data: projects = [], isLoading } = useProjects();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [type, setType] = useState("all");
  const [stage, setStage] = useState("all");
  const [health, setHealth] = useState("all");
  const [view, setView] = useState<"grid" | "table">("grid");

  const filtered = useMemo(
    () =>
      projects.filter((p) => {
        if (q && !`${p.name} ${p.client} ${p.code}`.toLowerCase().includes(q.toLowerCase())) return false;
        if (type !== "all" && p.type !== type) return false;
        if (stage !== "all" && p.stage !== stage) return false;
        if (health !== "all" && p.health !== health) return false;
        return true;
      }),
    [projects, q, type, stage, health],
  );

  const totalContract = projects.reduce((s, p) => s + p.feeContract, 0);
  const atRisk = projects.filter((p) => p.health === "at_risk" || p.health === "critical").length;
  const avgHealth = projects.length
    ? Math.round(projects.reduce((s, p) => s + (p.healthScore.value ?? 0), 0) / projects.length)
    : 0;

  // 1) Health mix — count projects per health band
  const healthMix = useMemo(() => {
    const bands: { key: string; name: string; color: string }[] = [
      { key: "healthy", name: "Healthy", color: CHART.sage },
      { key: "watch", name: "Watch", color: CHART.ochre },
      { key: "at_risk", name: "At risk", color: CHART.sienna },
      { key: "critical", name: "Critical", color: CHART.taupe },
    ];
    return bands
      .map((b) => ({
        name: b.name,
        color: b.color,
        value: projects.filter((p) => p.health === b.key).length,
      }))
      .filter((d) => d.value > 0);
  }, [projects]);

  // 2) Fee (contract value) by project TYPE
  const feeByType = useMemo(() => {
    const totals = new Map<string, number>();
    for (const p of projects) totals.set(p.type, (totals.get(p.type) ?? 0) + p.feeContract);
    return Object.keys(TYPE_LABELS)
      .filter((t) => totals.has(t))
      .map((t) => ({ type: TYPE_LABELS[t as keyof typeof TYPE_LABELS], fee: totals.get(t) ?? 0 }));
  }, [projects]);

  // 3) Collected vs contract per project code
  const collectedVsContract = useMemo(
    () =>
      [...projects]
        .sort((a, b) => b.feeContract - a.feeContract)
        .map((p) => ({ code: p.code, contract: p.feeContract, collected: p.feeCollected })),
    [projects],
  );

  return (
    <Page>
      <PageHeader
        kicker="Projects"
        title="Portfolio health"
        description="Every active project, matched across accounting, files and capture into one record."
      />

      {/* summary strip */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Active projects", value: String(projects.length) },
          { label: "At risk / critical", value: String(atRisk), tone: "text-sienna" },
          { label: "Contract value", value: bdt(totalContract, { compact: true }) },
          { label: "Avg health", value: String(avgHealth) },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="label-draft">{s.label}</div>
            <div className={cn("mt-1 font-display text-2xl text-ink tnum", s.tone)}>{s.value}</div>
          </Card>
        ))}
      </div>

      {/* portfolio analytics */}
      <PageSection title="Portfolio analytics" className="mt-8">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <div>
                <CardKicker>Health mix</CardKicker>
                <CardTitle>Projects by health</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <Donut data={healthMix} centerValue={String(projects.length)} centerLabel="Projects" />
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
                {healthMix.map((d) => (
                  <span key={d.name} className="flex items-center gap-1.5 text-xs text-ink-soft">
                    <span className="h-2 w-2 rounded-full" style={{ background: d.color }} />
                    {d.name}
                    <span className="tnum text-ink-faint">{d.value}</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardKicker>Contract value</CardKicker>
                <CardTitle>Fee by project type</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <BarSeries
                data={feeByType}
                xKey="type"
                currency
                height={216}
                bars={[{ key: "fee", color: CHART.blue, label: "Contract" }]}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardKicker>Realisation</CardKicker>
                <CardTitle>Collected vs. contract</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <BarSeries
                data={collectedVsContract}
                xKey="code"
                currency
                height={216}
                bars={[
                  { key: "contract", color: CHART.slate, label: "Contract" },
                  { key: "collected", color: CHART.sage, label: "Collected" },
                ]}
              />
            </CardContent>
          </Card>
        </div>
      </PageSection>

      {/* toolbar */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput
          placeholder="Search projects, clients, codes…"
          className="sm:max-w-xs"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Select
            size="sm"
            value={type}
            onValueChange={setType}
            options={[
              { value: "all", label: "All types" },
              ...Object.entries(TYPE_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
          <Select
            size="sm"
            value={stage}
            onValueChange={setStage}
            options={[
              { value: "all", label: "All stages" },
              ...Object.entries(STAGE_LABELS).map(([v, l]) => ({ value: v, label: l })),
            ]}
          />
          <Select
            size="sm"
            value={health}
            onValueChange={setHealth}
            options={[
              { value: "all", label: "All health" },
              { value: "healthy", label: "Healthy" },
              { value: "watch", label: "Watch" },
              { value: "at_risk", label: "At risk" },
              { value: "critical", label: "Critical" },
            ]}
          />
          <div className="flex rounded-md border border-line-strong bg-paper p-0.5">
            <button
              className={cn("rounded p-1.5", view === "grid" ? "bg-blue-tint text-blue" : "text-ink-faint")}
              onClick={() => setView("grid")}
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              className={cn("rounded p-1.5", view === "table" ? "bg-blue-tint text-blue" : "text-ink-faint")}
              onClick={() => setView("table")}
            >
              <Rows3 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* body */}
      <div className="mt-5">
        {filtered.length === 0 && !isLoading ? (
          <Card>
            <EmptyState title="No projects match" description="Try clearing a filter or search term." />
          </Card>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProjectCard key={p.id} p={p} />
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Project</TH>
                  <TH>Stage</TH>
                  <TH>Health</TH>
                  <TH className="text-right">Complete</TH>
                  <TH className="text-right">Collected / Contract</TH>
                  <TH className="text-right">Schedule</TH>
                </TR>
              </THead>
              <TBody>
                {filtered.map((p) => (
                  <TR key={p.id} interactive onClick={() => nav(`/projects/${p.id}`)}>
                    <TD>
                      <div className="font-medium text-ink">{p.name}</div>
                      <div className="text-xs text-ink-faint">
                        {p.code} · {p.client}
                      </div>
                    </TD>
                    <TD className="text-ink-soft">{STAGE_LABELS[p.stage]}</TD>
                    <TD>
                      <HealthBadge band={p.health} size="sm" />
                    </TD>
                    <TD className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tnum text-ink-soft">{p.pctComplete}%</span>
                        <Progress value={p.pctComplete} className="w-14" />
                      </div>
                    </TD>
                    <TD className="text-right tnum">
                      <span className="text-ink">{bdt(p.feeCollected, { compact: true })}</span>
                      <span className="text-ink-ghost"> / {bdt(p.feeContract, { compact: true })}</span>
                    </TD>
                    <TD className={cn("text-right tnum", p.scheduleVarianceDays < 0 ? "text-sienna" : "text-sage")}>
                      {p.scheduleVarianceDays > 0 ? "+" : ""}
                      {p.scheduleVarianceDays}d
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </div>

      <p className="mt-4 text-xs text-ink-ghost">
        Showing {filtered.length} of {projects.length} projects · {pct(
          projects.length ? Math.round(projects.reduce((s, p) => s + p.completeness, 0) / projects.length) : 0,
        )}{" "}
        average data completeness.
      </p>
    </Page>
  );
}
