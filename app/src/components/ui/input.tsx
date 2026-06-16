import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-line-strong bg-paper px-3 text-sm text-ink placeholder:text-ink-ghost",
        "focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";

export function SearchInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-ghost" />
      <input
        className="h-9 w-full rounded-md border border-line-strong bg-paper pl-8 pr-3 text-sm text-ink placeholder:text-ink-ghost focus:border-blue focus:outline-none focus:ring-2 focus:ring-blue/15"
        {...props}
      />
    </div>
  );
}
