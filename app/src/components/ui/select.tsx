import * as React from "react";
import * as RS from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className,
  size = "md",
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <RS.Root value={value} onValueChange={onValueChange}>
      <RS.Trigger
        className={cn(
          "inline-flex items-center justify-between gap-2 rounded-md border border-line-strong bg-paper text-ink outline-none",
          "hover:border-ink-ghost focus:border-blue focus:ring-2 focus:ring-blue/15",
          size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3 text-sm",
          className,
        )}
      >
        <RS.Value placeholder={placeholder} />
        <RS.Icon>
          <ChevronDown className="h-4 w-4 text-ink-faint" />
        </RS.Icon>
      </RS.Trigger>
      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          className="z-50 overflow-hidden rounded-lg border border-line bg-paper shadow-pop data-[state=open]:animate-rise"
        >
          <RS.Viewport className="p-1">
            {options.map((o) => (
              <RS.Item
                key={o.value}
                value={o.value}
                className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-1.5 text-sm text-ink-soft outline-none data-[highlighted]:bg-bone-2 data-[highlighted]:text-ink data-[state=checked]:text-ink"
              >
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator>
                  <Check className="h-3.5 w-3.5 text-blue" />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
