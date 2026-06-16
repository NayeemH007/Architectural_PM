import { Link } from "react-router-dom";
import { Target as TargetIcon } from "lucide-react";
import { Page, PageHeader, PageSection } from "@/components/page";
import { KpiCard } from "@/components/kpi-card";
import {
  Card,
  CardContent,
  CardHeader,
  CardKicker,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { BarSeries, CHART } from "@/components/charts";
import { Delta } from "@/components/status";
import { DataCompleteness } from "@/components/trust";
import { EmptyState } from "@/components/states";
import { bdt, num, pct } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useTargets } from "@/lib/api";
import { projectById } from "@/lib/mock/data";
import type { Target } from "@/lib/mock/ops";
import type { Metric } from "@/lib/types";

type BadgeTone = "neutral" | "blue" | "sage" | "ochre" | "sienna" | "rust" | "ink";
type ProgressTone = "blue" | "sage" | "ochre" | "sienna" | "rust" | "ink";

const STATUS_TONE: Record<Target["status"], BadgeTone> = {
  ahead: "sage",
  on_track: "sage",
  behind: "ochre",
  at_risk: "rust",
};

const STATUS_LABEL: Record<Target["status"], string> = {
  ahead: "Ahead",
  on_track: "On track",
  behind: "Behind",
  at_risk: "At risk",
};

/** Lower-is-better metrics (e.g. schedule slip in days): being under target is good. */
function isLowerBetter(t: Target): boolean {
  return t.unit === "days";
}

/** Format a goal value by its unit. */
function formatValue(value: number, unit: Target["unit"]): string {
  switch (unit) {
    case "bdt":
      return bdt(value, { compact: true });
    case "pct":
      return pct(value);
    case "days":
      return `${value}d`;
    case "ratio":
      return `${value}×`;
    default:
      return num(value);
  }
}

/** Attainment 0–100, clamped. Lower-is-better inverts the ratio sensibly. */
function attainment(t: Target): number {
  if (isLowerBetter(t)) {
    // target is a ceiling (e.g. 0 days slip). At or under target = 100%.
    if (t.actual <= t.target) return 100;
    const over = t.actual - t.target;
    return Math.max(0, Math.min(100, 100 - over * 10));
  }
  if (t.target === 0) return t.actual <= 0 ? 100 : 0;
  return Math.max(0, Math.min(100, (t.actual / t.target) * 100));
}

const TODAY = "2026-06-17";

