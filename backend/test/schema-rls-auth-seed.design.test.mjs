// ============================================================
// Acceptance ledger — Step 2: full canonical/mart schema + ENFORCING
// RLS (under a NON-SUPERUSER SET ROLE) + auth/claim reset + full seed.
//
// REVIEWER-AUTHORED, TEST-FIRST. These tests are RED today: the builder
// has NOT yet created the `app_user` non-superuser role + grants, the
// extra canonical tables (design_approval / file_record / client_submission
// / decision / activity / audit_task), the project_member scoping table,
// nor the full-array seed. A LATER, DIFFERENT agent (the builder) makes
// them GREEN by shipping migrations 0003+ and extending the seed. This
// file MUST NOT implement schema/seed/semantic logic.
//
// Each test cites the gap/finding it closes. Contract of record:
//   backend/spike/CONTRACT-schema-rls-auth-seed.md
//
// WHY THIS IS RUNNABLE AS RED (not blocked): the harness boots the CURRENT
// migrations+seed fine, so freshDb() succeeds; these tests then assert the
// Step-2 surface that DOES NOT EXIST YET and fail with clear messages.
//
// pglite fact established by spike (see CONTRACT §RLS): the bootstrap
// superuser BYPASSES RLS, but `SET ROLE app_user` (a NOLOGIN, is_superuser=off
// role the builder creates in a migration) ENFORCES the company_id policies —
// even an explicit `WHERE company_id = <FirmB>` returns 0 rows. THAT is how
// gap A-3 / G3 gets closed: prove isolation with NO predicate, under the role.
//
// Determinism: as_of is ALWAYS injected; no test reads the wall clock.
// ============================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, FIRM_A, FIRM_B, AS_OF_PINNED } from "./harness.mjs";

const KPI_VERSION = 1;

// The non-superuser app role the builder MUST create in a migration so RLS
// is actually enforced (superuser bypasses it). Name is part of the contract.
const APP_ROLE = "app_user";

let db;

before(async () => {
  // freshDb() applies the builder's migrations + seed. Succeeds on the current
  // scaffold; the Step-2 assertions below are what is RED.
  db = await freshDb();
});

after(async () => {
  if (db) await db.close();
});

