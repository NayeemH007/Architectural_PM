// ============================================================
// Acceptance ledger — Step 6: AIOS write-discipline (proposal-only,
// maker-checker, append-only tamper-evident audit). Reviewer-authored,
// test-first. RED today: the builder has NOT yet shipped
//   - backend/db/migrations/0003_aios.sql (mart.agent_action,
//     mart.design_approval, audit.event + functions/triggers),
//   - the seed extension that loads g1..g8 (proposed) + ap1..ap6,
//   - backend/semantic/serialize_aios.mjs.
// A LATER, DIFFERENT agent (the builder) makes these GREEN. The author
// of this ledger MUST NOT implement that schema/seed/serializer.
//
// Each test name cites the finding id it closes. The contract these
// assert against is backend/spike/CONTRACT-aios-write-discipline.md.
//
// Determinism: as_of is ALWAYS injected; no test reads the wall clock.
// ============================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, FIRM_A, AS_OF_PINNED } from "./harness.mjs";

// Firm-A principals (see seed / live data.ts).
const FIRM_A_FOUNDER = { companyId: FIRM_A, userId: "m1", role: "founder" }; // can_check
const FIRM_A_LEAD = { companyId: FIRM_A, userId: "m3", role: "project_lead" }; // NOT can_check

let db;

