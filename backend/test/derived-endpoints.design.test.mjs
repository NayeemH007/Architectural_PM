// ============================================================
// Step 3/4 — DERIVED ENDPOINTS design ledger (reviewer-authored, RED today).
// ------------------------------------------------------------
// Only overdueAmount/managementOverview is backend-backed today (Slice 2b).
// This ledger demands the OTHER derived endpoints become semantic functions
// over pglite that return the SAME JSON the live frontend emits, each headline
// number carried as a Metric envelope fed by mart.kpi_lineage:
//
//   financeOverview        -> semantic/finance.mjs        (income/billable/receivables/collectionRate — gross, low)
//   profitabilityByProject -> semantic/profitability.mjs  (margin fee-only low)
//   aiosKpis               -> semantic/aios.mjs           (autonomy REFUSE / output 3.0x / automated low)
//   projects/clients/payments (array endpoints)          (serialize-only, no Metric)
//
// PARITY: each served Metric matches the frontend Slice-2a/3/4 shape (same keys
// + same recordRef conventions) so the swap is drop-in. VALUE = Σ(lineage).
// Viewer (designer) redaction holds. A-5 carried: the OTHER money fields
// (received/total_contract/billable) get the envelope, not just overdueAmount.
//
// Builder makes this GREEN by shipping the modules + kpi_lineage rows per
// backend/spike/CONTRACT-derived-endpoints.md. Reviewer MUST NOT implement them.
//
// RED REASON TODAY: backend/semantic/{finance,profitability,aios}.mjs do not
// exist (and the finance/profitability/aios metric_keys are not emitted into
// mart.kpi_lineage by any recompute fn). Every block below fails at import or
// at the missing-lineage assertion — the expected RED.
//
// Determinism: pglite via harness freshDb() + injected pinned clock. No wall
// clock. Run:
//   node --test --test-isolation=none --test-force-exit backend/test/derived-endpoints.design.test.mjs
// ============================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, FIRM_A, AS_OF_PINNED } from "./harness.mjs";

const KPI_VERSION = 1;
let db;

before(async () => {
  // freshDb fails CLEANLY if migrations/seed are absent. They are present
  // (Slice 2b), so this boots; the RED comes from the absent semantic modules.
  db = await freshDb();
});

after(async () => {
  if (db) await db.close();
});

