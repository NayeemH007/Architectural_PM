// ============================================================
// The ONE frontend clock authority. Mirrors the backend `as_of`
// oracle (CONTEXT.md ⑤ — single clock as_of=2026-06-22). Inject
// `as_of`; NEVER read the wall clock for a KPI / aging value.
//
// This is the SOLE permitted home of the literal `2026-06-22` in
// the shipped tree (see clock-unify grep-guard). All other modules
// import AS_OF / AS_OF_DATE / daysFrom / relativeTo from here.
// ============================================================
import { differenceInCalendarDays, formatDistanceStrict, parseISO } from "date-fns";

/** ISO form of the locked oracle. Matches the former finance.ts/api.ts/aios.ts AS_OF. */
export const AS_OF = "2026-06-22T00:00:00.000Z";
/** Date-only form (replaces the former TODAY consts in data.ts/aios.ts/Approvals.tsx). */
export const AS_OF_DATE = "2026-06-22";

/** Calendar days from `asOf` to `iso` (negative = past / overdue). Pure; inject `asOf`. */
export function daysFrom(
  iso: string | null | undefined,
  asOf: string = AS_OF_DATE,
): number | null {
  if (!iso) return null;
  try {
    return differenceInCalendarDays(parseISO(iso), parseISO(asOf));
  } catch {
    return null;
  }
}

/**
 * Human "N days ago / in N days" relative to `asOf` — NOT the wall clock.
 * Deterministic: same (iso, asOf) always yields the same string.
 */
export function relativeTo(
  iso: string | null | undefined,
  asOf: string = AS_OF_DATE,
): string {
  if (!iso) return "—";
  try {
    return `${formatDistanceStrict(parseISO(iso), parseISO(asOf), { addSuffix: true })}`;
  } catch {
    return "—";
  }
}
