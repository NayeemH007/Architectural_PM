import { Info } from "lucide-react";
import type { Confidence, Metric, Provenance } from "@/lib/types";
import { cn } from "@/lib/cn";
import { shortDate } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const CONFIDENCE: Record<
  Confidence,
  { label: string; tone: string; text: string; bg: string; bars: number }
> = {
  high: { label: "High confidence", tone: "sage", text: "text-sage", bg: "bg-sage", bars: 4 },
  medium: { label: "Medium confidence", tone: "ochre", text: "text-ochre", bg: "bg-ochre", bars: 3 },
  low: { label: "Low confidence", tone: "sienna", text: "text-sienna", bg: "bg-sienna", bars: 2 },
  insufficient: { label: "Insufficient data", tone: "neutral", text: "text-ink-faint", bg: "bg-ink-ghost", bars: 0 },
};

export function ConfidenceMeter({ level, className }: { level: Confidence; className?: string }) {
  const c = CONFIDENCE[level];
  return (
    <span className={cn("inline-flex items-end gap-0.5", className)} title={c.label}>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "w-0.5 rounded-sm",
            i < c.bars ? c.bg : "bg-line-strong",
          )}
          style={{ height: `${5 + i * 2}px` }}
        />
      ))}
    </span>
  );
}

export function ConfidenceBadge({ level, className }: { level: Confidence; className?: string }) {
  const c = CONFIDENCE[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide",
        c.text,
        className,
      )}
    >
      <ConfidenceMeter level={level} />
      {level === "insufficient" ? "No data" : level}
    </span>
  );
}

export function DataCompleteness({
  value,
  className,
  showLabel = true,
}: {
  value: number;
  className?: string;
  showLabel?: boolean;
}) {
  const tone = value >= 75 ? "bg-sage" : value >= 50 ? "bg-ochre" : "bg-sienna";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bone-2">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${value}%` }} />
      </div>
      {showLabel && <span className="label-draft">{value}% data</span>}
    </div>
  );
}

/** "Why this number?" — the anti-hallucination affordance attached to every metric. */
export function ProvenancePopover({
  metric,
  sources,
  trigger,
}: {
  metric?: Metric;
  sources?: Provenance[];
  trigger?: React.ReactNode;
}) {
  const srcs = sources ?? metric?.sources ?? [];
  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger ?? (
          <button className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-0.5 text-[11px] text-ink-faint transition-colors hover:border-blue/40 hover:text-blue">
            <Info className="h-3 w-3" />
            Why this number?
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="label-draft mb-2">Provenance & method</div>
        {metric?.formula && (
          <div className="mb-3 rounded-md bg-paper-2 p-2 font-mono text-[11px] leading-relaxed text-ink-soft">
            {metric.formula}
          </div>
        )}
        {metric && (
          <div className="mb-3 flex items-center justify-between">
            <DataCompleteness value={metric.completeness} />
            <ConfidenceBadge level={metric.confidence} />
          </div>
        )}
        <div className="label-draft mb-1.5">Sources ({srcs.length})</div>
        <ul className="space-y-1.5">
          {srcs.length === 0 && (
            <li className="text-xs text-ink-faint">No linked source records.</li>
          )}
          {srcs.map((s, i) => (
            <li key={i} className="flex items-start justify-between gap-3 text-xs">
              <div>
                <span className="font-medium text-ink">{s.sourceName}</span>
                <span className="ml-1.5 font-mono text-ink-faint">{s.recordRef}</span>
              </div>
              <span className="shrink-0 text-ink-ghost">{shortDate(s.observedAt)}</span>
            </li>
          ))}
        </ul>
        {metric?.note && (
          <div className="mt-3 border-t border-line pt-2 text-xs text-ink-soft">{metric.note}</div>
        )}
        {metric && (
          <div className="mt-2 text-[11px] text-ink-ghost">As of {shortDate(metric.asOf)}</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
