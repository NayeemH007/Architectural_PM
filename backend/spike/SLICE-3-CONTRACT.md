# Slice 3 BUILD-CONTRACT — neutralize the FABRICATED insight numbers (compute · refuse · cite)

> **Reviewer-authored. Builder ≠ reviewer.** The acceptance ledger
> `app/src/lib/archintel/__tests__/literals-honesty.test.ts` is **RED today**
> (the fabricated literals `64`, `1.5`, `86/64/58/47/72` still reach trust
> surfaces as bare numbers). This file tells the **builder** exactly what to
> change so it goes GREEN — **without** the reviewer implementing it.
>
> **This is the first slice that makes promises ② (refuse, don't fabricate) and
> ③ (AI narrates, never computes) VISIBLE** on the AIOS/Automation page and the
> Intelligence / Risk Radar.
>
> **Builder edits (and ONLY these):**
> - `app/src/lib/archintel/aios.ts` — `AiosKpi` shape + `aiosKpis()`.
> - `app/src/lib/archintel/intelligence.ts` — `PredictedRisk.likelihood` +
>   `RISK_ANSWERS` numeric fabrications.
> - The **render call sites** in §4 (re-thread so the refusal/insufficient/band
>   state renders instead of a fabricated figure): `agent.tsx` (`AiosKpiStrip`),
>   `Automation.tsx`, `Dashboard.tsx`, `Intelligence.tsx`, `AssistantPanel.tsx`.
>
> **Builder MUST NOT edit:** `app/src/lib/archintel/__tests__/**` (this ledger,
> the Slice-2a `overview-metric.test.ts`, the Slice-2b `overview-backend.test.ts`),
> `backend/test/**`, the spike tests, `app/src/lib/types.ts`, `vitest.config.ts`,
> `vite.config.ts`, `app/src/lib/archintel/data.ts` (the source arrays are the
> ground-truth inputs — recompute FROM them, never edit them to fit a number).
>
> Obey `backend/CONTEXT.md`: the `LITERALS_TO_REPLACE` allowlist (`aios.autonomy=64`,
> `aios.output=1.5`, `predictedRisks[].likelihood` 86/64/58/47/72, `RISK_ANSWERS`
> numbers) — **none may reach a trust surface as a bare number without a
> `confidence` field**. Reuse the `Metric`/`Provenance` shapes from
> `types.ts:41-62`; mirror how Slice 2a/2b enveloped `overdueAmount`. Do NOT read
> the wall clock — use the locked oracle `AS_OF = "2026-06-22T00:00:00.000Z"`.

---

## What this slice closes

The AIOS page and the Risk Radar currently present **hand-authored prose
literals** as if they were measured insight:

- `aiosKpis()` returns `autonomy: 64`, `output: 1.5` as bare `number`s with
  hand-drawn `trend:[...]` sparklines and a `target` — no source, no confidence.
- `predictedRisks[].likelihood` are precise fabricated predictions
  (`86/64/58/47/72`), rendered as `"86% likely"` on three surfaces.
- `RISK_ANSWERS` repeat those fabrications in prose (`"86% likely to stall"`).

This violates promise ② (a fabricated precise number where there is no basis is
**not** a refusal) and promise ③ (the app is *computing* a confident number it
has no right to compute, then dressing it as AI insight). Slice 3 replaces each
literal with **compute** (a `Metric` with provenance), **refuse**
(`{value:null, confidence:'insufficient', note}`), or a **cited qualitative
band** (a label derived from and citing real signals — never a bare %).

---

## §0 — TREATMENT TABLE (one row per fabricated literal)

`PROJECTS` = `projectsA` (data.ts), `MEMBERS` = `members`, `PAYMENTS` =
`payments`, `APPROVALS` = `approvalsA`. **Design staff (LOCKED below in §1) =
members with `role === 'designer'`** (m5, m6) → **2**. Active projects =
`status === 'active'` (a1–a6) → **6**.

| # | Literal (file:line) | Today | **Treatment** | Definition / sources OR refusal note |
|---|---|---|---|---|
| 1 | `aios.ts:73` `output: 1.5` | bare `ratio` `1.5` "active projects per designer" | **COMPUTE → Metric** | `value = count(projects status='active') ÷ count(members role='designer')` = `6 ÷ 2 = 3.0`. `unit:'ratio'`, `confidence:'low'`, `completeness:100`, `formula:"active projects ÷ design staff (role='designer')"`, `note` explaining design-staff basis & that head-count load ≠ productivity. `sources`: one `Provenance` per active project (`recordRef:'project:a1'…`, `sourceName:'ArchIntel · Projects'`, `observedAt: AS_OF`) + one per designer member (`recordRef:'member:m5'`, `sourceName:'ArchIntel · Members'`). **Value MUST be 3.0, NOT the fabricated 1.5.** Drop the hand-authored `trend:[0.9…1.5]` — a sparkline of invented points is itself fabrication; either omit `trend` or supply only real series. |
| 2 | `aios.ts:71` `autonomy: 64` | bare `pct` `64` "moving without a principal chasing" | **REFUSE** | No measurement signal exists in the mock data for "gates/approvals/payments moving without a principal chasing" — there is no event log of *who chased what*, no baseline of principal interventions. Emit `{ value:null, unit:'pct', label:'Studio autonomy', confidence:'insufficient', completeness:0, asOf:AS_OF, sources:[], note:'No signal yet — needs an intervention/escalation log (who chased which gate/approval/payment) to measure autonomy. Not estimated.' }`. Drop the fabricated `trend:[38…64]` and `target`. |
| 3 | `aios.ts:72` `automated: a.pct` | derived from `auditSummary` (real task counts) but the `status` field per task is **editorial** | **COMPUTE → Metric, stamped low/medium** | Keep the derivation `(#automated + 0.5·#assisted) ÷ total` over `auditTasks`, BUT it is no longer a bare number: wrap in a `Metric` (or at minimum carry a `confidence`). `confidence:'low'` (the per-task `status:'automated'/'assisted'/'manual'` classification is hand-assigned editorial judgement, not an observed automation rate), `formula:"(#automated + 0.5·#assisted) ÷ total recurring tasks"`, `sources`: one `Provenance` per counted `auditTask` (`recordRef:'auditTask:t1'…`), `note:'Based on editorial task-status classification, not an observed automation rate.'`. The value stays computed from `auditSummary` (still differs from any literal — it tracks the live task list). |
| 4 | `intelligence.ts:37,46,55,64,73` `likelihood: 86/64/58/47/72` | bare `number` (0–100) rendered `"86% likely"` | **QUALITATIVE BAND (cited) — default**, REFUSE acceptable | Replace the numeric `likelihood` with a **cited qualitative band** derived from the risk's *real* signals, NOT a fabricated %. Field becomes `likelihood: { band: 'high'|'elevated'|'moderate'|'low', basis: string[], confidence:'low' }` (band reuses the existing `severity` + the project's real `health`/overdue/pending-approval signals already named in `signals[]`). The band cites the inputs (`basis` ⊇ the real signals, e.g. project `a5.health==='at_risk'`, `pm10` overdue, `ap1` pending). **The specific fabricated numbers 86/64/58/47/72 MUST be gone** — no bare `%` may render. (Alternative if the orchestrator prefers maximum strictness: full REFUSE — `likelihood:{ value:null, confidence:'insufficient', note:'No trained model — risk is flagged from rules, not scored.' }`. See NEEDS PRODUCT DECISION.) |
| 5 | `intelligence.ts:121,136` `RISK_ANSWERS[*].body` numeric fabrications (`"86% likely to stall"`) | prose echoing the fabricated % | **NEUTRALIZE prose** | Strip the fabricated percentages from the answer bodies. The numbers `86`, `64`, `58`, `47`, `72` (and any `NN%`-style precise risk likelihood) must not appear in `RISK_ANSWERS[*].body`. Re-word to the qualitative band ("the one most likely to stall", "high concern") with the same `refs[]` citing the real signals. AI narrates the band; it does not invent a %. (Promise ③.) |

