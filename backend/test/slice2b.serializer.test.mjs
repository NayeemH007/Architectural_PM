// ============================================================
// Slice 2b — SERIALIZER ledger (reviewer-authored, RED today).
// ------------------------------------------------------------
// Closes adversary gap G1 at the BACKEND serializer: today
// serializeOverview returns overdueAmount as a BARE scalar for
// finance-eligible principals (in pglite a pg-numeric STRING
// "930000") with no confidence / note / sources. This ledger
// demands it return a full Metric{} envelope whose sources[] come
// from mart.kpi_lineage (real DB provenance, NOT synthesized).
//
// Builder makes it GREEN by extending serializeOverview to the new
// 3-arg form `serializeOverview(row, lineageRows, principal)` per
// backend/spike/SLICE-2B-CONTRACT.md §2. The 2-arg form
// `serializeOverview(row, principal)` MUST keep working
// (spike.acceptance.test.mjs depends on it).
//
// Reviewer MUST NOT implement the serializer change.
//
// Determinism: runs over pglite via harness freshDb() + recompute;
// as_of is the injected pinned clock; no wall-clock reads.
// ============================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  freshDb,
  FIRM_A,
  AS_OF_PINNED,
} from "./harness.mjs";

const KPI_VERSION = 1;
let db;

before(async () => {
  // RED until the builder ships migrations + seed (already shipped by spike) AND
  // the serializer Metric envelope (G1). freshDb fails cleanly if the former is absent.
  db = await freshDb();
});

after(async () => {
  if (db) await db.close();
});