// --- principal / claim helpers (pglite JWT emulation, CONTEXT.md) ---
async function setClaims(p) {
  await db.query(`select set_config('request.company_id', $1, false)`, [p.companyId ?? ""]);
  await db.query(`select set_config('request.user_id', $1, false)`, [p.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [p.role ?? ""]);
}
// Clear EVERY request.* claim — models a route's per-request reset (A-2).
async function clearClaims() {
  await db.query(`select set_config('request.company_id', '', false)`);
  await db.query(`select set_config('request.user_id', '', false)`);
  await db.query(`select set_config('request.role', '', false)`);
  await db.query(`select set_config('request.kpi_run_id', '', false)`);
}
async function setRoleApp() {
  await db.exec(`set role ${APP_ROLE};`);
}
async function resetRole() {
  await db.exec(`reset role;`);
}

const FIRM_A_OWNER = { companyId: FIRM_A, userId: "m1", role: "founder" };
const FIRM_A_VIEWER = { companyId: FIRM_A, userId: "m6", role: "designer" };
const FIRM_B_PRINCIPAL = { companyId: FIRM_B, userId: "bm1", role: "founder" };

// Tables that must enforce company isolation under the app role.
const RLS_TABLES = [
  "canonical.member",
  "canonical.project",
  "canonical.client",
  "canonical.payment_milestone",
  "canonical.design_approval",
  "canonical.file_record",
  "canonical.client_submission",
  "canonical.decision",
  "canonical.activity",
  "canonical.audit_task",
];

// ============================================================
// (1) [closes A-3 / G3] ENFORCING RLS under a NON-SUPERUSER role.
//   Under `SET ROLE app_user`, a Firm-A principal sees ONLY Firm-A rows
//   on EVERY canonical table — WITHOUT any explicit company_id predicate.
//   And an EXPLICIT `WHERE company_id = FIRM_B` still returns 0 (the policy
//   filters it). This is the defence the spike could not prove (superuser
//   bypassed RLS). Requires the builder to create the role + grants.
// ============================================================
test("(1) [A-3/G3] RLS ENFORCES under SET ROLE app_user — Firm A sees only Firm-A rows on every table, even with a Firm-B predicate", async () => {
  // The app role must exist (builder creates it in a migration).
  const roleRes = await db.query(
    `select 1 from pg_roles where rolname = $1`,
    [APP_ROLE],
  );
  assert.equal(
    roleRes.rows.length,
    1,
    `non-superuser role '${APP_ROLE}' must exist (builder creates it + grants in a migration) so RLS is enforced — superuser bypasses RLS (A-3)`,
  );

  try {
    await setRoleApp();
    await setClaims(FIRM_A_OWNER);

    for (const tbl of RLS_TABLES) {
      // No predicate: the policy alone must hide Firm B.
      const all = await db.query(`select count(*)::int n from ${tbl}`);
      const a = await db.query(
        `select count(*)::int n from ${tbl} where company_id = $1::uuid`,
        [FIRM_A],
      );
      assert.equal(
        Number(all.rows[0].n),
        Number(a.rows[0].n),
        `${tbl}: unscoped count must equal Firm-A count (RLS hides other firms with NO predicate)`,
      );

      // Explicit attempt to read Firm B must be filtered by the policy → 0.
      const b = await db.query(
        `select count(*)::int n from ${tbl} where company_id = $1::uuid`,
        [FIRM_B],
      );
      assert.equal(
        Number(b.rows[0].n),
        0,
        `${tbl}: Firm-A principal must NOT read Firm-B rows even WITH an explicit predicate (RLS enforced under ${APP_ROLE})`,
      );
    }
  } finally {
    await resetRole();
  }
});

// ============================================================
// (2) [closes A-3 / G3] Symmetry — a Firm-B principal under the role sees
//   ONLY Firm-B rows; cannot read Firm-A. Proves it is genuine isolation,
//   not a one-way Firm-A allowlist.
// ============================================================
test("(2) [A-3/G3] RLS symmetry — Firm-B principal under app_user sees only Firm-B; cannot read Firm-A", async () => {
  try {
    await setRoleApp();
    await setClaims(FIRM_B_PRINCIPAL);

    const proj = await db.query(`select company_id from canonical.project`);
    assert.ok(proj.rows.length >= 1, "Firm B must have >= 1 project seeded");
    for (const r of proj.rows) {
      assert.equal(
        String(r.company_id),
        FIRM_B,
        "under Firm-B claims, every visible project row must be Firm B's",
      );
    }
    const aLeak = await db.query(
      `select count(*)::int n from canonical.payment_milestone where company_id = $1::uuid`,
      [FIRM_A],
    );
    assert.equal(Number(aLeak.rows[0].n), 0, "Firm-B principal must not read Firm-A milestones");
  } finally {
    await resetRole();
  }
});

// ============================================================
// (3) [closes A-2] Claim reset — with the full request.* claim set CLEARED
//   (modelling a route that resets every claim per request), an isolated
//   table read under the app role must NOT leak a previous request's company.
//   company_id resolves to NULL → the policy matches nothing → 0 rows
//   (fail-closed). Proves a forgotten/unset claim cannot carry over.
// ============================================================
test("(3) [A-2] cleared claim set fails closed — no company claim ⇒ RLS returns 0 rows (no carry-over leak)", async () => {
  try {
    await setRoleApp();
    // First, a Firm-A read (warms the session claim).
    await setClaims(FIRM_A_OWNER);
    const warm = await db.query(`select count(*)::int n from canonical.project`);
    assert.ok(Number(warm.rows[0].n) >= 1, "Firm A must see its projects when claim is set");

    // Now CLEAR every claim (the per-request reset A-2 demands).
    await clearClaims();
    const after = await db.query(`select count(*)::int n from canonical.project`);
    assert.equal(
      Number(after.rows[0].n),
      0,
      "with the company claim cleared, RLS must fail closed (0 rows) — a forgotten claim must NOT carry the previous company over (A-2)",
    );
  } finally {
    await resetRole();
  }
});

// ============================================================
// (4) [closes F5 / live schema] ALL live entities exist with the live grain.
//   design_approval (decided_by + submitted_by + the asymmetry CHECK),
//   file_record, client_submission, decision (promoted + provenance +
//   promoted_by/promoted_at), activity, audit_task. RLS-enabled.
// ============================================================
test("(4) [F5] all live canonical entities exist with live columns + RLS enabled", async () => {
  async function cols(schema, table) {
    const r = await db.query(
      `select column_name from information_schema.columns
        where table_schema = $1 and table_name = $2`,
      [schema, table],
    );
    return new Set(r.rows.map((x) => x.column_name));
  }
  async function rlsOn(table) {
    const r = await db.query(
      `select relrowsecurity from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'canonical' and c.relname = $1`,
      [table],
    );
    return r.rows.length === 1 && r.rows[0].relrowsecurity === true;
  }

  const expected = {
    design_approval: ["id", "company_id", "project_id", "type", "status", "submitted_by", "decided_by"],
    file_record: ["id", "company_id", "project_id", "storage", "version", "uploaded_date", "status"],
    client_submission: ["id", "company_id", "project_id", "status", "sent_via", "sent_date"],
    decision: ["id", "company_id", "project_id", "promoted", "promoted_by", "promoted_at", "source_system", "source_record_ref", "observed_at"],
    activity: ["id", "company_id", "type", "actor", "summary"],
    audit_task: ["id", "company_id", "human_gate", "status", "automatable"],
  };

  for (const [tbl, need] of Object.entries(expected)) {
    const c = await cols("canonical", tbl);
    assert.ok(c.size > 0, `canonical.${tbl} must exist`);
    for (const col of need) {
      assert.ok(c.has(col), `canonical.${tbl} must have column '${col}'`);
    }
    assert.equal(await rlsOn(tbl), true, `canonical.${tbl} must have RLS enabled`);
  }
});

// ============================================================
// (5) [closes da-1 / maker-checker] design_approval enforces
//   decided_by <> submitted_by via a CHECK constraint — a reviewer cannot
//   approve their own submission (the maker≠checker seed of promise ⑥ at the
//   approval grain). Inserting a self-decided row must RAISE.
// ============================================================
test("(5) [da-1] design_approval CHECK rejects decided_by == submitted_by (no self-approval)", async () => {
  // Use the superuser path to attempt the insert; the CHECK fires regardless of role.
  await setClaims(FIRM_A_OWNER);
  await assert.rejects(
    async () => {
      await db.query(
        `insert into canonical.design_approval
           (id, company_id, project_id, type, title, submitted_by, decided_by,
            status, submitted_date, decided_date, version, phase)
         values ('ap_self', $1::uuid, 'a5', 'concept', 'self-approve attempt',
                 'm1', 'm1', 'approved', '2026-06-19', '2026-06-20', 'v1', 2)`,
        [FIRM_A],
      );
    },
    /check|decided_by|submitted_by|violat/i,
    "design_approval must reject a row where decided_by == submitted_by (CHECK)",
  );
});

// ============================================================
// (6) [closes seed / full-ingest] FULL seed from ALL live arrays
//   (not the spike's partial). The live counts must be present.
//   Firm A: members 6, clients 6, projects 8, milestones 12, approvals 6,
//   files 16, submissions 6, decisions 5, activities 10, audit_tasks 10.
// ============================================================
test("(6) [seed] full live-array seed — Firm A canonical counts match the live data.ts/aios.ts arrays", async () => {
  await setClaims(FIRM_A_OWNER); // superuser session; counts scoped by explicit predicate
  async function countA(tbl, hasCompany = true) {
    const sql = hasCompany
      ? `select count(*)::int n from ${tbl} where company_id = $1::uuid`
      : `select count(*)::int n from ${tbl}`;
    const r = await db.query(sql, hasCompany ? [FIRM_A] : []);
    return Number(r.rows[0].n);
  }
  assert.equal(await countA("canonical.member"), 6, "6 live members");
  assert.equal(await countA("canonical.client"), 6, "6 live clients");
  assert.equal(await countA("canonical.project"), 8, "8 live projects (a1..a8)");
  assert.equal(await countA("canonical.payment_milestone"), 12, "12 live milestones (pm1..pm12)");
  assert.equal(await countA("canonical.design_approval"), 6, "6 live design approvals (ap1..ap6)");
  assert.equal(await countA("canonical.file_record"), 16, "16 live files (f1..f16)");
  assert.equal(await countA("canonical.client_submission"), 6, "6 live submissions (s1..s6)");
  assert.equal(await countA("canonical.decision"), 5, "5 live decisions (d1..d5)");
  assert.equal(await countA("canonical.activity"), 10, "10 live activities (ac1..ac10)");
  assert.equal(await countA("canonical.audit_task"), 10, "10 live audit tasks (t1..t10)");
});

// ============================================================
// (7) [closes seed-idempotency] RE-INGEST IS A NO-OP. Running the seed a
//   second time on the warm db must not duplicate rows (idempotency keys /
//   on-conflict-do-nothing). Counts before == counts after.
// ============================================================
test("(7) [seed-idempotency] re-running the seed is a no-op (no duplicate rows)", async () => {
  const tables = [
    "canonical.member", "canonical.client", "canonical.project",
    "canonical.payment_milestone", "canonical.design_approval",
    "canonical.file_record", "canonical.client_submission",
    "canonical.decision", "canonical.activity", "canonical.audit_task",
  ];
  async function totals() {
    const out = {};
    for (const t of tables) {
      const r = await db.query(`select count(*)::int n from ${t}`);
      out[t] = Number(r.rows[0].n);
    }
    return out;
  }
  const before = await totals();

  // Re-run the live seed default export against the warm db.
  const { default: seed } = await import("../db/seed/seed_live.mjs");
  await seed(db);

  const after = await totals();
  for (const t of tables) {
    assert.equal(after[t], before[t], `${t}: re-ingest must not change row count (idempotent seed)`);
  }
});

// ============================================================
// (8) [closes fin-* field-level gating] FIELD-LEVEL finance gating —
//   the Viewer (designer) serialized project/milestone payload OMITS money
//   fields (ABSENT, not null). contract_value / gross_amount / received_amount
//   must not appear. Owner (founder) retains them.
//   Tested against the builder's serializer (serialize.mjs).
// ============================================================
test("(8) [fin] Viewer-serialized project + milestone rows OMIT money fields (absent, not null); Owner retains", async () => {
  const mod = await import("../semantic/serialize.mjs");
  // The builder MUST expose row/collection serializers for projects + milestones
  // that apply the SAME finance band as serializeOverview/serializeClients.
  const serializeProjects = mod.serializeProjects;
  const serializeMilestones = mod.serializeMilestones;
  assert.equal(
    typeof serializeProjects,
    "function",
    "serialize.mjs must export serializeProjects(rows, principal) (field-level finance gating)",
  );
  assert.equal(
    typeof serializeMilestones,
    "function",
    "serialize.mjs must export serializeMilestones(rows, principal) (field-level finance gating)",
  );

  await setClaims(FIRM_A_OWNER);
  const projRes = await db.query(
    `select * from canonical.project where company_id = $1::uuid`,
    [FIRM_A],
  );
  const pmRes = await db.query(
    `select * from canonical.payment_milestone where company_id = $1::uuid`,
    [FIRM_A],
  );

  const FORBIDDEN = ["contract_value", "contractvalue", "gross_amount", "received_amount", "net_receivable", "amount"];

  const viewerProjects = serializeProjects(projRes.rows, FIRM_A_VIEWER);
  for (const row of viewerProjects) {
    for (const k of FORBIDDEN) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(row, k),
        false,
        `Viewer project row must OMIT money field '${k}' (absent, not null)`,
      );
    }
  }
  const viewerPm = serializeMilestones(pmRes.rows, FIRM_A_VIEWER);
  for (const row of viewerPm) {
    for (const k of FORBIDDEN) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(row, k),
        false,
        `Viewer milestone row must OMIT money field '${k}' (absent, not null)`,
      );
    }
  }

  // Owner keeps at least contract_value on projects (band passes money through).
  const ownerProjects = serializeProjects(projRes.rows, FIRM_A_OWNER);
  assert.ok(
    ownerProjects.some((r) => Object.prototype.hasOwnProperty.call(r, "contract_value")),
    "Owner (founder) project rows must RETAIN contract_value",
  );
});

