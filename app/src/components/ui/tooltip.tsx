import * as React from "react";
import * as RT from "@radix-ui/react-tooltip";
import { cn } from "@/lib/cn";

export const TooltipProvider = RT.Provider;

export function Tooltip({
  children,
  content,
  side = "top",
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  className?: string;
}) {
  return (
    <RT.Root delayDuration={150}>
      <RT.Trigger asChild>{children}</RT.Trigger>
      <RT.Portal>
        <RT.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 max-w-xs rounded-md bg-ink px-2.5 py-1.5 text-xs text-paper shadow-pop",
            "data-[state=delayed-open]:animate-rise",
            className,
          )}
        >
          {content}
          <RT.Arrow className="fill-ink" />
        </RT.Content>
      </RT.Portal>
    </RT.Root>
  );
}