before(async () => {
  // freshDb() applies ALL backend/db/migrations/NNNN_*.sql in order (incl. the
  // builder's future 0003_aios.sql) then runs the seed. Until 0003 + its seed
  // rows exist, the queries below fail — that clean failure IS the RED state.
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

/** Assert that running `fn` (a DB write) throws — i.e. the server rejected it. */
async function rejects(fn, why) {
  await assert.rejects(fn, why);
}

// Pick any seeded agent_action id to mutate in-place for the negative tests.
async function anyActionId() {
  const r = await db.query(`select id from mart.agent_action limit 1`);
  assert.ok(r.rows.length >= 1, "expected >=1 seeded agent_action");
  return r.rows[0].id;
}

// ============================================================
// (mc-1) [F1/mc-1] CHECKER = MAKER is REJECTED server-side.
//   A design_approval whose decided_by == submitted_by must RAISE.
//   The natural live row ap6 (submitted_by=m2, decided_by=m1) must insert fine,
//   proving the constraint is checker≠maker, not "no decisions allowed".
// ============================================================
test("(mc-1) [F1] design_approval with decided_by == submitted_by is rejected (checker != maker)", async () => {
  await setPrincipal(FIRM_A_FOUNDER);

  // self-approval attempt: m1 decides an item m1 submitted -> must be rejected.
  await rejects(
    () =>
      db.query(
        `insert into mart.design_approval
           (id, company_id, project_id, title, submitted_by, decided_by, decision, submitted_at, decided_at)
         values ('ap-self', $1, 'a1', 'self-approve attempt', 'm1', 'm1', 'approved', $2::timestamptz, $2::timestamptz)`,
        [FIRM_A, AS_OF_PINNED],
      ),
    /checker|maker|decided_by|check/i,
  );

  // ap6 already seeded (m2 -> m1) is the legitimate checker != maker case.
  const ok = await db.query(
    `select submitted_by, decided_by from mart.design_approval where id = 'ap6'`,
  );
  assert.equal(ok.rows.length, 1, "ap6 must be seeded");
  assert.notEqual(
    ok.rows[0].decided_by,
    ok.rows[0].submitted_by,
    "ap6 must be a checker != maker decision",
  );
});

// ============================================================
// (mc-2) [mc-2] INELIGIBLE checker is REJECTED.
//   decided_by must reference a member with can_check=true. A lead (m3,
//   can_check=false) deciding must RAISE (eligibility trigger).
// ============================================================
test("(mc-2) [mc-2] decision by a member with can_check=false is rejected (eligibility)", async () => {
  await setPrincipal(FIRM_A_FOUNDER);
  await rejects(
    () =>
      db.query(
        `insert into mart.design_approval
           (id, company_id, project_id, title, submitted_by, decided_by, decision, submitted_at, decided_at)
         values ('ap-inelig', $1, 'a1', 'ineligible checker', 'm5', 'm3', 'approved', $2::timestamptz, $2::timestamptz)`,
        [FIRM_A, AS_OF_PINNED],
      ),
    /can_check|eligib|checker/i,
  );
});

// ============================================================
// (w-1) [F1/pw-1] EXECUTED-WITHOUT-RECEIPT is REJECTED.
//   Promoting an agent_action to state='executed' while delivery_receipt IS NULL
//   must RAISE (CHECK). This repo holds no write credential and cannot mint one.
// ============================================================
test("(w-1) [F1] agent_action -> 'executed' with NULL delivery_receipt is rejected", async () => {
  await setPrincipal(FIRM_A_FOUNDER);
  const id = await anyActionId();
  await rejects(
    () =>
      db.query(
        `update mart.agent_action
            set state = 'executed', delivery_receipt = null
          where id = $1`,
        [id],
      ),
    /receipt|executed|check/i,
  );
});

// ============================================================
// (w-2) [F1] SEEDED PROPOSE-ONLY.
//   Every seeded agent_action (live g1..g8) is 'proposed' with NULL receipt —
//   none 'executed'. The frontend's "done" must NOT seed as executed.
// ============================================================
test("(w-2) [F1] every seeded agent_action is 'proposed' with NULL delivery_receipt (not 'executed')", async () => {
  await setPrincipal(FIRM_A_FOUNDER);
  const r = await db.query(
    `select state, delivery_receipt from mart.agent_action where company_id = $1::uuid`,
    [FIRM_A],
  );
  assert.ok(r.rows.length >= 1, "expected seeded agent_action rows (g1..g8)");
  for (const row of r.rows) {
    assert.equal(row.state, "proposed", "seeded action must be 'proposed'");
    assert.equal(row.delivery_receipt, null, "seeded action must have NULL delivery_receipt");
  }
  const executed = await db.query(
    `select count(*)::int as n from mart.agent_action where state = 'executed'`,
  );
  assert.equal(Number(executed.rows[0].n), 0, "no seeded action may be 'executed'");
});

// ============================================================
// (w-3) [pw-1/C5] IDEMPOTENCY KEY is UNIQUE.
//   A second insert reusing an existing idempotency_key must RAISE — a logical
//   re-proposal is never a second row (never a double send downstream).
// ============================================================
test("(w-3) [pw-1] duplicate idempotency_key is rejected (unique)", async () => {
  await setPrincipal(FIRM_A_FOUNDER);
  const existing = await db.query(
    `select idempotency_key from mart.agent_action where company_id = $1::uuid limit 1`,
    [FIRM_A],
  );
  assert.ok(existing.rows.length >= 1, "expected a seeded action to copy a key from");
  const key = existing.rows[0].idempotency_key;
  await rejects(
    () =>
      db.query(
        `insert into mart.agent_action
           (id, company_id, task_id, state, human_gated, summary, proposed_by,
            idempotency_key, proposed_at)
         values ('g-dupe', $1, 't1', 'proposed', true, 'dupe key attempt', 'm3', $2, $3::timestamptz)`,
        [FIRM_A, key, AS_OF_PINNED],
      ),
    /idempot|unique|duplicate/i,
  );
});

// ============================================================
// (au-1) [F1/sr-1] HASH-CHAIN TAMPER is DETECTED.
//   An untouched chain verifies TRUE; hand-mutating one row's payload (which a
//   pglite superuser CAN do) makes mart.verify_audit_chain(company) return FALSE.
//   This is the tamper-EVIDENCE: the edit succeeds at the row but the chain
//   no longer reconciles.
// ============================================================
test("(au-1) [F1/sr-1] hash-chain detects an after-the-fact payload edit", async () => {
  await setPrincipal(FIRM_A_FOUNDER);

  // Seed must establish a multi-row chain for Firm A (e.g. from promotions /
  // seeded events). Verify it reconciles before tampering.
  const before = await db.query(`select mart.verify_audit_chain($1::uuid) as ok`, [FIRM_A]);
  assert.equal(before.rows.length, 1, "verify_audit_chain must return one row");
  assert.equal(before.rows[0].ok, true, "an untouched chain must verify TRUE");

  // There must be at least 2 chained rows to make tampering meaningful.
  const cnt = await db.query(
    `select count(*)::int as n from audit.event where company_id = $1::uuid`,
    [FIRM_A],
  );
  assert.ok(Number(cnt.rows[0].n) >= 2, "expected >= 2 chained audit rows for Firm A");

  // Tamper: edit a payload WITHOUT recomputing the chain. The append-only
  // trigger blocks UPDATE on the table, so we must defeat it to even mutate —
  // proving the table is genuinely immutable. We therefore assert EITHER:
  //   (i) the UPDATE itself raises (append-only), OR
  //   (ii) if a privileged path mutates the row, the verifier flags it FALSE.
  let mutated = false;
  try {
    await db.query(
      `update audit.event set payload = '{"tampered":true}'::jsonb
        where company_id = $1::uuid
          and seq = (select max(seq) from audit.event where company_id = $1::uuid)`,
      [FIRM_A],
    );
    mutated = true;
  } catch (e) {
    // append-only trigger fired — tamper attempt rejected outright.
    assert.match(String(e?.message ?? e), /append|immutable|update|delete|revoke/i);
  }

  if (mutated) {
    const after = await db.query(`select mart.verify_audit_chain($1::uuid) as ok`, [FIRM_A]);
    assert.equal(after.rows[0].ok, false, "verifier must flag the tampered chain FALSE");
  }
});

// ============================================================
// (au-2) [sr-1] APPEND-ONLY.
//   UPDATE and DELETE on audit.event must RAISE — corrections are NEW rows
//   (type='correction'/'retraction' with supersedes_event_id), never mutations.
// ============================================================
test("(au-2) [sr-1] audit.event is append-only — UPDATE and DELETE are rejected", async () => {
  await setPrincipal(FIRM_A_FOUNDER);
  await rejects(
    () => db.query(`update audit.event set actor = 'm1' where company_id = $1::uuid`, [FIRM_A]),
    /append|immutable|update|delete/i,
  );
  await rejects(
    () => db.query(`delete from audit.event where company_id = $1::uuid`, [FIRM_A]),
    /append|immutable|update|delete/i,
  );
});

// ============================================================
// (au-3) [F1/mc-*] ONE AUDIT ROW PER PROMOTION, IN-TXN.
//   mart.promote_agent_action(proposed -> approved) inserts EXACTLY one
//   audit.event row for that entity, atomically with the state flip.
// ============================================================
test("(au-3) [F1] a state promotion emits exactly one chained audit row in-txn", async () => {
  await setPrincipal(FIRM_A_FOUNDER);

  // pick a proposed, human-gated action proposed by someone OTHER than the
  // approver (m1 founder = can_check) so checker != maker holds.
  const pick = await db.query(
    `select id, lock_version, proposed_by
       from mart.agent_action
      where company_id = $1::uuid and state = 'proposed' and proposed_by <> 'm1'
      limit 1`,
    [FIRM_A],
  );
  assert.ok(pick.rows.length >= 1, "expected a proposed action not proposed by m1");
  const { id, lock_version } = pick.rows[0];

  const beforeN = await db.query(
    `select count(*)::int as n from audit.event where entity_ref = $1`,
    [`agent_action:${id}`],
  );

  await db.query(
    `select mart.promote_agent_action($1, 'approved', 'm1', $2::int, $3::timestamptz)`,
    [id, Number(lock_version), AS_OF_PINNED],
  );

  const afterN = await db.query(
    `select count(*)::int as n from audit.event where entity_ref = $1`,
    [`agent_action:${id}`],
  );
  assert.equal(
    Number(afterN.rows[0].n) - Number(beforeN.rows[0].n),
    1,
    "exactly one audit.event row must be emitted per promotion",
  );

  // and the state actually advanced (atomic with the audit write).
  const st = await db.query(`select state, approved_by from mart.agent_action where id = $1`, [id]);
  assert.equal(st.rows[0].state, "approved", "state must advance to 'approved'");
  assert.equal(st.rows[0].approved_by, "m1", "approver recorded as the checker");
});

// ============================================================
// (w-4) [F1/W7] "HANDLED" iff RECEIPT.
//   The serializer marks an action handled ONLY when delivery_receipt is
//   present; a proposed (receipt-less) action is NEVER handled.
// ============================================================
test("(w-4) [F1] serializeAiosActions marks handled=true only for actions with a delivery_receipt", async () => {
  const { serializeAiosActions } = await import("../semantic/serialize_aios.mjs");

  const rows = [
    { id: "x1", project_id: "a1", task_id: "t1", summary: "proposed only", detail: "", state: "proposed", delivery_receipt: null, proposed_at: AS_OF_PINNED },
    { id: "x2", project_id: "a5", task_id: "t3", summary: "really executed", detail: "", state: "executed", delivery_receipt: "wamid.RECEIPT123", proposed_at: AS_OF_PINNED },
  ];
  const out = serializeAiosActions(rows, FIRM_A_FOUNDER);
  const byId = Object.fromEntries(out.map((a) => [a.id, a]));

  assert.equal(byId.x1.handled, false, "a receipt-less (proposed) action must be handled=false");
  assert.equal(byId.x2.handled, true, "an action with a delivery_receipt must be handled=true");

  // never the inverse: no item with a null receipt may be handled.
  for (const a of out) {
    const raw = rows.find((r) => r.id === a.id);
    if (raw.delivery_receipt == null) {
      assert.equal(a.handled, false, `handled must be false when delivery_receipt is null (${a.id})`);
    }
  }
});
