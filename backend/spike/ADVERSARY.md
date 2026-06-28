# ADVERSARY — independent sign-off, first vertical slice

> Loop step 4 (adversarial). Author did NOT write the build
> (`backend/db/**`, `backend/semantic/**`) and did NOT author the acceptance
> ledger (`backend/test/spike.acceptance.test.mjs`). Mandate: try to BREAK the
> four promises end-to-end, decide HOLDS / BROKEN per promise, rank residual
> gaps. A green acceptance suite is the claim under suspicion, not the proof.
>
> Attack tests: `backend/test/adversary.spike.test.mjs` (runs on the same
> harness `freshDb()`; each fresh test opens its own throwaway db so input
> mutations cannot bleed between attacks).

## How to reproduce

```
# kill strays first (they starve CPU and hang node --test):
Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -match 'adversary|spike\.acceptance|--test ' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }

node --test --test-force-exit backend/test/spike.acceptance.test.mjs   # baseline (4 pass)
node --test --test-force-exit backend/test/adversary.spike.test.mjs    # attacks
```

`--test-force-exit` is mandatory — pglite holds the event loop open and
`node --test` hangs without it.

---

## Baseline

Existing acceptance suite on a clean board: **YES — 4 green, 0 fail.**

Evidence (`node --test --test-force-exit backend/test/spike.acceptance.test.mjs`):
`✔ (a) ✔ (b) ✔ (c) ✔ (d)` · `ℹ tests 4 · pass 4 · fail 0 · skipped 0 · todo 0`.

Adversary suite (`backend/test/adversary.spike.test.mjs`):
`ℹ tests 12 · pass 10 · fail 0 · skipped 2` (the 2 skips are the named Phase-2
gaps G1/G2; exit 0).

---

## Per-promise verdict

### ① VALUE = Σ LINEAGE — **HOLDS**
The displayed scalar is reconstructable from its lineage, and it tracks its
inputs (so it is not a coincidental literal):

- **Partial receipt** (`a-i`): set `pm10.received_amount = 200000` → the served
  `overdueAmount` becomes `930000 − 200000 = 730000`, the single `pm10` lineage
  `contribution_value` is `730000`, and `scalar == Σ lineage` still holds.
- **Second overdue** (`a-ii`): flip `pm3` (gross 840000, received 0) to
  `'overdue'` → lineage grows to **2 rows**, `overdueAmount = 1,770,000`,
  `scalar == Σ` over both rows, each carrying its own `tally:pm3` / `tally:pm10`
  ref. The metric is genuinely `Σ(gross − received)` over `status='overdue'`,
  not a hardcoded `930000`.

Mechanism read (`0002_mart.sql`): `recompute_portfolio_summary` writes both the
summary `overdueAmount` and the per-milestone lineage rows from the **same**
`select … where status='overdue'`, tagged with one minted `v_run`. Value and
lineage share a source — the invariant is structural, not asserted-by-luck.

### ① REFS ARE REAL — **HOLDS**
`pm10` lineage row carries `record_ref='tally:pm10'`, `observed_at` =
`2026-06-04T00:00:00Z` (derived from `due_date` because the milestone is
unreceived), and `source_id` that **joins** an actual `canonical.source` row
belonging to Firm A with `source_system='tallyprime'`. The ref and observed_at
are copied from the milestone's own provenance (not a constant / null-island).
The lineage columns are declared `not null`, so an empty popover is impossible by
schema.

### CROSS-TENANT ISOLATION — **HOLDS (via function scope, NOT RLS)**
`a-iii` proves the dangerous truth explicitly: under pglite the bootstrap
**superuser BYPASSES RLS** — a raw `select … where company_id = Firm B` as the
Firm-A principal still returns Firm B's rows, so the `*_company_isolation`
policies in `0001_canonical.sql` are **not** what protects the metric. Isolation
comes entirely from `recompute_portfolio_summary` scoping every read to
`v_company := current_setting('request.company_id')` in the `WHERE` clause:

- Recompute AS Firm A (with Firm B seeded 2×500000 overdue) → `overdueAmount =
  930000`, **zero** Firm-B entities in lineage, all lineage rows tagged Firm A.
- Recompute AS Firm B → `overdueAmount = 1,000,000`, exactly its 2 rows, zero
  Firm-A entities.

> **Caveat for fan-out (see gaps):** because protection is the function body,
> any NEW mart function a manager writes must repeat the `company_id = v_company`
> predicate. RLS will not catch a missed scope under the superuser test path.

