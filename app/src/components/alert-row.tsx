import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import { relative } from "@/lib/format";
import type { Alert, AlertSeverity } from "@/lib/types";
import { ConfidenceBadge } from "@/components/trust";
import { SourceChip } from "@/components/data-source";

export const ALERT_TONE: Record<
  AlertSeverity,
  { dot: string; icon: any; ring: string; text: string }
> = {
  critical: { dot: "bg-rust", icon: AlertOctagon, ring: "border-l-rust", text: "text-rust" },
  warning: { dot: "bg-ochre", icon: AlertTriangle, ring: "border-l-ochre", text: "text-ochre" },
  info: { dot: "bg-blue", icon: Info, ring: "border-l-blue", text: "text-blue" },
  positive: { dot: "bg-sage", icon: CheckCircle2, ring: "border-l-sage", text: "text-sage" },
};

export function AlertRow({ alert }: { alert: Alert }) {
  const cfg = ALERT_TONE[alert.severity];
  const Icon = cfg.icon;
  return (
    <div className={cn("flex gap-3 border-l-2 bg-paper px-4 py-3", cfg.ring)}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", cfg.text)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-medium text-ink">{alert.title}</h4>
          <span className="shrink-0 text-[11px] text-ink-ghost">{relative(alert.createdAt)}</span>
        </div>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{alert.detail}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <SourceChip name={`${alert.source.sourceName} · ${alert.source.recordRef}`} />
          <ConfidenceBadge level={alert.confidence} />
          {alert.projectId && (
            <Link
              to={`/projects/${alert.projectId}`}
              className="text-[11px] font-medium text-blue hover:underline"
            >
              View project →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
