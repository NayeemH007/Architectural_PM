import * as React from "react";
import * as RP from "@radix-ui/react-popover";
import { cn } from "@/lib/cn";

export const Popover = RP.Root;
export const PopoverTrigger = RP.Trigger;
export const PopoverAnchor = RP.Anchor;

export function PopoverContent({
  className,
  align = "center",
  sideOffset = 8,
  children,
  ...props
}: React.ComponentProps<typeof RP.Content>) {
  return (
    <RP.Portal>
      <RP.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-lg border border-line bg-paper p-3 shadow-pop outline-none",
          "data-[state=open]:animate-rise",
          className,
        )}
        {...props}
      >
        {children}
      </RP.Content>
    </RP.Portal>
  );
}