### ⑤ / C4 REDACTION BAND — **HOLDS for the tested surface**
`serializeOverview` / `serializeClients` omit **every** money key (absent, not
present-with-null) for non-finance roles, and pass money through for
finance-eligible roles:

- `principal` (Fariha m2 — explicitly NOT finance) and `project_lead` → all of
  `contract_value/contractValue/amount/gross_amount/net_receivable/margin/
  overdueAmount/overdueamount/total_contract/received/billable/received_amount`
  OMITTED; non-money fields survive. Omitted is `undefined`, not `null`.
- `founder` and `finance` → money retained unchanged.
- Slip attempts defeated: casing variants (camel/snake/lower) all fall because
  matching is `key.toLowerCase()` against the money-key set; a money **Metric**
  envelope (`overdueAmount: {value, confidence}`) is rewritten to
  `{value:null, confidence:'insufficient'}` (`c-refusal`) so no number leaks.

> **Redaction is KEY-NAME driven, not value/semantics driven** — see gap
> REDACT-KEYSET below. A money figure under an unlisted key name (e.g.
> `receivedMetric`, `fee`, `cash`, a nested object) passes through. The current
> seed/summary never emits such a key, so the slice is safe, but the band is one
> rename away from a leak.

### F7 CLOCK PURITY — **HOLDS**
`mart.days_overdue(due, as_of)` is `IMMUTABLE` and = `(as_of::date − due)`:

- pm10 (due 2026-06-04): **18** @2026-06-22, **20** @2026-06-24, **30**
  @2026-07-04 (third as_of added by this adversary). Re-evaluation is identical.
- A pre-due date returns a **negative** value, not clamped (due 2026-08-20 @
  as_of 2026-06-22 → −59) — pure arithmetic, no flooring.
- `overdueAmount` is **invariant** across all three as_of runs (930000), because
  `received` is unchanged and the metric has no clock term.
- Each recompute mints a **distinct** `kpi_run_id` even at the **same** as_of
  (`d-fresh-id`), proving determinism comes from injected inputs, not run id or
  wall clock.

### ⑤ TAX-DEFERRAL HONESTY — **HOLDS**
`net_receivable / vat / vds_withheld / ait_withheld` are **NULL for every seeded
milestone** (both firms). `overdueAmount` is computed from **GROSS**
(`gross_amount − received_amount`), not from `net_receivable` (which is NULL and
would yield 0/NULL if used). It equals the direct GROSS-minus-received sum from
canonical, and the lineage contribution is likewise gross. The number is gross
face value, as the lock requires.

> **Honesty gap at the SURFACE:** the lock says "never emit a bare gross number
> as if it were net cash" and that gross KPIs must be stamped
> `confidence='low', note='gross, withholding not modeled'`. At the DB the value
> is correctly gross, BUT the served payload is a **bare number with no
> confidence/note stamp** (the serializer returns the raw column). The gross
> figure is technically un-mislabeled only because nothing labels it at all.
> Closing this is the same work as the ① served-payload gap (TRUST_ENVELOPE).

---

## Ranked residual gaps

