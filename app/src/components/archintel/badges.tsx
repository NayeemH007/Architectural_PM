import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { PHASE_TEMPLATE } from "@/lib/archintel/data";
import type {
  ApprovalStatusA,
  FileStatus,
  FileStorage,
  PaymentStatusA,
  PhaseStatus,
  ProjectStatusA,
  SubmissionStatus,
  DecisionTypeA,
} from "@/lib/archintel/data";

export const phaseName = (i: number) => PHASE_TEMPLATE[i - 1]?.name ?? `Phase ${i}`;
export const phaseShort = (i: number) => ["Discovery", "Concept", "Design Dev", "Construction Docs"][i - 1] ?? `P${i}`;

const PHASE_CFG: Record<PhaseStatus, { label: string; tone: any }> = {
  not_started: { label: "Not started", tone: "neutral" },
  in_progress: { label: "In progress", tone: "blue" },
  blocked: { label: "Blocked", tone: "rust" },
  complete: { label: "Complete", tone: "sage" },
};
export const PhaseBadge = ({ status }: { status: PhaseStatus }) => (
  <Badge tone={PHASE_CFG[status].tone} size="sm">{PHASE_CFG[status].label}</Badge>
);

const PROJ_CFG: Record<ProjectStatusA, { label: string; tone: any }> = {
  active: { label: "Active", tone: "blue" },
  on_hold: { label: "On hold", tone: "ochre" },
  completed: { label: "Completed", tone: "sage" },
  archived: { label: "Archived", tone: "neutral" },
};
export const ProjectStatusBadge = ({ status }: { status: ProjectStatusA }) => (
  <Badge tone={PROJ_CFG[status].tone} size="sm">{PROJ_CFG[status].label}</Badge>
);

export const HEALTH_CFG: Record<string, { label: string; tone: any; dot: string }> = {
  on_track: { label: "On track", tone: "sage", dot: "bg-sage" },
  watch: { label: "Watch", tone: "ochre", dot: "bg-ochre" },
  at_risk: { label: "At risk", tone: "rust", dot: "bg-rust" },
};
export const HealthBadge = ({ health }: { health: string }) => (
  <Badge tone={HEALTH_CFG[health]?.tone ?? "neutral"} size="sm" dot>{HEALTH_CFG[health]?.label ?? health}</Badge>
);

const FILE_CFG: Record<FileStatus, { label: string; tone: any }> = {
  draft: { label: "Draft", tone: "neutral" },
  shared: { label: "Shared", tone: "blue" },
  approved: { label: "Approved", tone: "sage" },
  superseded: { label: "Superseded", tone: "ochre" },
  archived: { label: "Archived", tone: "neutral" },
};
export const FileStatusBadge = ({ status }: { status: FileStatus }) => (
  <Badge tone={FILE_CFG[status].tone} size="sm">{FILE_CFG[status].label}</Badge>
);

const STORAGE_CFG: Record<FileStorage, { label: string; cls: string }> = {
  local: { label: "Local PC", cls: "text-ochre" },
  gdrive: { label: "Google Drive", cls: "text-blue" },
  archintel: { label: "ArchIntel", cls: "text-sage" },
};
export const StorageChip = ({ storage }: { storage: FileStorage }) => (
  <span className={cn("inline-flex items-center gap-1 rounded border border-line bg-paper-2 px-1.5 py-0.5 text-[11px]", STORAGE_CFG[storage].cls)}>
    <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
    {STORAGE_CFG[storage].label}
  </span>
);

const APPROVAL_CFG: Record<ApprovalStatusA, { label: string; tone: any }> = {
  pending: { label: "Pending review", tone: "ochre" },
  approved: { label: "Approved", tone: "sage" },
  revise: { label: "Sent to revise", tone: "sienna" },
  rejected: { label: "Rejected", tone: "rust" },
};
export const ApprovalStatusBadge = ({ status }: { status: ApprovalStatusA }) => (
  <Badge tone={APPROVAL_CFG[status].tone} size="sm">{APPROVAL_CFG[status].label}</Badge>
);

const SUB_CFG: Record<SubmissionStatus, { label: string; tone: any }> = {
  sent: { label: "Sent", tone: "blue" },
  feedback: { label: "Feedback received", tone: "ochre" },
  revision_requested: { label: "Revision requested", tone: "sienna" },
  approved: { label: "Approved", tone: "sage" },
};
export const SubmissionStatusBadge = ({ status }: { status: SubmissionStatus }) => (
  <Badge tone={SUB_CFG[status].tone} size="sm">{SUB_CFG[status].label}</Badge>
);

const PAY_CFG: Record<PaymentStatusA, { label: string; tone: any }> = {
  pending: { label: "Pending", tone: "neutral" },
  partial: { label: "Partial", tone: "ochre" },
  paid: { label: "Paid", tone: "sage" },
  overdue: { label: "Overdue", tone: "rust" },
};
export const PaymentStatusBadge = ({ status }: { status: PaymentStatusA }) => (
  <Badge tone={PAY_CFG[status].tone} size="sm">{PAY_CFG[status].label}</Badge>
);

const DEC_CFG: Record<DecisionTypeA, { label: string; tone: any }> = {
  layout_freeze: { label: "Layout freeze", tone: "blue" },
  material_lock: { label: "Material lock", tone: "sage" },
  change_request: { label: "Change request", tone: "sienna" },
  decision: { label: "Decision", tone: "neutral" },
};
export const DecisionBadge = ({ type }: { type: DecisionTypeA }) => (
  <Badge tone={DEC_CFG[type].tone} size="sm">{DEC_CFG[type].label}</Badge>
);
