// ============================================================
// adversary.spike.test.mjs — ADVERSARIAL sign-off (loop step 4).
//
// Author did NOT write the build (backend/db/**, backend/semantic/**)
// and did NOT author the acceptance ledger. Job: TRY TO BREAK the four
// promises end-to-end, prove each HOLDS or is BROKEN, and document
// residual gaps. A passing acceptance test is a claim to distrust, not
// accept — these attacks mutate inputs and probe edges the green suite
// never touched.
//
// These ADD to the suite. They run on the same harness freshDb() as
// backend/test/spike.acceptance.test.mjs. Each fresh test gets its own
// db so mutations in one attack cannot leak into another.
//
// Determinism: as_of is ALWAYS injected; no test reads the wall clock.
//
// RULES OBEYED:
//   * Does NOT edit any builder file or the acceptance suite.
//   * INSERT/UPDATE as the bootstrap superuser is fair game for probing
//     the math (the attacker owns its own throwaway db).
//   * Genuine GAPS are documented as clearly-named `todo` tests with the
//     gap explained — never a red test that just means "not built yet".
// ============================================================
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  freshDb,
  FIRM_A,
  FIRM_B,
  AS_OF_PINNED,
  AS_OF_ADVANCED,
} from "./harness.mjs";

const KPI_VERSION = 1;
const AS_OF_FAR = "2026-07-04"; // pm10 due 2026-06-04 -> 30 days

// Each attack opens its own db (mutations must not bleed across tests).
async function withDb(fn) {
  const db = await freshDb();
  try {
    return await fn(db);
  } finally {
    await db.close();
  }
}