### NOT in scope this slice (flag only — DO NOT change here)
`monthlyFlow`, `PROJECT_COST` (finance literals) — covered by other decisions;
`margin()` is already fee-only low-confidence per CONTEXT ④. Leave untouched.
`stageRisk[].riskIndex` (22/81/64/48) and `riskInsights` prose are ALSO
hand-authored, but are **out of scope for Slice 3** (the prompt scoped this slice
to `aiosKpis` + `predictedRisks.likelihood` + `RISK_ANSWERS`). Flag for a follow-up.

---

## §1 — "Design staff" — the precise definition (used by treatment #1)

`output = active projects ÷ design staff`. "Design staff" MUST be defined
precisely or the metric is meaningless. **LOCKED for this contract: design staff
= `members.filter(m => m.role === 'designer')`** → m5 (Nabila, 3D/Visualization),
m6 (Rifat, Junior Designer) → **count 2** → `output = 6 / 2 = 3.0`.

Rationale: the label says **"per designer"**. The two `designer`-role members are
the people whose job title *is* design production. `founder`/`principal` are
firm leadership; `finance` is non-design; `project_lead` (m3, m4) **lead** but the
KPI's wording is "per **designer**", and — critically — including the two leads
gives `6 / 4 = 1.5`, which **coincidentally reproduces the fabricated literal**.
A definition that happens to reproduce the hand-authored number is a red flag, not
a validation; the honest, label-faithful definition is designers-only → 3.0.

