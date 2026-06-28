# Slice 2b BUILD-CONTRACT — swap overdueAmount's DATA source from mock → real pglite/kpi_lineage backend over HTTP, behind a flag

> **Reviewer-authored. Builder ≠ reviewer.** Three backend ledgers
> (`backend/test/slice2b.serializer.test.mjs`, `slice2b.http.test.mjs`,
> `slice2b.parity.test.mjs`) and one frontend ledger
> (`app/src/lib/archintel/__tests__/overview-backend.test.ts`) are **RED today**.
> This file tells the **builder** exactly what to create so they go GREEN —
> **without** the reviewer implementing the server, serializer, or `api.ts` fetch.
>
> **Builder creates / edits (and ONLY these):**
> - `backend/server/index.mjs` — the local Node HTTP service (NEW).
> - `backend/semantic/serialize.mjs` — extend `serializeOverview` to close **G1**
>   (return a full Metric envelope from `kpi_lineage` for finance-eligible
>   principals). Existing 2-arg behaviour must stay byte-compatible.
> - `app/src/lib/archintel/api.ts` — add the `VITE_USE_BACKEND_AI` flag wiring +
>   backend fetch + mock fallback.
>
> **Builder MUST NOT edit:** `backend/test/**`, the Slice-2a frontend ledger
> (`app/src/lib/archintel/__tests__/overview-metric.test.ts`), the spike tests
> (`spike.acceptance.test.mjs`, `adversary.spike.test.mjs`), `harness.mjs`,
> `types.ts`, the spike's finance-eligible role set, `vite.config.ts`,
> `vitest.config.ts`.
>
> Obey every locked decision in `backend/CONTEXT.md` and the pglite hard rules
> (no `gen_random_uuid`/`pgcrypto`, core-PG only).

---

## What 2b closes

| Gap | Today | After 2b |
|---|---|---|
| **G1** (high) — served-payload trust envelope missing at the **backend**. | `serializeOverview` returns `overdueAmount` as a **bare scalar** for owners (in pglite a pg-numeric **string** `"930000"`), with no `confidence`/`note`/`sources`. ① proven at the DB table, not at the API surface. | `serializeOverview` returns `overdueAmount` as a full **Metric** envelope whose `sources[]` come from `mart.kpi_lineage` (real DB provenance), `confidence:'low'`, gross note. |
| **⑦** seam swap — proven end-to-end on **one** metric. | Frontend `managementOverview()` always reads the in-process mock (Slice 2a). No backend fetch exists. | A flag `VITE_USE_BACKEND_AI` (default OFF) gates the data source. ON → `fetch('/api/v1/overview')` from the real pglite backend; the `ai-overview` queryKey + `resolve()` seam shape are preserved; mock fallback on fetch failure. |
| **G2** (partial) — E2E through a fetch boundary. | Spike exercised SQL + serializer **directly**. | The HTTP service boots pglite → migrations → seed → recompute → serialize, and serves the Metric JSON over HTTP. (Wiring it behind the **live React hook** in the running app is the manual gate §C; the unit ledger proves the wrapper picks the backend payload with `fetch` mocked.) |

**Scope boundary (LOCKED):** per-user role→finance gating (whether `principal`/Fariha
sees finance) is **deferred to the Auth & Finance Gating manager (Step 2)**. For 2b:
- the **live demo fetch** uses a **finance-eligible** principal (role `founder`
  or `finance`) so the card stays visible;
- **redaction is proven by UNIT tests** using a `designer` principal.
Do **not** change the spike's finance-eligible role set.

---

## §1 — The HTTP service: `backend/server/index.mjs` (NEW)

ES module, Node 23, **no external HTTP deps** (use built-in `node:http`; pglite is
already a backend dep). It must be **importable** by the test (no auto-`listen` on
import) **and** runnable as a script (`node backend/server/index.mjs` for the live
demo).

### Required named exports

```js
// backend/server/index.mjs
export async function buildDb();          // boot pglite + apply migrations + seed ONCE (warm), return PGlite
export function createHandler(db);        // (req,res) Node request handler bound to a warm db
export async function createServer(opts);  // -> { server: http.Server, db } ; server NOT yet listening
export async function startServer(opts);   // createServer + server.listen(opts.port ?? 0) ; resolves to { server, db, port, url }
export default startServer;
```

