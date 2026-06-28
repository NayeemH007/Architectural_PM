# Slice 4 BUILD-CONTRACT — finish the frontend trust surface (compute · refuse · band · stamp)

> **Reviewer-authored. Builder ≠ reviewer.** The acceptance ledger
> `app/src/lib/archintel/__tests__/trust-surface.test.ts` is **RED today**.
> Slice 4 closes the **remaining** dishonest surfaces: the last hand-authored
> fabricated numbers (`stageRisk[].riskIndex`, the `81/100` echo in
> `RISK_ANSWERS`) and the **real KPIs still rendered as bare numbers** on the
> Finance / Dashboard / Intelligence headline cards (`collectionRate`,
> `pendingApprovals`, the `financeOverview()` figures, and `margin`).
>
> After Slice 4, promises ① (every number cites its source), ② (refuse, don't
> fabricate) and ③ (AI narrates, never computes) hold across the **whole app
> headline surface**, not just the overdue card and the AIOS strip.
>
> **Builder edits (and ONLY these source files):**
> - `app/src/lib/archintel/intelligence.ts` — `stageRisk` shape, `RISK_ANSWERS`
>   `81/100` echo, (and a no-fabricated-number guarantee on `riskInsights`).
> - `app/src/lib/archintel/finance.ts` — `financeOverview()`,
>   `profitabilityByProject()`, and the `monthlyFlow` provenance stamp (per the
>   resolved product decision).
> - `app/src/lib/archintel/api.ts` — `managementOverview()` `collectionRate` +
>   `pendingApprovals`.
> - The **render call sites** in §5 (re-thread so the enveloped / banded /
>   refused state renders, never a fabricated or bare number).
>
> **Builder MUST NOT edit:** `app/src/lib/archintel/__tests__/**` (this ledger,
> the Slice-2a/2b/3 ledgers), `backend/test/**`, `app/src/lib/types.ts`,
> `app/src/lib/archintel/data.ts` (source arrays = ground truth — recompute FROM
> them, never edit them to fit a number), `vitest.config.ts`, `vite.config.ts`.
>
> Reuse `Metric`/`Provenance` from `types.ts:41-62` (mirror Slice 2a/3). The
> refusal shape is `{value:null, confidence:'insufficient', note}`. The band
> shape is `{band, basis[], confidence}`. Do NOT read the wall clock — use the
> locked oracle `AS_OF = "2026-06-22T00:00:00.000Z"`. Obey `backend/CONTEXT.md`:
> ⑤ tax DEFERRED → gross finance KPIs stamped `confidence='low', note='gross…'`;
> ④ margin RETIRED → fee-only `confidence='low', note='fee-only, no labour cost'`.

---

## §0 — TREATMENT TABLE (one row per item)

`PROJECTS`=`projectsA`, `MEMBERS`=`members`, `PAYMENTS`=`payments`,
`APPROVALS`=`approvalsA` (all `data.ts`). Active projects = `status==='active'`
(a1–a6) → **6**. Pending approvals = `status==='pending'` (ap1, ap2, ap5) → **3**.
Designers = `role==='designer'` (m5, m6) → **2** (locked Slice 3).

