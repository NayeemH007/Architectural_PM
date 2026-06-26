// ============================================================
// Acceptance ledger — Step X · ingestion idempotency · reconciliation ·
// corrections. Reviewer-authored, test-first (builder ≠ reviewer).
//
// RED TODAY: the `etl` schema, its tables and its functions DO NOT EXIST.
// freshDb() boots fine (0001_canonical + 0002_mart + seed_live apply today),
// but every assertion that touches etl.* fails with
// `relation "etl.*" does not exist` / `function etl.* does not exist`.
// That clean "absent implementation" failure IS the expected RED state.
//
// A LATER, DIFFERENT agent (the builder) makes these GREEN by shipping
// backend/db/migrations/0003_ingestion.sql + the §2 functions + the §4 seed
// back-fill described in backend/spike/CONTRACT-ingestion-reconciliation.md.
// The author MUST NOT implement that production logic here.
//
// Determinism: as_of is ALWAYS injected; no test reads the wall clock.
// Each test cites the closes-id (in-* / etl-*) it locks.
// ============================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, FIRM_A, AS_OF_PINNED, AS_OF_ADVANCED } from "./harness.mjs";
import { randomUUID } from "node:crypto";

let db;

before(async () => {
  // freshDb() applies the EXISTING migrations + seed. This succeeds today.
  // The RED comes from the etl.* surface being absent, asserted per-test below.
  db = await freshDb();
});

after(async () => {
  if (db) await db.close();
});

// Firm-A principal — every etl.* function is explicitly company-scoped by
// current_setting('request.company_id') (G3/A-3: superuser bypasses RLS).
async function setFirmA() {
  await db.query(`select set_config('request.company_id', $1, false)`, [FIRM_A]);
  await db.query(`select set_config('request.user_id', $1, false)`, ["m1"]);
  await db.query(`select set_config('request.role', $1, false)`, ["founder"]);
}

// Count the LIVE (non-superseded, non-retracted) ingest events for a ref.
async function liveEventCount(sourceRef) {
  const r = await db.query(
    `select count(*)::int as n
       from etl.ingest_event
      where company_id = $1::uuid
        and source_record_ref = $2
        and event_type = 'sync'
        and superseded = false
        and retracted = false`,
    [FIRM_A, sourceRef],
  );
  return Number(r.rows[0].n);
}

async function receivedForMilestone(milestoneId) {
  const r = await db.query(
    `select received_amount from canonical.payment_milestone
      where company_id = $1::uuid and id = $2`,
    [FIRM_A, milestoneId],
  );
  return r.rows.length ? Number(r.rows[0].received_amount) : null;
}

async function reviewRows(reason) {
  const r = await db.query(
    `select count(*)::int as n from etl.needs_review
      where company_id = $1::uuid and reason = $2 and state = 'open'`,
    [FIRM_A, reason],
  );
  return Number(r.rows[0].n);
}

// A canonical export row, as a connector would hand it to etl.ingest().
// Hashing is the builder's (PD-3: business fields only).
function exportRow(over = {}) {
  return {
    source_system: "tallyprime",
    source_record_ref: "tally:pm10",
    target_kind: "payment_milestone",
    target_ref: "pm10",
    project_id: "a5",
    label: "Concept sign-off (30%)",
    gross_amount: 930000,
    received_amount: 0,
    status: "overdue",
    due_date: "2026-06-04",
    data_observed_at: "2026-06-04T00:00:00Z",
    ingested_at: AS_OF_PINNED + "T00:00:00Z",
    ...over,
  };
}

// ============================================================
// in-1 [closes in-* / A1] RE-INGEST IS A NO-OP
//   Ingesting the SAME export row twice writes exactly ONE live ingest_event,
//   leaves canonical received_amount unchanged, and creates zero review rows.
// ============================================================
test("in-1 [in-*] re-ingesting the same export row is a no-op (one live event, canonical unchanged, no review)", async () => {
  await setFirmA();
  const row = exportRow();

  await db.query(`select etl.ingest($1::jsonb)`, [JSON.stringify(row)]);
  const receivedAfterFirst = await receivedForMilestone("pm10");

  // exact same export again — must be a no-op (same content_hash)
  await db.query(`select etl.ingest($1::jsonb)`, [JSON.stringify(row)]);

  assert.equal(await liveEventCount("tally:pm10"), 1, "exactly one live sync event for the ref after a duplicate ingest");
  assert.equal(await receivedForMilestone("pm10"), receivedAfterFirst, "canonical received_amount unchanged by the re-ingest");
  assert.equal(await reviewRows("duplicate_same_amount"), 0, "a clean re-ingest creates no review rows");
});