async function setPrincipal(db, principal) {
  await db.query(`select set_config('request.company_id', $1, false)`, [principal.companyId]);
  await db.query(`select set_config('request.user_id', $1, false)`, [principal.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [principal.role ?? ""]);
}

const FIRM_A_OWNER = { companyId: FIRM_A, userId: "m1", role: "founder" };
const FIRM_B_OWNER = { companyId: FIRM_B, userId: "bx", role: "founder" };

async function recompute(db, principal, asOf) {
  await setPrincipal(db, principal);
  const res = await db.query(
    `select * from mart.recompute_portfolio_summary($1::timestamptz, $2::int)`,
    [asOf, KPI_VERSION],
  );
  assert.equal(res.rows.length, 1, "recompute must return exactly one summary row");
  return res.rows[0];
}

async function lineageSum(db, kpiRunId) {
  const r = await db.query(
    `select coalesce(sum(contribution_value),0)::numeric as total, count(*)::int as n
       from mart.kpi_lineage
      where metric_key = 'overdueAmount' and kpi_run_id = $1`,
    [kpiRunId],
  );
  return { total: Number(r.rows[0].total), n: Number(r.rows[0].n) };
}

// ============================================================
// (a-i) value=Σ is NOT a coincidence: PARTIAL RECEIPT moves the metric.
//   Set pm10.received_amount = 200000 → overdueAmount must drop to
//   gross(930000) - received(200000) = 730000, and the SINGLE lineage
//   contribution must equal 730000. Proves the scalar tracks the input,
//   not a hardcoded 930000.
// ============================================================
test("(a-i) [F2/①] partial receipt: overdueAmount tracks gross-received, lineage contribution matches", async () => {
  await withDb(async (db) => {
    await db.query(
      `update canonical.payment_milestone
          set received_amount = 200000
        where company_id = $1::uuid and id = 'pm10'`,
      [FIRM_A],
    );
    const run = await recompute(db, FIRM_A_OWNER, AS_OF_PINNED);
    const value = Number(run.overdueamount ?? run.overdueAmount);
    assert.equal(value, 730000, "overdueAmount must be 930000-200000=730000 after partial receipt");

    const { total, n } = await lineageSum(db, run.kpi_run_id);
    assert.equal(n, 1, "still exactly one overdue contribution (pm10)");
    assert.equal(total, 730000, "lineage contribution must equal the new gross-received");
    assert.equal(value, total, "INVARIANT: scalar still equals Σ lineage after mutation");

    // pm10's own contribution row carries exactly the partial-adjusted value.
    const row = await db.query(
      `select contribution_value::numeric as cv from mart.kpi_lineage
        where metric_key='overdueAmount' and kpi_run_id=$1 and entity_id='pm10'`,
      [run.kpi_run_id],
    );
    assert.equal(Number(row.rows[0].cv), 730000, "pm10 lineage row = 730000");
  });
});

// ============================================================
// (a-ii) value=Σ is NOT a coincidence: a SECOND overdue milestone grows
//   the lineage to 2 rows and the sum still equals the scalar.
//   Flip pm9 (Firm A, a5, gross 620000, received 620000) — but received
//   would zero the contribution, so flip pm3 (gross 840000, received 0)
//   to 'overdue': overdueAmount must become 930000 + 840000 = 1,770,000
//   across exactly 2 lineage rows.
// ============================================================
test("(a-ii) [F2/①] second overdue milestone: lineage grows to 2 rows, Σ still equals scalar", async () => {
  await withDb(async (db) => {
    await db.query(
      `update canonical.payment_milestone
          set status = 'overdue'
        where company_id = $1::uuid and id = 'pm3'`,
      [FIRM_A],
    );
    const run = await recompute(db, FIRM_A_OWNER, AS_OF_PINNED);
    const value = Number(run.overdueamount ?? run.overdueAmount);
    const { total, n } = await lineageSum(db, run.kpi_run_id);
    assert.equal(n, 2, "lineage must grow to exactly 2 contribution rows");
    assert.equal(value, 1770000, "overdueAmount = 930000 + 840000 = 1,770,000");
    assert.equal(value, total, "INVARIANT: scalar equals Σ over the 2 lineage rows");

    // Both entities present, each with its own provenance ref.
    const ents = await db.query(
      `select entity_id, record_ref, contribution_value::numeric as cv
         from mart.kpi_lineage
        where metric_key='overdueAmount' and kpi_run_id=$1 order by entity_id`,
      [run.kpi_run_id],
    );
    const byId = Object.fromEntries(ents.rows.map((r) => [r.entity_id, r]));
    assert.equal(byId.pm10.record_ref, "tally:pm10");
    assert.equal(byId.pm3.record_ref, "tally:pm3");
    assert.equal(Number(byId.pm3.cv), 840000);
  });
});

// ============================================================
// (a-iii) CROSS-TENANT ISOLATION UNDER PRESSURE.
//   Firm B seeded with TWO overdue milestones (bpm1/bpm2, 500000 each).
//   - Recompute AS Firm A: overdueAmount must NOT include 1,000,000 and
//     NO Firm-B entity may appear in lineage.
//   - Recompute AS Firm B: must see ONLY Firm B = exactly 1,000,000.
//   Superuser BYPASSES RLS, so isolation must come from the function's
//   explicit company scoping. We prove RLS is bypassed (a raw cross-tenant
//   read succeeds) yet the function still isolates — i.e. the WHERE clause
//   is what protects us, not the policy.
// ============================================================
test("(a-iii) [F2/① + RLS-bypass] cross-tenant: Firm A never pulls Firm B; Firm B sees only itself; protection is the function scope not RLS", async () => {
  await withDb(async (db) => {
    // Sanity: Firm B really has 1,000,000 overdue seeded.
    const fb = await db.query(
      `select coalesce(sum(gross_amount-received_amount),0)::numeric as s, count(*)::int as n
         from canonical.payment_milestone
        where company_id=$1::uuid and status='overdue'`,
      [FIRM_B],
    );
    assert.equal(Number(fb.rows[0].s), 1000000, "Firm B seeded 2x500000 overdue");
    assert.equal(Number(fb.rows[0].n), 2);

    // PROVE superuser bypasses RLS: as Firm A principal, a RAW read still
    // returns Firm B rows (the policy does NOT block the bootstrap superuser).
    await setPrincipal(db, FIRM_A_OWNER);
    const rawCross = await db.query(
      `select count(*)::int as n from canonical.payment_milestone where company_id=$1::uuid`,
      [FIRM_B],
    );
    assert.ok(
      Number(rawCross.rows[0].n) >= 2,
      "RLS is BYPASSED for superuser — raw cross-tenant read sees Firm B (so isolation must come from the function's WHERE, not the policy)",
    );

    // Recompute AS Firm A — must be 930000 (pm10 only), zero Firm-B entities.
    const runA = await recompute(db, FIRM_A_OWNER, AS_OF_PINNED);
    assert.equal(Number(runA.overdueamount ?? runA.overdueAmount), 930000, "Firm A overdueAmount excludes Firm B");
    const bInA = await db.query(
      `select count(*)::int as n from mart.kpi_lineage l
        where l.metric_key='overdueAmount' and l.kpi_run_id=$1
          and l.entity_id in (select id from canonical.payment_milestone where company_id=$2::uuid)`,
      [runA.kpi_run_id, FIRM_B],
    );
    assert.equal(Number(bInA.rows[0].n), 0, "no Firm-B entity in Firm-A lineage");
    // also: every lineage row of Firm A's run is tagged company_id = Firm A.
    const aTag = await db.query(
      `select count(*)::int as n from mart.kpi_lineage
        where kpi_run_id=$1 and company_id <> $2::uuid`,
      [runA.kpi_run_id, FIRM_A],
    );
    assert.equal(Number(aTag.rows[0].n), 0, "all Firm-A lineage rows tagged Firm A");

    // Recompute AS Firm B — must be exactly 1,000,000 over 2 Firm-B rows.
    const runB = await recompute(db, FIRM_B_OWNER, AS_OF_PINNED);
    assert.equal(Number(runB.overdueamount ?? runB.overdueAmount), 1000000, "Firm B sees only its own 1,000,000");
    const sumB = await lineageSum(db, runB.kpi_run_id);
    assert.equal(sumB.n, 2, "Firm B lineage has its 2 rows");
    assert.equal(sumB.total, 1000000);
    const aInB = await db.query(
      `select count(*)::int as n from mart.kpi_lineage l
        where l.metric_key='overdueAmount' and l.kpi_run_id=$1
          and l.entity_id in (select id from canonical.payment_milestone where company_id=$2::uuid)`,
      [runB.kpi_run_id, FIRM_A],
    );
    assert.equal(Number(aInB.rows[0].n), 0, "no Firm-A entity in Firm-B lineage");
  });
});

// ============================================================
// (b) REFS ARE REAL, not placeholder.
//   record_ref == 'tally:pm10'; observed_at == pm10's derived date
//   (unreceived -> due_date 2026-06-04); source_id joins an ACTUAL
//   canonical.source row for Firm A (not a constant / null-island).
// ============================================================
test("(b) [F2/①] pm10 lineage refs are real: record_ref, observed_at derived from due_date, source_id joins a real Firm-A source", async () => {
  await withDb(async (db) => {
    const run = await recompute(db, FIRM_A_OWNER, AS_OF_PINNED);
    const r = await db.query(
      `select record_ref, observed_at, source_id from mart.kpi_lineage
        where metric_key='overdueAmount' and kpi_run_id=$1 and entity_id='pm10'`,
      [run.kpi_run_id],
    );
    assert.equal(r.rows.length, 1, "pm10 lineage row exists");
    const row = r.rows[0];
    assert.equal(row.record_ref, "tally:pm10", "record_ref is the real Tally ref");

    // observed_at derived from pm10 (unreceived -> due_date 2026-06-04).
    const obs = new Date(row.observed_at).toISOString().slice(0, 10);
    assert.equal(obs, "2026-06-04", "observed_at derived from pm10 due_date (unreceived)");

    // source_id joins a REAL canonical.source row for Firm A.
    const src = await db.query(
      `select company_id, source_system from canonical.source where id=$1`,
      [row.source_id],
    );
    assert.equal(src.rows.length, 1, "source_id resolves to an actual source row (not a null-island)");
    assert.equal(src.rows[0].company_id, FIRM_A, "source belongs to Firm A");
    assert.equal(src.rows[0].source_system, "tallyprime", "source_system matches the milestone");

    // And it equals the milestone's own provenance, not a constant.
    const pm = await db.query(
      `select source_record_ref, observed_at from canonical.payment_milestone
        where company_id=$1::uuid and id='pm10'`,
      [FIRM_A],
    );
    assert.equal(row.record_ref, pm.rows[0].source_record_ref, "lineage ref copied from milestone provenance");
    assert.equal(
      new Date(row.observed_at).getTime(),
      new Date(pm.rows[0].observed_at).getTime(),
      "lineage observed_at copied from milestone",
    );
  });
});

// ============================================================
// (c) REDACTION IS COMPLETE ACROSS ROLES, and tries to slip money through.
//   - 'principal' (Fariha m2 — NOT finance) and 'project_lead' must OMIT
//     every money key.
//   - 'founder' and 'finance' may keep money.
//   - Slip attempts: different casing, nested objects, a Metric envelope,
//     extra fields. Confirm omitted != null.
// ============================================================
test("(c) [⑤/C4] redaction complete for principal + project_lead; founder/finance keep money; no slip via casing/nested/Metric/extra", async () => {
  const { serializeOverview, serializeClients } = await import("../semantic/serialize.mjs");

  const PRINCIPAL = { companyId: FIRM_A, userId: "m2", role: "principal" }; // Fariha — NOT finance
  const PROJECT_LEAD = { companyId: FIRM_A, userId: "m3", role: "project_lead" };
  const FOUNDER = { companyId: FIRM_A, userId: "m1", role: "founder" };
  const FINANCE = { companyId: FIRM_A, userId: "mF", role: "finance" };

  const MONEY_KEYS = [
    "contract_value", "contractValue", "amount", "gross_amount", "net_receivable",
    "margin", "overdueAmount", "overdueamount", "totalContract", "totalcontract",
    "total_contract", "received", "billable", "received_amount",
  ];

  // A hostile row trying every smuggle vector.
  const hostile = {
    company_id: FIRM_A,
    label: "ok-nonmoney",
    overdueAmount: 930000,          // camel
    overdueamount: 930000,          // lower
    total_contract: 17400000,       // snake
    contractValue: 17400000,        // camel
    received: 5000000,
    billable: 9999999,
    gross_amount: 930000,
    margin: 42,
    // Metric-envelope money figure
    receivedMetric: { value: 5000000, confidence: "high", label: "received" },
    // extra non-money field must survive
    active_count: 6,
    as_of: "2026-06-22T00:00:00Z",
  };

  for (const viewer of [PRINCIPAL, PROJECT_LEAD]) {
    const out = serializeOverview(hostile, viewer);
    for (const k of MONEY_KEYS) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(out, k), false,
        `${viewer.role}: money key '${k}' must be OMITTED (absent, not null)`,
      );
      // and explicitly: not present-with-null
      assert.equal(out[k], undefined, `${viewer.role}: '${k}' must be undefined (omitted, not null)`);
    }
    // Non-money fields survive.
    assert.equal(out.active_count, 6, `${viewer.role}: non-money field survives`);
    assert.equal(out.label, "ok-nonmoney");
    // A money Metric, if a money key, must be the refusal shape; receivedMetric
    // is NOT in MONEY_KEYS so the serializer passes it through — document that.
    if ("receivedMetric" in out) {
      // not a money key per the serializer's set -> passes through unredacted.
      // (Documented gap, see ADVERSARY.md: redaction is key-name driven.)
      assert.ok(out.receivedMetric, "receivedMetric passes through (not in money-key set)");
    }
  }

  // Finance-eligible roles keep money untouched.
  for (const eligible of [FOUNDER, FINANCE]) {
    const out = serializeOverview(hostile, eligible);
    assert.equal(out.overdueAmount, 930000, `${eligible.role}: keeps overdueAmount`);
    assert.equal(out.total_contract, 17400000, `${eligible.role}: keeps total_contract`);
    assert.equal(out.received, 5000000, `${eligible.role}: keeps received`);
  }

  // Clients redaction for principal: a hostile client row with money keys.
  const hostileClients = [
    { id: "c1", company_id: FIRM_A, name: "X", contract_value: 1, amount: 2, received_amount: 3, type: "residential" },
  ];
  const redacted = serializeClients(hostileClients, PRINCIPAL);
  for (const k of ["contract_value", "amount", "received_amount"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(redacted[0], k), false, `clients: '${k}' omitted for principal`);
  }
  assert.equal(redacted[0].name, "X", "clients: non-money field survives");
});

