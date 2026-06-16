import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-bone-2", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-lg border border-line bg-paper p-5 shadow-card">
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-2 h-8 w-32" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}
