# Step 0 BUILD-CONTRACT — Contract guard (queryKey→endpoint→shape diff) + production-port plan (Supabase/FastAPI)

> **Reviewer-authored. Builder ≠ reviewer.** This contract has TWO deliverables:
> **(a)** a runnable CI contract-guard (one frontend RED ledger is already written —
> `app/src/lib/archintel/__tests__/contract-ci-and-prod-port.design.test.ts`); and
> **(b)** a design-heavy production-port plan (no RED ledger — it is a sequencing
> document + a `*.supabase.sql` audit).
>
> **Builder creates / edits (and ONLY these for (a)):**
> - `app/src/lib/archintel/contract/manifest.ts` — the contract manifest + `assertContract`.
> - `app/src/lib/archintel/contract/shape.ts` — `describeShape` / `diffShape` / `isMetricShape`.
> - `app/package.json` — add a `contract` script (`vitest run …design.test.ts`) wired into CI.
>   (Optionally a tiny `app/scripts/contract-check.mjs` that boots the backend and runs
>   `assertContract` against LIVE served JSON; see §3 — this is the only place a real
>   runtime touches the guard.)
>
> **Builder MUST NOT edit:** the RED ledger, any `backend/test/**`, the other archintel
> `__tests__/*`, `types.ts`, `serialize.mjs`, `vitest.config.ts`, `vite.config.ts`,
> `app/src/lib/archintel/{api,aios,finance,intelligence,data}.ts` (the guard READS the
> live producers; it does not change them).
>
> Honor every locked decision in `backend/CONTEXT.md` (tax DEFERRED, coverage RETIRED,
> AIOS read-only-strict, single clock `as_of=2026-06-22`) and the pglite hard rules.

---

## Why this step exists (the drift it closes)

Promise ⑦ — "swap mock→backend **without rewriting the React tree**" — is enforced today
only by convention. Docs 13/14 and the dormant `types.ts` already **drifted** from the live
`app/src/lib/archintel/*` (CONTEXT.md: "the spec docs drifted; read the LIVE code"). Nothing
**fails the build** when a hook's TS row-shape and the served JSON disagree. F5 (frontend
contract reconcile) and F6 (seam swap) both depend on a machine-checkable contract of record.

This step makes the contract of record **executable**: a single manifest
(`queryKey → endpoint → row-shape`) plus a **shape-diff guard** that turns any divergence
into a CI failure. It is the structural complement to Slice 2b's flag seam — 2b proved ONE
metric swaps cleanly; this proves nothing CAN swap dirtily without the build going red.

---

## §0 — The surface the guard covers (the contract of record)

