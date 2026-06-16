import { cn } from "@/lib/cn";

const TONES: Record<string, string> = {
  blue: "bg-blue",
  sage: "bg-sage",
  ochre: "bg-ochre",
  sienna: "bg-sienna",
  rust: "bg-rust",
  ink: "bg-ink",
};

export function Progress({
  value,
  tone = "blue",
  className,
  trackClassName,
}: {
  value: number; // 0–100
  tone?: keyof typeof TONES;
  className?: string;
  trackClassName?: string;
}) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-bone-2", trackClassName)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", TONES[tone], className)}
        style={{ width: `${v}%` }}
      />
    </div>
  );
}
