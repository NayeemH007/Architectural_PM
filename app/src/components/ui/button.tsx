import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const button = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all disabled:pointer-events-none disabled:opacity-50 active:translate-y-px select-none",
  {
    variants: {
      variant: {
        primary: "bg-blue text-paper hover:bg-blue-bright shadow-card",
        sienna: "bg-sienna text-paper hover:bg-sienna-bright shadow-card",
        outline: "border border-line-strong bg-paper text-ink hover:bg-paper-2 hover:border-ink-ghost",
        ghost: "text-ink-soft hover:bg-bone-2 hover:text-ink",
        subtle: "bg-blue-tint text-blue hover:bg-blue-ghost",
        danger: "bg-rust text-paper hover:opacity-90",
      },
      size: {
        sm: "h-8 rounded-md px-3 text-[13px]",
        md: "h-9 rounded-md px-4 text-sm",
        lg: "h-11 rounded-md px-5 text-[15px]",
        icon: "h-9 w-9 rounded-md",
        iconSm: "h-7 w-7 rounded",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(button({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
