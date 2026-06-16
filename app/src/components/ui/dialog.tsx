import * as React from "react";
import * as RD from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

export function DialogContent({
  className,
  children,
  ...props
}: React.ComponentProps<typeof RD.Content>) {
  return (
    <RD.Portal>
      <RD.Overlay className="fixed inset-0 z-50 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-rise" />
      <RD.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2",
          "rounded-xl border border-line bg-paper shadow-pop outline-none data-[state=open]:animate-rise",
          className,
        )}
        {...props}
      >
        {children}
        <RD.Close className="absolute right-4 top-4 rounded-md p-1 text-ink-faint hover:bg-bone-2 hover:text-ink">
          <X className="h-4 w-4" />
        </RD.Close>
      </RD.Content>
    </RD.Portal>
  );
}

export function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-b border-line px-5 py-4", className)} {...props} />;
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof RD.Title>) {
  return <RD.Title className={cn("font-display text-lg text-ink", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof RD.Description>) {
  return <RD.Description className={cn("mt-1 text-sm text-ink-soft", className)} {...props} />;
}
