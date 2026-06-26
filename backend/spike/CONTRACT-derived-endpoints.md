# CONTRACT — derived endpoints → semantic functions + Metrics (Step 3/4, remaining)

> **Reviewer-authored. Builder ≠ reviewer.** The acceptance ledger
> `backend/test/derived-endpoints.design.test.mjs` is **RED today** (9 fail / 0
> pass) — the `semantic/{finance,profitability,aios}.mjs` modules do not exist and
> no recompute emits finance/profitability/aios `metric_key`s into
> `mart.kpi_lineage`. This file tells the **builder** exactly what to create so it
> goes GREEN — **without** the reviewer implementing the semantic logic.
>
> **What is already DONE (do not rebuild):** `overdueAmount` / `managementOverview`
> is fully backend-backed (Slice 2b): `mart.recompute_portfolio_summary` +
> `mart.kpi_lineage` + `serializeOverview` + `GET /api/v1/overview` +
> `VITE_USE_BACKEND_AI`. This contract converts the **OTHER** derived endpoints to
> the same pattern.
>
> **Builder creates / edits (and ONLY these):**
> - `backend/semantic/finance.mjs` — NEW (financeOverview family + A-5 overview money).
> - `backend/semantic/profitability.mjs` — NEW (margin family).
> - `backend/semantic/aios.mjs` — NEW (aiosKpis + dailyBrief + agentActions family).
> - `backend/semantic/arrays.mjs` — NEW *(or fold into finance.mjs)* — projects/clients/payments.
> - `backend/db/migrations/0003_mart_derived.sql` (+ `.down.sql` + `.supabase.sql`)
>   — NEW recompute functions that emit the new `metric_key`s into `mart.kpi_lineage`.
> - `backend/server/index.mjs` — ADD the new per-family routes (do NOT rewrite the
>   existing `/api/v1/overview`).
> - `app/src/lib/archintel/api.ts` + `aios.ts` — extend the existing flag seam to
>   the new endpoints (mirror `fetchOverview`).
>
> **Builder MUST NOT edit:** `backend/test/**` (this ledger + the spike/slice2b
> ledgers), the existing `serializeOverview` 2a/2b behaviour (extend, don't break),
> `app/src/lib/archintel/__tests__/**`, `app/src/lib/types.ts`,
> `app/src/lib/archintel/{data,finance,intelligence,aios}.ts` source arrays (ground
> truth — recompute FROM them, never edit them to fit a number), `harness.mjs`,
> `vite.config.ts`, `vitest.config.ts`.
>
> Obey `backend/CONTEXT.md`: ⑤ tax DEFERRED → gross finance KPIs `confidence='low'`,
> gross note; ④ coverage RETIRED → margin fee-only `confidence='low'`, never bare,
> never `insufficient`; ⑦ AIOS READ-ONLY-STRICT → this repo PROPOSES only; clock
> `as_of=2026-06-22` injected, never wall-clock; preserve `ai-*`/`aios-*` query keys
> and the `resolve()`/`fetchOverview` seam shapes. Mirror `Metric`/`Provenance`
> (`types.ts:41-62`) and the Slice-2a/3/4 shapes exactly so the swap is drop-in.

---

## §0 — What is being converted (the seam map)

`managementOverview()` is done. The remaining derived endpoints wrap **function
calls** (`resolve(financeOverview())`, `resolve(aiosKpis())`), so they become
**server aggregates / semantic functions**, NOT path swaps. One semantic module
per family so parallel builders don't collide on `serialize.mjs` / `server`.

| Live producer (frontend) | Query key | Seam | New semantic module | New route | Closes |
|---|---|---|---|---|---|
| `financeOverview()` (`finance.ts:83`) | `ai-finance` | `api.ts` resolve(240) | `semantic/finance.mjs` | `GET /api/v1/finance` | F6, F2, A-5 |
| `profitabilityByProject()` (`finance.ts:136`) | `ai-profit` | `api.ts` resolve(240) | `semantic/profitability.mjs` | `GET /api/v1/profitability` | F6, F4(retired) |
| `aiosKpis()` (`aios.ts:82`) | `aios-kpis` | `aios.ts` resolve(220) | `semantic/aios.mjs` | `GET /api/v1/aios/kpis` | F6, F2 |
| `dailyBrief()` (`aios.ts:196`) | `aios-brief` | `aios.ts` resolve(220) | `semantic/aios.mjs` | `GET /api/v1/aios/brief` | F6 |
| `agentActions` (`aios.ts:170`) | `aios-actions` | `aios.ts` resolve(220) | `semantic/aios.mjs` | `GET /api/v1/aios/actions` | F6 |
| `auditTasks` (`aios.ts:37`) | `aios-audit` | `aios.ts` resolve(220) | `semantic/aios.mjs` (array) | `GET /api/v1/aios/audit` | F6 |
| `projectsA` | `ai-projects` | `api.ts` resolve(240) | `semantic/arrays.mjs` | `GET /api/v1/projects` | F6 |
| `clientsA` | `ai-clients` | `api.ts` resolve(240) | `semantic/arrays.mjs` | `GET /api/v1/clients` | F6 |
| `payments` | `ai-payments` | `api.ts` resolve(240) | `semantic/arrays.mjs` | `GET /api/v1/payments` | F6 |

> Both seams covered: **ai-*** via `finance`/`profitability`/`arrays`; **aios-***
> via `aios.mjs`. The `aios-*` routes live under `/api/v1/aios/*` so the two seams
> (api.ts 240ms / aios.ts 220ms) map to two route families that two builders can
> ship without colliding.

---

## §1 — TREATMENT per item (mirror the locked frontend treatment EXACTLY)

`PROJECTS`=`canonical.project`, `PAYMENTS`=`canonical.payment_milestone`,
`MEMBERS`=`canonical.member`. Active = `status='active'` (a1–a6) → **6**.
Designers = `role='designer'` (m5,m6) → **2**. Seeded Firm-A:
Σ received = **8,470,000**; Σ gross (billable) = **13,440,000**; overdue = pm10 **930,000**.

### A. finance family (`semantic/finance.mjs`) — ⑤ gross-low

| field | rule (recompute FROM canonical) | Metric stamp |
|---|---|---|
| `income` | `Σ received_amount` over the company's milestones | `unit:'bdt'`, `confidence:'low'`, `note` gross, sources = one `Provenance` per milestone (`recordRef='tally:pmN'`, `sourceName:'TallyPrime'`) |
| `billable` | `Σ gross_amount` | same gross-low stamp |
| `receivables` | `Σ (gross_amount − received_amount) where status≠'paid'` | same |
| `collectionRate` | `round(income ÷ billable × 100)` | `unit:'pct'`, `confidence:'low'`, gross note |

The `monthlyFlow`-derived figures (`ytd*`/`monthIncome`/`monthNet`) are **NOT
backend-backed** — they are illustrative frontend-only sample data (`finance.ts:41`
`monthlyFlowMeta`, `confidence:'low'`, `note:'Illustrative …'`). The backend does
**NOT** serve them. They stay frontend mock with their existing stamp. **FLAGGED**
in §6 (D2-derived): `ytd*`/`month*` stay mock; only `income/billable/receivables/
collectionRate/overdue` cross the seam.

### A-5 (carried) — overview money envelope

`managementOverview()` returns `received`/`total_contract`/`billable` as **bare
scalars** today (Slice 2b enveloped only `overdueAmount`; A-5 ranked these as raw
un-enveloped pg-numeric strings to finance roles). The finance family closes A-5:
serve these three as Metrics (same gross-low stamp) **or** at minimum coerce them
to `Number` AND redact them for a designer (they are money keys — already in the
serializer's `MONEY_KEYS` set). The ledger accepts a Metric or a coerced Number,
but **never a bare pg string**, and **never a number to a designer**.

### B. profitability family (`semantic/profitability.mjs`) — ④ fee-only low

| field | rule | Metric stamp |
|---|---|---|
| per-row `margin` | `round((contract_value − PROJECT_COST[id]) ÷ contract_value × 100)` over active+archived projects | `unit:'pct'`, `confidence:'low'` (**never `insufficient`, never bare**), `completeness:60`, `note:'Fee-only margin — no labour cost; PROJECT_COST is a modeled input, not measured.'`, sources = `[{recordRef:'project:aN', sourceName:'ArchIntel · Projects'}, {recordRef:'model:PROJECT_COST:aN', sourceName:'ArchIntel · Cost model (modeled input)'}]` |

`PROJECT_COST` is a **modeled input** (`finance.ts:67`, a CONTEXT non-migratable
literal). It is **NOT seeded as a canonical fact**. The recompute must read it from
a declared model table OR carry it as a declared constant in `profitability.mjs`
and cite it as `model:PROJECT_COST:aN` (a declared input, NOT an observed source) —
see §3 lineage decision.

### C. aios family (`semantic/aios.mjs`) — match Slice-3 EXACTLY (aios.ts:82-157)

| KPI | treatment | served shape (parity with `AiosKpi`, aios.ts:67-81) |
|---|---|---|
| `autonomy` | **REFUSE** | `{key:'autonomy', value:null, unit:'pct', confidence:'insufficient', completeness:0, sources:[], note:'No signal yet — needs an intervention/escalation log …'}` — **never the fabricated 64** |
| `output` | **COMPUTE** | `value = active ÷ designers = 6/2 = 3.0` (**not 1.5**), `unit:'ratio'`, `confidence:'low'`, `completeness:100`, `formula:"active projects ÷ design staff (role='designer')"`, sources = one per active project (`project:aN`) + one per designer (`member:mN`) |
| `automated` | **COMPUTE low** | `value = round((#automated + 0.5·#assisted) ÷ total)` over the task audit, `confidence:'low'` (editorial classification), sources = one per `auditTask` (`auditTask:tN`) |

`dailyBrief` / `agentActions` / `auditTasks` are **prose/feed** surfaces, not
Metrics. Serve them through, preserving shape. **FLAG (§6 D-AIOS):** `autonomy`'s
refusal and the task-status classification are editorial — the *real-data* AIOS
KPIs are `output` (computed from projects/members) and `automated` (computed from
the task list). `autonomy` stays **REFUSE** until a real intervention log exists.

---

## §2 — Tables / columns / functions the builder adds

### New migration `0003_mart_derived.sql` (idempotent, core-PG only)

Three recompute functions, mirroring `mart.recompute_portfolio_summary`'s pattern
(mint one `kpi_run_id`, scope every read by `current_setting('request.company_id')`
— superuser bypasses RLS, so the **explicit company predicate is the isolation**,
per gap A-3 — insert the summary row + one `kpi_lineage` row per contribution):

1. `mart.recompute_finance(p_as_of timestamptz, p_kpi_version int) returns …`
   - emits `kpi_lineage` rows with `metric_key in
     ('income','billable','receivables')` — one row **per milestone** that
     contributes (so VALUE = Σ lineage holds row-for-row, drillable).
   - `collectionRate` is a **ratio of two Σ's** — derive it in the serializer from
     the income/billable lineage sums (do NOT seed a fake per-row contribution for
     a ratio).
2. `mart.recompute_profitability(p_as_of, p_kpi_version) returns …`
   - emits `kpi_lineage` rows `metric_key='margin'`, one **per project**,
     `contribution_value = round((contract − cost)/contract × 100)` (the per-row
     margin), `entity_id = project id`, `record_ref='project:aN'`. The modeled cost
     is cited as a SECOND source in the serializer (`model:PROJECT_COST:aN`).
3. `mart.recompute_aios(p_as_of, p_kpi_version) returns …`
   - emits `kpi_lineage` for `metric_key in ('output','automated')` only.
     `output`: one row per active project + one per designer member.
     `automated`: one row per audit task (the audit-task list may be a small seeded
     `canonical.audit_task` table OR carried as a declared constant — see §3).
   - `autonomy` emits **NO lineage** (it refuses) — its absence from `kpi_lineage`
     is the structural proof of the refusal.

> **Reuse, don't fork:** the new functions reuse `canonical.source`,
> `canonical.payment_milestone`, `canonical.project`, `canonical.member`. The only
> new canonical surface is the **audit-task** input (§3) and the **PROJECT_COST**
> declared model (§3) — both optional (may be constants in the .mjs).

### `mart.kpi_lineage` reuse (no schema change needed)

The existing `kpi_lineage` table already carries `metric_key`, `entity_id`,
`contribution_value`, `source_id`, `record_ref`, `observed_at`, `company_id` — the
new `metric_key`s (`income`/`billable`/`receivables`/`margin`/`output`/`automated`)
slot in with **no DDL change**. (If the builder wants a `kpi_version` index per
metric_key, that's an additive `create index if not exists` only.)

---

## §3 — The two non-canonical inputs (declared, not observed)

| input | what it is | where it lives | how it is cited |
|---|---|---|---|
| `PROJECT_COST[id]` | a **modeled** per-project direct cost (`finance.ts:67`); CONTEXT non-migratable literal — NOT a fact | a `mart.cost_model(project_id, modeled_cost, company_id)` seed table OR a declared const in `profitability.mjs` | `recordRef='model:PROJECT_COST:aN'`, `sourceName:'ArchIntel · Cost model (modeled input)'` — a DECLARED input, never `confidence` above `low` |
| audit-task statuses | editorial `status` per `auditTask` (`aios.ts:37`) | a `canonical.audit_task` seed table OR a declared const in `aios.mjs` | `recordRef='auditTask:tN'`, `sourceName:'ArchIntel · Task Audit'`, the KPI stamped `confidence:'low'` (editorial) |

Both are **declared inputs**, never seeded as observed canonical facts (CONTEXT
`LITERALS_TO_REPLACE`). Citing them as a `model:` / `auditTask:` ref with a `low`
confidence is the honesty mechanism — the number is computed but stamped.

---

## §4 — Serializer surface (`semantic/finance.mjs` / `profitability.mjs` / `aios.mjs`)

Each module exports a recompute+serialize fn with the signature the ledger calls:

```js
// semantic/finance.mjs
export async function serializeFinance(db, asOf, principal) { … }  // returns financeOverview() shape
export async function servePayments(db, asOf, principal) { … }     // (or arrays.mjs) company-scoped payments array
// semantic/profitability.mjs
export async function serializeProfitability(db, asOf, principal) { … } // rows[{project, contract, received, cost, profit, margin:Metric}]
// semantic/aios.mjs
export async function serializeAiosKpis(db, asOf, principal) { … } // AiosKpi[]  (autonomy refuse / output 3.0 / automated low)
export async function serializeDailyBrief(db, asOf, principal) { … }
export async function serveAgentActions(db, asOf, principal) { … }
```

Rules (identical to `serializeOverview`'s discipline, `serialize.mjs:74-91`):
- **Coerce pg-numeric STRINGS → Number** before building any Metric `value`
  (pglite serializes `numeric` as a JS string — the bare-scalar half of G1/A-5).
- **VALUE = Σ LINEAGE**: each Metric `value` MUST equal Σ of the lineage rows its
  `sources` cite (the ledger reconstructs each Σ; a hardcoded literal cannot pass).
- **Finance band redaction (reuse, don't reinvent):** import/reuse the existing
  `redactRow`/`MONEY_KEYS` machinery from `serialize.mjs` so a **designer** gets
  money keys OMITTED, and money Metrics rewritten to `{value:null,
  confidence:'insufficient'}`. `income`/`billable`/`receivables`/`collectionRate`/
  `margin` are money/finance keys → add them to `MONEY_KEYS` if not present.
  > `collectionRate` and `margin` are derived percentages over money — redact them
  > too (a designer should not infer the firm's collection efficiency / margins).
- **AIOS is NOT money-gated:** `aiosKpis`/`dailyBrief`/`agentActions` are
  operational, not finance — they are **not** redacted by the finance band (any
  authenticated principal sees them). Do not run them through `redactRow`.

---

## §5 — Routes (`backend/server/index.mjs`) — ADD, don't rewrite

Mirror the existing `/api/v1/overview` handler (principal-from-headers →
`set_config request.*` (all three, every request — gap A-2) → recompute at pinned
`as_of=2026-06-22`, `kpi_version=1` → read back summary + lineage → serialize):

| route | serializer | redaction |
|---|---|---|
| `GET /api/v1/finance` | `serializeFinance` | finance band (designer → money omitted/refused) |
| `GET /api/v1/profitability` | `serializeProfitability` | finance band (margin redacted) |
| `GET /api/v1/payments` | `servePayments` | finance band on each row's money columns |
| `GET /api/v1/projects` | `serveProjects` | `contract_value` redacted for designer |
| `GET /api/v1/clients` | `serveClients` | no money → pass through |
| `GET /api/v1/aios/kpis` | `serializeAiosKpis` | none (operational) |
| `GET /api/v1/aios/brief` | `serializeDailyBrief` | none |
| `GET /api/v1/aios/actions` | `serveAgentActions` | none |
| `GET /api/v1/aios/audit` | `serveAuditTasks` | none |

CORS, `Connection: close`, the warm-db teardown discipline, and the
`request.*`-reset-every-request rule are **already correct** in `index.mjs` — copy
the pattern verbatim. Reset ALL `request.*` keys on every request (A-2: no claim
bleed on the warm connection). Each new mart read MUST repeat the
`company_id = v_company` predicate (A-3: superuser bypasses RLS).

---

## §6 — Integration / render sites + flag wiring (frontend)

Extend the existing `VITE_USE_BACKEND_AI` (api.ts) and add `VITE_USE_BACKEND_AIOS`
(aios.ts) seam exactly like `fetchOverview` (`api.ts:46`): default OFF (build
unaffected), ON → fetch the new route with the demo finance principal headers
(`X-Company-Id=FIRM_A`, `X-User-Role=founder`), mock fallback on any failure so the
card never blanks. **Preserve the query keys** (`ai-finance`/`ai-profit`/
`ai-projects`/`ai-clients`/`ai-payments`/`aios-kpis`/`aios-brief`/`aios-actions`/
`aios-audit`) and the `resolve()` shape.

| hook (file) | today | re-thread to |
|---|---|---|
| `useAiFinance` (api.ts:183) | `resolve(financeOverview())` | `fetchFinance()` (flag-gated; same shape) |
| `useAiProfitability` (api.ts:186) | `resolve(profitabilityByProject())` | `fetchProfitability()` |
| `useAiProjects/Clients/Payments` (api.ts:164-172) | `resolve(arr)` | flag-gated fetch; same arrays |
| `useAiosKpis` (aios.ts:215) | `resolve(aiosKpis())` | `fetchAiosKpis()` (VITE_USE_BACKEND_AIOS) |
| `useDailyBrief`/`useAgentActions`/`useTaskAudit` (aios.ts:214-217) | `resolve(...)` | flag-gated fetch |

Render sites are **unchanged** — the payload *shape* is preserved (Metrics already
rendered via `KpiCard metric=` since Slice 4). The swap is data-source only.

---

## §7 — NEEDS PRODUCT DECISION (orchestrator resolves BEFORE the builder runs)

**D-FIN-1 — `ytd*`/`month*` finance figures: stay mock vs backend-serve.**
These derive from `monthlyFlow` (illustrative sample data, `finance.ts:41`, NOT
reconcilable to milestone lineage). **Default: stay frontend mock** with the
existing `monthlyFlowMeta` low/illustrative stamp; the backend serves ONLY
`income/billable/receivables/collectionRate/overdue` (the milestone-backed
figures). Alternative: seed a `mart.monthly_flow` illustrative table and serve them
stamped `confidence:'low', note:'Illustrative …'`. **Decide (default: stay mock).**
The ledger asserts only the milestone-backed figures.

**D-FIN-2 — A-5 overview money: full Metric vs coerced-Number.**
`received`/`total_contract`/`billable` on the overview — envelope as full Metrics
(gross-low, sources) OR just coerce to Number + keep the finance-band redaction.
**Default: full Metric** (consistent trust surface; closes A-5 cleanly). The ledger
accepts either, but **forbids a bare pg string** and **forbids a number to a
designer**. **Decide (default: full Metric).**

**D-AIOS-1 — which `aios-*` endpoints get REAL backend data vs stay mock.**
*(This is the explicitly-requested FLAG.)*
- **Real backend data (computed from canonical):** `output` (active ÷ designers =
  3.0), `automated` (over the audit-task list). These cross the seam as computed
  Metrics.
- **REFUSE (no signal — backend returns null/insufficient):** `autonomy`. Stays a
  refusal until a real intervention/escalation log exists. The backend serves the
  refusal envelope (not a mock 64).
- **STAY MOCK (prose/feed, no Metric, served-through unchanged):** `dailyBrief`,
  `agentActions`, `auditTasks`. These are editorial/operational narrative — the
  backend can serve them (shape-preserving) but they carry **no computed Metric**;
  whether they cross the seam at all is cosmetic. **Default: serve `aios/kpis`
  backend-backed (output+automated real, autonomy refused); `brief`/`actions`/
  `audit` MAY stay frontend mock** (no trust-surface number in them). The `agentActions`
  feed is also bound by ⑦ READ-ONLY-STRICT (this repo PROPOSES; a `delivery_receipt`
  before "handled" is the AIOS Write-discipline manager's Step-6 job, NOT this one).
  **Decide: which of brief/actions/audit cross the seam (default: kpis only).**

**D-AIOS-2 — audit-task statuses: seed table vs declared const.**
The per-task `status` (editorial) — seed a `canonical.audit_task` table OR carry it
as a declared const in `aios.mjs`. **Default: declared const in `aios.mjs`** (it is
editorial classification, not an observed fact — keeping it out of `canonical`
honours the non-migratable-literal rule). **Decide (default: const).**

**D-PROFIT-1 — `PROJECT_COST`: seed `mart.cost_model` table vs declared const.**
Same shape as D-AIOS-2 for the modeled cost. **Default: declared const in
`profitability.mjs`, cited as `model:PROJECT_COST:aN`.** **Decide (default: const).**

---

## §8 — Run / RED-proof

```powershell
# kill strays first:
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'derived|slice2b|spike|--test' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# the RED ledger (currently 9 fail / 0 pass — modules absent):
node --test --test-isolation=none --test-force-exit backend/test/derived-endpoints.design.test.mjs
```

**RED today (verified):** `freshDb()` boots (migrations + seed present), then every
block fails because `backend/semantic/{finance,profitability,aios}.mjs` do not
exist and no recompute emits the new `metric_key`s. That clean failure (impl
absent, NOT harness broken) IS the expected RED.

**GREEN target:** the 3 surface tests import the modules; finance figures are
gross-low Metrics with `value=Σ lineage` (income=8,470,000); margin is fee-only low
per row (never bare/insufficient); aios `output=3.0`, `autonomy` refused,
`automated` low; A-5 money fields enveloped (no bare pg string, no number to a
designer); arrays company-scoped (no Firm-B bleed, pm10 present).

**Existing suites MUST stay green** (verified unaffected by this file):
`spike.acceptance.test.mjs` (4), `slice2b.serializer.test.mjs` (6),
`slice2b.parity.test.mjs` (3), `slice2b.http.test.mjs`, `adversary.*`; frontend
`pnpm --dir app test` (overview-metric / overview-backend / literals-honesty /
trust-surface).

---

## §9 — Acceptance summary (which ledger assertion closes what)

| Ledger block | Closes | What must hold |
|---|---|---|
| `[surface] finance/profitability/aios.mjs` | F6 | the three semantic modules exist + export a recompute fn |
| `[finance/B4]` | F6, F2, ⑤ | income/billable/receivables/collectionRate are gross-low Metrics; VALUE=Σ lineage; income=8,470,000; refs ~ `tally:pm` |
| `[profit/B5]` | F4(retired), F2 | every row's margin is a fee-only **low** Metric (never bare, never insufficient); cites project + modeled cost |
| `[aios/Slice-3]` | F6, F2 | autonomy REFUSE (null/insufficient, ≠64); output 3.0 (≠1.5); automated low — parity with aios.ts:82-157 |
| `[A-5]` | A-5 | received/billable enveloped (Metric or Number, never bare pg string) |
| `[band/⑤]` | ⑤, A-3 | designer never sees a finance number (omitted or refused) |
| `[arrays]` | F6 | projects/clients/payments company-scoped; no Firm-B bleed; pm10 present |
