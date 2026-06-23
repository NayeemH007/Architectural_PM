import { Check, Clock, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { Sparkline, CHART } from "@/components/charts";
import type { AiosKpi } from "@/lib/archintel/aios";

/** Small marker threaded through the app where the AI operating layer acted. */
export function AgentChip({
  variant = "done",
  label,
  className,
}: {
  variant?: "done" | "pending";
  label?: string;
  className?: string;
}) {
  const done = variant === "done";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        done ? "border-sage/30 bg-sage-tint text-sage" : "border-ochre/30 bg-ochre-tint text-ochre",
        className,
      )}
    >
      {done ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
      {label ?? (done ? "AI handled" : "Needs your approval")}
    </span>
  );
}

export function AgentBadgeInline({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 text-[11px] font-medium text-blue", className)}>
      <Sparkles className="h-3 w-3" /> ArchIntel AI
    </span>
  );
}

function fmt(k: AiosKpi) {
  return k.unit === "pct" ? `${k.value}%` : `${k.value.toFixed(1)}×`;
}

/** The 3 AIOS KPIs: studio autonomy · coordination automated · output per designer. */
export function AiosKpiStrip({ kpis }: { kpis: AiosKpi[] }) {
  const tone = ["sage", "blue", "ochre"];
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {kpis.map((k, i) => (
        <Card key={k.key} className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="label-draft">{k.label}</div>
            <span className="label-draft !text-[9px]">target {k.unit === "pct" ? `${k.target}%` : `${k.target}×`}</span>
          </div>
          <div className="mt-1 flex items-end justify-between gap-3">
            <div className="font-display text-[26px] leading-none text-ink tnum">{fmt(k)}</div>
            <div className="h-8 w-20 shrink-0 opacity-90">
              <Sparkline data={k.trend} color={CHART[tone[i] as "sage" | "blue" | "ochre"]} />
            </div>
          </div>
          <p className="mt-2 text-[11px] leading-snug text-ink-faint">{k.sub}</p>
        </Card>
      ))}
    </div>
  );
}
