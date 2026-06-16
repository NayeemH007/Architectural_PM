import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { bdt, num, pct } from "@/lib/format";
import type { Metric } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Sparkline, CHART } from "@/components/charts";
import { ConfidenceMeter, DataCompleteness, ProvenancePopover } from "@/components/trust";
import { Delta } from "@/components/status";

function formatMetric(m: Metric): string {
  if (m.value === null) return "—";
  switch (m.unit) {
    case "bdt":
      return bdt(m.value, { compact: true });
    case "pct":
      return pct(m.value);
    case "score":
      return m.value.toFixed(0);
    case "days":
      return `${m.value > 0 ? "+" : ""}${m.value}d`;
    case "hours":
      return `${num(m.value)}h`;
    case "ratio":
      return `${m.value.toFixed(2)}×`;
    default:
      return num(m.value);
  }
}

export function KpiCard({
  kicker,
  metric,
  value,
  delta,
  deltaGoodWhenUp = true,
  sparkColor,
  footnote,
  className,
  onClick,
}: {
  kicker: string;
  metric?: Metric;
  value?: ReactNode;
  delta?: number | null;
  deltaGoodWhenUp?: boolean;
  sparkColor?: string;
  footnote?: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  const insufficient = metric?.confidence === "insufficient" || metric?.value === null;
  const display = value ?? (metric ? formatMetric(metric) : "—");
  const d = delta ?? metric?.deltaPct ?? null;

  return (
    <Card
      className={cn(
        "flex flex-col p-5 transition-shadow",
        onClick && "cursor-pointer hover:shadow-lift",
        className,
      )}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <span className="label-draft">{kicker}</span>
        {metric && <ConfidenceMeter level={metric.confidence} />}
      </div>

      {insufficient ? (
        <div className="mt-2">
          <div className="font-display text-2xl text-ink-ghost">— —</div>
          <div className="mt-1 text-xs text-ink-faint">
            Insufficient data{metric?.note ? ` · ${metric.note}` : ""}
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <div>
            <div className="font-display text-[28px] leading-none text-ink tnum">{display}</div>
            {d !== null && (
              <div className="mt-1.5">
                <Delta value={d} goodWhenUp={deltaGoodWhenUp} />
                <span className="ml-1 text-xs text-ink-ghost">vs last period</span>
              </div>
            )}
          </div>
          {metric?.trend && metric.trend.length > 1 && (
            <div className="h-9 w-24 shrink-0 opacity-90">
              <Sparkline data={metric.trend} color={sparkColor ?? CHART.blue} />
            </div>
          )}
        </div>
      )}

      {(metric || footnote) && (
        <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
          {metric ? <DataCompleteness value={metric.completeness} /> : <span />}
          {footnote ?? (metric && <ProvenancePopover metric={metric} />)}
        </div>
      )}
    </Card>
  );
}