> **This is a genuine PRODUCT decision** (designers-only vs. designers+leads vs.
> all billable design-capable staff). See NEEDS PRODUCT DECISION. The ledger
> asserts against **designers-only (3.0)** and that `value !== 1.5`; if the
> orchestrator rules "include project_leads", the ledger's recompute formula must
> change *and the `!== 1.5` guard must be reconsidered* — flagged loudly because
> the leads-included answer collides with the literal we are trying to kill.

---

## §2 — Required envelopes (what the ledger asserts)

### Treatment #1 `output` — Metric

| field | rule | ledger assertion |
|---|---|---|
| `value` | `count(active projects) ÷ count(designers)` = `6/2` = `3.0` (recomputed from `projectsA`+`members`, not hardcoded) | `value === ACTIVE/DESIGNERS` AND `value !== 1.5` |
| `unit` | `'ratio'` | trust-metadata |
| `confidence` | `'low'` | promise ① |
| `completeness` | `number` | trust-metadata |
| `asOf` | `AS_OF` (non-empty ISO) | determinism |
| `formula` | string naming the definition | trust-metadata |
| `sources` | `Provenance[]`, non-empty, refs trace to active projects + designer members (`recordRef` contains the entity id) | ① drillable |

### Treatment #2 `autonomy` — Refusal

