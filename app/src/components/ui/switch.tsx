import * as React from "react";
import * as RS from "@radix-ui/react-switch";
import { cn } from "@/lib/cn";

export function Switch({ className, ...props }: React.ComponentProps<typeof RS.Root>) {
  return (
    <RS.Root
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full border border-line-strong bg-bone-2 transition-colors outline-none",
        "data-[state=checked]:border-blue data-[state=checked]:bg-blue",
        "focus-visible:ring-2 focus-visible:ring-blue/30",
        className,
      )}
      {...props}
    >
      <RS.Thumb className="block h-4 w-4 translate-x-0.5 rounded-full bg-paper shadow-sm transition-transform data-[state=checked]:translate-x-4" />
    </RS.Root>
  );
}
