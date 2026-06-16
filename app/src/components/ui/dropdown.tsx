import * as React from "react";
import * as RD from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/cn";

export const Dropdown = RD.Root;
export const DropdownTrigger = RD.Trigger;

export function DropdownContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof RD.Content>) {
  return (
    <RD.Portal>
      <RD.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 min-w-44 rounded-lg border border-line bg-paper p-1 shadow-pop outline-none",
          "data-[state=open]:animate-rise",
          className,
        )}
        {...props}
      />
    </RD.Portal>
  );
}

export function DropdownItem({ className, ...props }: React.ComponentProps<typeof RD.Item>) {
  return (
    <RD.Item
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-ink-soft outline-none",
        "data-[highlighted]:bg-bone-2 data-[highlighted]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownLabel({ className, ...props }: React.ComponentProps<typeof RD.Label>) {
  return <RD.Label className={cn("label-draft px-2.5 py-1.5", className)} {...props} />;
}

export function DropdownSeparator({ className, ...props }: React.ComponentProps<typeof RD.Separator>) {
  return <RD.Separator className={cn("my-1 h-px bg-line", className)} {...props} />;
}
