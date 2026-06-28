import { format, parseISO } from "date-fns";
import { daysFrom, relativeTo, AS_OF_DATE } from "@/lib/clock";

/** Format a BDT amount. Large values compact to lakh/crore-friendly K/M. */
export function bdt(
  value: number | null | undefined,
  opts: { compact?: boolean; decimals?: number } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const { compact = false, decimals } = opts;
  if (compact) {
    const abs = Math.abs(value);
    const sign = value < 0 ? "-" : "";
    if (abs >= 10_000_000) return `${sign}৳${(abs / 10_000_000).toFixed(2)} Cr`;
    if (abs >= 100_000) return `${sign}৳${(abs / 100_000).toFixed(2)} L`;
    if (abs >= 1_000) return `${sign}৳${(abs / 1_000).toFixed(1)}k`;
    return `${sign}৳${abs.toFixed(0)}`;
  }
  return `৳${value.toLocaleString("en-IN", {
    minimumFractionDigits: decimals ?? 0,
    maximumFractionDigits: decimals ?? 0,
  })}`;
}

/** Plain compact number. */
export function num(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function pct(
  value: number | null | undefined,
  { decimals = 0, signed = false }: { decimals?: number; signed?: boolean } = {},
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const s = signed && value > 0 ? "+" : "";
  return `${s}${value.toFixed(decimals)}%`;
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM yyyy");
  } catch {
    return "—";
  }
}

export function compactDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "d MMM");
  } catch {
    return "—";
  }
}

/** Human relative time anchored to the locked `as_of` (NOT the wall clock). */
export function relative(iso: string | null | undefined): string {
  return relativeTo(iso, AS_OF_DATE);
}

/** Days from the locked `as_of` (negative = overdue / in the past). */
export function daysFromNow(iso: string | null | undefined): number | null {
  return daysFrom(iso, AS_OF_DATE);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
