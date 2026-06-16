import { DatabaseZap, FileQuestion, PlusCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

export function EmptyState({
  icon: Icon = FileQuestion,
  title,
  description,
  action,
  className,
}: {
  icon?: any;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-12 text-center", className)}>
      <div className="mb-3 rounded-full border border-line bg-paper-2 p-3 text-ink-ghost">
        <Icon className="h-5 w-5" />
      </div>
      <h4 className="font-display text-base text-ink">{title}</h4>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-soft">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** The signature "we refuse to fabricate" state. Invites capture instead of guessing. */
export function InsufficientData({
  metric,
  hint,
  onCapture,
  className,
}: {
  metric: string;
  hint?: string;
  onCapture?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-2 rounded-md border border-dashed border-line-strong bg-paper-2 p-4",
        className,
      )}
    >
      <div className="flex items-center gap-2 text-ink-faint">
        <DatabaseZap className="h-4 w-4" />
        <span className="label-draft !text-ink-soft">Insufficient data</span>
      </div>
      <p className="text-sm text-ink-soft">
        <span className="font-medium text-ink">{metric}</span> can't be computed reliably yet —{" "}
        {hint ?? "the underlying records are missing."} We show nothing rather than a fabricated number.
      </p>
      {onCapture && (
        <Button variant="subtle" size="sm" onClick={onCapture}>
          <PlusCircle className="h-4 w-4" />
          Capture the missing data
        </Button>
      )}
    </div>
  );
}