| # | Item (file:line) | Today | **Treatment** | Definition / sources OR refusal note OR band derivation |
|---|---|---|---|---|
| **A. REMAINING FABRICATIONS — neutralize (like Slice 3)** |
| A1 | `intelligence.ts:117-122` `stageRisk[].riskIndex` `22/81/64/48` | bare hand-authored `number` 0–100, rendered as `{s.riskIndex}/100` + a bar width | **BAND (cited qualitative) — default** | Replace the numeric `riskIndex` with a **cited qualitative band** over the SAME enum as risk likelihood: `risk: { band:'high'|'elevated'|'moderate'|'low', basis:string[], confidence:'low' }`. The band is a relative read, NOT a measured score. `basis` cites the real signals already named in each stage's `note` + the live evidence (e.g. Concept → the `predictedRisks` flagged at the Concept/layout-freeze gate (r1,r2), the at-risk project a5; Design Dev → the pending material approvals ap2,ap5, project a1). The exact numbers **22/81/64/48 MUST be gone** — no bare index may render. (Alternative: full REFUSE per stage `{value:null,confidence:'insufficient',note:'relative risk needs a slip/stall history to rank stages'}` — see NEEDS PRODUCT DECISION D1.) |
| A2 | `intelligence.ts:165` `RISK_ANSWERS["Why do our projects keep stalling at Concept?"].refs` contains `"Stage risk · Concept 81/100"` | the **fabricated `81`** survives inside a ref string echoed in the assistant answer | **NEUTRALIZE prose/ref** | The substring `81` (and any `NN/100` stage index) must not appear in any `RISK_ANSWERS[*].body` **or** `RISK_ANSWERS[*].refs[]`. Re-word the ref to the qualitative band: e.g. `"Stage risk · Concept (highest concern)"`. AI narrates the band; it never echoes a fabricated index. (Promise ③.) |
| A3 | `intelligence.ts:130-136` `riskInsights[].detail` / `.title` | prose insights (currently NO embedded numbers) | **GUARANTEE clean (no change expected)** | Audited clean today — titles/details are qualitative. The ledger pins this: no `riskInsights` `title`/`detail` may contain a bare fabricated index (`22/81/64/48`) or an `NN/100` / `NN%`-style precise figure. Builder must keep it that way if it re-words anything. |
| A4 | `finance.ts:34-41` `monthlyFlow` (Jan–Jun income/expense literals) | hand-authored 6-month series, **not computable** from the live `payments`/`expenses` arrays, rendered as the headline area chart + feeds `ytd*`/`monthIncome` | **MANUAL-CAPTURE PROVENANCE STAMP (default) — PRODUCT DECISION D2** | This is historical manual-capture data, categorically different from insight-fabrication (a real firm would have entered these months). Default treatment: keep the series but make it **honestly labelled as manual capture** — expose alongside it a provenance descriptor `monthlyFlowMeta = { confidence:'low', note:'Manually captured monthly totals — not reconciled to milestone-level lineage.', sources:[{sourceId:'manual', sourceName:'Manual capture · monthly close', recordRef:'manual:monthly-flow', observedAt:AS_OF}] }` so any KPI derived from it (`ytdIncome/ytdExpense/monthIncome/monthNet/ytdNet`) inherits `confidence:'low'` + that note. The **chart itself is a manual-capture surface, not a cited Metric** — a chart of entered points is acceptable when labelled; a precise *trust-card number* derived from it is not, so the YTD/month cards (§B) must carry the manual stamp. See NEEDS PRODUCT DECISION D2 for alternatives (refuse / drop the series). |
| **B. REAL KPIs still bare — envelope as cited Metrics (locked stamps)** |
| B1 | `api.ts:111` `managementOverview().collectionRate` (`Math.round(received/billable*100)`) | bare `number` %, rendered Dashboard.tsx:218 `{overview.collectionRate}%` | **COMPUTE → Metric, gross low** | `value = round(Σ received ÷ Σ billable × 100)` over `payments` (recomputed). `unit:'pct'`, `confidence:'low'` (⑤ gross — receipts are face value, withholding not modeled), `completeness:100`, `asOf:AS_OF`, `formula:"Σ received ÷ Σ billable (gross)"`, `note:'Gross collection — VAT/VDS/AIT withholding not modeled.'`, `sources`: one `Provenance` per payment milestone that contributes (`recordRef:'tally:pm1'…`, `sourceName:'TallyPrime'`, `observedAt: pm.dueDate`). NEVER a bare %. |
| B2 | `api.ts:104` `managementOverview().pendingApprovals` (`pending.length`) | bare `number` count, rendered Dashboard.tsx:202 `value={overview.pendingApprovals}` | **COMPUTE → Metric, higher confidence** | A real, fully-observed count of internal records → `value = count(approvalsA where status='pending')` = 3 (recomputed). `unit:'count'`, `confidence:'high'` (it is a direct, complete count of internal approval records — no estimation, no tax/gross caveat), `completeness:100`, `asOf:AS_OF`, `formula:"count(approvals where status='pending')"`, `sources`: one `Provenance` per pending approval (`recordRef:'approval:ap1'…`, `sourceName:'ArchIntel · Approvals'`, `observedAt: a.submittedDate`). |
| B3 | `api.ts:98,108` `managementOverview().totalContract` + `activeCount` etc. rendered on Dashboard KpiCards | bare numbers | **NOTE / DEFER (finance-gate)** | `activeCount`/`completedCount`/`overdueCount`/`blockedCount`/`pendingApprovals` are **complete internal counts** — B2 envelopes the headline one (`pendingApprovals`). `totalContract`/`received`/`billable` are **finance figures behind the per-user finance gate** (CONTEXT ⑦ / api.ts:35-37). Enveloping them fully (Viewer redaction) is the **Auth & Finance Gating** step, NOT Slice 4. DEFERRED — flagged, not changed here. The ledger does NOT assert on them. |
| B4 | `finance.ts:48-67` `financeOverview()` headline figures: `income`, `billable`, `receivables`, `collectionRate` | bare numbers, rendered Finance.tsx KpiCards 76-108 + cash card | **COMPUTE → Metrics, gross low** | Each headline figure rendered on a Finance KpiCard becomes a `Metric` (mirror B1). `income = Σ receivedAmount`, `billable = Σ amount`, `receivables = Σ(amount−received) where status≠'paid'`, `collectionRate = round(income÷billable×100)`. All `unit` per figure (`'bdt'` / `'pct'`), `confidence:'low'`, `note` gross/withholding, `asOf:AS_OF`, `sources`: one `Provenance` per contributing payment milestone (`recordRef:'tally:pmN'`). `overdue` already has a sibling pattern (Slice 2a) — mirror it. The `ytd*`/`monthNet`/`monthIncome` figures derive from `monthlyFlow` → inherit the **manual-capture** stamp (A4), `confidence:'low'`, `note` manual. **CUT for tractability:** envelope the **4 headline KpiCards** (income, receivables, overdue, collectionRate) + the YTD/month cash-card numbers carry the manual note; the per-row receivables/expenses **tables** are NOT enveloped this slice (deferred — see §6). |
| B5 | `finance.ts:69-78` `profitabilityByProject()[].margin` (`round((contract−cost)/contract×100)`) | bare `number` %, rendered Finance.tsx:466 `{r.margin}%` | **COMPUTE → fee-only low stamp (④ RETIRED) — NEVER bare** | `margin` becomes a `Metric` (or at minimum carries `confidence`+`note`): `value = round((contractValue − PROJECT_COST)/contractValue × 100)` (recomputed). `unit:'pct'`, `confidence:'low'`, `completeness` < 100, `asOf:AS_OF`, `formula:"(contract − modeled project cost) ÷ contract"`, `note:'Fee-only margin — no labour cost; PROJECT_COST is a modeled input, not measured.'`, `sources`: the contract (`recordRef:'project:aN'`, `sourceName:'ArchIntel · Projects'`) + the modeled cost as a declared input (`recordRef:'model:PROJECT_COST:aN'`, `sourceName:'ArchIntel · Cost model (modeled input)'`). NEVER a bare margin %, NEVER `insufficient` (we have a number, just low-trust — CONTEXT ④). |