- `buildDb()` reuses the harness primitives: import `applyMigrations`, `runSeed`
  from `backend/test/harness.mjs` (or replicate them) so the served data is the
  SAME seed the ledger uses (pm10 = 930000 overdue). Boot pglite, apply
  migrations, run seed **once** and keep the instance **warm** for the process
  lifetime (do NOT re-seed per request).
- `createServer(opts)` returns the http.Server **without** calling `.listen` so
  the test can `listen(0)` on an ephemeral port and `close()` it deterministically.
- `startServer({ port })` is the convenience for the live demo; default port `0`
  (ephemeral) unless a `PORT` is given.

### Route

`GET /api/v1/overview` — the only required route for 2b.

1. **Principal from headers** (JWT-claim emulation, mirrors `request.*`):
   - `X-Company-Id` → `request.company_id` (default `FIRM_A` = `00000000-0000-0000-0000-00000000aaaa` when absent, for the demo).
   - `X-User-Role` → `request.role`.
   - `X-User-Id` → `request.user_id` (optional).
   Set them via `select set_config('request.company_id'|'request.role'|'request.user_id', $1, false)` on the warm db before the recompute, exactly as the harness/tests do.
2. **Recompute** `mart.recompute_portfolio_summary('2026-06-22'::timestamptz, 1)`
   for that principal (pinned `as_of=2026-06-22`, `kpi_version=1`). Read back the
   inserted summary row + its `kpi_lineage` rows for `metric_key='overdueAmount'`
   filtered to that run's `kpi_run_id`.
3. **Serialize** with `serializeOverview(summaryRow, lineageRows, principal)` (§2).
4. **Respond** `200 application/json` with the overview object. `overdueAmount` is
   a Metric (finance-eligible) or omitted/refused (non-finance) per §2.
5. **CORS**: every response (incl. an `OPTIONS` preflight) carries
   `Access-Control-Allow-Origin: http://localhost:5173` (the Vite dev origin) and
   `Access-Control-Allow-Headers: Content-Type, X-Company-Id, X-User-Role, X-User-Id`.
   (A permissive `*` also satisfies the header assertion, but the dev origin is the
   intent.)
6. Any other path → `404`. A handler error → `500` JSON `{ error }` (never crash
   the process).

> The recompute mints a fresh `kpi_run_id` per request (per spike §2). That is
> fine — the served Metric reads back **its own** run's lineage by that id.

---

## §2 — `serializeOverview` extended (close G1) — `backend/semantic/serialize.mjs`

### New signature (backwards-compatible — the spike test still calls the 2-arg form)

```
serializeOverview(row, lineageRows, principal)   // 2b — the full form
serializeOverview(row, principal)                // 2a/spike — still valid (no lineage → no Metric build)
```

**Overload detection (REQUIRED so `spike.acceptance.test.mjs` stays green):** the
existing spike test calls `serializeOverview(rawRow, FIRM_A_VIEWER)` (two args,
2nd is a *principal*: an object with a `role` / `companyId` and **no** array
shape). The builder MUST detect the arity:
- If the 2nd arg is an **Array** → it is `lineageRows`; the 3rd arg is the principal.
- Else → the 2nd arg is the principal; there are no lineage rows (2a behaviour:
  no Metric is synthesized; redaction rules below still apply to the raw row).

> Recommended: `function serializeOverview(row, a, b){ const [lineageRows, principal] = Array.isArray(a) ? [a, b] : [[], a]; … }`

### Behaviour — FINANCE-ELIGIBLE principal (role `founder` or `finance`)

`overdueAmount` is returned as a **Metric** built FROM `lineageRows` (the
`kpi_lineage` rows for `metric_key='overdueAmount'`, this run) — **not** synthesized
from a constant:

```
overdueAmount = {
  value:        Σ lineageRows.contribution_value   (coerced pg-numeric string → Number),
  unit:         'bdt',
  label:        non-empty string (e.g. "Overdue payments (gross) — N milestone(s)"),
  confidence:   'low',                              // ⑤ tax DEFERRED → gross
  completeness: <number>,                           // e.g. 100 (gross-complete at milestone grain)
  asOf:         <ISO from the summary row's as_of, e.g. "2026-06-22T00:00:00.000Z">,
  formula:      "Σ (gross_amount − received_amount) over status='overdue' milestones",
  note:         string matching /gross|withhold/i,  // e.g. "Gross … VAT/VDS/AIT withholding not modeled."
  sources:      Provenance[] — ONE per lineage row, mapped:
                  { sourceId:   String(row.source_id),
                    sourceName: 'TallyPrime',        // human label for the source
                    recordRef:  row.record_ref,      // e.g. "tally:pm10" — REAL, from kpi_lineage
                    observedAt: <ISO from row.observed_at> }
}
```

