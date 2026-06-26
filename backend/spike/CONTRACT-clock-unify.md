# CONTRACT — Step 1: Clock Unification (one server `as_of`)

> **Closes F7.** Reviewer-authored build contract (test-first). The BUILDER implements
> the surface below; the reviewer who wrote this MUST NOT implement it (builder ≠ reviewer).
> Code is ground truth — this contract was authored against the LIVE archintel modules,
> not the drifted spec docs.

---

## 0. The problem (THREE date authorities exist today)

The repo has **three independent "today" sources**, and they disagree:

| # | Authority | Site | Value today | Used by |
|---|---|---|---|---|
| A1 | `new Date("2026-06-17")` | `app/src/lib/format.ts:78` (`daysFromNow`) | **2026-06-17** | Dashboard overdue Badge, Finance receivables table |
| A2 | `TODAY = "2026-06-22"` | `app/src/lib/archintel/data.ts:10` | 2026-06-22 | Dashboard header/greeting, Activity grouping |
| A2′ | `TODAY = "2026-06-22"` | `app/src/lib/archintel/aios.ts:14` | 2026-06-22 | Daily brief `date` |
| A2″ | `const TODAY = "2026-06-22"` | `app/src/pages/app/Approvals.tsx:48` (local) | 2026-06-22 | approval decision stamp |
| A3 | **wall clock** `new Date()` | `app/src/lib/format.ts:68` (`relative` → `formatDistanceToNowStrict`) | non-deterministic | `alert-row`, `Automation`, `Topbar` relative timestamps |

The locked oracle (CONTEXT.md) is **`as_of = 2026-06-22`**. The backend already honors it: `mart.days_overdue(due, as_of)` is `IMMUTABLE` and pure (ADVERSARY.md §F7 — HOLDS). The drift is entirely **frontend**.

### 🚩 LOAD-BEARING DEFECT — removing the A1 anchor CHANGES a displayed number

`daysFromNow` anchors **`2026-06-17`**, not the locked `2026-06-22`. Verified arithmetic
(`date-fns differenceInCalendarDays`, pm10 due `2026-06-04`):

```
anchor 2026-06-17 → -13   ⇒ Dashboard Badge renders "13d overdue"
anchor 2026-06-22 → -18   ⇒ Badge SHOULD render "18d overdue"
```

But the live blocker prose (`data.ts:216`) and activity log (`data.ts:419`) hardcode
**"18 days overdue"**. So **the UI is internally inconsistent today**: the computed Badge says
**13d**, the authored prose says **18d**. Unifying to `as_of=2026-06-22` makes the Badge read
**18d** — matching the prose and the backend `mart.days_overdue` oracle. **This is the correct
fix, and it WILL move the displayed number 13 → 18.** Flag it for product (it is the
intended outcome of F7, not a regression).

`relative()` (A3) reads the wall clock — its rendered string changes every day the app is
opened; it is non-deterministic and untestable as-is.

---

## 1. Surface the builder implements

A single injected clock. **No module reads the wall clock for a KPI/aging value.**

### 1.1 New module: `app/src/lib/clock.ts`

```ts
// The ONE frontend clock authority. Mirrors the backend as_of oracle.
export const AS_OF = "2026-06-22T00:00:00.000Z";        // ISO, matches finance.ts/api.ts/aios.ts AS_OF
export const AS_OF_DATE = "2026-06-22";                  // date-only form (replaces both TODAY consts)

/** Calendar days from `asOf` to `iso` (negative = past/overdue). Pure; inject asOf. */
export function daysFrom(iso: string | null | undefined, asOf?: string): number | null;

/** Human "N days ago / in N days" relative to `asOf` — NOT the wall clock. */
export function relativeTo(iso: string | null | undefined, asOf?: string): string;
```

- `asOf` defaults to `AS_OF_DATE` when omitted, so call sites need no change beyond the import.
- `daysFrom` replaces `format.ts:daysFromNow` — **same signature**, anchored to `asOf` (default `2026-06-22`) instead of the literal `new Date("2026-06-17")`.
- `relativeTo` replaces `format.ts:relative` — anchored to `asOf`, deterministic.

### 1.2 Edits to existing modules (treatment per authority)

| Authority | Treatment |
|---|---|
| A1 `format.ts:daysFromNow` | **Replace body** to anchor `AS_OF_DATE` (or re-export `clock.daysFrom`). Delete `new Date("2026-06-17")`. Keep the export name so consumers (Dashboard, Finance) are untouched, OR re-point those 2 imports to `clock.daysFrom`. |
| A3 `format.ts:relative` | **Replace** to delegate to `clock.relativeTo(iso, AS_OF_DATE)`. Delete the wall-clock `formatDistanceToNowStrict(parseISO(iso))` path. |
| A2 `data.ts:TODAY` | **Re-export** `AS_OF_DATE` as `TODAY` (`export { AS_OF_DATE as TODAY } from "@/lib/clock"`) so `Dashboard`/`Activity` imports keep working, OR repoint the imports. Remove the standalone literal. |
| A2′ `aios.ts:TODAY` + `aios.ts:AS_OF` | Replace both with imports from `clock.ts` (`AS_OF_DATE`, `AS_OF`). Remove the two local literals. |
| A2″ `Approvals.tsx:48` local `TODAY` | Replace with `import { AS_OF_DATE as TODAY } from "@/lib/clock"`. Remove the local literal. |

