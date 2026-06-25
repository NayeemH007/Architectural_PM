# Slice 2a BUILD-CONTRACT — overdueAmount becomes a cited Metric at the app surface

> **Reviewer-authored. Builder ≠ reviewer.** The acceptance ledger
> `app/src/lib/archintel/__tests__/overview-metric.test.ts` is RED today
> (6 fail / 1 pass). This file tells the **builder** exactly what to change so
> it goes GREEN — **without** the reviewer implementing it.
>
> **Builder edits:** `app/src/lib/archintel/api.ts` (and only that, plus the one
> Dashboard re-thread below). Builder MUST NOT edit the `__tests__/` ledger,
> `vitest.config.ts`, `types.ts`, or the trust components.

---

## What this slice closes

Adversary gap **G1** (high): `managementOverview().overdueAmount` is served as a
**bare number** (`api.ts:42,52`), so promise ① ("every number cites its source,
drillable") holds at the DB table but **NOT at the app surface**. Also subsumes
the ⑤ tax-honesty stamp (no `confidence='low'` / gross note on the figure).

This slice closes the **visible half**: the live React tree consumes
`overdueAmount` as a `Metric{}` and renders its `ProvenancePopover`.

**SCOPE BOUNDARY:** Data still comes from the in-process mock arrays
(`app/src/lib/archintel/data.ts`) via the existing `resolve()` seam. Only the
**shape** changes — `overdueAmount` goes from `number` → `Metric{}` whose
`sources[]` are **real record refs** to the overdue payment milestones. Swapping
the DATA source to the pglite / `kpi_lineage` backend over HTTP is **Slice 2b**.
**DO NOT** add an HTTP server or `fetch` here.

---

## §1 — The change: `managementOverview().overdueAmount` → `Metric`

Today (`app/src/lib/archintel/api.ts:41-42, 52`):

```ts
const overdue = payments.filter((p) => p.status === "overdue");
const overdueAmount = overdue.reduce((s, p) => s + (p.amount - p.receivedAmount), 0);
// ...
return { ..., overdueAmount, ... };   // ← bare number
```

Target — build a `Metric` envelope (mirror the live `Metric`/`Provenance` shapes
in `app/src/lib/types.ts:41-62`; do NOT reinvent):

```ts
import type { Metric, Provenance } from "@/lib/types";

const AS_OF = "2026-06-22T00:00:00.000Z"; // locked clock oracle (CONTEXT.md). Inject, do not read wall clock.

const overdue = payments.filter((p) => p.status === "overdue");

// one Provenance per overdue milestone — REAL refs into TallyPrime
const overdueSources: Provenance[] = overdue.map((pm) => ({
  sourceId: "tally",                       // stable source id
  sourceName: "TallyPrime",                // the accounting system of record
  recordRef: `tally:${pm.id}`,             // e.g. "tally:pm10" — drillable, contains the real milestone id
  observedAt: pm.dueDate,                  // when the fact (the unpaid milestone) was true
  // ingestedAt optional
}));

const grossOverdue = overdue.reduce((s, p) => s + (p.amount - p.receivedAmount), 0);

const overdueAmount: Metric = {
  value: grossOverdue,                     // == Σ (amount - receivedAmount) over overdue milestones
  unit: "bdt",
  label: "Overdue payments (gross)",
  confidence: "low",                       // ⑤ tax DEFERRED → gross figure is low-trust
  completeness: 100,                       // fully known at the milestone grain (it is gross-complete, not net)
  asOf: AS_OF,
  formula: "Σ (gross_amount − received_amount) over status='overdue' milestones",
  note: "Gross face value — withholding (VAT/VDS/AIT) not modeled.",
  sources: overdueSources,
};
// ...
return { ..., overdueAmount, ... };        // ← now a Metric{}
```

### Required envelope (what the ledger asserts)

| field          | value / rule                                                                 | ledger assertion |
|----------------|------------------------------------------------------------------------------|------------------|
| `value`        | `Σ (amount − receivedAmount)` over `status==='overdue'` payments (≠ literal) | `[①]` value === EXPECTED_GROSS (930000 today, but **recomputed**, not hardcoded) |
| `unit`         | `'bdt'`                                                                       | trust-metadata test |
| `label`        | non-empty string                                                             | trust-metadata test |
| `confidence`   | `'low'`                                                                       | `[⑤ tax-honesty]` |
| `note`         | string matching `/gross|withhold/i`                                          | `[⑤ tax-honesty]` |
| `completeness` | a `number`                                                                    | trust-metadata test |
| `asOf`         | non-empty ISO string (use the locked `2026-06-22` oracle — do NOT read wall clock) | trust-metadata test + determinism |
| `sources`      | `Provenance[]`, length === number of overdue milestones; each `recordRef` contains the milestone id (`'tally:pm10'`); each has `sourceId`, `sourceName`, `observedAt` | `[① drillable]` + `[① VALUE = Σ LINEAGE]` |

`value` MUST be reconstructable from the milestones the `sources` cite
(`[① VALUE = Σ LINEAGE]`): summing `(amount − receivedAmount)` over each overdue
payment a source points at must equal `value`. This is the same VALUE = Σ LINEAGE
invariant the DB spike proved — now enforced at the served payload.

> Mirrors `backend/spike/BUILD-CONTRACT.md §3 serializeOverview` so Slice 2b's
> backend swap is drop-in: 2b's `serializeOverview(row, principal)` returns the
> identical `Metric{value,unit,label,confidence,completeness,asOf,formula,note,sources[]}`
> envelope, fed by `kpi_lineage` instead of the mock `payments` array. The React
> consumer (KpiCard `metric=`) does not change between 2a and 2b.

---

## §2 — Re-thread the Dashboard overdue KpiCard

**File:** `app/src/pages/app/Dashboard.tsx:207-215` (the "Overdue payments" KpiCard).

Today it renders the **count** as `value` and the **amount** as a footnote string:

```tsx
<KpiCard
  kicker="Overdue payments"
  value={overview.overdueCount}
  footnote={
    <span className="text-xs text-rust tnum">
      {bdt(overview.overdueAmount, { compact: true })} outstanding   // ← line 212: bare-number consumer
    </span>
  }
/>
```

Re-thread so the amount Metric drives the card (so `ConfidenceMeter` +
`DataCompleteness` + `ProvenancePopover` render). `KpiCard` already renders the
popover **only when `metric` is truthy** (`kpi-card.tsx:66,97-98`). Bind
`metric={overview.overdueAmount}`:

```tsx
<KpiCard
  kicker="Overdue payments"
  metric={overview.overdueAmount}        // ← Metric drives value display + confidence meter + provenance popover
  footnote={
    <span className="text-xs text-rust tnum">
      {overview.overdueCount} milestone{overview.overdueCount === 1 ? "" : "s"} outstanding
    </span>
  }
/>
```

Notes for the builder:
- `KpiCard` formats a `unit:'bdt'` metric via `bdt(value,{compact:true})`
  (`kpi-card.tsx:13-14`) — so the displayed amount stays `৳9.30 L`-style. The
  raw `bdt(overview.overdueAmount, ...)` call at **line 212 MUST be removed**:
  `overview.overdueAmount` is no longer a number and `bdt()` would render `—`.
- The overdue **count** that used to be `value` moves to the footnote (or pick
  another placement) so the card still surfaces both signals. Keep it a number
  (`overview.overdueCount` is unchanged).
- Do NOT add a `value=` prop alongside `metric=` for this card — `value` wins
  over `metric` for the display (`kpi-card.tsx:52`), which would suppress the
  formatted Metric value.

---

## §3 — Every consumer of `managementOverview().overdueAmount` (so nothing breaks)

Grepped `overdueAmount` across `app/`:

| file:line                                   | role           | action |
|---------------------------------------------|----------------|--------|
| `app/src/lib/archintel/api.ts:42`           | **producer** (computes the sum) | rewrite to build the `Metric` (§1) |
| `app/src/lib/archintel/api.ts:52`           | **producer** (returns it in the object) | unchanged key name; now returns `Metric` |
| `app/src/pages/app/Dashboard.tsx:212`       | **sole render consumer** (`bdt(overview.overdueAmount,...)`) | re-thread to `metric={overview.overdueAmount}` (§2); remove the `bdt(...)` call |

There are **no other consumers** — only these three sites touch
`overdueAmount`. The `ai-overview` query key is unchanged (`api.ts:82`); the
`useAiOverview` hook and `resolve()` seam are untouched. The Dashboard's separate
**overdue-payments list** (`Dashboard.tsx:407-450`) computes
`pay.amount - pay.receivedAmount` per-row from `useAiPayments()` directly — it
does NOT read `overview.overdueAmount`, so it is unaffected.

---

## §C — MANUAL / screenshot GATE (builder + adversary)

The **ProvenancePopover render** is NOT a unit test (RTL/jsdom is out of scope
for 2a). It is a manual gate the builder and adversary confirm:

1. `pnpm --dir app dev`
2. Open the Dashboard.
3. On the **"Overdue payments"** KpiCard, confirm all of:
   - the **ConfidenceMeter** shows 2 bars (`low` → `bg-sienna`, `kpi-card.tsx:66`);
   - the **DataCompleteness** bar + `% data` is shown (`kpi-card.tsx:97`);
   - the **"Why this number?"** button appears (`kpi-card.tsx:98`) and, on click,
     the popover lists the real source ref(s) — e.g. **TallyPrime · `tally:pm10`**
     with the observed date — plus the formula and the gross/withholding note.
4. Screenshot for the adversary sign-off.

Acceptance for the slice = **ledger GREEN** (`pnpm --dir app test`) **AND** the
manual popover gate passes.

---

## Test runner notes (already set up by the reviewer)

- `vitest` added as a devDependency to `app/`.
- `app/vitest.config.ts` is **separate** from `app/vite.config.ts` (build/dev
  untouched). Node environment, re-uses the `@` alias, scopes to
  `src/**/__tests__/**/*.test.ts`.
- `pnpm --dir app test` → `vitest run`. `pnpm --dir app test:watch` → watch.
- Determinism: the ledger recomputes `EXPECTED_GROSS` from the same `payments`
  array the producer reads and asserts `value === Σ`, so a hardcoded literal
  cannot satisfy it. No wall-clock reads (`asOf` is the injected `2026-06-22`).