- **`value` = Σ LINEAGE**: the Metric value MUST equal the sum of the lineage
  rows' `contribution_value`, which (by spike invariant) equals the summary
  `overdueAmount`. Builder MUST coerce pg numeric **strings** → `Number` (pglite
  serializes `numeric` as a JS string — the bare-scalar half of G1).
- **`sources[].recordRef`** MUST be the real `record_ref` from `kpi_lineage`
  (contains `tally:pm10` for the seeded Firm-A run) — NOT a synthesized/constant.
- For other (non-money) summary fields the finance-eligible row passes through as
  today.

### Behaviour — NON-FINANCE principal (e.g. `designer`) — unchanged from spike

- Money keys (incl. `overdueAmount`) are **OMITTED** entirely (key absent, NOT
  present-with-null), **OR** if `overdueAmount` is carried as a Metric it is
  rewritten to `{ value: null, confidence: 'insufficient' }` (plus non-money
  metadata). Never a computed number (promise ②). This is exactly the spike's
  current `redactRow` behaviour — keep it.

> The Metric envelope is fed by `kpi_lineage` rather than the mock `payments`
> array, but its **shape is identical to Slice 2a** (see §4 parity) so the React
> consumer (`KpiCard metric=`) and the swap are drop-in.

---

## §3 — `api.ts` flag wiring — `app/src/lib/archintel/api.ts`

### Flag

- Env var: **`VITE_USE_BACKEND_AI`** (Vite exposes `import.meta.env.VITE_*`).
- **Default OFF.** `import.meta.env.VITE_USE_BACKEND_AI` undefined/`'false'`/`'0'` →
  OFF. Truthy only when `=== 'true'` (or `'1'`). Keep it a pure boolean read; no
  wall-clock, no network at module load.
- Backend base URL: **`VITE_BACKEND_AI_URL`** (default `http://localhost:8787`),
  so the fetch target is configurable.

> **Default OFF keeps `vite build` / deploy unaffected** — the prototype dev/build
> path never fetches; existing Slice-2a behaviour is byte-identical with the flag
> off.

### Wiring (preserve the ⑦ seam exactly)

The `ai-overview` queryKey and the shape returned by the query function MUST NOT
change. Recommended:

```ts
const USE_BACKEND_AI = import.meta.env.VITE_USE_BACKEND_AI === "true";
const BACKEND_AI_URL = import.meta.env.VITE_BACKEND_AI_URL ?? "http://localhost:8787";

// Returns the SAME overview shape as managementOverview() (Metric for overdueAmount).
export async function fetchOverview() {
  if (!USE_BACKEND_AI) return resolve(managementOverview());   // OFF: existing mock seam, unchanged
  try {
    const res = await fetch(`${BACKEND_AI_URL}/api/v1/overview`, {
      headers: { "X-Company-Id": FIRM_A, "X-User-Role": "founder" },  // finance-eligible demo principal (Step-2 defers per-user gating)
    });
    if (!res.ok) throw new Error(`backend ${res.status}`);
    return await res.json();                                    // backend overview (same Metric shape)
  } catch {
    return resolve(managementOverview());                       // ON but failed → mock fallback (stays usable)
  }
}

export const useAiOverview = () =>
  useQuery({ queryKey: ["ai-overview"], queryFn: () => fetchOverview() });
```

- `managementOverview()` stays exported and unchanged (Slice 2a). With the flag
  OFF, `fetchOverview()` returns exactly `resolve(managementOverview())` — the
  Slice-2a mock Metric, byte-for-byte.
- With the flag ON, `fetchOverview()` returns the backend overview JSON, whose
  `overdueAmount` is the same Metric shape (§4).
- **Mock fallback stays** if the fetch fails (network error or non-2xx) — the
  card never goes blank.