// ============================================================
// (c-refusal) The serializer's Metric-refusal path: a money KEY carrying a
//   Metric must become {value:null, confidence:'insufficient'} for a
//   non-finance principal — NOT a leaked number, NOT omitted-silently.
//   (Probes the branch the acceptance suite never exercises because the raw
//    summary row has bare numbers, not Metrics.)
// ============================================================
test("(c-refusal) [②] money key carrying a Metric becomes {value:null, confidence:'insufficient'} for non-finance", async () => {
  const { serializeOverview } = await import("../semantic/serialize.mjs");
  const PRINCIPAL = { companyId: FIRM_A, userId: "m2", role: "principal" };
  const row = {
    label: "x",
    overdueAmount: { value: 930000, confidence: "low", label: "overdue", note: "gross", sources: [{ recordRef: "tally:pm10" }] },
  };
  const out = serializeOverview(row, PRINCIPAL);
  assert.ok("overdueAmount" in out, "money Metric is KEPT as a refusal envelope (not omitted) when it is a Metric");
  assert.equal(out.overdueAmount.value, null, "refused Metric value:null");
  assert.equal(out.overdueAmount.confidence, "insufficient", "refused Metric confidence:insufficient");
  // No real number leaks through.
  assert.notEqual(out.overdueAmount.value, 930000, "the 930000 must NOT leak");
});