| # | Sev | Gap | Evidence | What closes it | Phase-2 owner |
|---|-----|-----|----------|----------------|----------------|
| G1 | **high** | **① served-payload trust envelope missing.** `serializeOverview` returns `overdueAmount` as a BARE scalar (in pglite it is even the string `"930000"` — pg numerics serialize as JS strings), NOT a drillable `Metric{value, confidence:'low', note~'gross, withholding not modeled', sources:[Provenance]}` reconstructable from `kpi_lineage`. ① is proven at the **DB table** but NOT at the **API surface**. Also subsumes the tax-honesty stamp (no `confidence='low'`/note on the gross figure). | `GAP-①·now` (PASSING — verifies the served value is a bare scalar with no confidence/note/sources today); `GAP-①·target` (SKIPPED — carries the Step-4 Metric-shape assertions). | Semantic-layer functions return `Metric{value,confidence,completeness,as_of,formula,sources[]}` fed by `kpi_lineage`; serializer emits Metric envelopes; gross stamped `confidence='low'`+note; coerce pg numeric → number. | **Step 4 — TRUST_ENVELOPE** (orchestrated §6 / punch-list #6; closes F2). |
| G2 | **high** | **No end-to-end through the live hook.** The spike exercises SQL + serializer **directly**; nothing wires `serialize.mjs` behind the live `useAiOverview` / `ai-overview` queryKey. "Through the live hook" (⑦) is unproven. | `GAP-E2E` (SKIPPED, reason names the gap); no production call site imports `backend/semantic/serialize.mjs`. | Re-thread the live `ai-overview` endpoint to call the recompute + serializer and bind `metric=` at the KpiCard call site, preserving the `ai-*` query keys. | **Step 3/4** (orchestrated §6, F2/⑦; punch-list #6). |
| G3 | med | **Cross-tenant isolation rides on per-function discipline, not RLS.** Superuser bypasses the policies; isolation is the `company_id = v_company` predicate inside `recompute_portfolio_summary`. Every future mart function must repeat it; a missed scope will NOT be caught under the superuser test path. | `a-iii` (raw cross-tenant read succeeds; only the function isolates). | Run tests under a non-superuser role so RLS is actually enforced as defence-in-depth; add a lint/contract test that every mart read is company-scoped. | Step 2 (RLS/role hardening) — supabase variant + a non-superuser test role. |
| G4 | med | **Redaction is key-name driven, not value/semantics driven.** A money figure under an unlisted key (`fee`, `cash`, `receivedMetric`, nested object) passes through the band. Safe today only because the seed/summary emit no such key. | `c` (`receivedMetric` passes through). | Drive redaction off a typed Metric `unit:'bdt'` / field-classification, not a hand-maintained key allowlist; add a test asserting NO numeric money escapes under any key for a Viewer. | Step 4 (TRUST_ENVELOPE) — typed money fields make the band semantic. |
| G5 | low | **`recompute` writes are not idempotent across runs** (each call appends a new summary + lineage partition). Fine for the spike (PK includes `kpi_run_id`), but unbounded growth and "latest row" selection by `computed_at desc` is fragile if two runs share a timestamp. | n/a (by design this slice). | Retention / "latest run" view, or upsert-by-(company,as_of); C3 mart-refresh decision. | Step 5 (mart refresh, C3). |
| G6 | low | **`days_overdue` accepts NULL `due_date`** (returns NULL) and negative (pre-due) silently; no metric currently consumes it for non-overdue rows, but a future "due in N" KPI must define the sign/zero contract. | `d` (pre-due → −89, not clamped). | Define and test the days-overdue contract (clamp vs signed) when the aging buckets KPI lands. | Step 4/5 (aging KPI). |

---

## Sign-off

**The trust spine HOLDS well enough at the DB/semantic layer to fan out the 6
managers — with one condition.** All four promises hold where the slice claims
them: value=Σ tracks inputs, refs are real and drillable, the finance band
omits money completely, the clock is pure and pinned, tenant isolation is real
(via function scope), and gross is honestly gross with tax deferred-NULL.

The two HIGH gaps (G1 served-payload Metric, G2 live-hook E2E) are **promised
Phase-2 work, not slice regressions** — ① and ⑦ are demonstrated at the table
and at the serializer-band but not yet stitched into the served Metric or the
React hook. They do **not** block fan-out because they are the explicit subject
of Step 3/4; they DO block any claim that ① holds "end-to-end through the live
hook" today.

**One thing to flag to every manager before they build:** G3 — RLS does not
protect you under the test superuser; tenant isolation is your function's
`company_id` predicate. Carry that predicate in every new mart read, or add the
non-superuser test role first.

**Verdict: SIGN-OFF to fan out, conditional** on (a) the served-payload Metric
(G1) and live-hook wiring (G2) being tracked as Step-3/4 deliverables, and (b)
the company-scoping discipline (G3) being stated in the fan-out brief.

---

## Attack inventory (`backend/test/adversary.spike.test.mjs`)

| Test | Targets | Result |
|---|---|---|
| `a-i` partial receipt | ① value=Σ tracks input | pass |
| `a-ii` second overdue | ① lineage grows, Σ holds | pass |
| `a-iii` cross-tenant under pressure | isolation via function scope, RLS-bypass proven | pass |
| `b` real refs | ① drillable provenance | pass |
| `c` redaction across roles + slips | ⑤/C4 band | pass |
| `c-refusal` money Metric → refusal shape | ② | pass |
| `d` clock purity (18/20/30 + pre-due) | F7 | pass |
| `d-fresh-id` distinct run id at same as_of | F7 | pass |
| `tax` deferred NULL + gross | ⑤ | pass |
| `GAP-①·now` served value is a bare scalar | ① at API surface | pass (verifies G1 exists) |
| `GAP-①·target` desired Metric envelope | ① at API surface | **skipped** (Step-4 target, G1) |
| `GAP-E2E` live-hook wiring | ⑦ E2E | **skipped** (documents G2) |

Final: `pass 10 · fail 0 · skipped 2`, exit 0.