async function setPrincipal(principal) {
  await db.query(`select set_config('request.company_id', $1, false)`, [principal.companyId]);
  await db.query(`select set_config('request.user_id', $1, false)`, [principal.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [principal.role ?? ""]);
}

// Finance-eligible (sees money) — the spike's locked set { founder, finance }.
const FIRM_A_OWNER = { companyId: FIRM_A, userId: "m1", role: "founder" };
// Non-finance (redacted) — designer.
const FIRM_A_DESIGNER = { companyId: FIRM_A, userId: "m6", role: "designer" };

/**
 * Recompute Firm A at the pinned clock and return BOTH the summary row and the
 * overdueAmount kpi_lineage rows for THAT run — the two inputs the new
 * serializeOverview(row, lineageRows, principal) consumes.
 */
async function recomputeWithLineage(principal, asOf = AS_OF_PINNED) {
  await setPrincipal(principal);
  const sumRes = await db.query(
    `select * from mart.recompute_portfolio_summary($1::timestamptz, $2::int)`,
    [asOf, KPI_VERSION],
  );
  assert.equal(sumRes.rows.length, 1, "recompute must return exactly one summary row");
  const summaryRow = sumRes.rows[0];
  const linRes = await db.query(
    `select kpi_run_id, metric_key, entity_id, contribution_value,
            source_id, record_ref, observed_at, company_id
       from mart.kpi_lineage
      where metric_key = 'overdueAmount'
        and kpi_run_id = $1`,
    [summaryRow.kpi_run_id],
  );
  return { summaryRow, lineageRows: linRes.rows };
}

function isMetric(v) {
  return v && typeof v === "object" && "value" in v && "confidence" in v && "sources" in v;
}

// ============================================================
// [G1] FINANCE-ELIGIBLE: overdueAmount is a Metric built FROM kpi_lineage.
// ============================================================
test("[G1] serializeOverview(row, lineageRows, owner) returns overdueAmount as a Metric (not a bare scalar)", async () => {
  const { summaryRow, lineageRows } = await recomputeWithLineage(FIRM_A_OWNER);
  assert.ok(lineageRows.length >= 1, "fixture sanity: expected >= 1 overdue lineage row (pm10)");

  const { serializeOverview } = await import("../semantic/serialize.mjs");
  const payload = serializeOverview(summaryRow, lineageRows, FIRM_A_OWNER);

  const m = payload.overdueAmount;
  // RED today: the 3-arg form is not implemented → overdueAmount is the raw
  // numeric STRING "930000" (a bare scalar), not a Metric envelope.
  assert.notEqual(typeof m, "string", "overdueAmount must NOT be a bare pg-numeric string");
  assert.notEqual(typeof m, "number", "overdueAmount must NOT be a bare number");
  assert.equal(isMetric(m), true, "overdueAmount must be a Metric{value,confidence,sources}");
});

test("[G1/①] Metric value === 930000 and equals Σ lineage contribution_value (VALUE = Σ LINEAGE, coerced from pg-numeric)", async () => {
  const { summaryRow, lineageRows } = await recomputeWithLineage(FIRM_A_OWNER);
  const { serializeOverview } = await import("../semantic/serialize.mjs");
  const m = serializeOverview(summaryRow, lineageRows, FIRM_A_OWNER).overdueAmount;

  assert.equal(isMetric(m), true, "overdueAmount must be a Metric");
  // pg numeric arrives as a JS string; the Metric value must be a coerced Number.
  assert.equal(typeof m.value, "number", "Metric.value must be a coerced number, not a pg string");

  // Σ over the SAME lineage rows the serializer was fed.
  const lineageSum = lineageRows.reduce((s, r) => s + Number(r.contribution_value), 0);
  assert.equal(m.value, lineageSum, "Metric.value must equal Σ lineage contribution_value");
  // The seeded Firm-A run has exactly pm10 overdue (gross 930000, received 0).
  assert.equal(m.value, 930000, "seeded Firm-A overdueAmount is 930000");
});

test("[⑤ tax-honesty] Metric confidence==='low' with a gross/withholding note + bdt unit + asOf", async () => {
  const { summaryRow, lineageRows } = await recomputeWithLineage(FIRM_A_OWNER);
  const { serializeOverview } = await import("../semantic/serialize.mjs");
  const m = serializeOverview(summaryRow, lineageRows, FIRM_A_OWNER).overdueAmount;

  assert.equal(isMetric(m), true, "overdueAmount must be a Metric");
  assert.equal(m.confidence, "low", "gross figure is low-trust (⑤ tax deferred)");
  assert.equal(typeof m.note, "string", "Metric.note must be a string");
  assert.match(m.note, /gross|withhold/i, "note must mention gross/withholding");
  assert.equal(m.unit, "bdt", "Metric.unit must be 'bdt'");
  assert.equal(typeof m.label, "string", "Metric.label must be a string");
  assert.ok(m.label.length > 0, "Metric.label must be non-empty");
  assert.equal(typeof m.completeness, "number", "Metric.completeness must be a number");
  assert.equal(typeof m.asOf, "string", "Metric.asOf must be an ISO string");
  assert.ok(m.asOf.length > 0, "Metric.asOf must be non-empty");
});

test("[① drillable] sources[] come from kpi_lineage — recordRef contains 'tally:pm10', one per lineage row, NOT synthesized", async () => {
  const { summaryRow, lineageRows } = await recomputeWithLineage(FIRM_A_OWNER);
  const { serializeOverview } = await import("../semantic/serialize.mjs");
  const m = serializeOverview(summaryRow, lineageRows, FIRM_A_OWNER).overdueAmount;

  assert.equal(isMetric(m), true, "overdueAmount must be a Metric");
  assert.ok(Array.isArray(m.sources), "Metric.sources must be an array");
  // one Provenance per lineage row (drives the popover row-for-row).
  assert.equal(m.sources.length, lineageRows.length, "one source per lineage row");
  assert.ok(m.sources.length >= 1, "must cite >= 1 source");

  // recordRef must be the REAL ref from kpi_lineage (contains the milestone id).
  const refs = m.sources.map((s) => s.recordRef);
  assert.ok(refs.some((r) => typeof r === "string" && r.includes("tally:pm10")),
    "a source recordRef must contain 'tally:pm10' (real kpi_lineage ref, not synthesized)");

  // every source carries the real lineage provenance shape.
  const lineageRefs = new Set(lineageRows.map((r) => r.record_ref));
  for (const s of m.sources) {
    assert.equal(typeof s.sourceId, "string", "source.sourceId is a string");
    assert.equal(typeof s.sourceName, "string", "source.sourceName is a string");
    assert.equal(typeof s.recordRef, "string", "source.recordRef is a string");
    assert.ok(lineageRefs.has(s.recordRef),
      `source.recordRef '${s.recordRef}' must come from kpi_lineage, not be synthesized`);
    assert.equal(typeof s.observedAt, "string", "source.observedAt is an ISO string");
    assert.ok(s.observedAt.length > 0, "source.observedAt non-empty");
  }
});

// ============================================================
// NON-FINANCE (designer): overdueAmount omitted, OR refused Metric. (unchanged
// from spike, asserted here so the G1 change does not leak money to a Viewer.)
// ============================================================
test("[⑤/C4] designer principal: overdueAmount is OMITTED (absent) or refused {value:null, confidence:'insufficient'}", async () => {
  const { summaryRow, lineageRows } = await recomputeWithLineage(FIRM_A_OWNER);
  const { serializeOverview } = await import("../semantic/serialize.mjs");

  // serialize the SAME run's row/lineage but for the designer.
  const viewer = serializeOverview(summaryRow, lineageRows, FIRM_A_DESIGNER);

  const hasKey = Object.prototype.hasOwnProperty.call(viewer, "overdueAmount");
  if (!hasKey) {
    // omission path — money key absent. Good.
    assert.equal(hasKey, false, "overdueAmount omitted for designer");
  } else {
    // refusal path — must be exactly the insufficient envelope, never a number.
    const m = viewer.overdueAmount;
    assert.ok(m && typeof m === "object", "if present, overdueAmount must be a refusal envelope");
    assert.equal(m.value, null, "refused Metric.value must be null for designer");
    assert.equal(m.confidence, "insufficient", "refused Metric.confidence must be 'insufficient'");
  }

  // Belt-and-suspenders: no money key may leak a numeric value for the designer.
  const MONEY = ["overdueamount", "overdueAmount", "total_contract", "totalContract", "received", "billable"];
  for (const k of MONEY) {
    if (Object.prototype.hasOwnProperty.call(viewer, k)) {
      const v = viewer[k];
      const leaked = typeof v === "number" || typeof v === "string" ||
        (v && typeof v === "object" && typeof v.value === "number");
      assert.equal(leaked, false, `money key '${k}' must not leak a numeric value to designer`);
    }
  }
});

// ============================================================
// 2-arg backwards compatibility: serializeOverview(row, principal) (spike form)
// must still redact money for a designer WITHOUT a lineage array.
// ============================================================
test("[compat] 2-arg serializeOverview(row, designer) still omits money keys (spike form unbroken)", async () => {
  const { summaryRow } = await recomputeWithLineage(FIRM_A_OWNER);
  const { serializeOverview } = await import("../semantic/serialize.mjs");
  const viewer = serializeOverview(summaryRow, FIRM_A_DESIGNER); // 2-arg: 2nd is the principal

  for (const k of ["overdueamount", "total_contract", "received", "billable"]) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(viewer, k),
      false,
      `2-arg designer payload must OMIT money key '${k}'`,
    );
  }
});