> **Scope cut (stated explicitly):** Slice 4 envelopes the **headline KpiCard
> numbers** on Dashboard / Finance / Intelligence + kills the named fabrications.
> It does **not** envelope every micro-number inside the receivables / expenses /
> profitability **tables**, nor the finance-gated `totalContract`/`received`/
> `billable` cards (deferred to Auth & Finance Gating). Intelligence's other KPI
> cards (`openCount`, `critHighCount`, `approvalBottleneck`) are complete
> derived counts/booleans, not fabrications — left as-is (noted §6).

---

## §1 — Required envelopes (what the ledger asserts)

### B1 `collectionRate` (managementOverview) — Metric, gross low
| field | rule | assertion |
|---|---|---|
| `value` | `round(Σreceived ÷ Σbillable × 100)` over `payments` (recomputed, ≠ literal) | `value === EXPECTED_COLLECTION` |
| `unit` | `'pct'` | trust-metadata |
| `confidence` | `'low'` | ⑤ gross |
| `note` | matches `/gross\|withhold/i` | ⑤ gross |
| `sources` | non-empty `Provenance[]`, refs trace to payment milestones | ① drillable |

### B2 `pendingApprovals` (managementOverview) — Metric, high
| field | rule | assertion |
|---|---|---|
| `value` | `count(approvalsA where status='pending')` (recomputed) = 3 | `value === EXPECTED_PENDING` |
| `unit` | `'count'` | trust-metadata |
| `confidence` | a valid `Confidence` (contract: `'high'` — a complete internal count) | present + valid |
| `sources` | length === pending count; each `recordRef` contains the approval id (`ap1`…) | ① drillable + VALUE=Σ lineage |

