import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

const TONES: Record<string, string> = {
  blue: "bg-blue-tint text-blue",
  sienna: "bg-sienna-tint text-sienna",
  sage: "bg-sage-tint text-sage",
  ochre: "bg-ochre-tint text-ochre",
};

export function Avatar({
  name,
  tone = "blue",
  size = "md",
  className,
}: {
  name: string;
  tone?: string;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const dims = size === "xs" ? "h-6 w-6 text-[10px]" : size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-mono font-medium",
        TONES[tone] ?? TONES.blue,
        dims,
        className,
      )}
      title={name}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, tones }: { names: string[]; tones?: string[] }) {
  return (
    <div className="flex -space-x-1.5">
      {names.slice(0, 4).map((n, i) => (
        <Avatar key={n} name={n} tone={tones?.[i] ?? "blue"} size="sm" className="ring-2 ring-paper" />
      ))}
      {names.length > 4 && (
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-bone-2 text-[10px] font-medium text-ink-soft ring-2 ring-paper">
          +{names.length - 4}
        </span>
      )}
    </div>
  );
}
