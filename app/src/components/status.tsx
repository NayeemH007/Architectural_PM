import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import type {
  ApprovalStatus,
  DeliverableStatus,
  HealthBand,
  MilestoneStatus,
  ProjectStage,
  ProjectType,
} from "@/lib/types";

export const HEALTH: Record<HealthBand, { label: string; tone: any }> = {
  healthy: { label: "Healthy", tone: "sage" },
  watch: { label: "Watch", tone: "ochre" },
  at_risk: { label: "At risk", tone: "sienna" },
  critical: { label: "Critical", tone: "rust" },
};

export function HealthBadge({ band, size = "md" }: { band: HealthBand; size?: "sm" | "md" }) {
  return (
    <Badge tone={HEALTH[band].tone} size={size} dot>
      {HEALTH[band].label}
    </Badge>
  );
}

export const STAGE_LABELS: Record<ProjectStage, string> = {
  concept: "Concept",
  schematic: "Schematic",
  design_dev: "Design Dev",
  authority_approval: "Authority Approval",
  construction_docs: "Construction Docs",
  tender: "Tender",
  construction_admin: "Construction Admin",
  handover: "Handover",
  on_hold: "On Hold",
  closed: "Closed",
};

export const STAGE_ORDER: ProjectStage[] = [
  "concept",
  "schematic",
  "design_dev",
  "authority_approval",
  "construction_docs",
  "tender",
  "construction_admin",
  "handover",
];

export const TYPE_LABELS: Record<ProjectType, string> = {
  residential: "Residential",
  commercial: "Commercial",
  mixed_use: "Mixed-use",
  interior: "Interior",
  institutional: "Institutional",
  industrial: "Industrial",
  planning: "Planning",
};

const APPROVAL_CFG: Record<ApprovalStatus, { label: string; tone: any }> = {
  not_started: { label: "Not started", tone: "neutral" },
  preparing: { label: "Preparing", tone: "neutral" },
  submitted: { label: "Submitted", tone: "blue" },
  in_review: { label: "In review", tone: "ochre" },
  query_raised: { label: "Query raised", tone: "sienna" },
  approved: { label: "Approved", tone: "sage" },
  rejected: { label: "Rejected", tone: "rust" },
};
export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  return <Badge tone={APPROVAL_CFG[status].tone}>{APPROVAL_CFG[status].label}</Badge>;
}

const MILESTONE_CFG: Record<MilestoneStatus, { label: string; tone: any }> = {
  done: { label: "Done", tone: "sage" },
  due_soon: { label: "Due soon", tone: "ochre" },
  overdue: { label: "Overdue", tone: "rust" },
  upcoming: { label: "Upcoming", tone: "neutral" },
  blocked: { label: "Blocked", tone: "sienna" },
};
export function MilestoneBadge({ status }: { status: MilestoneStatus }) {
  return <Badge tone={MILESTONE_CFG[status].tone}>{MILESTONE_CFG[status].label}</Badge>;
}

const DELIVERABLE_CFG: Record<DeliverableStatus, { label: string; tone: any }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "blue" },
  internal_review: { label: "Internal review", tone: "ochre" },
  issued: { label: "Issued", tone: "sage" },
  approved: { label: "Approved", tone: "sage" },
  revise: { label: "Revise", tone: "sienna" },
};
export function DeliverableBadge({ status }: { status: DeliverableStatus }) {
  return <Badge tone={DELIVERABLE_CFG[status].tone}>{DELIVERABLE_CFG[status].label}</Badge>;
}

/** Period-over-period delta. `goodWhenUp` flips the color logic for cost-like metrics. */
export function Delta({
  value,
  goodWhenUp = true,
  suffix = "%",
  className,
}: {
  value?: number | null;
  goodWhenUp?: boolean;
  suffix?: string;
  className?: string;
}) {
  if (value === null || value === undefined) return null;
  const up = value > 0;
  const good = goodWhenUp ? up : !up;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-[13px] font-medium tnum",
        value === 0 ? "text-ink-faint" : good ? "text-sage" : "text-rust",
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {value > 0 ? "+" : ""}
      {value}
      {suffix}
    </span>
  );
}