export default function Goals() {
  const { data: targets, isLoading } = useTargets();

  if (isLoading || !targets) {
    return (
      <Page>
        <PageHeader
          kicker="Clients & Growth"
          title="Goals & targets"
          description="Firm and project targets tracked against actuals — owned by the director."
        />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
        <div className="mt-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      </Page>
    );
  }

  const firmGoals = targets.filter((t) => t.scope === "firm");
  const projectGoals = targets.filter((t) => t.scope === "project");

  const onTrack = targets.filter((t) => t.status === "ahead" || t.status === "on_track").length;
  const behind = targets.filter((t) => t.status === "behind" || t.status === "at_risk").length;
  const overall = targets.length
    ? targets.reduce((sum, t) => sum + attainment(t), 0) / targets.length
    : 0;

  const kOnTrack: Metric = {
    value: onTrack,
    unit: "count",
    label: "On track",
    confidence: "high",
    completeness: 100,
    asOf: TODAY,
    sources: [],
  };
  const kBehind: Metric = {
    value: behind,
    unit: "count",
    label: "Behind / at risk",
    confidence: "high",
    completeness: 100,
    asOf: TODAY,
    sources: [],
  };
  const kOverall: Metric = {
    value: Math.round(overall),
    unit: "pct",
    label: "Overall attainment",
    confidence: "medium",
    completeness: 100,
    asOf: TODAY,
    sources: [],
  };

  const chartData = targets.map((t) => ({
    name:
      t.scope === "project"
        ? projectById(t.projectId ?? "")?.code ?? t.label
        : t.label.length > 14
          ? `${t.label.slice(0, 13)}…`
          : t.label,
    target: attainment({ ...t, actual: t.target, target: t.target }),
    actual: attainment(t),
  }));

  return (
    <Page>
      <PageHeader
        kicker="Clients & Growth"
        title="Goals & targets"
        description="Firm and project targets tracked against actuals — the director's scorecard for growth, cash and delivery."
      />

      {/* KPI row */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard kicker="On track" metric={kOnTrack} value={num(onTrack)} sparkColor={CHART.sage} />
        <KpiCard kicker="Behind / at risk" metric={kBehind} value={num(behind)} deltaGoodWhenUp={false} sparkColor={CHART.ochre} />
        <KpiCard kicker="Overall attainment" metric={kOverall} value={pct(Math.round(overall))} sparkColor={CHART.blue} />
        <KpiCard kicker="Tracked goals" value={num(targets.length)} footnote={<span className="text-xs text-ink-ghost">{firmGoals.length} firm · {projectGoals.length} project</span>} />
      </div>

      {/* Firm goals */}
      <PageSection
        className="mt-8"
        title="Firm goals"
        description="Company-wide targets for the financial year."
      >
        {firmGoals.length === 0 ? (
          <Card>
            <EmptyState icon={TargetIcon} title="No firm goals set" description="Define annual targets to track firm performance." />
          </Card>
        ) : (
          <div className="space-y-3">
            {firmGoals.map((t) => (
              <GoalRow key={t.id} target={t} />
            ))}
          </div>
        )}
      </PageSection>

      {/* Project goals */}
      <PageSection
        className="mt-8"
        title="Project goals"
        description="Targets tied to specific projects in delivery."
      >
        {projectGoals.length === 0 ? (
          <Card>
            <EmptyState icon={TargetIcon} title="No project goals set" description="Attach margin or schedule targets to active projects." />
          </Card>
        ) : (
          <div className="space-y-3">
            {projectGoals.map((t) => (
              <GoalRow key={t.id} target={t} />
            ))}
          </div>
        )}
      </PageSection>

      {/* Attainment chart */}
      <Card className="mt-8">
        <CardHeader>
          <div>
            <CardKicker>Scorecard</CardKicker>
            <CardTitle>Attainment vs. target</CardTitle>
          </div>
          <Badge tone="neutral" dot>% of target</Badge>
        </CardHeader>
        <CardContent>
          <BarSeries
            data={chartData}
            xKey="name"
            height={260}
            bars={[
              { key: "target", color: CHART.taupe, label: "Target" },
              { key: "actual", color: CHART.blue, label: "Actual" },
            ]}
          />
        </CardContent>
      </Card>
    </Page>
  );
}

function GoalRow({ target: t }: { target: Target }) {
  const lowerBetter = isLowerBetter(t);
  const value = attainment(t);
  const tone: ProgressTone =
    t.status === "ahead" || t.status === "on_track"
      ? "sage"
      : t.status === "behind"
        ? "ochre"
        : "rust";

  // Gap: actual minus target, expressed in the metric's own unit.
  const gap = t.actual - t.target;
  // For lower-is-better metrics, a positive gap (over the ceiling) is bad.
  const gapGoodWhenUp = !lowerBetter;
  const project = t.scope === "project" ? projectById(t.projectId ?? "") : null;

  return (
    <Card className="p-4 transition-shadow hover:shadow-lift">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        {/* label + project */}
        <div className="min-w-0 lg:w-64 lg:shrink-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-display text-[15px] text-ink">{t.label}</span>
            <Badge tone={STATUS_TONE[t.status]} size="sm" dot>
              {STATUS_LABEL[t.status]}
            </Badge>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-soft">{t.metric}</p>
          {project && (
            <Link
              to={`/projects/${project.id}`}
              className="mt-1 inline-flex items-center gap-1 text-xs text-blue hover:underline"
            >
              <span className="font-mono text-[10px] text-ink-ghost">{project.code}</span>
              {project.name}
            </Link>
          )}
        </div>

        {/* progress + figures */}
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <span className="text-sm text-ink-soft">
              <span className="font-medium text-ink tnum">{formatValue(t.actual, t.unit)}</span>
              <span className="mx-1 text-ink-ghost">/</span>
              <span className="tnum">{formatValue(t.target, t.unit)}</span>
              <span className="ml-1 text-xs text-ink-ghost">target</span>
            </span>
            <span className="font-display text-sm text-ink tnum">{Math.round(value)}%</span>
          </div>
          <Progress value={value} tone={tone} />
          <div className="mt-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-ink-ghost">{t.period}</span>
            <DataCompleteness value={Math.round(value)} showLabel={false} />
          </div>
        </div>

        {/* gap + owner */}
        <div className="flex items-center justify-between gap-4 lg:w-44 lg:shrink-0 lg:flex-col lg:items-end lg:justify-center">
          <div className="text-right">
            <div className="label-draft mb-0.5">Gap</div>
            {gap === 0 ? (
              <span className="text-[13px] font-medium text-ink-faint tnum">On target</span>
            ) : t.unit === "bdt" ? (
              <span
                className={cn(
                  "text-[13px] font-medium tnum",
                  gapGoodWhenUp
                    ? gap > 0
                      ? "text-sage"
                      : "text-rust"
                    : gap > 0
                      ? "text-rust"
                      : "text-sage",
                )}
              >
                {gap > 0 ? "+" : "−"}
                {bdt(Math.abs(gap), { compact: true })}
              </span>
            ) : (
              <Delta
                value={gap}
                goodWhenUp={gapGoodWhenUp}
                suffix={t.unit === "pct" ? "pp" : t.unit === "days" ? "d" : t.unit === "ratio" ? "×" : ""}
              />
            )}
          </div>
          <div className="text-right">
            <div className="label-draft mb-0.5">Owner</div>
            <span className="text-[13px] text-ink-soft">{t.owner}</span>
          </div>
        </div>
      </div>
    </Card>
  );
}