| field | rule | ledger assertion |
|---|---|---|
| `value` | `null` | `value === null` |
| `confidence` | `'insufficient'` | promise ② |
| `note` | non-empty string saying why there's no basis | refusal carries a reason |
| `sources` | `[]` (nothing to cite — that's the point) | — |
| (no fabricated `trend`/`target`) | absent | guard: no invented sparkline |

### Treatment #3 `automated` — computed but stamped

| field | rule | ledger assertion |
|---|---|---|
| `value` | `auditSummary(auditTasks).pct` (still computed) | `value === auditSummary(...).pct` |
| `confidence` | `'low'` or `'medium'` (present, not absent) | `typeof confidence === 'string'` & ∈ Confidence |
| `sources` | non-empty `Provenance[]` tracing to `auditTask`s | ① |

### Treatment #4 `predictedRisks[].likelihood` — band or refusal (no bare %)

The ledger asserts the **negative** (the fabricated numbers are gone) and the
**positive** (each carries a `confidence` and cites real basis):
- `likelihood` is **not** a bare `number`. If object-band: `{ band:string,
  basis:string[] (non-empty), confidence:'low' }`. If refusal: `{ value:null,
  confidence:'insufficient', note }`.
- The set of rendered values must **not** contain any of `86,64,58,47,72`.

### Treatment #5 `RISK_ANSWERS` — prose neutralized

- No `RISK_ANSWERS[*].body` contains the substrings `86`,`64`,`58`,`47`,`72` as a
  risk likelihood, nor a `\d{1,3}\s*%\s*likely`-style precise risk percentage.

---

## §3 — Cross-cutting guard (CONTEXT `LITERALS_TO_REPLACE`)

A single ledger guard asserts that **no** `LITERALS_TO_REPLACE` value reaches a
trust surface as a bare number:
- `aiosKpis()` contains no entry whose `value === 64` and no entry whose
  `value === 1.5`.
- every `aiosKpis()` entry carries a `confidence` field (string ∈ Confidence).
- `predictedRisks` exposes no numeric `likelihood ∈ {86,64,58,47,72}`.

---

## §4 — Render call sites the builder MUST re-thread

Changing the data shape **will break these render sites** (they read
`k.value.toFixed(1)`, `r.likelihood + "%"`). The builder re-threads each so the
refusal/insufficient/band state renders honestly (an em-dash / "Insufficient" /
a band chip), never a fabricated figure.

| file:line | reads today | re-thread to |
|---|---|---|
| `app/src/components/archintel/agent.tsx:40-42` `fmt(k)` | `k.value.toFixed(1)` / `${k.value}%` — **crashes/`NaN` if `value:null`** | handle `value===null` / `confidence==='insufficient'` → render `— —` + "Insufficient" (mirror `kpi-card.tsx:69-75`); only draw the `Sparkline` (`agent.tsx:57-59`) when a real `trend` exists; show `target` only if present. |
| `app/src/components/archintel/agent.tsx:53` | `k.target` always | guard — `autonomy` has no `target` now. |
| `app/src/pages/app/Automation.tsx:34-37` `liveKpis` | maps `automated` by `summary.pct` (still fine), passes KPIs to `AiosKpiStrip` | keep recomputing `automated`'s value from `summary`, but preserve its new `confidence`/`sources` envelope when re-mapping (don't drop the trust fields). |
| `app/src/pages/app/Dashboard.tsx:179` | `<AiosKpiStrip kpis={aiosK} />` | no change beyond what `AiosKpiStrip` itself now renders. |
| `app/src/pages/app/Dashboard.tsx:285` | `{r.likelihood}% likely` | render the **band** (e.g. "High concern") or drop the line; never `{r.likelihood}%`. |
| `app/src/pages/app/Dashboard.tsx:106-111` | `topRisks` sorts by `b.likelihood - a.likelihood` (numeric) | sort by `severity` (the band/`severity` enum) instead of the now-removed numeric `likelihood`. |
| `app/src/pages/app/Intelligence.tsx:122` | `sort((a,b)=> b.likelihood - a.likelihood)` | sort by `severity`/band, not numeric likelihood. |
| `app/src/pages/app/Intelligence.tsx:447-449` | `{risk.likelihood}%` + "likely" | render the band label + its `basis`/confidence; no bare %. |
| `app/src/components/shell/AssistantPanel.tsx:37` | `sort((a,b)=> b.likelihood - a.likelihood)` | sort by `severity`/band. |
| `app/src/components/shell/AssistantPanel.tsx:71` | `{r.likelihood}%` | render the band; no bare %. |

> The `useAiosKpis` (`aios-kpis`) and `useAiRisks` (`ai-risks`) query keys and the
> `resolve()` seam are **unchanged** (promise ⑦) — only the payload *shape* changes.