// ============================================================
// (9) [closes sr-* project_member scoping] project_member table scopes the
//   live 5-role model: a member is linked to the projects they lead/team on.
//   Schema present + RLS enabled + seeded from live ProjectA.leadId/teamIds.
//   Spot-check: lead m3 is a member of a5 (Tejgaon).
// ============================================================
test("(9) [sr] project_member scoping table exists, RLS-enabled, seeded from live leadId/teamIds", async () => {
  const c = await db.query(
    `select column_name from information_schema.columns
      where table_schema = 'canonical' and table_name = 'project_member'`,
  );
  const cols = new Set(c.rows.map((x) => x.column_name));
  assert.ok(cols.size > 0, "canonical.project_member must exist");
  for (const col of ["company_id", "project_id", "member_id", "role_on_project"]) {
    assert.ok(cols.has(col), `canonical.project_member must have '${col}'`);
  }

  const rls = await db.query(
    `select relrowsecurity from pg_class cc
       join pg_namespace n on n.oid = cc.relnamespace
      where n.nspname = 'canonical' and cc.relname = 'project_member'`,
  );
  assert.ok(rls.rows.length === 1 && rls.rows[0].relrowsecurity === true,
    "canonical.project_member must have RLS enabled");

  // Seeded from live: m3 leads a5, so (a5, m3) must be present for Firm A.
  await setClaims(FIRM_A_OWNER);
  const link = await db.query(
    `select count(*)::int n from canonical.project_member
      where company_id = $1::uuid and project_id = 'a5' and member_id = 'm3'`,
    [FIRM_A],
  );
  assert.equal(Number(link.rows[0].n), 1, "project_member must link lead m3 to project a5 (from live leadId/teamIds)");
});

// ============================================================
// (10) [closes A-3 defense-in-depth] EVERY mart function repeats the
//   company_id predicate. Run recompute under the app role for Firm A with
//   Firm B seeded overdue — the lineage must contain ZERO Firm-B entities,
//   proving the function scopes reads itself (not relying on RLS alone).
// ============================================================
test("(10) [A-3 d-in-d] recompute under app_user is company-scoped — no Firm-B entity leaks into Firm-A lineage", async () => {
  try {
    await setRoleApp();
    await setClaims(FIRM_A_OWNER);
    const run = await db.query(
      `select * from mart.recompute_portfolio_summary($1::timestamptz, $2::int)`,
      [AS_OF_PINNED, KPI_VERSION],
    );
    assert.equal(run.rows.length, 1, "recompute must return one row under app_user");
    const kpiRunId = run.rows[0].kpi_run_id;

    const firmB = await db.query(
      `select count(*)::int n from mart.kpi_lineage l
        where l.kpi_run_id = $1 and l.company_id = $2::uuid`,
      [kpiRunId, FIRM_B],
    );
    assert.equal(Number(firmB.rows[0].n), 0, "no Firm-B lineage row may appear in a Firm-A recompute run");
  } finally {
    await resetRole();
  }
});