// ============================================================
// (d) CLOCK PURITY: days_overdue is a pure function of (due, as_of).
//   Third as_of 2026-07-04 -> 30. A pre-due date -> negative (not overdue).
//   overdueAmount identical across ALL as_of (pinned/advanced/far).
// ============================================================
test("(d) [F7/clock] days_overdue pure over 3 as_of (18/20/30) + pre-due negative; overdueAmount invariant across as_of", async () => {
  await withDb(async (db) => {
    await setPrincipal(db, FIRM_A_OWNER);

    async function days(due, asOf) {
      const r = await db.query(`select mart.days_overdue($1::date, $2::timestamptz) as d`, [due, asOf]);
      return Number(r.rows[0].d);
    }

    // pm10 due 2026-06-04 across three injected clocks.
    assert.equal(await days("2026-06-04", AS_OF_PINNED), 18, "18 @2026-06-22");
    assert.equal(await days("2026-06-04", AS_OF_ADVANCED), 20, "20 @2026-06-24");
    assert.equal(await days("2026-06-04", AS_OF_FAR), 30, "30 @2026-07-04");

    // Purity: same args -> same result regardless of order / repetition.
    assert.equal(await days("2026-06-04", AS_OF_PINNED), 18, "re-eval identical (no wall clock)");

    // Pre-due milestone: as_of BEFORE due -> negative (not yet overdue).
    // 2026-06-22 -> 2026-08-20 is 59 calendar days, so as_of-due = -59.
    assert.equal(await days("2026-08-20", AS_OF_PINNED), -59, "pre-due date is negative, not clamped");

    // overdueAmount identical across all three as_of runs (received unchanged).
    const v1 = Number((await recompute(db, FIRM_A_OWNER, AS_OF_PINNED)).overdueamount);
    const v2 = Number((await recompute(db, FIRM_A_OWNER, AS_OF_ADVANCED)).overdueamount);
    const v3 = Number((await recompute(db, FIRM_A_OWNER, AS_OF_FAR)).overdueamount);
    assert.equal(v1, 930000);
    assert.equal(v1, v2, "overdueAmount invariant pinned vs advanced");
    assert.equal(v2, v3, "overdueAmount invariant advanced vs far");
  });
});