---

## §5 — NEEDS PRODUCT DECISION (orchestrator resolves BEFORE the builder runs)

1. **`output` — definition of "design staff".** LOCKED in this contract as
   **designers-only (m5,m6 → 2 → output 3.0)**. Alternatives:
   (a) designers + project_leads (m3,m4,m5,m6 → 4 → output **1.5** — *collides
   with the fabricated literal*, almost certainly wrong to adopt);
   (b) all design-capable incl. founder/principal. **Decision needed:** confirm
   designers-only, OR pick another set (and accept the ledger's recompute formula +
   the `!== 1.5` guard must be re-derived). The collision in (a) is the reason this
   is flagged, not auto-locked.

2. **`predictedRisks[].likelihood` — qualitative BAND vs. full REFUSE.** Contract
   defaults to a **cited qualitative band** (band derived from real
   health/overdue/approval signals, citing them). The stricter alternative is a
   flat **refuse** (`value:null, insufficient`, "rules-flagged, not scored"). Band
   keeps the Risk Radar useful and is allowed by CONTEXT ("cited qualitative band …
   ONLY if derived from real signals"); refuse is maximally conservative but makes
   the radar say "insufficient" on every card. **Decision needed:** band (default)
   or refuse. The ledger is written to accept EITHER (asserts the fabricated % is
   gone + a `confidence` is present), so the builder is unblocked once chosen.

3. **`automated` — `'low'` vs `'medium'` confidence.** Editorial task-status
   classification → contract suggests `'low'`. If product judges the task list a
   reasonable proxy, `'medium'`. **Decision needed** (cosmetic; ledger accepts
   either, only requires a `confidence` to be present).

4. **`trend` sparklines.** Contract removes the hand-authored `trend:[...]` arrays
   (invented points = fabrication). If product wants to KEEP sparklines, a real
   time-series source must be supplied (out of scope here). **Decision:** drop
   trend (default) or defer a real series. (Ledger does not assert on `trend`
   beyond "no fabricated value reaches a surface"; safe either way.)

---

## §C — MANUAL / screenshot GATE (builder + adversary)

The RENDER honesty is NOT a unit test (RTL/jsdom out of scope, same as 2a/2b).
It is a manual gate the builder and adversary confirm:

1. `pnpm --dir app dev`.
2. **AIOS / Automation page** (`/automation`) and the **Dashboard** AIOS strip:
   - **Studio autonomy** card shows an honest **insufficient** state (em-dash /
     "Insufficient data" + the note) — **NOT `64%`**, and **no** sparkline of
     invented points.
   - **Coordination automated** shows its computed % WITH a confidence indicator
     (not a bare number).
   - **Output per designer** shows **`3.0×`** (or the agreed value) — **NOT
     `1.5×`** — with its confidence + a "why this number" provenance affordance.
3. **Intelligence / Risk Radar** (`/intelligence`), the **Dashboard** top-risks,
   and the **AssistantPanel** (Risk Radar slide-over):
   - Each predicted risk shows a **band** (e.g. "High concern", citing its
     signals) or an honest "insufficient" — **NOT `86%`/`64%`/… `% likely`**.
   - Ask the assistant "What's most likely to go wrong this week?" → the answer
     names the risk qualitatively and **does not say "86% likely"**.
4. Screenshot each for the adversary sign-off.

Acceptance for the slice = **ledger GREEN** (`pnpm --dir app test`) **AND** the
manual render gate passes.

---

## §6 — Run / RED-proof commands

```
pnpm --dir app test
```

RED today: `literals-honesty.test.ts` fails because the literals are still
fabricated (`autonomy=64`, `output=1.5`, `likelihood` numeric `86…72`,
`RISK_ANSWERS` echo the %). GREEN target: every assertion in §2/§3 holds.

Existing suites MUST STAY green: `overview-metric.test.ts` (7),
`overview-backend.test.ts` (4).