The 10 **derived/aggregate** endpoints (the ones CONTEXT.md says "wrap function calls →
become server aggregates / semantic functions, NOT path swaps"). These are the ⑦ swap
surface and the only ones whose JSON shape can silently drift from a TS Metric envelope.

| # | queryKey | live producer (api/aios) | endpoint (versioned) | row-shape (leaf summary) | runtime |
|---|---|---|---|---|---|
| 1 | `ai-overview` | `managementOverview()` via `fetchOverview()` | `/api/v1/overview` | object: `overdueAmount:metric`, `pendingApprovals:metric`, `collectionRate:metric`, `activeCount/completedCount/overdueCount/blockedCount:number`, `totalContract/received/billable:number` | pglite→supabase |
| 2 | `ai-finance` | `financeOverview()` | `/api/v1/finance/overview` | object of 11 **metric** leaves (`income`,`billable`,`receivables`,`overdue`,`month*`,`ytd*`,`collectionRate`) | pglite→fastapi |
| 3 | `ai-profit` | `profitabilityByProject()` | `/api/v1/finance/profitability` | array of `{project:object, contract:number, received:number, cost:number, profit:number, margin:metric}` | pglite→fastapi |
| 4 | `ai-expcat` | `expenseByCategory()` | `/api/v1/finance/expense-by-category` | array of `{category:string, amount:number}` | pglite→fastapi |
| 5 | `ai-stagerisk` | `stageRisk` | `/api/v1/risk/stage` | array (stage-risk band rows — read live `intelligence.ts` for exact leaf set) | pglite→fastapi |
| 6 | `ai-insights` | `riskInsights` | `/api/v1/risk/insights` | array (insight rows w/ confidence — read live `intelligence.ts`) | pglite→fastapi |
| 7 | `aios-audit` | `auditTasks` | `/api/v1/aios/audit` | array of `AuditTask` (`humanGate:boolean` re-tagged t1/t3/t4/t5 per ⑦) | pglite→fastapi |
| 8 | `aios-kpis` | `aiosKpis()` | `/api/v1/aios/kpis` | array of `AiosKpi` (`value:number\|null`, `confidence`, `sources[]`) — `autonomy` REFUSES (`value:null`) | pglite→fastapi |
| 9 | `aios-brief` | `dailyBrief()` | `/api/v1/aios/brief` | object `{date, summary, needsYou[], handled[]}` | pglite→fastapi |
| 10 | `aios-actions` | `agentActions` | `/api/v1/aios/actions` | array of `AgentAction` (proposal feed — read-only-strict ⑦) | pglite→fastapi |

**Out of scope for the guard (path-swaps, not aggregates):** the raw-array passthroughs
`ai-projects / ai-project / ai-members / ai-clients / ai-files / ai-approvals / ai-subs /
ai-payments / ai-decisions / ai-activity / ai-risks / ai-expenses / ai-flow`. These return
live arrays unchanged and become table/path swaps. They get a lighter **row-shape audit**
(same `describeShape`, no per-leaf metric semantics) — author it as a follow-up if the fan-out
needs it; it is NOT required to make the RED ledger green.

> The shape descriptors above are **summaries**. The builder derives the AUTHORITATIVE shape
> by calling `describeShape(producer())` on the live producer (the RED ledger's
> `[diff-identical-empty]` test enforces manifest==producer), so the manifest can never
> encode a stale hand-typed shape. **Read the live code, not this table, for leaf truth.**

---

## §1 — `contract/manifest.ts` (NEW — builder authors)

```ts
export type LeafKind =
  | "metric" | "metric[]"            // Metric envelope (value+confidence+sources) / array of
  | "number" | "string" | "boolean"
  | "null" | "array" | "object";

export type ShapeNode =
  | { kind: Exclude<LeafKind, "object"> }
  | { kind: "object"; children: Record<string, ShapeNode> }
  | { kind: "array"; element: ShapeNode };

export interface ContractEntry {
  queryKey: string;     // exact live key — ai-* / aios-*, preserved verbatim (⑦)
  endpoint: string;     // /api/v1/… versioned route this key maps to
  runtime: "pglite" | "frontend" | "supabase" | "fastapi";
  shape: ShapeNode;     // === describeShape(producer()) — enforced by the ledger
}

export const HEADLINE_KEYS: string[];     // the 10 keys in §0
export const CONTRACT: ContractEntry[];   // one entry per HEADLINE_KEY

// Throws a readable Error naming the FIRST diverging queryKey (and the diff) when any
// served payload violates its manifest shape; returns void on full match.
export function assertContract(servedByKey: Record<string, unknown>): void;
```

**Acceptance the ledger pins (must hold):**
- `CONTRACT` covers **exactly** the 10 headline keys (`[covers-10]`), no omission/padding.
- Every entry's `endpoint` matches `^/api/v1/` and `runtime ∈ {pglite,frontend,supabase,fastapi}` (`[maps-endpoint+runtime]`).
- `CONTRACT[i].shape` **equals** `describeShape(producer())` for its key (`[diff-identical-empty]`).
- `assertContract` **throws naming the key** on a Metric→number demotion, **does not throw** on match (`[guard-runnable]`).

> **`assertContract` MUST iterate `CONTRACT`**, not the input, so an endpoint that DISAPPEARS
> from `servedByKey` is a diff (missing → throw), not a silent skip.

---

## §2 — `contract/shape.ts` (NEW — builder authors)

```ts
export function describeShape(value: unknown): ShapeNode;
//   - object → { kind:'object', children:{…} } recursively.
//   - a Metric (has BOTH 'value' and 'confidence' and 'sources') → leaf { kind:'metric' }
//     (do NOT descend — its internal value may legitimately be null|number; the metric
//      envelope is the contract, not the inner number). An array whose FIRST element is a
//      Metric → { kind:'metric[]' }.
//   - array (non-metric) → { kind:'array', element: describeShape(first ?? {}) }.
//   - number|string|boolean|null → the matching leaf kind.

export function isMetricShape(node: unknown): boolean;   // node.kind === 'metric' | 'metric[]'

export function diffShape(expected: ShapeNode, actual: ShapeNode): ShapeDiff[];
//   - [] when actual satisfies expected.
//   - one ShapeDiff per: missing key, extra key, kind mismatch (e.g. metric→number),
//     array-element mismatch. Each ShapeDiff carries a dotted `path` (e.g.
//     'overdueAmount') so the message can name the field — the ledger greps the path.
export interface ShapeDiff { path: string; expected: string; actual: string; reason: string; }
```

**Metric detection is load-bearing.** `isMetricShape` is how the guard catches the F2/① drift
(a Metric demoted to a bare scalar). It keys off the **envelope** (`value`+`confidence`+`sources`),
matching `serialize.mjs:isMetric` and `types.ts:50-62`. Mirror that predicate exactly so the
frontend guard and the backend serializer agree on what "a Metric" is.

**Determinism:** `describeShape` reads only the value passed in — no env, no clock, no network.

---

## §3 — Wiring the guard into CI (two layers)

1. **Pure/static layer (RED ledger, no runtime):** the existing
   `…design.test.ts` runs under `pnpm --dir app test` (vitest, node env). It proves the
   manifest matches the live producers AND that `diffShape`/`assertContract` actually catch
   missing-key + kind-mismatch drift. This is the layer that **fails the next drift** and needs
   **no Docker / no Supabase** — it runs on the existing frontend test runtime today.

2. **Live layer (optional, needs the backend running):** `app/scripts/contract-check.mjs`
   boots `backend/server/index.mjs` (pglite warm), fetches each `/api/v1/*` endpoint that
   exists, and calls `assertContract({ 'ai-overview': servedJson, … })`. Today only
   `/api/v1/overview` is implemented (Slice 2b), so this script asserts the ONE live endpoint
   and SKIPS the not-yet-served keys with a printed note. As the fan-out adds endpoints, each
   new route flips from "skipped" to "asserted" — the guard's coverage grows mechanically.
   Add `"contract": "vitest run src/lib/archintel/__tests__/contract-ci-and-prod-port.design.test.ts"`
   to `app/package.json` and call it in CI alongside `test`.

> **Runtime split (critical):** the **shape-diff guard never needs a real runtime** — it diffs
> TS-derived shapes against producer JSON in-process. Only the OPTIONAL live cross-check (layer 2)
> needs the pglite server, and that already runs on node today. So **Step 0(a) is NON-BLOCKING on
> any provisioning** — it ships now, on pglite/node.

---

## §4 — PRODUCTION-PORT PLAN (design-heavy — NO RED ledger)

The spike runs on **pglite + node:http + TypeScript**. Production is **Supabase Postgres +
Python/FastAPI versioned KPI functions + Claude as a tool-calling narrator** over those
functions. This is the sequenced bridge. It is design only — there is no failing test here;
the gate is the `*.supabase.sql` audit (§4.1) + the FastAPI parity contract (§4.2).

### §4.1 — What is ALREADY Supabase-faithful (audit of the `*.supabase.sql` variants)

| Artifact | pglite path | `*.supabase.sql` variant | Faithful? | Port action |
|---|---|---|---|---|
| `0001_canonical.sql` | core-PG; UUIDs minted in seed; `text + unique(lower(email))` for citext; tax cols **plain nullable** (⑤ deferred) | `0001_canonical.supabase.sql` — `pgcrypto`+`citext`, `auth.jwt()->>'company_id'` RLS policies, **GENERATED** tax cols + `reconcile_net` CHECK | **YES (authored)** | Run `0001_*.supabase.sql` on Supabase. **Keep tax cols GENERATED but behind the `TAX_NET` flag — they stay dormant until ⑤ re-opens** (CONTEXT ⑤). Verify the live data still satisfies `reconcile_net`. |
| `0002_mart.sql` | `md5(random()||clock_timestamp())::uuid` for `kpi_run_id`; recompute scopes by explicit `company_id` predicate | `0002_mart.supabase.sql` — `gen_random_uuid()`, RLS enabled+policies on `portfolio_summary`/`kpi_lineage`, recompute reads `v_company` from `auth.jwt()`, KEEPS the explicit predicate (defense in depth) | **YES (authored)** | Run on Supabase. The explicit `company_id` predicate stays (closes adversary **A-3**: under a superuser/SECURITY-DEFINER path RLS can be bypassed, so the predicate is the real guard). |
| `seed_live.mjs` | mints UUIDs, `request.*` GUC principal | — (no supabase variant; it's app code) | n/a | Seed runs identically against Supabase Postgres (it's parameterized SQL over a pg client). Swap the `set_config('request.*')` emulation for real JWT issuance (§4.3). |
| `serialize.mjs` | finance-band response filter; reads `principal.role` | — (becomes the FastAPI serializer, §4.2) | n/a | Re-express as the FastAPI Metric serializer — SAME `MONEY_KEYS` set, SAME refusal shape `{value:null, confidence:'insufficient'}`. The shape is the contract; only the language changes. |
| `server/index.mjs` | `node:http`; principal from `X-*` headers | — | n/a | **Replaced** by FastAPI (§4.2). The header-principal shim becomes JWT-claim extraction. |

**Audit verdict:** the **schema + mart layers are already Supabase-faithful** (both
`*.supabase.sql` variants exist and were syntax-authored against real PG features). The
**semantic layer (serialize) + transport (node:http)** are the parts that get **re-implemented**
in Python/FastAPI — not ported line-for-line, but re-expressed to emit byte-identical Metric JSON.

> **The Metric JSON is the invariant across BOTH the language port AND the runtime port.** The
> contract guard in §1–§3 is what proves that invariant holds when FastAPI replaces node:http
> (point `contract-check.mjs` at the FastAPI base URL → same `assertContract`, same manifest).

### §4.2 — What the FastAPI semantic layer looks like

- **Versioned KPI functions mirror the TS serializers.** One FastAPI route per derived endpoint
  in §0 (`/api/v1/overview`, `/api/v1/finance/overview`, …, `/api/v1/aios/kpis`). Each route:
  1. calls the **same SQL recompute function** (`mart.recompute_portfolio_summary($as_of,$kpi_version)`,
     and its siblings for finance/risk/aios) — the deterministic versioned semantic layer
     (promise ③: AI narrates, never computes);
  2. reads back the summary row + `mart.kpi_lineage`;
  3. serializes a **Metric** (`{value,unit,label,confidence,completeness,asOf,formula,sources[],note}`)
     **identical** to `types.ts:50-62` / `serialize.mjs:buildOverdueMetric`.
- **`kpi_version` is a route/function parameter**, never inferred — bumping the formula bumps the
  version; old versions stay callable (deterministic reproducibility of past KPI runs).
- **Pydantic models = the Metric/Provenance shapes**; FastAPI's `response_model` enforces the
  envelope server-side, the contract guard enforces it against the consumer.
- **Finance band** = the same `serialize.redactRow` rule re-expressed: non-`{founder,finance}`
  principal → money keys OMITTED, money Metrics → `{value:null, confidence:'insufficient'}`.
  Driven by the verified JWT role claim, not a header (§4.3).

### §4.3 — Claude as a tool-calling narrator (promise ③)

- Claude is given the §0 endpoints as **tools** (one tool per versioned KPI function). It may
  ONLY call them and **word the returned Metric** — it never computes a number. The narrator
  must echo `confidence`/`note` and refuse (say "insufficient signal") when `value===null`
  (promise ②). It cites `sources[].recordRef` (promise ①).
- This repo is **AIOS READ-ONLY-STRICT** (CONTEXT ⑦): the narrator/tools here **propose only**;
  a separate AIOS repo holds write credentials and executes. No tool in this layer sends/drafts
  to WhatsApp/Drive — `agent_action` rows are proposals behind maker-checker.

### §4.4 — RLS / auth move to real Supabase Auth JWTs

| Spike (pglite) | Production (Supabase) |
|---|---|
| `current_setting('request.company_id'/'request.user_id'/'request.role')` GUCs set by `set_config` | **`auth.jwt() ->> 'company_id'`** etc. from a verified Supabase Auth JWT |
| local `app_user` table emulates identity | **`auth.users`** + FK from `canonical.member` to `auth.users(id)` |
| `X-Company-Id`/`X-User-Role` request headers (server/index.mjs) | claims in the signed JWT (header default-to-FIRM_A footgun **removed** — adversary **A-4**) |
| RLS policies present but **bypassed under the pglite superuser** (A-3) | RLS **enforced** under the authenticated (non-superuser) role; explicit `company_id` predicate kept as defense in depth |
| auth providers: none (demo principal) | **Google OAuth + Microsoft OAuth + email OTP** via Supabase Auth; role grant (`founder/finance/...`) carried as a JWT claim / `app_metadata` |

Hardening carried from ADVERSARY-2B that the prod auth layer MUST close: **A-2** (reset the full
`request.*`/claim set per request, or use txn-local `set_config(...,true)`), **A-4** (require
company from the verified JWT, 400 on absent — no default tenant), **A-6** (generic 4xx/5xx
bodies; never echo the raw PG error / attacker input).

### §4.5 — Sequenced port plan (what runs WHEN, what blocks WHEN)

| Phase | Work | Runtime needed | Blocking? |
|---|---|---|---|
| **P0 (now)** | Build the contract guard (§1–§3); keep all KPI logic on pglite; keep authoring `*.supabase.sql` variants alongside every new migration | **pglite + node (have it)** | **Never blocks.** Ships today. |
| **P1** | Re-express the serializer + routes as FastAPI over the SAME pglite (or local Postgres) DB; point `contract-check.mjs` at FastAPI; prove Metric parity via the guard | Python 3.13 (have it) + the existing DB | **Not blocking** — FastAPI can sit over pglite-via-pg-wire or a local Postgres; no Supabase yet. |
| **P2** | Stand up a **real Supabase Postgres** + run the `*.supabase.sql` variants; move RLS to `auth.jwt()`; wire Supabase Auth (Google/MS OAuth + email OTP) | **Docker Desktop (supabase-local) OR a hosted Supabase project** | **BLOCKING here, and only here.** Real `auth.users` FKs, `auth.uid()` policies, and OAuth callbacks cannot run on pglite. Everything BEFORE P2 progresses without it. |
| **P3** | Claude tool-calling narrator over the FastAPI KPI functions; the separate AIOS repo wires execution (read-only-strict boundary preserved) | P2 runtime + Claude API | Blocked only by P2 (needs real auth/tenancy to be meaningful). |

> **The single provisioning decision the USER must make is at P2:** *Docker Desktop running
> supabase-local* **vs.** *a hosted Supabase project*. Until P2, **everything (the guard, the
> FastAPI port, KPI parity) keeps progressing on pglite/node** — provisioning is **not** on the
> critical path for P0/P1. See NEEDS PRODUCT DECISION.

---

## §5 — Integration / render sites

- **Guard (a):** no render site — it is a CI gate. It READS the live producers
  (`api.ts`/`aios.ts`/`finance.ts`/`intelligence.ts`); it changes none of them. Wired into CI
  via the `contract` npm script. The `ai-overview`/`aios-*` query keys and the `resolve()`/
  `fetchOverview` seam shapes (promise ⑦) are **asserted, not modified**.
- **Prod port (b):** the consumers (`app/src/pages/app/Dashboard.tsx`, Finance, Intelligence,
  the `KpiCard`s) are UNCHANGED — that is the whole point of ⑦. They keep calling the same hooks;
  only the data SOURCE behind `VITE_USE_BACKEND_AI` / `VITE_BACKEND_AI_URL` moves
  (node:http→FastAPI→Supabase). The guard is what lets the source move safely.

---

## §6 — NEEDS PRODUCT DECISION

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **PD-1** | **P2 production runtime** — when the prod port needs real auth/tenancy. | (a) **Docker Desktop + supabase-local** (free, offline, full auth stack locally; needs Docker installed — this machine has none today). (b) **Hosted Supabase project** (no local Docker; real OAuth callbacks work out of the box; free tier; data leaves the machine). | **(b) hosted Supabase project** for P2 — OAuth redirect URIs and the managed `auth.users`/JWT signer work immediately, and the firm is single-tenant so the free tier suffices. Keep pglite as the offline test runtime. Provision **only at P2** (P0/P1 do not need it). |
| **PD-2** | **Guard coverage scope** — does the CI guard cover only the 10 derived endpoints, or also the ~13 raw-array passthroughs? | (a) 10 derived only (the ⑦ swap surface). (b) all ~23 query keys (full row-shape audit). | **(a) 10 derived now**, add (b) as a follow-up row-shape audit during the fan-out. The derived endpoints are where Metric/scalar drift actually happens; the passthroughs are structurally lower-risk. |
| **PD-3** | **Live cross-check (layer 2) in CI** — run `contract-check.mjs` against the booted backend in CI, or keep CI to the static ledger only? | (a) static ledger only (fast, hermetic, no server boot). (b) also boot the backend and assert live served JSON. | **(a) static in CI + (b) as a local/pre-merge gate.** The static ledger catches manifest↔producer drift hermetically; the live check needs a warm pglite (slower, the `--test-force-exit` teardown quirk) — run it on demand / pre-merge, not on every CI push, until FastAPI replaces node:http. |
| **PD-4** | **FastAPI base path / versioning** — `/api/v1/...` per the manifest, or a different scheme? | (a) `/api/v1/<domain>/<kpi>` (matches the manifest endpoints). (b) GraphQL / single aggregate route. | **(a) versioned REST per the manifest** — it matches the existing `/api/v1/overview` Slice-2b route and the `kpi_version`-parameterized semantic layer (promise ③). |

---

## §7 — Definition of done (for the BUILDER of part (a))

1. `contract/manifest.ts` + `contract/shape.ts` exist; the RED ledger
   `contract-ci-and-prod-port.design.test.ts` goes **GREEN** (all 8 cases).
2. `assertContract` throws-naming-the-key on a Metric→scalar demotion and a dropped endpoint;
   returns clean on a matching served-by-key map.
3. The manifest covers **exactly** the 10 headline keys, each mapped to a `/api/v1/*` endpoint +
   a runtime, with `shape === describeShape(producer())`.
4. A `contract` npm script is wired into CI; existing suites stay green
   (`pnpm --dir app test` = the prior 38 + the new 8 = 46 pass; backend node:test unchanged).
5. **Builder did NOT edit** the RED ledger, the live producers, `types.ts`, `serialize.mjs`,
   or any other `__tests__/*`. The prod-port plan (§4) is design — no code is owed for it here;
   its gate is the `*.supabase.sql` audit + the FastAPI Metric-parity contract checked by the guard.