// ============================================================
// in-2 [closes A1 / etl-*] CORRECTION SUPERSEDES, NEVER DUPLICATES/OVERSTATES
//   Same (source,ref) with a changed amount → a NEW 'correction' event whose
//   supersedes_event_id points at the prior live event; the prior event is
//   marked superseded; canonical re-projects to the CORRECTED amount; the count
//   of live events for the ref stays 1 (no duplicate); receivables reflect the
//   corrected (not summed) amount (no overstatement).
// ============================================================
test("in-2 [A1] a corrected record supersedes — no duplicate, no overstated receivable", async () => {
  await setFirmA();
  await db.query(`select etl.ingest($1::jsonb)`, [JSON.stringify(exportRow())]);

  // a correction: same ref, received now 200000 (partial receipt landed)
  const corrected = exportRow({ received_amount: 200000, status: "partial" });
  await db.query(`select etl.ingest($1::jsonb)`, [JSON.stringify(corrected)]);

  // exactly one LIVE event for the ref (the old one is superseded, not a 2nd live)
  assert.equal(await liveEventCount("tally:pm10"), 1, "a correction supersedes — still exactly one live event for the ref");

  // a correction event exists with supersedes_event_id set
  const corr = await db.query(
    `select count(*)::int as n from etl.ingest_event
      where company_id = $1::uuid and source_record_ref = 'tally:pm10'
        and event_type = 'correction' and supersedes_event_id is not null`,
    [FIRM_A],
  );
  assert.ok(Number(corr.rows[0].n) >= 1, "a correction event with supersedes_event_id must exist");

  // the prior sync event is now marked superseded (history survives, not edited)
  const superseded = await db.query(
    `select count(*)::int as n from etl.ingest_event
      where company_id = $1::uuid and source_record_ref = 'tally:pm10'
        and event_type = 'sync' and superseded = true`,
    [FIRM_A],
  );
  assert.equal(Number(superseded.rows[0].n), 1, "the prior sync event must be marked superseded, not deleted");

  // canonical re-projects to the CORRECTED amount — 200000, not 0 and not 200000+0
  assert.equal(await receivedForMilestone("pm10"), 200000, "canonical received re-projects to the corrected amount (no overstatement, no double-count)");
});

// ============================================================
// in-3 [closes etl-* / C5] TWO SAME-AMOUNT RECEIPTS ARE NOT SILENTLY DROPPED
//   Two genuine receipts (same project, same amount, same day) → two
//   payment_receipt rows; the second is NOT silently absorbed: it routes to
//   needs_review(reason='duplicate_same_amount') (or is an audited second
//   match), and canonical received is NOT silently inflated by a phantom double.
// ============================================================
test("in-3 [etl-*] two genuine same-amount same-day receipts: second routes to review, never silent-drop", async () => {
  await setFirmA();
  const receipt = {
    source_system: "tallyprime",
    project_id: "a5",
    amount: 100000,
    received_at: "2026-06-20",
    data_observed_at: "2026-06-20T00:00:00Z",
  };
  await db.query(`select etl.reconcile_receipt($1::jsonb)`, [JSON.stringify({ ...receipt, source_record_ref: "tally:rcpt-1" })]);
  await db.query(`select etl.reconcile_receipt($1::jsonb)`, [JSON.stringify({ ...receipt, source_record_ref: "tally:rcpt-2" })]);

  // both receipts are RECORDED — neither silently dropped
  const recs = await db.query(
    `select count(*)::int as n from etl.payment_receipt
      where company_id = $1::uuid and project_id = 'a5' and amount = 100000 and received_at = '2026-06-20'`,
    [FIRM_A],
  );
  assert.equal(Number(recs.rows[0].n), 2, "both genuine same-amount receipts must be recorded (neither dropped)");

  // the second is surfaced for a human (duplicate_same_amount), not auto-absorbed
  assert.ok(await reviewRows("duplicate_same_amount") >= 1, "the second same-amount receipt must route to needs_review, never silent-drop");
});