// ============================================================
// (d-fresh-id) Each recompute mints a DISTINCT kpi_run_id even at the SAME
//   as_of (determinism is from inputs, not run identity). The acceptance
//   suite only checks distinct ids across DIFFERENT as_of; this proves it
//   for IDENTICAL as_of too, and that lineage stays partitioned per run.
// ============================================================
test("(d-fresh-id) [F7] two recomputes at the SAME as_of mint distinct kpi_run_ids; lineage stays partitioned", async () => {
  await withDb(async (db) => {
    const r1 = await recompute(db, FIRM_A_OWNER, AS_OF_PINNED);
    const r2 = await recompute(db, FIRM_A_OWNER, AS_OF_PINNED);
    assert.notEqual(r1.kpi_run_id, r2.kpi_run_id, "distinct run ids at identical as_of");
    // Each run's lineage sums to the same scalar but lives under its own id.
    const s1 = await lineageSum(db, r1.kpi_run_id);
    const s2 = await lineageSum(db, r2.kpi_run_id);
    assert.equal(s1.total, 930000);
    assert.equal(s2.total, 930000);
    assert.equal(s1.n, 1);
    assert.equal(s2.n, 1);
  });
});

// ============================================================
// TAX-DEFERRAL HONESTY (lock ⑤).
//   net_receivable/vat/vds_withheld/ait_withheld NULL for EVERY seeded
//   milestone (both firms). overdueAmount is GROSS (gross - received) and is
//   never served as net cash. A gross number presented as cash violates ⑤.
// ============================================================
test("(tax) [⑤] deferred tax columns NULL for every milestone; overdueAmount is GROSS not net cash", async () => {
  await withDb(async (db) => {
    // Every milestone (Firm A + Firm B) has NULL tax columns.
    const nn = await db.query(
      `select count(*)::int as n from canonical.payment_milestone
        where net_receivable is not null or vat is not null
           or vds_withheld is not null or ait_withheld is not null`,
    );
    assert.equal(Number(nn.rows[0].n), 0, "no milestone may have a non-NULL deferred tax column");

    // overdueAmount is computed from GROSS (gross-received), NOT from
    // net_receivable. Prove by construction: had it used net_receivable
    // (all NULL), the sum would be 0/NULL. It is 930000.
    const run = await recompute(db, FIRM_A_OWNER, AS_OF_PINNED);
    const v = Number(run.overdueamount);
    assert.equal(v, 930000, "overdueAmount = gross(930000) - received(0) — GROSS face value");

    // Equals gross-received directly from canonical (the GROSS definition).
    const g = await db.query(
      `select coalesce(sum(gross_amount-received_amount),0)::numeric as s
         from canonical.payment_milestone
        where company_id=$1::uuid and status='overdue'`,
      [FIRM_A],
    );
    assert.equal(Number(g.rows[0].s), v, "overdueAmount tracks GROSS-received, not net_receivable");

    // The lineage contribution is likewise gross-received, not a net figure.
    const row = await db.query(
      `select contribution_value::numeric as cv from mart.kpi_lineage
        where metric_key='overdueAmount' and kpi_run_id=$1 and entity_id='pm10'`,
      [run.kpi_run_id],
    );
    assert.equal(Number(row.rows[0].cv), 930000, "pm10 contribution is GROSS-received");
  });
});

