# ADVERSARY VERDICT — S0 contract-guard (contract-drift CI guard)

**Subsystem:** S0-contract-guard — `queryKey → endpoint → shape` manifest + shape-diff guard.
**Contract:** `backend/spike/CONTRACT-contract-ci-and-prod-port.md`
**Ledger:** `app/src/lib/archintel/__tests__/contract-ci-and-prod-port.design.test.ts`
**Files under test:** `app/src/lib/archintel/contract/{shape.ts,manifest.ts}`, `app/package.json`
**Reviewer:** independent adversary (did NOT build it).
**Date:** 2026-06-26.

## VERDICT: HOLDS (ship). No blocking gap. Two low-severity residual gaps, both inherited from the CONTRACT §2 spec (not builder defects).

---

## Baseline re-run (builder honesty confirmed)

- `pnpm --dir app test` → **6 files / 57 tests GREEN** (matches builder's claim of 57).
- Contract ledger alone → **8/8 GREEN** (`pnpm exec vitest run …contract-ci-and-prod-port.design.test.ts`).
- `pnpm --dir app build` (vite) → **EXIT 0**, built in 18.5s.
- Edit scope honored: `package.json` diff is exactly the `+"contract": "vitest run …"` line; `contract/` holds exactly the two declared modules (`shape.ts`, `manifest.ts`); the RED ledger, `types.ts`, `serialize.mjs`, and the other `__tests__/*` are untouched by this work.

Builder's report is **honest**.

## Manifest coverage (verified empirically, not from the doc table)

Dumped `describeShape(producer())` for all 10 keys. Coverage is exact — 6 ai-* + 4 aios-*, each with `queryKey → /api/v1/* endpoint → runtime ∈ {pglite,fastapi}`. No endpoint silently uncovered; `HEADLINE_KEYS` set equals the ledger's. Live-confirmed leaf kinds:

- `ai-overview`: `overdueAmount`, `pendingApprovals`, `collectionRate` = **metric** leaves; `overdueCount`/`activeCount`/`totalContract` etc. = **number**. The guard tells them apart (the ① regression target).
- `ai-finance`: 11 **metric** leaves.
- `ai-profit`: array of object with `margin` = **metric** leaf, rest number/object.
- `aios-kpis`: **metric[]** (AiosKpi carries value+confidence+sources, incl. the `autonomy` refusal with `value:null` which stays a metric — envelope is the contract).
- `ai-expcat`/`ai-stagerisk`/`ai-insights`/`aios-audit`/`aios-brief`/`aios-actions`: plain object/array shapes as specified.

## ATTACKS RUN (all behaved correctly)

| # | Attack | Result |
|---|---|---|
| A1 | Nested finance metric (`overdue`) demoted to number | **CAUGHT** — `path:overdue, metric→number` |
| A2 | `aios-kpis` metric[] stripped of `sources` → plain array | **CAUGHT** — `(root) metric[]→array` |
| A3 | Array-element field (`profit[].margin`) demoted metric→number | **CAUGHT** — `path:[].margin` |
| A4 | Extra key injected into served overview | **CAUGHT** — `extra key 'sneaky'` |
| A5 | `assertContract({})` (every endpoint vanished) | **THROWS** (iterates CONTRACT, not input — no silent skip) |
| A6 | `ai-profit` served as `[]` vs rich manifest | **CAUGHT** — all element keys reported missing |
| A7 | Metric inner `value` flipped number→null | `[]` (correct **by design** — §2: don't descend into the envelope) |
| A8 | `overdueAmount` `sources` stripped → value+confidence only | **CAUGHT** — `metric→object` |
| ledger-① | `overdueAmount` → bare number `930000` | **THROWS naming `ai-overview`** |
| ledger-missing | drop `overdueAmount` | diff contains `overdueAmount` |

Metric-predicate divergence (builder flagged as intentional): the guard's `isMetricValue` requires **value+confidence+sources**, stricter than `serialize.mjs:isMetric` (value+confidence). Confirmed self-consistent and correct here — it keeps RiskLikelihood bands (`{band,basis,confidence}`, no sources) as plain objects while AiosKpi is a metric. Mirrors `types.ts:50-62` (Metric.sources is required). Not a gap.

## RANKED RESIDUAL GAPS

1. **[LOW] Array endpoints are sampled by element[0] only.** `describeShape(array)` derives the element shape from the FIRST element (`first ?? {}`). A metric demotion or key drift that appears on the **second-or-later row only** of `ai-profit`/`ai-stagerisk`/`ai-insights`/`aios-audit`/`aios-kpis`/`aios-actions` produces an empty diff and passes silently (verified: corrupting `profit[1].margin` → `[]`). Real-world severity is low — a backend serializer drift normally affects all rows uniformly, so row[0] catches it; only heterogeneous per-row drift is uncaught. This is the CONTRACT §2 spec (`describeShape(first ?? {})`), so it is a **spec limitation the builder implemented faithfully**, not a builder defect. *Owner: contract author (tighten §2 to scan all elements, or sample first+last+a-random row).*

2. **[LOW] Empty non-metric array vs rich manifest is undetectable for the array-of-object case.** `aios-kpis` (metric[]) catches an empty `[]` (array≠metric[], A6/G1). But an array-of-**plain-object** endpoint (`ai-profit`, `ai-expcat`, …) served as `[]` yields `{kind:array,element:object}` for both manifest-empty and served-empty in the degenerate `[]`-vs-`[]` case, so a backend that returns an empty list where rows are expected would not be flagged by shape alone (it is not a shape drift — it's an emptiness/row-count concern out of scope for a shape guard). *Owner: contract author — out of scope for a structural guard; note for the live layer-2 cross-check (§3) to add a non-empty assertion.*

3. **[INFO, not a gap] Layer-2 live cross-check (`app/scripts/contract-check.mjs`) is not built.** CONTRACT §3 marks it OPTIONAL and PD-3 recommends static-only in CI; only `/api/v1/overview` is served today. Correctly deferred. The static ledger (the shipped layer) is the gate that fails the next drift.

## SIGN-OFF

The guard delivers every promise the contract pins: it detects a served payload missing a manifest key, a Metric demoted to a bare number (promise ① regression), extra keys, kind mismatches, and a vanished endpoint — throwing a readable error naming the diverging `queryKey` — and returns clean on exact match. Manifest covers exactly the 10 derived endpoints with `queryKey→endpoint→runtime→shape`, shape derived from live producers (`shape === describeShape(producer())`, so it cannot encode a stale literal). Frontend build + all 57 tests green. Edit scope clean. **APPROVED.** The two residual gaps are low-severity spec limitations owned by the contract author, not blockers.