async function setPrincipal(p) {
  await db.query(`select set_config('request.company_id', $1, false)`, [p.companyId]);
  await db.query(`select set_config('request.user_id', $1, false)`, [p.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [p.role ?? ""]);
}

const OWNER = { companyId: FIRM_A, userId: "m1", role: "founder" };     // finance-eligible
const DESIGNER = { companyId: FIRM_A, userId: "m6", role: "designer" }; // redacted

function isMetric(v) {
  return v && typeof v === "object" && "value" in v && "confidence" in v && "sources" in v;
}

// Optional import: returns the module or null (so we can assert "absent" cleanly
// rather than crash the whole file at top-level import).
async function tryImport(spec) {
  try {
    return await import(spec);
  } catch {
    return null;
  }
}

// ────────────────────────────────────────────────────────────
// A. The semantic modules MUST exist (drop-in seam, one module per family).
// ────────────────────────────────────────────────────────────
test("[surface] semantic/finance.mjs exports serializeFinance / recompute path", async () => {
  const mod = await tryImport("../semantic/finance.mjs");
  assert.ok(mod, "backend/semantic/finance.mjs must exist (RED: not yet created)");
  // The builder picks the exact name; the contract recommends serializeFinance.
  assert.equal(
    typeof (mod.serializeFinance ?? mod.financeOverview ?? mod.default),
    "function",
    "finance.mjs must export a serializer/recompute function",
  );
});

test("[surface] semantic/profitability.mjs exists", async () => {
  const mod = await tryImport("../semantic/profitability.mjs");
  assert.ok(mod, "backend/semantic/profitability.mjs must exist (RED: not yet created)");
  assert.equal(
    typeof (mod.serializeProfitability ?? mod.profitabilityByProject ?? mod.default),
    "function",
    "profitability.mjs must export a serializer/recompute function",
  );
});

test("[surface] semantic/aios.mjs exists", async () => {
  const mod = await tryImport("../semantic/aios.mjs");
  assert.ok(mod, "backend/semantic/aios.mjs must exist (RED: not yet created)");
  assert.equal(
    typeof (mod.serializeAiosKpis ?? mod.aiosKpis ?? mod.default),
    "function",
    "aios.mjs must export a serializer/recompute function",
  );
});

// ────────────────────────────────────────────────────────────
// B. financeOverview parity — income/billable/receivables/collectionRate
//    each a Metric; VALUE = Σ over the cited milestones; gross-low stamp.
// ────────────────────────────────────────────────────────────
test("[finance/B4] financeOverview() served from pglite — headline figures are gross-low Metrics, value = Σ lineage", async () => {
  const mod = await tryImport("../semantic/finance.mjs");
  assert.ok(mod, "RED: semantic/finance.mjs absent");
  const recompute = mod.serializeFinance ?? mod.financeOverview ?? mod.default;
  assert.equal(typeof recompute, "function", "finance recompute fn required");

  await setPrincipal(OWNER);
  // Contract: the fn takes (db, asOf, principal) and returns the same object
  // financeOverview() returns in finance.ts — income/billable/receivables/collectionRate Metrics.
  const fin = await recompute(db, AS_OF_PINNED, OWNER);

  for (const key of ["income", "billable", "receivables", "collectionRate"]) {
    const m = fin[key];
    assert.equal(isMetric(m), true, `${key} must be a Metric{value,confidence,sources}`);
    assert.equal(typeof m.value, "number", `${key}.value must be a coerced Number (not pg string)`);
    assert.equal(m.confidence, "low", `${key} is gross → confidence 'low' (⑤ tax deferred)`);
    assert.ok(Array.isArray(m.sources) && m.sources.length >= 1, `${key} must cite >= 1 source`);
  }

  // Gross note on the money figures (parity with finance.ts GROSS_NOTE).
  assert.match(fin.income.note ?? "", /gross|withhold/i, "income carries the gross/withholding note");
  // Provenance ref parity: a payment-milestone source recordRef contains 'tally:pm'.
  const refs = fin.income.sources.map((s) => s.recordRef);
  assert.ok(refs.some((r) => typeof r === "string" && /tally:pm/.test(r)),
    "income sources cite payment milestones (recordRef ~ 'tally:pmN') — drop-in popover parity");

  // VALUE = Σ LINEAGE for collectionRate: round(income ÷ billable × 100).
  const expectRate = fin.billable.value
    ? Math.round((fin.income.value / fin.billable.value) * 100)
    : 0;
  assert.equal(fin.collectionRate.value, expectRate,
    "collectionRate.value === round(income ÷ billable × 100) over the cited milestones");

  // Seeded Firm-A income = Σ received_amount = 8,470,000 (data.ts ground truth).
  assert.equal(fin.income.value, 8_470_000, "seeded Firm-A income (Σ received) = 8,470,000");
});

// ────────────────────────────────────────────────────────────
// C. profitabilityByProject parity — every row's margin is a fee-only low Metric,
//    NEVER bare, NEVER 'insufficient' (④ retired: we have a number, low-trust).
// ────────────────────────────────────────────────────────────
test("[profit/B5] profitabilityByProject() served from pglite — margin is fee-only low Metric per row, never bare", async () => {
  const mod = await tryImport("../semantic/profitability.mjs");
  assert.ok(mod, "RED: semantic/profitability.mjs absent");
  const recompute = mod.serializeProfitability ?? mod.profitabilityByProject ?? mod.default;
  assert.equal(typeof recompute, "function", "profitability recompute fn required");

  await setPrincipal(OWNER);
  const rows = await recompute(db, AS_OF_PINNED, OWNER);
  assert.ok(Array.isArray(rows) && rows.length >= 1, "profitability returns rows");

  for (const row of rows) {
    const m = row.margin ?? row.marginMetric;
    assert.equal(isMetric(m), true, "each row's margin (or marginMetric) is a Metric — never a bare number");
    assert.equal(m.confidence, "low", "margin is fee-only low (④ retired) — never 'insufficient', never bare");
    assert.notEqual(m.confidence, "insufficient", "margin must not refuse — we have a number, just low-trust");
    assert.match(m.note ?? "", /fee-only|labour|modeled/i, "margin note explains fee-only basis");
    // Provenance parity: cites the contract (project:aN) + the modeled cost input.
    const refs = (m.sources ?? []).map((s) => s.recordRef);
    assert.ok(refs.some((r) => /project:/.test(r)), "margin cites the project contract (project:aN)");
    assert.ok(refs.some((r) => /model:PROJECT_COST:/.test(r)), "margin cites the modeled cost input");
  }
});

// ────────────────────────────────────────────────────────────
// D. aiosKpis parity — autonomy REFUSE / output 3.0x COMPUTED / automated low.
//    Matches the frontend Slice-3 treatment EXACTLY (aios.ts:82-157).
// ────────────────────────────────────────────────────────────
test("[aios/Slice-3] aiosKpis() served from pglite — autonomy refused, output 3.0x computed, automated low", async () => {
  const mod = await tryImport("../semantic/aios.mjs");
  assert.ok(mod, "RED: semantic/aios.mjs absent");
  const recompute = mod.serializeAiosKpis ?? mod.aiosKpis ?? mod.default;
  assert.equal(typeof recompute, "function", "aios recompute fn required");

  await setPrincipal(OWNER);
  const kpis = await recompute(db, AS_OF_PINNED, OWNER);
  assert.ok(Array.isArray(kpis), "aiosKpis returns an array");

  const byKey = Object.fromEntries(kpis.map((k) => [k.key, k]));

  // #2 autonomy — REFUSE (no signal). value null, insufficient, empty sources.
  assert.ok(byKey.autonomy, "autonomy KPI present");
  assert.equal(byKey.autonomy.value, null, "autonomy value is null (REFUSE — no intervention log)");
  assert.equal(byKey.autonomy.confidence, "insufficient", "autonomy confidence 'insufficient'");
  assert.equal(byKey.autonomy.value !== 64, true, "autonomy must NOT be the fabricated 64");

  // #1 output — COMPUTE: active projects ÷ designers = 6 / 2 = 3.0 (NOT 1.5).
  assert.ok(byKey.output, "output KPI present");
  assert.equal(byKey.output.value, 3, "output === active ÷ designers === 3.0 (recomputed, not 1.5)");
  assert.equal(byKey.output.unit, "ratio", "output unit 'ratio'");
  assert.ok(Array.isArray(byKey.output.sources) && byKey.output.sources.length >= 1,
    "output cites projects + designers");

  // #3 automated — COMPUTE low (editorial classification stamp).
  assert.ok(byKey.automated, "automated KPI present");
  assert.equal(typeof byKey.automated.value, "number", "automated computed from task audit");
  assert.equal(byKey.automated.confidence, "low", "automated stamped low (editorial classification)");
});

// ────────────────────────────────────────────────────────────
// E. A-5 carried — the OTHER money fields on the overview envelope (not just
//    overdueAmount): received / total_contract / billable enveloped, not bare.
// ────────────────────────────────────────────────────────────
test("[A-5] overview money fields received/total_contract/billable are enveloped Metrics (not bare pg strings)", async () => {
  const mod = await tryImport("../semantic/finance.mjs");
  assert.ok(mod, "RED: semantic/finance.mjs absent (A-5 envelope lives in the finance family)");
  const recompute = mod.serializeOverviewMoney ?? mod.serializeFinance ?? mod.default;
  assert.equal(typeof recompute, "function", "an overview-money envelope fn is required to close A-5");

  await setPrincipal(OWNER);
  const out = await recompute(db, AS_OF_PINNED, OWNER);
  // The contract lets the builder put these on financeOverview OR a dedicated
  // overview-money serializer; either way, each must be enveloped, not a bare string.
  for (const key of ["received", "billable"]) {
    const v = out[key];
    assert.notEqual(typeof v, "string", `${key} must NOT be a bare pg-numeric string (A-5)`);
    if (v !== undefined) {
      assert.equal(isMetric(v) || typeof v === "number", true,
        `${key} is a Metric or coerced Number, never a raw pg string`);
    }
  }
});

// ────────────────────────────────────────────────────────────
// F. Viewer redaction — a designer never sees the money figures (both seams).
// ────────────────────────────────────────────────────────────
test("[band/⑤] designer gets finance money OMITTED or refused (value:null, insufficient) — never a number", async () => {
  const mod = await tryImport("../semantic/finance.mjs");
  assert.ok(mod, "RED: semantic/finance.mjs absent");
  const recompute = mod.serializeFinance ?? mod.financeOverview ?? mod.default;
  assert.equal(typeof recompute, "function");

  await setPrincipal(DESIGNER);
  const fin = await recompute(db, AS_OF_PINNED, DESIGNER);

  for (const key of ["income", "billable", "receivables"]) {
    if (Object.prototype.hasOwnProperty.call(fin, key)) {
      const v = fin[key];
      const leaked =
        typeof v === "number" ||
        typeof v === "string" ||
        (v && typeof v === "object" && typeof v.value === "number");
      assert.equal(leaked, false, `money key '${key}' must not leak a number to a designer`);
      if (v && typeof v === "object" && "confidence" in v) {
        assert.equal(v.confidence, "insufficient", `refused '${key}' must be 'insufficient'`);
      }
    }
  }
});

// R2 (orchestrator-added after the S3 adversary found a band LEAK): the prior
// ledger only checked serializeFinance, so a designer was leaking contract/cost/
// profit (bare) + nested project.contractValue on the PROFITABILITY rows. The
// band must hold on every money endpoint, not just finance.
test("[band/⑤ profitability] a designer sees NO money on profitability rows — contract/cost/profit + nested project money omitted, margin refused", async () => {
  const mod = await tryImport("../semantic/profitability.mjs");
  assert.ok(mod, "RED: semantic/profitability.mjs absent");
  const recompute = mod.serializeProfitability ?? mod.profitabilityByProject ?? mod.default;
  assert.equal(typeof recompute, "function");

  await setPrincipal(DESIGNER);
  const rows = await recompute(db, AS_OF_PINNED, DESIGNER);
  assert.ok(Array.isArray(rows) && rows.length >= 1, "profitability returns rows for a designer too");

  const isNum = (x) =>
    typeof x === "number" ||
    (typeof x === "string" && /^-?\d+(\.\d+)?$/.test(x)) ||
    Boolean(x && typeof x === "object" && typeof x.value === "number");
  // NB: an OMITTED money key is `undefined` → isNum(undefined) must be a strict
  // `false` (Boolean(...) coerces the last operand), so omission passes the band.

  for (const row of rows) {
    for (const key of ["contract", "cost", "profit", "received"]) {
      assert.equal(isNum(row[key]), false,
        `designer must not see profitability money key '${key}' (got ${JSON.stringify(row[key])})`);
    }
    const m = row.margin ?? row.marginMetric;
    if (m && typeof m === "object" && "value" in m) {
      assert.equal(m.value, null, "margin Metric must be refused (value:null) for a designer");
      assert.equal(m.confidence, "insufficient", "refused margin is 'insufficient'");
    } else {
      assert.equal(isNum(m), false, "margin must not be a bare number for a designer");
    }
    const proj = row.project;
    if (proj && typeof proj === "object") {
      for (const pk of ["contractValue", "contract_value", "contract"]) {
        assert.equal(isNum(proj[pk]), false,
          `designer must not see nested project.${pk} (got ${JSON.stringify(proj[pk])})`);
      }
    }
  }
});

// ────────────────────────────────────────────────────────────
// G. Array endpoints — projects/clients/payments served per-family, company-scoped.
//    (serialize-only: no Metric, but Firm-B rows never bleed; A-5 redaction for
//    money columns on payment rows when a designer reads them.)
// ────────────────────────────────────────────────────────────
test("[arrays] projects/clients/payments endpoints serve company-scoped rows (no Firm-B bleed)", async () => {
  const mod = await tryImport("../semantic/finance.mjs"); // arrays may live alongside; builder picks the module
  const arr =
    (await tryImport("../semantic/arrays.mjs")) ?? mod; // contract allows a dedicated arrays.mjs
  assert.ok(arr, "RED: an arrays serializer (semantic/arrays.mjs or finance.mjs) must serve projects/clients/payments");
  const servePayments = arr.servePayments ?? arr.payments ?? arr.default;
  assert.equal(typeof servePayments, "function",
    "a payments-array serializer is required (company-scoped, Viewer money redaction)");

  await setPrincipal(OWNER);
  const rows = await servePayments(db, AS_OF_PINNED, OWNER);
  assert.ok(Array.isArray(rows) && rows.length >= 1, "payments array non-empty for Firm A");
  // No Firm-B milestone ids may appear in Firm-A's payload.
  const ids = JSON.stringify(rows);
  assert.equal(/bpm1|bpm2/.test(ids), false, "Firm-B milestones (bpm1/bpm2) must not bleed into Firm-A payments");
  assert.ok(/pm10/.test(ids), "Firm-A overdue milestone pm10 present in the payments array");
});
