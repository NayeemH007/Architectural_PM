import * as React from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  drafting = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { drafting?: boolean }) {
  return (
    <div
      className={cn(
        "relative rounded-lg border border-line bg-paper shadow-card",
        drafting && "drafting-corners",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-start justify-between gap-3 px-5 pt-4 pb-3", className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("font-display text-[17px] leading-tight text-ink", className)} {...props} />;
}

export function CardKicker({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("label-draft mb-1", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center justify-between gap-2 border-t border-line px-5 py-3", className)}
      {...props}
    />
  );
}
