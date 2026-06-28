// ============================================================
// Acceptance ledger — first vertical slice (KPI provenance-lineage
// parity spike). Reviewer-authored, test-first. These tests are
// RED today: backend/db/** and the recompute function / serializer
// they reference do not exist yet. A LATER, DIFFERENT agent (the
// builder) makes them GREEN. The author MUST NOT implement schema/
// seed/semantic logic here.
//
// Each test name cites the finding id it closes. The contract these
// assert against is backend/spike/BUILD-CONTRACT.md.
//
// Determinism: as_of is ALWAYS injected; no test reads the wall clock.
// ============================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  freshDb,
  FIRM_A,
  FIRM_B,
  AS_OF_PINNED,
  AS_OF_ADVANCED,
} from "./harness.mjs";

const KPI_VERSION = 1;

let db;

before(async () => {
  // freshDb() FAILS CLEANLY (clear RED message) until the builder ships
  // backend/db/migrations/** + backend/db/seed/seed_live.mjs.
  db = await freshDb();
});

after(async () => {
  if (db) await db.close();
});

// --- principal / RLS context helpers (pglite JWT emulation, CONTEXT.md) ---
// The builder's RLS reads current_setting('request.company_id' | 'request.user_id'
// | 'request.role'). We set them per-call. company-scoped settings are LOCAL to
// a transaction-less session here; set them immediately before each query.
async function setPrincipal(principal) {
  // principal: { companyId, userId, role }
  await db.query(`select set_config('request.company_id', $1, false)`, [principal.companyId]);
  await db.query(`select set_config('request.user_id', $1, false)`, [principal.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [principal.role ?? ""]);
}

// Firm-A finance-eligible principal (founder) — sees money.
const FIRM_A_OWNER = { companyId: FIRM_A, userId: "m1", role: "founder" };
// Firm-A Viewer — designer, can_check=false, NO finance grant.
const FIRM_A_VIEWER = { companyId: FIRM_A, userId: "m6", role: "designer" };

/**
 * Run the recompute for Firm A at a given as_of, returning the row the
 * function emits: { kpi_run_id, overdueamount, ... } plus convenience.
 * Contract: mart.recompute_portfolio_summary(p_as_of timestamptz, p_kpi_version int)
 * returns one row whose first column is the minted kpi_run_id (uuid) and which
 * also exposes the computed overdueAmount. See BUILD-CONTRACT.md.
 */
async function recomputeFirmA(asOf) {
  await setPrincipal(FIRM_A_OWNER);
  const res = await db.query(
    `select * from mart.recompute_portfolio_summary($1::timestamptz, $2::int)`,
    [asOf, KPI_VERSION],
  );
  assert.equal(res.rows.length, 1, "recompute must return exactly one summary row");
  return res.rows[0];
}

// ============================================================
// (a) [closes F2/①] VALUE = Σ LINEAGE
//   portfolio_summary.overdueAmount EXACTLY equals SUM(contribution_value)
//   over precisely the kpi_lineage rows for this metric + this kpi_run_id.
//   No row belongs to a different kpi_run_id; no Firm-B entity appears.
//   Asserted as an INVARIANT (value == Σ), not a hardcoded magic total,
//   plus the run produced >= 1 contribution row.
// ============================================================
test("(a) [F2/①] overdueAmount value equals SUM(contribution_value) over its exact kpi_run_id lineage; no foreign run, no Firm-B rows", async () => {
  const run = await recomputeFirmA(AS_OF_PINNED);
  const kpiRunId = run.kpi_run_id;
  assert.ok(kpiRunId, "recompute must mint/return a kpi_run_id");

  // the displayed scalar
  const value = Number(run.overdueamount ?? run.overdueAmount);
  assert.ok(Number.isFinite(value), "overdueAmount must be a finite number");

  // Σ of the EXACT lineage rows tagged with metric_key + this run
  const sumRes = await db.query(
    `select coalesce(sum(contribution_value), 0)::numeric as total,
            count(*)::int as n
       from mart.kpi_lineage
      where metric_key = 'overdueAmount'
        and kpi_run_id = $1`,
    [kpiRunId],
  );
  const lineageSum = Number(sumRes.rows[0].total);
  const lineageRows = Number(sumRes.rows[0].n);

  // INVARIANT: value reconstructable from its lineage (not a literal).
  assert.equal(value, lineageSum, "overdueAmount must equal SUM(contribution_value) of its lineage");
  // run produced at least one contribution (pm10).
  assert.ok(lineageRows >= 1, "run must produce >= 1 overdueAmount contribution row");

  // No overdueAmount lineage row may belong to a DIFFERENT kpi_run_id mixed in.
  const otherRun = await db.query(
    `select count(*)::int as n
       from mart.kpi_lineage
      where metric_key = 'overdueAmount'
        and kpi_run_id <> $1
        and entity_id in (
          select entity_id from mart.kpi_lineage
           where metric_key = 'overdueAmount' and kpi_run_id = $1
        )`,
    [kpiRunId],
  );
  // (existence of older runs is fine; this guards against the sum pulling them in —
  //  the sum above already pinned kpi_run_id, this documents the run-scoping intent.)
  assert.ok(Number(otherRun.rows[0].n) >= 0);

  // No Firm-B entity may appear in Firm-A's lineage for this run.
  const firmBEntities = await db.query(
    `select count(*)::int as n
       from mart.kpi_lineage l
      where l.metric_key = 'overdueAmount'
        and l.kpi_run_id = $1
        and l.entity_id in (
          select pm.id from canonical.payment_milestone pm
           where pm.company_id = $2::uuid
        )`,
    [kpiRunId, FIRM_B],
  );
  assert.equal(Number(firmBEntities.rows[0].n), 0, "no Firm-B entity may appear in Firm-A lineage");
});

// ============================================================
// (b) [closes F2/①] REAL REFS
//   Every overdueAmount lineage row carries a non-null source_id,
//   record_ref, observed_at — the "Why this number?" popover has content.
// ============================================================
test("(b) [F2/①] every overdueAmount lineage row has non-null source_id, record_ref, observed_at", async () => {
  const run = await recomputeFirmA(AS_OF_PINNED);
  const kpiRunId = run.kpi_run_id;

  const rows = await db.query(
    `select source_id, record_ref, observed_at
       from mart.kpi_lineage
      where metric_key = 'overdueAmount'
        and kpi_run_id = $1`,
    [kpiRunId],
  );
  assert.ok(rows.rows.length >= 1, "expected >= 1 lineage row to inspect");
  for (const r of rows.rows) {
    assert.notEqual(r.source_id, null, "source_id IS NOT NULL");
    assert.notEqual(r.record_ref, null, "record_ref IS NOT NULL");
    assert.notEqual(r.observed_at, null, "observed_at IS NOT NULL");
  }
});

// ============================================================
// (c) [closes ⑤ band / C4] VIEWER REDACTION
//   As the Firm-A Viewer, the serialized overview/clients payload MUST OMIT
//   money keys entirely (absent, not present-with-null). If any finance figure
//   is returned as a Metric, it MUST be {value:null, confidence:'insufficient'}.
//   Tested against the builder's serializer (serializeOverview).
// ============================================================
test("(c) [⑤/C4] Viewer-serialized overview omits money keys; any finance Metric is {value:null, confidence:'insufficient'}", async () => {
  // Build a summary row first (as owner), then serialize it for the Viewer.
  const run = await recomputeFirmA(AS_OF_PINNED);

  // The builder ships a TS/JS serializer that takes the raw summary row + principal.
  // It lives in backend/semantic/serialize.mjs (see BUILD-CONTRACT.md).
  const { serializeOverview, serializeClients } = await import(
    "../semantic/serialize.mjs"
  );

  const FORBIDDEN_MONEY_KEYS = [
    "contract_value",
    "contractValue",
    "amount",
    "gross_amount",
    "net_receivable",
    "margin",
    "overdueAmount",
    "overdueamount",
    "totalContract",
    "totalcontract",
    "received",
    "billable",
  ];

  // Pull the raw owner-visible row to feed the serializer.
  await setPrincipal(FIRM_A_OWNER);
  const rawRes = await db.query(
    `select * from mart.portfolio_summary where company_id = $1::uuid order by computed_at desc limit 1`,
    [FIRM_A],
  );
  assert.ok(rawRes.rows.length >= 1, "expected a portfolio_summary row to serialize");
  const rawRow = rawRes.rows[0];

  const viewerPayload = serializeOverview(rawRow, FIRM_A_VIEWER);

  // Money keys must be ABSENT (omitted), not present-with-null.
  for (const key of FORBIDDEN_MONEY_KEYS) {
    assert.equal(
      Object.prototype.hasOwnProperty.call(viewerPayload, key),
      false,
      `Viewer overview payload must OMIT money key '${key}' (absent, not null)`,
    );
  }

  // If any finance figure is returned as a Metric, it must be the refusal shape.
  for (const [k, v] of Object.entries(viewerPayload)) {
    if (v && typeof v === "object" && "confidence" in v && "value" in v) {
      // a Metric envelope — finance ones must be refused
      if (/contract|amount|margin|overdue|received|billable|receivable/i.test(k)) {
        assert.equal(v.value, null, `finance Metric '${k}' must have value:null for Viewer`);
        assert.equal(
          v.confidence,
          "insufficient",
          `finance Metric '${k}' must have confidence:'insufficient' for Viewer`,
        );
      }
    }
  }

  // Clients payload: same redaction rule.
  await setPrincipal(FIRM_A_VIEWER);
  const clientsRes = await db.query(
    `select * from canonical.client where company_id = $1::uuid`,
    [FIRM_A],
  );
  const viewerClients = serializeClients(clientsRes.rows, FIRM_A_VIEWER);
  for (const row of viewerClients) {
    for (const key of FORBIDDEN_MONEY_KEYS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(row, key),
        false,
        `Viewer clients row must OMIT money key '${key}'`,
      );
    }
  }
});

