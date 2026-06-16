import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-line-strong bg-paper-2 text-ink-soft",
        blue: "border-blue/20 bg-blue-tint text-blue",
        sage: "border-sage/25 bg-sage-tint text-sage",
        ochre: "border-ochre/25 bg-ochre-tint text-ochre",
        sienna: "border-sienna/25 bg-sienna-tint text-sienna",
        rust: "border-rust/25 bg-rust-tint text-rust",
        ink: "border-ink/15 bg-ink text-paper",
      },
      size: {
        sm: "px-2 py-0.5 text-[11px]",
        md: "px-2.5 py-0.5 text-xs",
      },
    },
    defaultVariants: { tone: "neutral", size: "md" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {
  dot?: boolean;
}

export function Badge({ className, tone, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badge({ tone, size }), className)} {...props}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}
