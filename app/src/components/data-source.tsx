import {
  Banknote,
  Box,
  CalendarClock,
  FolderOpen,
  Landmark,
  MessageSquare,
  PencilLine,
  Ruler,
  Timer,
  Files,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { DataSourceKind, SourceStatus } from "@/lib/types";

export const SOURCE_STATUS: Record<
  SourceStatus,
  { label: string; dot: string; text: string }
> = {
  connected: { label: "Connected", dot: "bg-sage", text: "text-sage" },
  syncing: { label: "Syncing", dot: "bg-blue", text: "text-blue" },
  stale: { label: "Stale", dot: "bg-ochre", text: "text-ochre" },
  error: { label: "Error", dot: "bg-rust", text: "text-rust" },
  manual: { label: "Manual", dot: "bg-sienna", text: "text-sienna" },
  not_connected: { label: "Not connected", dot: "bg-ink-ghost", text: "text-ink-faint" },
};

export const KIND_ICON: Record<DataSourceKind, LucideIcon> = {
  accounting: Banknote,
  bim_cad: Ruler,
  project_mgmt: Box,
  document_mgmt: Files,
  file_storage: FolderOpen,
  communication: MessageSquare,
  time_tracking: Timer,
  calendar: CalendarClock,
  manual_capture: PencilLine,
  authority: Landmark,
};

export function StatusDot({ status, pulse }: { status: SourceStatus; pulse?: boolean }) {
  const s = SOURCE_STATUS[status];
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && status === "syncing" && (
        <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", s.dot)} />
      )}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", s.dot)} />
    </span>
  );
}

/** Small chip indicating where a piece of data came from. */
export function SourceChip({
  name,
  status,
  className,
}: {
  name: string;
  status?: SourceStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border border-line bg-paper-2 px-1.5 py-0.5 text-[11px] text-ink-soft",
        className,
      )}
    >
      {status && <StatusDot status={status} />}
      {name}
    </span>
  );
}