- The frontend ledger imports `fetchOverview` (the seam wrapper) — keep it
  **named-exported**. `FIRM_A` const = `'00000000-0000-0000-0000-00000000aaaa'`.

---

## §4 — Parity Metric shape (the swap is drop-in)

The backend `overdueAmount` Metric JSON has the **SAME keys + types** as the
Slice-2a frontend Metric, **and the same `recordRef` `tally:pm10`** — so the swap
is drop-in and the `ProvenancePopover` renders identically.

| field | type | value rule | parity with 2a |
|---|---|---|---|
| `value` | `number` | Σ lineage `contribution_value` (= 930000 for the seeded Firm-A run) | same number |
| `unit` | `'bdt'` | literal | same |
| `label` | `string` (non-empty) | gross overdue label | same kind |
| `confidence` | `'low'` | ⑤ tax deferred | same |
| `completeness` | `number` | gross-complete | same |
| `asOf` | `string` (ISO, non-empty) | from summary `as_of` (`2026-06-22…`) | same |
| `formula` | `string` | `Σ (gross_amount − received_amount) …` | same |
| `note` | `string` matching `/gross\|withhold/i` | gross/withholding note | same |
| `sources` | `Provenance[]`, length = # overdue lineage rows | one per lineage row | same length/shape |
| `sources[].sourceId` | `string` | from `source_id` | present in 2a |
| `sources[].sourceName` | `string` | `'TallyPrime'` | present in 2a |
| `sources[].recordRef` | `string` | real `record_ref`, **contains `tally:pm10`** | **identical ref** |
| `sources[].observedAt` | `string` (ISO) | from `observed_at` | present in 2a |

`value` MUST be reconstructable from the lineage rows the `sources` cite
(VALUE = Σ LINEAGE) — the same invariant the DB spike proved, now at the served
payload.

---

## §5 — Principals (LOCKED for 2b)

- **Finance-eligible (sees money)** = role in `{ founder, finance }` (the spike's
  set, unchanged) — used for the HTTP 200 + Metric assertions and the live demo
  fetch.
- **Non-finance (redacted)** = role `designer` — used for the redaction/refusal
  unit assertions.
- Demo fetch principal: `{ X-Company-Id: FIRM_A, X-User-Role: 'founder' }`. Per-user
  gating (whether a given person is finance-eligible) is **Step-2 deferred**.

---

## §6 — The assertions these satisfy

| Ledger | Closes | What must hold |
|---|---|---|
| `slice2b.serializer.test.mjs` | **G1** | `serializeOverview(summaryRow, lineageRows, owner)` → `overdueAmount` Metric: `value=930000`, `confidence='low'`, `note~gross`, `sources[].recordRef` contains `tally:pm10` (from `kpi_lineage`, not synthesized), VALUE=Σ lineage. Designer → omitted/refused. |
| `slice2b.http.test.mjs` | **⑦ / G2** | `GET /api/v1/overview` (finance headers) → 200 + `overdueAmount` Metric JSON citing `tally:pm10`; (designer headers) → omitted/refused; Firm-B company → no Firm-A entities; CORS header present for the dev origin. |
| `slice2b.parity.test.mjs` | **⑦ parity** | backend Metric keys+types == Slice-2a frontend Metric, same `recordRef` `tally:pm10` → drop-in popover. |
| `overview-backend.test.ts` | **⑦ flag seam** | flag OFF → `fetchOverview()` returns the mock Metric (2a, green); flag ON + `fetch` MOCKED → returns the backend Metric. `ai-overview` queryKey + `resolve()` seam shape preserved. |

---

## §7 — Run / RED-proof commands

Backend (kill strays first):

```
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'slice2b|spike\.acceptance|adversary|--test' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
node --test --test-force-exit backend/test/slice2b.serializer.test.mjs
node --test --test-force-exit backend/test/slice2b.http.test.mjs
node --test --test-force-exit backend/test/slice2b.parity.test.mjs
```

`--test-force-exit` is mandatory (pglite holds the event loop open).

Frontend:

```
pnpm --dir app test        # vitest run — overview-backend.test.ts is RED (flag-on path / fetchOverview not wired)
```

Existing suites must STAY green: `spike.acceptance.test.mjs` (4),
`adversary.spike.test.mjs` (10 pass / 2 skip), `overview-metric.test.ts` (7).