### B4 `financeOverview()` headline figures — Metrics, gross low
For each of `income`, `billable`, `receivables`, `collectionRate`:
| field | rule | assertion |
|---|---|---|
| `value` | the recomputed sum/ratio over `payments` (≠ literal) | `value === EXPECTED_*` |
| `confidence` | `'low'` | ⑤ gross |
| `note` | present, gross/withholding (the `bdt`/`pct` figures) | ⑤ gross |
| `sources` | non-empty `Provenance[]` tracing to payment milestones | ① drillable |
`income`/`receivables`/`collectionRate` `value` MUST equal the deterministic
recompute (the ledger reconstructs each Σ from `payments`).

### B5 `profitabilityByProject()[].margin` — fee-only low stamp
| field | rule | assertion |
|---|---|---|
| (margin not a bare number) | every row's `margin` carries a `confidence` | `typeof margin !== 'number'` OR a sibling `marginMetric` carries confidence |
| `value` | `round((contract − cost)/contract × 100)` (recomputed per row) | `value === EXPECTED_MARGIN(row)` |
| `confidence` | `'low'` | ④ fee-only |
| `note` | matches `/fee-only\|labour\|modeled/i` | ④ fee-only |
| `sources` | cites the contract + the modeled cost input | ① + "modeled input declared" |

> **Builder note (shape choice for B5):** the cleanest re-thread is to make
> `margin` itself a `Metric` (`unit:'pct'`) so Finance.tsx renders it via the
> Metric path. If the builder prefers to keep `margin:number` for the existing
> colour-threshold logic, it MUST add a parallel `marginMetric: Metric` on the
> row AND the render site must read the Metric's confidence/note. The ledger
> accepts **either** (it asserts: no bare margin reaches the row without a
> confidence + fee-only note somewhere on the row). Pick one; don't leave a bare
> `margin` number as the only representation.

### A1 `stageRisk[].risk` — band or refusal (no bare index)
| field | rule | assertion |
|---|---|---|
| (no bare index) | no `stageRisk` entry exposes a numeric `riskIndex ∈ {22,81,64,48}` | the fabricated set is gone |
| shape | each stage's risk is a refusal `{value:null,confidence:'insufficient',note}` OR a cited band `{band:string, basis:string[] (non-empty), confidence}` | refusal OR band |
| confidence | present + valid `Confidence` | ② |

### A2/A3 prose guards
- No `RISK_ANSWERS[*].body` or `RISK_ANSWERS[*].refs[]` contains `81` (or any
  `NN/100` stage index).
- No `riskInsights[*].title`/`.detail` contains `22/81/64/48` as a bare index
  nor an `NN/100`/`NN%` precise figure.

---

## §2 — Cross-cutting guard (CONTEXT `LITERALS_TO_REPLACE`, Slice-4 surfaces)
A single ledger guard asserts no Slice-4 fabricated index / bare trust number
reaches a surface uncovered:
- `stageRisk` exposes no numeric `riskIndex ∈ {22,81,64,48}`.
- `managementOverview().collectionRate` and `.pendingApprovals` are **not** bare
  numbers (both carry a `confidence`).
- every Finance headline figure asserted in §1 carries a `confidence`.
- no `margin` row is a bare number lacking a confidence.

---

## §3 — Provenance ref conventions (match Slice 2a/3 so the backend swap is drop-in)
| entity | recordRef | sourceName |
|---|---|---|
| payment milestone | `tally:pm10` | `TallyPrime` |
| pending approval | `approval:ap1` | `ArchIntel · Approvals` |
| project (contract) | `project:a5` | `ArchIntel · Projects` |
| modeled cost input | `model:PROJECT_COST:a5` | `ArchIntel · Cost model (modeled input)` |
| manual monthly close | `manual:monthly-flow` | `Manual capture · monthly close` |

`observedAt`: milestones → `pm.dueDate`; approvals → `a.submittedDate`; projects
/ model / manual → `AS_OF`.

---