// ============================================================
// GAP ① — SERVED-PAYLOAD trust envelope. Builder flagged this.
//   Promise ① is "every number cites its source, drillable." (a)/(b) prove
//   it at the kpi_lineage TABLE. But the SERVED owner payload from
//   serializeOverview returns overdueAmount as a BARE NUMBER, not a drillable
//   Metric{value, confidence:'low', note~'gross...', sources:[Provenance]}.
//
//   This is written TWO ways so it is not a silent "not built yet" red:
//   (1) a PASSING test that VERIFIES the gap exists today (served value is a
//       bare number, no confidence/note/sources), and
//   (2) a SKIPPED test (with the gap + owning Phase-2 step named in the skip
//       reason) carrying the DESIRED end-state assertions for Step 4.
//   When Step 4 lands, un-skip (2) and delete (1).
// ============================================================
test("(GAP-①·now) served owner overdueAmount is TODAY a bare number with NO confidence/note/sources (documents the gap)", async () => {
  await withDb(async (db) => {
    const { serializeOverview } = await import("../semantic/serialize.mjs");
    await recompute(db, FIRM_A_OWNER, AS_OF_PINNED);
    await setPrincipal(db, FIRM_A_OWNER);
    const raw = (
      await db.query(
        `select * from mart.portfolio_summary where company_id=$1::uuid order by computed_at desc limit 1`,
        [FIRM_A],
      )
    ).rows[0];
    const out = serializeOverview(raw, FIRM_A_OWNER);
    const m = out.overdueAmount ?? out.overdueamount;
    // GAP: it is a bare scalar (NOT an object/Metric) — ① is proven at the DB
    // table, NOT at the API surface. (pglite returns numeric columns as JS
    // strings, so the served scalar is "930000" — still a bare value, no envelope.)
    assert.notEqual(typeof m, "object", "served overdueAmount is a bare scalar, NOT a Metric envelope (the gap)");
    assert.ok(["number", "string"].includes(typeof m), "served value is a primitive scalar");
    assert.equal(Number(m), 930000, "the bare value is correct, it just carries no trust metadata");
    assert.equal(out.confidence, undefined, "no confidence stamp on the served payload");
    assert.equal(out.note, undefined, "no 'gross, withholding not modeled' note on the served payload");
    assert.equal(out.sources, undefined, "no drillable sources[] on the served payload");
  });
});