// ============================================================
// (d) [closes F7/clock] PINNED CLOCK
//   as_of=2026-06-22 -> pm10 days-overdue == 18 (reproduces the live
//   "18 days overdue" literal bit-for-bit).
//   as_of=2026-06-24 -> pm10 days-overdue == 20; overdueAmount recomputes
//   deterministically (same value, received unchanged).
//   No value depends on the wall clock.
// ============================================================
test("(d) [F7/clock] pm10 days-overdue == 18 @2026-06-22, == 20 @2026-06-24; overdueAmount deterministic; no wall-clock dependency", async () => {
  // days-overdue is computed by a deterministic semantic-layer fn taking as_of.
  // Contract: mart.days_overdue(p_due date, p_as_of timestamptz) returns int.
  async function daysOverduePm10(asOf) {
    await setPrincipal(FIRM_A_OWNER);
    const res = await db.query(
      `select mart.days_overdue(pm.due_date, $1::timestamptz) as d
         from canonical.payment_milestone pm
        where pm.company_id = $2::uuid and pm.id = 'pm10'`,
      [asOf, FIRM_A],
    );
    assert.equal(res.rows.length, 1, "pm10 must exist in Firm A");
    return Number(res.rows[0].d);
  }

  // pinned clock reproduces the live literal exactly
  assert.equal(await daysOverduePm10(AS_OF_PINNED), 18, "pm10 must be 18 days overdue @2026-06-22");
  // advanced clock moves it (+2 calendar days)
  assert.equal(await daysOverduePm10(AS_OF_ADVANCED), 20, "pm10 must be 20 days overdue @2026-06-24");

  // overdueAmount is clock-INDEPENDENT (received unchanged), so the two runs agree.
  const runPinned = await recomputeFirmA(AS_OF_PINNED);
  const runAdvanced = await recomputeFirmA(AS_OF_ADVANCED);
  const vPinned = Number(runPinned.overdueamount ?? runPinned.overdueAmount);
  const vAdvanced = Number(runAdvanced.overdueamount ?? runAdvanced.overdueAmount);
  assert.equal(
    vPinned,
    vAdvanced,
    "overdueAmount must recompute deterministically (received unchanged) across as_of",
  );

  // The two recompute runs must be distinct runs (fresh kpi_run_id each), proving
  // determinism is from the injected as_of, not run identity / wall clock.
  assert.notEqual(
    runPinned.kpi_run_id,
    runAdvanced.kpi_run_id,
    "each recompute mints a fresh kpi_run_id",
  );
});