> **Cross-check:** `finance.ts:10` and `api.ts:22` already define `const AS_OF = "2026-06-22T00:00:00.000Z"` locally. Fold these into the `clock.ts` import too, so there is exactly **one** literal `2026-06-22` in the shipped tree (in `clock.ts`).

### 1.3 Integration / render sites (no logic change, import swap only)

- `app/src/pages/app/Dashboard.tsx:408` — `daysFromNow(pay.dueDate)` ⇒ value moves 13→18 (intended).
- `app/src/pages/app/Finance.tsx:585` — `daysFromNow(p.dueDate)` ⇒ same anchor fix.
- `app/src/components/alert-row.tsx:28`, `Automation.tsx:94`, `shell/Topbar.tsx:94` — `relative(...)` becomes deterministic (anchored to `as_of`).
- `Dashboard.tsx:87` `new Date(TODAY)` and `Activity.tsx` `TODAY` math — now read the single `AS_OF_DATE`.

### 1.4 Backend (verify-only — already correct, do NOT rebuild)

`mart.days_overdue(p_due date, p_as_of timestamptz)` (`backend/db/migrations/0002_mart.sql:76`) is
`IMMUTABLE`, `(p_as_of::date - p_due)`, no `now()`. `recompute_portfolio_summary(p_as_of, …)`
threads `p_as_of` through. F7 already HOLDS on the backend (ADVERSARY.md §F7, test `(d)` of the spike
ledger). The builder's job for the backend is **NONE** — only confirm no regression.

---

## 2. Acceptance criteria (the ledger asserts these)

1. **(a) grep-guard** — NO shipped module (`app/src/**`, excluding `__tests__/**` and `clock.ts`) contains a literal date anchor: `2026-06-17`, a standalone `TODAY = "2026-06-22"` const, or `new Date("…")` with a hardcoded date string. The single permitted literal `2026-06-22` lives only in `clock.ts`.
2. **(b) one injected `as_of`** — `daysFrom`/`relativeTo` compute from the injected `asOf`:
   - pinning `2026-06-22` reproduces today's values: pm10 (due `2026-06-04`) ⇒ `daysFrom` = **-18** (Badge "18d overdue"), matching the backend `mart.days_overdue` oracle and the authored prose;
   - advancing to `2026-06-24` ⇒ **-20** (deterministic +2);
   - `relativeTo` is pure (same input + same `asOf` ⇒ same string; never reads `Date.now()`).
3. **(c) backend already threads `as_of`** — assert `mart.days_overdue` exists, is pure, and yields 18@06-22 / 20@06-24 (re-uses the spike oracle). Assert the frontend `daysFromNow`/`TODAY` literals are **slated for removal** (the grep-guard in (a) enforces their absence once the builder lands `clock.ts`).
4. **(d) anchor-move is flagged** — a documentation assertion: the Badge number moves 13→18 when the anchor is corrected; recorded here as the single intended display change.

---

## 3. NEEDS PRODUCT DECISION

| Flag | Question | Options | Recommendation |
|---|---|---|---|
| **`CLOCK_ANCHOR_FIX`** | Correcting `daysFromNow` from `2026-06-17` → `2026-06-22` changes the Dashboard/Finance overdue Badge from **"13d overdue"** to **"18d overdue"**. Ship it? | (a) ship — Badge now matches the authored blocker prose + backend oracle (intended F7 outcome); (b) keep 17th — re-anchor the *prose* to 13d instead. | **(a) ship.** 2026-06-22 is the locked oracle; the 17th anchor is a pre-pivot leftover. The prose and backend already say 18. |
| **`RELATIVE_TIME_SOURCE`** | `relative()` (timestamps on alerts/activity/topbar) reads the wall clock. Anchor to `as_of=2026-06-22`, or leave live-wall-clock for "ambient" UI chrome? | (a) anchor to `as_of` (deterministic, demo-stable, testable); (b) keep wall clock for chrome only, exclude from the grep-guard. | **(a) anchor.** This is a demo/intelligence product; a frozen, reproducible clock is the point (CONTEXT.md: "inject `as_of`, never read the wall clock"). |
| **`CLOCK_INJECTION_SHAPE`** | Should `as_of` be a build-time constant (`clock.ts`) or runtime-injected (env / query param / context) so the demo can "time-travel"? | (a) constant now, refactor later; (b) React context / env now. | **(a) constant now.** Step 1 only unifies; runtime injection is a later concern. The `asOf?` param on `daysFrom`/`relativeTo` already leaves the seam open. |

---

## 4. Out of scope (do NOT touch in Step 1)

- The Metric trust-envelope re-thread (Step 4) — `daysFrom` returns a raw number here, not a `Metric`.
- Backend `mart.*` — verify-only; no migration changes.
- Seam swaps / parity (Step 3). `as_of` constants in `api.ts`/`finance.ts`/`aios.ts` are folded into `clock.ts` only to collapse the literal, not to change served shapes.
