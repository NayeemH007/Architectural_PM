// ============================================================
// Slice 2b — PARITY ledger (reviewer-authored, RED today).
// ------------------------------------------------------------
// The swap must be DROP-IN: the backend overdueAmount Metric JSON
// must have the SAME keys + types as the Slice-2a FRONTEND Metric
// (value, unit:'bdt', label, confidence, completeness, asOf, formula,
// note, sources[].{sourceId,sourceName,recordRef,observedAt}) AND the
// SAME recordRef 'tally:pm10' — so the ProvenancePopover renders
// identically before/after the data-source swap (⑦).
//
// The golden 2a shape is the live frontend Metric (app/src/lib/types.ts
// Metric/Provenance + the managementOverview() envelope in api.ts).
// It is pinned here as GOLDEN so a drift on either side fails this test.
//
// RED today: the backend serializeOverview 3-arg Metric form (G1) is
// not implemented, so the backend overdueAmount is a bare pg-numeric
// string and has none of these keys. Builder makes it GREEN per
// backend/spike/SLICE-2B-CONTRACT.md §4. Reviewer MUST NOT implement.
// ============================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, FIRM_A, AS_OF_PINNED } from "./harness.mjs";

const KPI_VERSION = 1;
let db;

before(async () => {
  db = await freshDb();
});
after(async () => {
  if (db) await db.close();
});

async function setPrincipal(p) {
  await db.query(`select set_config('request.company_id', $1, false)`, [p.companyId]);
  await db.query(`select set_config('request.role', $1, false)`, [p.role ?? ""]);
}
const FIRM_A_OWNER = { companyId: FIRM_A, role: "founder" };

// ─── GOLDEN: the Slice-2a frontend Metric contract (types.ts + api.ts) ───
// Top-level Metric keys + their JS typeof, and the per-source Provenance keys.
// Mirrors app/src/lib/types.ts:41-62 and the managementOverview() envelope.
const GOLDEN_METRIC_TYPES = {
  value: "number",        // 930000 (coerced; pg-numeric string is a parity FAILURE)
  unit: "string",         // 'bdt'
  label: "string",
  confidence: "string",   // 'low'
  completeness: "number",
  asOf: "string",         // ISO
  formula: "string",
  note: "string",
  sources: "object",      // Array (typeof [] === 'object')
};
const GOLDEN_SOURCE_TYPES = {
  sourceId: "string",
  sourceName: "string",
  recordRef: "string",    // contains 'tally:pm10'
  observedAt: "string",   // ISO
};
const GOLDEN_RECORD_REF_SUBSTR = "tally:pm10";

async function backendOverdueMetric() {
  await setPrincipal(FIRM_A_OWNER);
  const sumRes = await db.query(
    `select * from mart.recompute_portfolio_summary($1::timestamptz, $2::int)`,
    [AS_OF_PINNED, KPI_VERSION],
  );
  const summaryRow = sumRes.rows[0];
  const linRes = await db.query(
    `select kpi_run_id, metric_key, entity_id, contribution_value,
            source_id, record_ref, observed_at, company_id
       from mart.kpi_lineage
      where metric_key = 'overdueAmount' and kpi_run_id = $1`,
    [summaryRow.kpi_run_id],
  );
  const { serializeOverview } = await import("../semantic/serialize.mjs");
  const payload = serializeOverview(summaryRow, linRes.rows, FIRM_A_OWNER);
  // Round-trip through JSON exactly like the HTTP boundary would.
  return JSON.parse(JSON.stringify(payload)).overdueAmount;
}

test("[⑦ parity] backend overdueAmount Metric has the SAME top-level keys + types as the Slice-2a frontend Metric", async () => {
  const m = await backendOverdueMetric();
  assert.ok(m && typeof m === "object" && !Array.isArray(m),
    "overdueAmount must be a Metric object (RED today: it is a bare pg-numeric string)");

  for (const [key, expectedType] of Object.entries(GOLDEN_METRIC_TYPES)) {
    assert.ok(Object.prototype.hasOwnProperty.call(m, key),
      `Metric must have key '${key}' (parity with Slice-2a frontend Metric)`);
    if (key === "sources") {
      assert.ok(Array.isArray(m.sources), "Metric.sources must be an Array");
    } else {
      assert.equal(typeof m[key], expectedType,
        `Metric.${key} must be typeof '${expectedType}' (got '${typeof m[key]}')`);
    }
  }
  // value must be a coerced NUMBER, not a pg-numeric string (the bare-scalar half of G1).
  assert.equal(typeof m.value, "number", "Metric.value must be a number, not a pg-numeric string");
});

test("[⑦ parity] each source has the SAME Provenance keys + types as Slice-2a, with the SAME recordRef tally:pm10", async () => {
  const m = await backendOverdueMetric();
  assert.ok(Array.isArray(m.sources) && m.sources.length >= 1, "sources must be a non-empty array");

  for (const s of m.sources) {
    for (const [key, expectedType] of Object.entries(GOLDEN_SOURCE_TYPES)) {
      assert.ok(Object.prototype.hasOwnProperty.call(s, key),
        `Provenance must have key '${key}'`);
      assert.equal(typeof s[key], expectedType,
        `Provenance.${key} must be typeof '${expectedType}' (got '${typeof s[key]}')`);
    }
  }

  // The SAME ref the 2a mock cites — drop-in popover.
  const refs = m.sources.map((s) => s.recordRef);
  assert.ok(refs.some((r) => r.includes(GOLDEN_RECORD_REF_SUBSTR)),
    `a source recordRef must contain '${GOLDEN_RECORD_REF_SUBSTR}' (identical ref to Slice-2a)`);
});

test("[⑦ parity] no EXTRA non-2a keys on the Metric (shape is exactly the 2a envelope, drop-in)", async () => {
  const m = await backendOverdueMetric();
  // Slice-2a Metric allows these optional keys too (types.ts): deltaPct, trend, ingestedAt.
  const ALLOWED_METRIC_KEYS = new Set([
    ...Object.keys(GOLDEN_METRIC_TYPES),
    "deltaPct", "trend",
  ]);
  for (const key of Object.keys(m)) {
    assert.ok(ALLOWED_METRIC_KEYS.has(key),
      `Metric has unexpected key '${key}' not in the Slice-2a envelope — swap would not be drop-in`);
  }
  const ALLOWED_SOURCE_KEYS = new Set([...Object.keys(GOLDEN_SOURCE_TYPES), "ingestedAt"]);
  for (const s of m.sources) {
    for (const key of Object.keys(s)) {
      assert.ok(ALLOWED_SOURCE_KEYS.has(key),
        `Provenance has unexpected key '${key}' not in the Slice-2a Provenance shape`);
    }
  }
});