// ============================================================
// in-4 [closes C5 / in-*] ABSENT REF → REVIEW, NEVER AUTO-APPLY
//   A row with null/empty source_record_ref creates 0 canonical writes and
//   exactly 1 needs_review(reason='absent_ref') row.
// ============================================================
test("in-4 [C5] an absent source_record_ref routes to review and never auto-applies", async () => {
  await setFirmA();
  const liveBefore = await db.query(`select count(*)::int as n from etl.ingest_event where company_id=$1::uuid and event_type='sync'`, [FIRM_A]);

  await db.query(`select etl.ingest($1::jsonb)`, [JSON.stringify(exportRow({ source_record_ref: null }))]);

  const liveAfter = await db.query(`select count(*)::int as n from etl.ingest_event where company_id=$1::uuid and event_type='sync'`, [FIRM_A]);
  assert.equal(Number(liveAfter.rows[0].n), Number(liveBefore.rows[0].n), "an absent-ref row creates NO canonical sync event");
  assert.equal(await reviewRows("absent_ref"), 1, "an absent-ref row creates exactly one needs_review(absent_ref)");
});

// ============================================================
// in-5 [closes etl-* / C5] ALIAS CONFLICT → REVIEW, NO OVERWRITE
//   An inbound label already mapped to a DIFFERENT canonical_id routes to
//   needs_review(reason='alias_conflict'); the existing etl.alias is unchanged.
// ============================================================
test("in-5 [etl-*] an alias remapped to a different entity routes to review without overwriting", async () => {
  await setFirmA();
  const aliasId = randomUUID();
  await db.query(
    `insert into etl.alias (id, company_id, source_system, entity_kind, external_label, canonical_id)
     values ($1,$2,'tallyprime','client','Bashati', 'c5')`,
    [aliasId, FIRM_A],
  );

  // inbound claims the SAME label maps to a DIFFERENT client (c1) — a conflict
  await db.query(`select etl.resolve_alias('tallyprime','client','Bashati', $1)`, ["c1"]);

  assert.ok(await reviewRows("alias_conflict") >= 1, "a conflicting alias remap must route to needs_review(alias_conflict)");

  const after = await db.query(`select canonical_id from etl.alias where id = $1`, [aliasId]);
  assert.equal(after.rows[0].canonical_id, "c5", "the existing alias must NOT be overwritten by the conflicting inbound");
});

// ============================================================
// in-6 [closes in-*] FRESHNESS SPLIT — stale connector vs stale data are distinct
//   A connector that SYNCED recently but whose newest fact is OLD must report a
//   FRESH connector_last_run and a STALE max(data_observed_at) — two distinct
//   ages, both against the injected as_of (no wall clock).
// ============================================================
test("in-6 [in-*] freshness split distinguishes a stale connector from stale data", async () => {
  await setFirmA();
  // freshness() returns both clocks + both ages against an injected as_of.
  const r = await db.query(
    `select * from etl.freshness($1::uuid, 'tallyprime', $2::timestamptz)`,
    [FIRM_A, AS_OF_PINNED + "T00:00:00Z"],
  );
  assert.equal(r.rows.length, 1, "freshness() returns one row per connector");
  const row = r.rows[0];

  // both clocks present and DISTINCT in meaning
  assert.notEqual(row.connector_last_run, null, "connector_last_run (sync clock) must be present");
  assert.notEqual(row.data_observed_at, null, "data_observed_at (fact clock) must be present");

  // the two ages are independently computed; the seed's newest fact (pm10 due
  // 2026-06-04) is older than a recent connector run, so data_age > connector_age.
  const connectorAge = Number(row.connector_age);
  const dataAge = Number(row.data_age);
  assert.ok(Number.isFinite(connectorAge) && Number.isFinite(dataAge), "both ages computed against the injected as_of");
  assert.ok(dataAge > connectorAge, "a recently-synced connector carrying an old fact must show data_age > connector_age (stale data, fresh connector)");
});

// ============================================================
// in-7 [closes A1] READ-ONLY-FIRST connector model
//   Every etl.connector.mode is 'read_only' — this repo ingests, never pushes.
//   The CHECK constraint must reject any other mode.
// ============================================================
test("in-7 [A1] connectors are read-only-first (no outbound mode permitted)", async () => {
  await setFirmA();
  const r = await db.query(
    `select count(*)::int as n from etl.connector
      where company_id = $1::uuid and mode <> 'read_only'`,
    [FIRM_A],
  );
  assert.equal(Number(r.rows[0].n), 0, "no connector may carry a non-read_only mode");

  // the CHECK must actively reject an outbound mode
  await assert.rejects(
    db.query(
      `insert into etl.connector (id, company_id, source_system, mode)
       values ($1,$2,'evil','write_back')`,
      [randomUUID(), FIRM_A],
    ),
    "the mode CHECK must reject a non-read_only connector",
  );
});
