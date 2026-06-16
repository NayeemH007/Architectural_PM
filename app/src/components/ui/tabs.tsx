import * as React from "react";
import * as RT from "@radix-ui/react-tabs";
import { cn } from "@/lib/cn";

export const Tabs = RT.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof RT.List>) {
  return (
    <RT.List
      className={cn("flex items-center gap-1 border-b border-line", className)}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof RT.Trigger>) {
  return (
    <RT.Trigger
      className={cn(
        "relative -mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-ink-faint transition-colors",
        "hover:text-ink",
        "data-[state=active]:border-blue data-[state=active]:text-ink",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof RT.Content>) {
  return <RT.Content className={cn("mt-5 outline-none", className)} {...props} />;
}