test(
  "(GAP-①·target) served overdueAmount SHOULD be Metric{value,confidence:'low',note,sources[]} — Phase-2 Step 4 TRUST_ENVELOPE (closes F2)",
  { skip: "NOT BUILT in this slice — owned by Phase-2 Step 4 (TRUST_ENVELOPE). Un-skip when the serializer emits Metric envelopes fed from kpi_lineage." },
  async () => {
    await withDb(async (db) => {
      const { serializeOverview } = await import("../semantic/serialize.mjs");
      await recompute(db, FIRM_A_OWNER, AS_OF_PINNED);
      await setPrincipal(db, FIRM_A_OWNER);
      const raw = (
        await db.query(
          `select * from mart.portfolio_summary where company_id=$1::uuid order by computed_at desc limit 1`,
          [FIRM_A],
        )
      ).rows[0];
      const out = serializeOverview(raw, FIRM_A_OWNER);
      const m = out.overdueAmount ?? out.overdueamount;
      assert.ok(m && typeof m === "object", "overdueAmount must be a Metric envelope");
      assert.equal(m.value, 930000, "Metric.value");
      assert.equal(m.confidence, "low", "gross figure stamped confidence:'low'");
      assert.match(m.note ?? "", /gross/i, "note flags gross/withholding-not-modeled");
      assert.ok(Array.isArray(m.sources) && m.sources.length >= 1, "drillable sources[] from kpi_lineage");
    });
  },
);

// ============================================================
// GAP (E2E) — END-TO-END THROUGH THE LIVE HOOK (useAiOverview).
//   The brief wants the path proven "through the live hook". The spike tests
//   the SQL + serializer directly; nothing wires to the React useAiOverview
//   hook / ai-overview queryKey. Skipped (gap + Phase-2 step named in the skip
//   reason) so it is a labelled gap, not a silent red.
// ============================================================
test(
  "(GAP-E2E) serializer wired to useAiOverview / the ai-overview queryKey — Phase-2 Step 3/4 must thread it through the live hook",
  { skip: "NOT BUILT in this slice — there is no production call site importing backend/semantic/serialize.mjs behind the ai-overview queryKey. Owned by Phase-2 Step 3/4. See ADVERSARY.md G2." },
  async () => {
    assert.fail("no live-hook wiring exists in this slice (by design — Phase-2 owns it)");
  },
);
