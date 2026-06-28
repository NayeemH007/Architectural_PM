# ADVERSARY-2B — independent sign-off, Slice 2b (overdueAmount mock→pglite/HTTP, behind a flag)

> Loop step 4 (adversarial). Author did NOT write the build under attack
> (`backend/server/index.mjs`, `backend/semantic/serialize.mjs`,
> `app/src/lib/archintel/api.ts`) and did NOT author the slice2b ledgers.
> Mandate: try to BREAK the HTTP/security boundary and the backend-vs-mock
> claim end-to-end; decide HOLDS/BROKEN per promise; rank residual gaps.
> A green ledger is the claim under suspicion, not the proof.
>
> Attack tests: `backend/test/adversary.slice2b.test.mjs` (one warm server for
> the boundary attacks — the same single warm pglite connection the live demo
> uses, so state-bleed is probed under realistic conditions; the tamper/VALUE=Σ
> proof uses a SEPARATE `freshDb()` so a seed mutation can't poison the server).

## How to reproduce

```powershell
# kill strays first:
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'slice2b|spike\.acceptance|adversary|server/index|--test' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

# baseline (must be pass 27 / skip 2 / fail 0):
node --test --test-isolation=none --test-force-exit backend/test/spike.acceptance.test.mjs backend/test/adversary.spike.test.mjs backend/test/slice2b.serializer.test.mjs backend/test/slice2b.http.test.mjs backend/test/slice2b.parity.test.mjs
pnpm --dir app test   # 11 pass

# the attacks (pass 11 / skip 1 / todo 1 / fail 0):
node --test --test-isolation=none --test-force-exit backend/test/adversary.slice2b.test.mjs

# isolation-workaround proof (default isolation; results print before the exit-code corruption):
node --test --test-force-exit backend/test/slice2b.http.test.mjs backend/test/slice2b.serializer.test.mjs
```

`--test-force-exit` is mandatory — pglite holds the event loop open.

---

## Baseline — GREEN (verified independently)

- Backend (isolation=none, force-exit): **tests 29 · pass 27 · skip 2 · fail 0** ✔ (matches the required 27/2/0).
- Frontend (`pnpm --dir app test`): **11 passed** ✔.
- `pnpm --dir app build` (flag OFF default; no `.env*` present so `VITE_USE_BACKEND_AI` is undefined→OFF): **exit 0, `✓ built in 5.52s`** ✔.

---

## Isolation-workaround proof (the `--test-isolation=none` is NOT masking a failure)

Re-ran `slice2b.http` + `slice2b.serializer` under **DEFAULT** isolation:

- **isolation=none:** the 4 http + 6 serializer named tests all `✔` (10/10), exit 0.
- **default isolation:** the **same 10 named tests all `✔`** (counted: 10 pass, 0 named `✖`). The runner reports `tests 11 · pass 10 · fail 1`, where the single "fail" is a **FILE-level** entry `✖ backend\test\slice2b.http.test.mjs:1:1` with the generic message `'test failed'` and **no failed assertion** — the pglite-warm teardown abort the runtime note describes. Exit code is corrupted (1), the printed test results are not.

**Conclusion:** the named pass/fail set is IDENTICAL across both isolation modes (10 pass / 0 fail). `--test-isolation=none` only papers over the cosmetic teardown abort / exit code; it does NOT hide a real assertion failure. (My own `adversary.slice2b.test.mjs` is a single suite that closes its warm db in `after`, so it exits 0 cleanly under BOTH modes: 13 tests · 11 pass · 1 skip · 1 todo.)

---

## Per-promise verdict

### backend-not-mock (the e2e telltale) — **HOLDS**
GET `/api/v1/overview` (FIRM_A, founder) → `overdueAmount` is a Metric, `value=930000`,
a source `recordRef` contains `tally:pm10`, and **`sources[].sourceId` is a real UUID**
(`93346a23-0b7b-4028-b727-874a9fe4d3de`), minted at seed into `canonical.source.id` and
copied into `kpi_lineage.source_id` — **NOT** the constant `'tally'` the Slice-2a mock uses.
That UUID is the structural proof the data came from the DB, not the mock.
Reconstruction + tamper proof (separate `freshDb`): served `value == Σ lineage
contribution_value`; updating `pm10.received_amount = 200000` makes the served value TRACK to
`730000` (= Σ lineage again) — a hardcoded literal could not move. **VALUE=Σ holds at the served payload.**
Evidence: `[backend-not-mock]`, `[value=Σ-reconstruct + tamper]`.

### finance band over HTTP (security-critical) — **HOLDS, fails SAFE**
- `designer` → `overdueAmount = {value:null, confidence:'insufficient'}`; a full-payload money
  scan (numbers AND pg-numeric strings: 930000, 1000000, 17400000, 8470000.00, 500000, 840000, 730000)
  returns **zero hits**.
- Every non-`{founder,finance}` role tried — `''`, `admin`, `project_lead`, `principal`, `viewer`,
  `manager`, `owner` — **redacts** (no money). Positive control: `founder` DOES leak money to the
  same scanner, so the scan can detect a leak.
- **ABSENT `X-User-Role` header → redacted** (the serializer's `isFinanceEligible` returns `false`
  for empty/unknown). So an absent role **fails SAFE (redacted), NOT finance-visible** — no privilege escalation.
- The band is **strict-exact, case-insensitive**: `FOUNDER`/`Founder`/`finance`/`Finance` match;
  `founderx`, `" founder"`, `"founder\t"` do NOT (verified directly against the serializer). The HTTP probe's
  `"founder "` (trailing space) showing money is **Node trimming the header value** before it reaches the
  serializer (the serializer sees `"founder"`) — benign, not a band gap.
Evidence: `[finance-band/designer]`, `[finance-band/unknown-roles]`.

### cross-tenant over HTTP — **HOLDS**
- FIRM_B founder → `overdueAmount.value = 1,000,000`, sources `tally:bpm1`/`tally:bpm2` only;
  the **whole Firm-B payload text contains neither `pm10` nor `930000`**. Firm-A is invisible to Firm-B.
- Garbage `X-Company-Id: not-a-uuid` and injection `'; drop table canonical.payment_milestone;--`
  → **500 JSON `{error}`**, process stays serving (next request 200/930000), and the table is **intact**
  (`set_config` is parameterized; the `::uuid` cast rejects the value before any SQL is built — no injection).
- Absent/empty `X-Company-Id` → **defaults to FIRM_A** (documented demo default). Combined with an absent
  role this yields a FIRM_A overview with **money redacted** — no anonymous money read, and never another tenant.
Evidence: `[cross-tenant]`, `[cross-tenant/injection]`, `[cross-tenant/default-company]`.

### state-bleed on the single warm pglite connection — **HOLDS (no bleed)**
The handler `set_config('request.company_id'|'user_id'|'role', …, false)` on every request. `false` =
session-scoped, so values persist on the warm connection — BUT each request **re-sets all three**, so the
predicate seen by `recompute_portfolio_summary` is always the CURRENT request's. Hammer sequence
`Firm-B founder → Firm-A designer → Firm-A founder`:
- the designer step (after a Firm-B **founder**) is correctly **redacted** (role did not bleed) and shows
  **Firm-A** refs, not Firm-B's bpm* (company did not bleed);
- the final Firm-A founder sees **930000 / pm10**, not Firm-B's 1,000,000.
Direct DB read confirms `request.*` reflects only the LAST request (always re-set, never stale).
**No request leaks the prior request's company or role.** Evidence: `[state-bleed]`, `[state-bleed/db]`.
> Caveat: safe **because** the handler sets all three keys unconditionally. `request.kpi_run_id`
> (an optional override the recompute reads) is never set by the handler, so it can't bleed today —
> but any future handler/route that sets a `request.*` key and forgets to clear it WOULD bleed on this
> warm connection. See gap A-2.

### CORS — **HOLDS (not over-permissive)**
GET and the `OPTIONS` preflight (204) both carry `Access-Control-Allow-Origin: http://localhost:5173`
(the Vite dev origin, **static — not reflected**, not `*`). `Access-Control-Allow-Credentials` is absent.
So the dangerous `*`-with-credentials combo does not occur. Preflight also returns
`Allow-Methods: GET, OPTIONS` and the expected `Allow-Headers`. Evidence: `[CORS]`.

### robustness — **HOLDS**
Unknown path → **404 JSON**, malformed/garbage input → **500 JSON**, and in every case the **process keeps
serving** the next request correctly. No crash, no process-level abort. Evidence: `[robustness]`,
`[cross-tenant/injection]`.

### flag seam (⑦) — **HOLDS**
Flag OFF (default, no `.env`) → `fetchOverview()` returns the Slice-2a mock; `vite build` exit 0 (never
fetches). Flag ON + `fetch` mocked → returns the backend Metric with the demo finance principal header
(`X-Company-Id=FIRM_A`, `X-User-Role` matching `/founder|finance/`); ON + fetch fails → mock fallback (card
never blanks). All four covered green by `app/src/lib/archintel/__tests__/overview-backend.test.ts`
(11/11 frontend) and the OFF-build (exit 0) re-proven here.

---

## Ranked residual gaps

| # | Sev | Gap | Evidence | What closes it | Owner step |
|---|-----|-----|----------|----------------|------------|
| **A-1** | **med** | **Mock-fallback masking — a backend OUTAGE is invisible.** Flag ON + backend DOWN → `api.ts` silently serves the **mock** numbers as if they were live backend data, with **no `source:'mock'\|'backend'` marker / stale banner**. Operationally, an overdue figure could be a stale mock during a real outage and no one would know. (The fallback itself is correct — card never blanks — and is green in `overview-backend.test.ts`'s `⑦ ON fallback`.) | `[gap/mock-fallback-masking]` (labelled **todo**). | Add a `source`/`degraded` field (or freshness/asOf surfaced in the card) so the React layer can show a "showing cached/mock" signal when the fetch fails. | **Step 4 — TRUST_ENVELOPE** (api.ts + KpiCard). |
| **A-2** | **med** | **Single warm pglite connection = shared mutable session.** Isolation today relies on the handler re-setting **all** `request.*` keys every request. It does. But there is **no per-request reset/guard**: a future route that sets any `request.*` (e.g. `request.kpi_run_id`, or a new claim) and forgets to clear it WILL bleed across requests on this warm connection. No test enforces "every request resets the full claim set." | `[state-bleed]` HOLDS today; the risk is structural (`set_config(...,false)` is session-scoped). | Reset/clear the full `request.*` claim set at the start of every request (or run each request in its own txn with `set_config(...,true)` = txn-local), and add a contract test that an unset claim never carries over. | **Step 2 — Auth & Finance Gating** (JWT/claim plumbing). |
| **A-3** | **med** | **RLS not enforced under the pglite superuser (carried G3).** Tenant isolation is the `company_id = v_company` predicate **inside** `recompute_portfolio_summary`, not the RLS policies (superuser bypasses them). Proven to HOLD for this one function, but any NEW mart function that omits the predicate would NOT be caught under the superuser test path. | `[gap/rls-superuser]` (labelled **skip**); `[cross-tenant]` proves the current fn is scoped. | Run tests under a **non-superuser** role so policies are defence-in-depth; add a lint/contract test that every mart read is company-scoped. | **Step 2 — RLS/role hardening** (+ the `*.supabase.sql` variant). |
| **A-4** | low | **Default-company = FIRM_A on absent/empty `X-Company-Id`.** A misconfigured client with no company header silently reads **FIRM_A** (its own firm here, and money is still role-gated, so no cross-tenant/money leak today). But a default-to-a-real-tenant is a footgun once there are >2 tenants / a real auth layer. | `[cross-tenant/default-company]`. | Make the company header **required** under real auth (derive company from the verified JWT, not a header default); 400 on absent in production mode. | **Step 2 — Auth & Finance Gating**. |
| **A-5** | low | **Money keys leak as pg-numeric STRINGS to finance roles** (`received: "8470000.00"`, `total_contract`/`billable` for Firm-B). Not a leak (finance is allowed money), but these non-overdue fields are **un-coerced raw pg-numeric strings** and **un-enveloped** (no Metric/confidence) — only `overdueAmount` got the G1 trust-envelope treatment. Other money fields are still bare scalars. | observed in founder/finance payloads (`received` is the string `"8470000.00"`). | Extend the trust-envelope (Metric coercion + confidence) to the remaining money fields as the envelope scales to more metrics. | **Step 4 — TRUST_ENVELOPE** (scale-out). |
| **A-6** | low | **`error` body echoes the raw PG message** (`invalid input syntax for type uuid: "…"`), including the attacker-supplied value. No injection, but it reflects input and reveals the backing engine (pglite/Postgres). | `[cross-tenant/injection]` (body `{ "error": "invalid input syntax for type uuid: \"…\"" }`). | Return a generic `{error:'bad request'}` for 4xx/5xx in production; log the detail server-side only. | **Step 2/4** (error-surface hardening). |

---

## Notable findings (explicit, as required)

- **set_config state-bleed probe:** PROBED HARD (`Firm-B founder → Firm-A designer → Firm-A founder`,
  plus a direct DB-session read). **No bleed** — the handler re-sets all three `request.*` keys every
  request, so the recompute predicate and the serializer band always reflect the current principal.
  The single warm connection is safe **today** purely by that discipline; the structural footgun for
  future claims is captured as gap **A-2**.
- **Mock-fallback-masking risk:** REAL and ranked **A-1 (med)**. The fallback keeps the card usable, but a
  backend outage is invisible (mock numbers shown as if live, no signal). Owner: Step 4.

---

## Sign-off

**Slice 2b HOLDS end-to-end. `overdueAmount` is DONE for the purpose of this slice** — proven not just
green but green for the RIGHT reason:

- the served data is the **pglite backend, not the 2a mock** (real-UUID `sourceId` telltale + VALUE=Σ
  that **tracks a seed tamper**),
- the **finance band over HTTP fails SAFE** (designer / unknown / absent role all redact; zero money
  sentinels; no privilege escalation),
- **cross-tenant isolation holds over HTTP** (Firm-B never sees Firm-A; garbage/injection → 500, no leak,
  no crash, no dropped table),
- the **warm-connection does not bleed** principal state between requests,
- **CORS is dev-origin-scoped, not `*`-with-credentials**, and the service is **robust** (404/500 JSON,
  stays serving),
- the **flag seam** is byte-identical-OFF (build green) and backend-ON (frontend ledger green).

**Verdict: SIGN-OFF.** Proceed — it is safe to either **scale the trust-envelope to more metrics**
(Step 4; while there, close **A-1** mock-fallback signal and **A-5** other-money-field envelopes) **or
proceed to the manager fan-out**. **Nothing in gaps A-1…A-6 is a slice regression or a blocker** for this
single-metric slice; all are explicitly owned by Step 2 (auth/RLS: A-2, A-3, A-4, A-6) or Step 4
(trust-envelope: A-1, A-5).

**Two things to carry into the fan-out brief (so they are not forgotten):**
1. **A-3 / A-2** — under the pglite superuser, RLS does NOT protect you; isolation is your function's
   `company_id` predicate AND your handler re-setting the full `request.*` claim set every request.
   Every new mart read must repeat the predicate; every new route must reset the claims (or use txn-local
   `set_config(...,true)`).
2. **A-1** — when more metrics go through the flag, add a mock/backend source signal so a backend outage
   is not invisible.

---

## Attack inventory (`backend/test/adversary.slice2b.test.mjs`)

| Test | Falsifies | Result |
|---|---|---|
| `[backend-not-mock]` | "data is the 2a mock" — real-UUID sourceId telltale | pass (HOLDS) |
| `[value=Σ-reconstruct + tamper]` | "930000 is a literal" — Σ lineage + tracks tamper | pass (HOLDS) |
| `[finance-band/designer]` | "non-finance sees money over HTTP" | pass (HOLDS) |
| `[finance-band/unknown-roles]` | "unknown/absent role → finance-visible (escalation)" | pass (HOLDS, fails SAFE) |
| `[cross-tenant]` | "Firm-B sees Firm-A" | pass (HOLDS) |
| `[cross-tenant/injection]` | "garbage/SQL company id crashes or injects" | pass (HOLDS — 500, intact, serving) |
| `[cross-tenant/default-company]` | "absent company → anonymous money read" | pass (HOLDS — redacted) |
| `[state-bleed]` | "request N leaks request N-1's company/role on the warm conn" | pass (HOLDS — no bleed) |
| `[state-bleed/db]` | "stale request.* lingers on the warm conn" | pass (HOLDS — re-set each call) |
| `[CORS]` | "`*` with credentials / wrong preflight" | pass (HOLDS — dev-origin, no creds) |
| `[robustness]` | "bad path crashes / 200s" | pass (HOLDS — 404, keeps serving) |
| `[gap/mock-fallback-masking]` | backend-outage invisibility | **todo** (gap A-1, Step 4) |
| `[gap/rls-superuser]` | RLS not enforced under superuser | **skip** (gap A-3, Step 2) |

Final: `tests 13 · pass 11 · skip 1 · todo 1 · fail 0`, exit 0 (clean under BOTH isolation modes).
```
