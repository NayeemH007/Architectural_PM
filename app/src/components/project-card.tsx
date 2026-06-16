import { Link } from "react-router-dom";
import { CalendarClock, Landmark, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { bdt, pct } from "@/lib/format";
import type { Project } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { HealthBadge, STAGE_LABELS, TYPE_LABELS } from "@/components/status";
import { StatusDot } from "@/components/data-source";

const HEALTH_BAR: Record<string, string> = {
  healthy: "sage",
  watch: "ochre",
  at_risk: "sienna",
  critical: "rust",
};

export function ProjectCard({ p }: { p: Project }) {
  const collectedPct = p.feeContract > 0 ? (p.feeCollected / p.feeContract) * 100 : 0;
  return (
    <Link to={`/projects/${p.id}`}>
      <Card className="group h-full p-4 transition-shadow hover:shadow-lift">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="label-draft">{p.code}</div>
            <h3 className="mt-0.5 truncate font-display text-[16px] text-ink group-hover:text-blue">{p.name}</h3>
            <div className="mt-0.5 truncate text-xs text-ink-soft">{p.client}</div>
          </div>
          <HealthBadge band={p.health} size="sm" />
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <span className="rounded border border-line bg-paper-2 px-1.5 py-0.5 text-[11px] text-ink-soft">
            {TYPE_LABELS[p.type]}
          </span>
          <span className="rounded border border-line bg-paper-2 px-1.5 py-0.5 text-[11px] text-ink-soft">
            {STAGE_LABELS[p.stage]}
          </span>
        </div>

        {/* health + complete */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="label-draft">Health</span>
              <span className="font-display text-base text-ink tnum">
                {p.healthScore.value ?? "—"}
              </span>
            </div>
            <Progress value={p.healthScore.value ?? 0} tone={HEALTH_BAR[p.health] as any} className="mt-1.5" />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <span className="label-draft">Complete</span>
              <span className="font-display text-base text-ink tnum">{p.pctComplete}%</span>
            </div>
            <Progress value={p.pctComplete} tone="blue" className="mt-1.5" />
          </div>
        </div>

        {/* footer stats */}
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs">
          <div>
            <div className="text-ink-soft">
              <span className="font-medium text-ink tnum">{bdt(p.feeCollected, { compact: true })}</span>
              <span className="text-ink-ghost"> / {bdt(p.feeContract, { compact: true })}</span>
            </div>
            <div className="label-draft mt-0.5 !text-[10px]">collected {pct(collectedPct)}</div>
          </div>
          <div className="flex items-center gap-2.5 text-ink-faint">
            {p.scheduleVarianceDays < 0 && (
              <span className="flex items-center gap-1 text-sienna" title="Schedule variance">
                <CalendarClock className="h-3.5 w-3.5" />
                {p.scheduleVarianceDays}d
              </span>
            )}
            {p.openApprovals > 0 && (
              <span className="flex items-center gap-1" title="Open approvals">
                <Landmark className="h-3.5 w-3.5" />
                {p.openApprovals}
              </span>
            )}
            {p.openRisks > 0 && (
              <span className="flex items-center gap-1" title="Open risks">
                <TriangleAlert className="h-3.5 w-3.5" />
                {p.openRisks}
              </span>
            )}
          </div>
        </div>

        {/* source dots */}
        <div className="mt-3 flex items-center gap-1.5">
          {p.crossRefs.map((x) => (
            <span key={x.sourceId} title={`${x.sourceName}: ${x.alias}`}>
              <StatusDot status={x.matched ? "connected" : "manual"} />
            </span>
          ))}
          <span className="label-draft ml-1 !text-[10px]">{p.completeness}% data</span>
        </div>
      </Card>
    </Link>
  );
}