## §4 — VALUE = Σ LINEAGE (the invariant the ledger re-checks)
Same invariant Slice 2a proved, extended to the new Metrics:
- `pendingApprovals.value` === number of pending-approval sources cited.
- `income.value` reconstructable as Σ `receivedAmount` over the milestones the
  sources cite; `billable.value` as Σ `amount`; `collectionRate.value` ===
  `round(income ÷ billable × 100)` over those same cited milestones.
A hardcoded literal cannot satisfy these (the ledger recomputes from `payments`).

---

## §5 — Render call sites the builder MUST re-thread
Changing these shapes WILL break the render sites (they read `.collectionRate`,
`.pendingApprovals`, `fin.income`, `r.margin`, `s.riskIndex` as bare values).
Re-thread each so the enveloped / banded / refused state renders honestly.

| file:line | reads today | re-thread to |
|---|---|---|
| `Dashboard.tsx:200-208` Pending approvals card | `value={overview.pendingApprovals}` | `metric={overview.pendingApprovals}` (now a Metric; KpiCard renders ConfidenceMeter + provenance). Keep the "Raiana's queue" footnote OR move count to footnote — but `value=` must not shadow the Metric (KpiCard:52 `value ?? formatMetric`). |
| `Dashboard.tsx:213-221` Blocked projects card footnote | `{overview.collectionRate}%` | render the `collectionRate` Metric's value via `formatMetric`/a small affordance, or move it to a card with `metric=`. Do NOT print `{overview.collectionRate}%` (now an object → `[object Object]%`). |
| `Finance.tsx:76-108` 4 KPI cards | `value={bdt(fin.income,…)}`, `value={bdt(fin.receivables,…)}`, `value={…bdt(fin.overdue…)}`, `value={`${fin.collectionRate}%`}` | bind `metric={fin.income}` etc.; remove the `bdt(...)`/`${…}%` wrappers (KpiCard formats `unit:'bdt'`→`bdt`, `unit:'pct'`→`pct`). `fin.overdue` should mirror the Slice-2a overdue Metric. |
| `Finance.tsx:174-202` Cash position (YTD/month) | `bdt(fin.ytdIncome…)`, `fin.monthNet`, `fin.monthIncome` | these derive from `monthlyFlow` → surface the **manual-capture note** near them (a small "manually captured" affordance). If figures become Metrics, render via Metric; otherwise keep numbers but show the manual provenance label. |
| `Finance.tsx:455-468` Margin cell | `{r.margin}%` + colour thresholds on `r.margin` | read the margin Metric: `formatMetric` for the value, keep the colour logic on `metric.value`, and surface the fee-only confidence/note (a popover or `title`). Never print a bare `{r.margin}%` with no confidence. |
| `Intelligence.tsx:298-310` Stage risk rows | `{s.riskIndex}/100`, `riskColour(s.riskIndex)`, `width:${s.riskIndex}%` | render the **band** (`BAND_LABEL[s.risk.band]`) instead of `NN/100`; map the bar colour/width from the band rank (`BAND_RANK`) or drop the numeric bar; never show `/100`. |
| `Intelligence.tsx` (assistant answers) | `RISK_ANSWERS` ref strings | no UI change needed beyond the data fix (A2) — but confirm no `81/100` renders. |

> The `ai-overview`, `ai-finance`, `ai-profit`, `ai-stagerisk`, `ai-risks`,
> `ai-insights` query keys and both `resolve()` seams are **unchanged** (⑦) —
> only the payload *shape* changes.

---

## §6 — NEEDS PRODUCT DECISION (orchestrator resolves BEFORE the builder runs)

