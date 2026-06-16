import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function PageHeader({
  kicker,
  title,
  description,
  actions,
  className,
}: {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {kicker && <div className="label-draft mb-1.5">{kicker}</div>}
        <h1 className="font-display text-[26px] leading-tight text-ink sm:text-[30px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("", className)}>
      {(title || actions) && (
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            {title && <h2 className="font-display text-lg text-ink">{title}</h2>}
            {description && <p className="mt-0.5 text-sm text-ink-soft">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

/** Standard page padding wrapper with a staggered entrance. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("animate-rise mx-auto w-full max-w-[1320px] px-5 py-6 sm:px-8 sm:py-8", className)}>
      {children}
    </div>
  );
}