**D1 — `stageRisk[].riskIndex`: cited BAND (default) vs full REFUSE.**
The contract defaults to a **cited qualitative band** per stage (band derived
from and citing the live risk signals: which `predictedRisks` and at-risk
projects sit at each stage). The stricter alternative is a flat **refuse** per
stage (`value:null, insufficient`, "relative stage risk needs a slip/stall
history to rank"). Band keeps "Where risk concentrates" useful; refuse makes the
whole section say "insufficient". The ledger accepts **either** (it asserts the
fabricated `22/81/64/48` are gone + a `confidence` is present). **Decide: band
(default) or refuse.**

**D2 — `monthlyFlow`: manual-capture STAMP (default) vs REFUSE vs DROP.**
This is the flagged PRODUCT decision — it differs from insight-fabrication. The
6-month series is plausibly real historical manual-capture data (a firm would
have entered it), so the default is to **keep it and label it manual-capture
provenance** (`confidence:'low'`, manual note, `recordRef:'manual:monthly-flow'`),
and let the YTD/month KPI cards inherit that low/manual stamp. Alternatives:
(a) **REFUSE** the YTD/month figures (`value:null, insufficient`) and keep only
the chart as an explicitly-illustrative preview; (b) **DROP** `monthlyFlow` and
the YTD/month section entirely until a real ledger feed exists. The chart-vs-card
distinction matters: a *labelled chart* of entered points is acceptable; a
precise *trust-card number* with no provenance is not. **Decide: stamp (default),
refuse the cards, or drop.** The ledger asserts the *cards' figures* are not bare
(carry confidence) only if D2 = stamp; if D2 = refuse/drop, the ledger's
finance-figure rows for `ytd*`/`monthNet` are relaxed accordingly — flagged so
the builder isn't blocked. **(Slice-4 ledger asserts the income/billable/
receivables/collectionRate cards regardless; the YTD/month assertion is gated on
D2.)**

**D3 — `pendingApprovals` confidence: `'high'` vs `'medium'`.**
Contract suggests `'high'` (a direct, complete count of internal approval
records — no estimation). If product wants conservatism (e.g. "approvals may
exist uncaptured outside ArchIntel"), `'medium'`. Cosmetic; ledger only requires
a present valid `confidence`. **Decide (default high).**

**D4 — `margin` representation: `Metric` replacing the number vs parallel
`marginMetric`.** See §1 B5 builder note. Default: make `margin` a `Metric`.
Ledger accepts either. **Decide (default: margin → Metric).**

**D5 — Finance `collectionRate` vs management `collectionRate`.** Both
`financeOverview()` and `managementOverview()` compute a `collectionRate`, but
over **different denominators**: management = `received ÷ billable`, finance =
`income ÷ billable` (income === received). They coincide today (same `payments`).
The ledger recomputes each against ITS producer's formula. Confirm both stay
gross-low; no further decision needed unless product wants one canonical figure
(then dedupe — out of scope for Slice 4).

---

## §C — MANUAL / screenshot GATE (builder + adversary)
The RENDER honesty is NOT a unit test (RTL/jsdom out of scope, same as 2a/2b/3).
Manual gate the builder + adversary confirm:

1. `pnpm --dir app dev`.
2. **Finance page** (`/finance`):
   - The 4 headline cards (Income, Receivables, Overdue, Collection rate) each
     show a **ConfidenceMeter** + a "Why this number?" provenance affordance —
     Income/Receivables/Collection at **`low`** with the gross note; not bare.
   - **Profitability tab → Margin column:** each margin shows its value WITH a
     **fee-only / low-confidence** indicator (popover or hover note) — never a
     bare `NN%`.
   - **Cash position (YTD/month):** carries a visible **"manually captured"**
     provenance label (per D2), not presented as reconciled lineage.
3. **Dashboard** (`/`):
   - **Pending approvals** card shows a ConfidenceMeter (high) + provenance to
     the approval records; **Collection rate** footnote renders the enveloped
     value, not `[object Object]%`.
4. **Intelligence / Risk Radar** (`/intelligence`):
   - **"Where risk concentrates"** shows a **band per stage** (e.g. "Highest
     concern" / "Moderate concern") — **NOT `81/100`** — and the assistant answer
     to "Why do our projects keep stalling at Concept?" does **not** say
     `81/100`.
5. Screenshot each for the adversary sign-off.

Acceptance = **ledger GREEN** (`pnpm --dir app test`) **AND** the manual gate.

---

## §7 — Run / RED-proof
```
pnpm --dir app test
```
RED today: `trust-surface.test.ts` fails because `stageRisk[].riskIndex` is still
the fabricated `22/81/64/48`, `RISK_ANSWERS` still echoes `81/100`,
`collectionRate`/`pendingApprovals`/the finance figures are still bare numbers,
and `margin` is a bare %. GREEN target: every assertion in §1/§2 holds.

Existing suites MUST STAY green: `overview-metric.test.ts` (7),
`overview-backend.test.ts` (4), `literals-honesty.test.ts` (11).
