// ============================================================
// adversary.slice2b.test.mjs — INDEPENDENT sign-off for Slice 2b.
// ------------------------------------------------------------
// Author did NOT write backend/server/index.mjs, backend/semantic/
// serialize.mjs, app/src/lib/archintel/api.ts, nor any slice2b.*
// ledger. Mandate (loop step 4): try to BREAK the HTTP/security
// boundary and the backend-vs-mock claim end-to-end; decide
// HOLDS/BROKEN per promise; rank residual gaps. Verdicts +
// evidence live in backend/spike/ADVERSARY-2B.md.
//
// Each test is named for the thing it FALSIFIES. Genuine residual
// gaps are clearly-labelled todo/skip with an explanation — never a
// bare red.
//
// RUN (PowerShell, kill strays first; --test-force-exit mandatory —
// pglite holds the loop open):
//   node --test --test-isolation=none --test-force-exit \
//     backend/test/adversary.slice2b.test.mjs
//
// One warm server is booted for the boundary attacks (mirrors the
// single warm pglite connection the live demo uses — so state-bleed
// is probed under realistic conditions). The tamper/VALUE=Σ proof
// uses a SEPARATE freshDb() so a seed mutation can't poison the
// shared server.
// ============================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { freshDb, FIRM_A, FIRM_B, AS_OF_PINNED } from "./harness.mjs";
import { createServer } from "../server/index.mjs";

const DEV_ORIGIN = "http://localhost:5173";
const KPI_VERSION = 1;

// Money values that MUST NOT appear in any non-finance payload, anywhere.
const MONEY_SENTINELS = [930000, 1000000, 17400000, 8470000, 500000, 840000, 730000];

let server;
let db; // the warm server's db (for the DB-session-state assertion)
let baseUrl;

before(async () => {
  const built = await createServer({ port: 0 });
  server = built.server;
  db = built.db;
  await new Promise((res, rej) => {
    if (server.listening) return res();
    server.listen(0, "127.0.0.1", res);
    server.once("error", rej);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((res) => server.close(res));
});

// ── helpers ──────────────────────────────────────────────────
async function get(headers) {
  const res = await fetch(`${baseUrl}/api/v1/overview`, {
    headers: { Origin: DEV_ORIGIN, ...headers },
  });
  let body = null;
  let text = "";
  try {
    text = await res.text();
    body = JSON.parse(text);
  } catch {
    /* non-JSON body */
  }
  return { res, status: res.status, body, text };
}

function isMetric(v) {
  return v && typeof v === "object" && "value" in v && "confidence" in v && "sources" in v;
}

// Deep-scan a payload for ANY money value (number OR pg-numeric string),
// returning the list of {path,value} hits. Used to prove NO money leaks.
function scanMoney(obj) {
  const hits = [];
  const walk = (v, path) => {
    if (v == null) return;
    if (typeof v === "number") {
      if (MONEY_SENTINELS.includes(v)) hits.push({ path, v });
    } else if (typeof v === "string") {
      for (const m of MONEY_SENTINELS) {
        // match "930000" or "930000.00" pg-numeric forms
        if (v === String(m) || v.startsWith(`${m}.`)) hits.push({ path, v });
      }
    } else if (Array.isArray(v)) {
      v.forEach((x, i) => walk(x, `${path}[${i}]`));
    } else if (typeof v === "object") {
      for (const [k, val] of Object.entries(v)) walk(val, path ? `${path}.${k}` : k);
    }
  };
  walk(obj, "");
  return hits;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ════════════════════════════════════════════════════════════
// FALSIFY: "the data is the 2a mock, not the pglite backend."
// The mock mints sources[].sourceId = the CONSTANT 'tally'. The backend
// mints it from kpi_lineage.source_id = a real per-seed UUID. If the served
// sourceId is a real UUID (and not 'tally'), the data came from the DB.
// ════════════════════════════════════════════════════════════
test("[backend-not-mock] sources[].sourceId is a real UUID from kpi_lineage, NOT the mock constant 'tally'", async () => {
  const { status, body } = await get({ "X-Company-Id": FIRM_A, "X-User-Role": "founder" });
  assert.equal(status, 200);
  const m = body.overdueAmount;
  assert.equal(isMetric(m), true, "overdueAmount must be a Metric over HTTP");
  assert.equal(Number(m.value), 930000, "seeded Firm-A overdueAmount = 930000");
  assert.ok(Array.isArray(m.sources) && m.sources.length >= 1, "non-empty sources");

  const refs = m.sources.map((s) => s.recordRef);
  assert.ok(refs.some((r) => String(r).includes("tally:pm10")), "recordRef cites tally:pm10");

  for (const s of m.sources) {
    assert.notEqual(s.sourceId, "tally", "sourceId must NOT be the 2a mock constant 'tally'");
    assert.match(
      String(s.sourceId),
      UUID_RE,
      `sourceId must be a real kpi_lineage UUID (got '${s.sourceId}') — the backend telltale`,
    );
  }
});

// ════════════════════════════════════════════════════════════
// FALSIFY: "930000 is a hardcoded literal, not reconstructed from lineage."
// On a SEPARATE freshDb, recompute → assert served-shape value == Σ lineage.
// Then TAMPER (partial receipt on pm10) → recompute → value must TRACK the
// change (930000 → 730000) and still equal Σ lineage. A literal can't track.
// ════════════════════════════════════════════════════════════
test("[value=Σ-reconstruct + tamper] served overdueAmount equals Σ lineage and tracks a seed change (not a literal)", async () => {
  const tdb = await freshDb();
  try {
    const setP = async (p) => {
      await tdb.query(`select set_config('request.company_id',$1,false)`, [p.companyId]);
      await tdb.query(`select set_config('request.role',$1,false)`, [p.role]);
    };
    const { serializeOverview } = await import("../semantic/serialize.mjs");
    const owner = { companyId: FIRM_A, role: "founder" };

    const recompute = async () => {
      await setP(owner);
      const s = await tdb.query(
        `select * from mart.recompute_portfolio_summary($1::timestamptz,$2::int)`,
        [AS_OF_PINNED, KPI_VERSION],
      );
      const row = s.rows[0];
      const lin = await tdb.query(
        `select kpi_run_id, contribution_value, source_id, record_ref, observed_at
           from mart.kpi_lineage where metric_key='overdueAmount' and kpi_run_id=$1`,
        [row.kpi_run_id],
      );
      const m = serializeOverview(row, lin.rows, owner).overdueAmount;
      const sigma = lin.rows.reduce((a, r) => a + Number(r.contribution_value), 0);
      return { m, sigma };
    };

    // Untampered: value = 930000 = Σ lineage.
    const before = await recompute();
    assert.equal(before.m.value, 930000);
    assert.equal(before.m.value, before.sigma, "value must equal Σ lineage (untampered)");

    // TAMPER: pm10 receives 200000 → overdue contribution drops to 730000.
    await tdb.query(
      `update canonical.payment_milestone set received_amount = 200000 where id = 'pm10'`,
    );
    const after = await recompute();
    assert.equal(after.m.value, 730000, "served value must TRACK the seed change (930000-200000)");
    assert.equal(after.m.value, after.sigma, "value must equal Σ lineage (tampered)");
    assert.notEqual(after.m.value, before.m.value, "a hardcoded literal could not change");
  } finally {
    await tdb.close();
  }
});

// ════════════════════════════════════════════════════════════
// FALSIFY: "a non-finance role can see money over HTTP."
// designer → overdueAmount refused/omitted AND no money sentinel anywhere.
// ════════════════════════════════════════════════════════════
test("[finance-band/designer] designer over HTTP gets refused/omitted overdueAmount and ZERO money sentinels", async () => {
  const { status, body } = await get({ "X-Company-Id": FIRM_A, "X-User-Role": "designer" });
  assert.equal(status, 200, "designer gets a redacted 200, not a 403");

  if (Object.prototype.hasOwnProperty.call(body, "overdueAmount")) {
    const m = body.overdueAmount;
    assert.equal(m.value, null, "refused Metric.value must be null");
    assert.equal(m.confidence, "insufficient", "refused Metric.confidence insufficient");
  }
  const hits = scanMoney(body);
  assert.deepEqual(hits, [], `NO money value may appear for a designer (leaked: ${JSON.stringify(hits)})`);
});

// ════════════════════════════════════════════════════════════
// FALSIFY: "an unknown / absent role defaults to finance-visible (escalation)."
// Probe the whole band: every non-{founder,finance} role and the ABSENT role
// must redact. If ANY leaks money, this test goes red and names the leak.
// ════════════════════════════════════════════════════════════
test("[finance-band/unknown-roles] no non-{founder,finance} role leaks money; ABSENT role fails SAFE (redacted)", async () => {
  const REDACTED_ROLES = ["", "admin", "project_lead", "principal", "viewer", "manager", "owner"];
  for (const role of REDACTED_ROLES) {
    const { body } = await get({ "X-Company-Id": FIRM_A, "X-User-Role": role });
    const m = body.overdueAmount;
    if (m && typeof m === "object") {
      assert.equal(m.value, null, `role='${role}' must not expose a money value`);
      assert.equal(m.confidence, "insufficient", `role='${role}' must be insufficient`);
    }
    const hits = scanMoney(body);
    assert.deepEqual(hits, [], `role='${role}' leaked money: ${JSON.stringify(hits)}`);
  }

  // ABSENT role header entirely → must default to REDACTED, not finance-visible.
  const { body: noRole } = await get({ "X-Company-Id": FIRM_A });
  assert.deepEqual(
    scanMoney(noRole),
    [],
    "ABSENT X-User-Role must fail SAFE (redacted), not default to finance-visible (privilege escalation)",
  );

  // Sanity (positive control): founder DOES see money — proves the scan can detect it.
  const { body: founder } = await get({ "X-Company-Id": FIRM_A, "X-User-Role": "founder" });
  assert.ok(scanMoney(founder).length > 0, "founder must see money (scan sanity / positive control)");
});

// ════════════════════════════════════════════════════════════
// FALSIFY: "Firm-B can see Firm-A entities over HTTP" (cross-tenant).
// ════════════════════════════════════════════════════════════
test("[cross-tenant] Firm-B founder sees ONLY Firm-B (1,000,000 / bpm*), never Firm-A (pm10 / 930000)", async () => {
  const { status, body, text } = await get({ "X-Company-Id": FIRM_B, "X-User-Role": "founder" });
  assert.equal(status, 200);
  const m = body.overdueAmount;
  assert.equal(isMetric(m), true);
  assert.equal(Number(m.value), 1000000, "Firm-B overdueAmount is its own 1,000,000");

  // No Firm-A entity anywhere in the Firm-B payload.
  assert.ok(!text.includes("pm10"), "Firm-B payload must NOT contain Firm-A's pm10");
  assert.ok(!text.includes("930000"), "Firm-B payload must NOT contain Firm-A's 930000");
  for (const s of m.sources) {
    assert.ok(String(s.recordRef).includes("bpm"), "Firm-B sources must be bpm* refs only");
  }
});

// ════════════════════════════════════════════════════════════
// FALSIFY: "a garbage / injection X-Company-Id crashes the process or leaks
// another tenant." set_config is parameterized; the ::uuid cast rejects
// non-UUIDs → 500 JSON. The process MUST keep serving the next request.
// ════════════════════════════════════════════════════════════
test("[cross-tenant/injection] garbage & SQL-ish X-Company-Id → 500 JSON, no leak, process stays serving", async () => {
  const garbage = await get({ "X-Company-Id": "not-a-uuid", "X-User-Role": "founder" });
  assert.equal(garbage.status, 500, "garbage company id → 500 (uuid cast rejects), not a crash");
  assert.ok(garbage.body && typeof garbage.body.error === "string", "500 body is JSON {error}");
  assert.deepEqual(scanMoney(garbage.body), [], "500 body leaks no money");

  const inj = await get({
    "X-Company-Id": "'; drop table canonical.payment_milestone;--",
    "X-User-Role": "founder",
  });
  assert.equal(inj.status, 500, "SQL-ish company id → 500 (parameterized, no injection)");

  // The process must still be alive and correct AFTER the 500s.
  const ok = await get({ "X-Company-Id": FIRM_A, "X-User-Role": "founder" });
  assert.equal(ok.status, 200, "process must keep serving after a 500");
  assert.equal(Number(ok.body.overdueAmount.value), 930000, "and serve correct data after the 500");

  // Confirm the injection did NOT drop the table (next request still computes).
  const stillThere = await get({ "X-Company-Id": FIRM_A, "X-User-Role": "founder" });
  assert.equal(Number(stillThere.body.overdueAmount.value), 930000, "table intact — no SQL injection");
});

// ════════════════════════════════════════════════════════════
// FALSIFY: "empty/missing X-Company-Id leaks an arbitrary tenant."
// The server defaults absent company to FIRM_A (documented demo default).
// That is the firm's OWN data, but the default + role-absent combo must still
// REDACT money (no anonymous money read).
// ════════════════════════════════════════════════════════════
test("[cross-tenant/default-company] absent X-Company-Id defaults to FIRM_A but anonymous (no role) sees NO money", async () => {
  const { status, body } = await get({}); // no company, no role
  assert.equal(status, 200);
  // Default company = FIRM_A (demo default), but role is absent → redacted.
  assert.deepEqual(
    scanMoney(body),
    [],
    "anonymous request (no company, no role) must not expose money — role-absent redacts",
  );
});

// ════════════════════════════════════════════════════════════
// FALSIFY: "request N leaks request N-1's company/role on the warm pglite
// connection." set_config(...,false) is SESSION-scoped on a single warm conn
// — a REAL risk. Hammer: Firm-B founder → Firm-A designer → Firm-A founder.
// If state bled, the designer step would show Firm-B's money or Firm-A money.
// ════════════════════════════════════════════════════════════
test("[state-bleed] sequential requests on the warm connection do NOT bleed company/role (set_config re-set each request)", async () => {
  // 1) Firm-B founder primes the session with company=FIRM_B, role=founder.
  const b = await get({ "X-Company-Id": FIRM_B, "X-User-Role": "founder" });
  assert.equal(Number(b.body.overdueAmount.value), 1000000, "Firm-B founder sees 1,000,000");

  // 2) Firm-A designer immediately after. If company bled → would show Firm-B
  //    sources; if role bled (founder) → would show money. Must be FIRM_A +
  //    redacted.
  const d = await get({ "X-Company-Id": FIRM_A, "X-User-Role": "designer" });
  const dm = d.body.overdueAmount;
  assert.ok(dm == null || dm.value === null, "designer after Firm-B founder must be redacted (role did not bleed)");
  assert.deepEqual(scanMoney(d.body), [], "designer step must show NO money (no role bleed from prior founder)");
  if (dm && Array.isArray(dm.sources)) {
    for (const s of dm.sources) {
      assert.ok(!String(s.recordRef).includes("bpm"), "company must NOT bleed Firm-B refs into a Firm-A request");
    }
  }

  // 3) Firm-A founder. Must be FIRM_A (930000), not Firm-B's 1,000,000.
  const a = await get({ "X-Company-Id": FIRM_A, "X-User-Role": "founder" });
  assert.equal(Number(a.body.overdueAmount.value), 930000, "Firm-A founder must see its own 930000, not Firm-B's");
  for (const s of a.body.overdueAmount.sources) {
    assert.ok(String(s.recordRef).includes("pm10"), "Firm-A founder cites pm10 (company did not bleed)");
  }
});

// ════════════════════════════════════════════════════════════
// FALSIFY: "CORS is over-permissive (`*` with credentials)" / "preflight is wrong".
// ════════════════════════════════════════════════════════════
test("[CORS] dev origin allowed on GET + OPTIONS preflight; NOT wildcard-with-credentials", async () => {
  const g = await get({ "X-Company-Id": FIRM_A, "X-User-Role": "founder" });
  const allow = g.res.headers.get("access-control-allow-origin");
  assert.ok(allow === DEV_ORIGIN || allow === "*", `GET must allow dev origin or *, got '${allow}'`);

  // If credentials were allowed AND origin is '*', that is the dangerous combo.
  const creds = g.res.headers.get("access-control-allow-credentials");
  assert.ok(!(allow === "*" && creds === "true"), "must NOT be wildcard-origin WITH credentials (CSRF/credential risk)");

  // OPTIONS preflight.
  const pre = await fetch(`${baseUrl}/api/v1/overview`, {
    method: "OPTIONS",
    headers: { Origin: DEV_ORIGIN },
  });
  assert.ok([200, 204].includes(pre.status), `preflight returns 200/204, got ${pre.status}`);
  const preAllow = pre.headers.get("access-control-allow-origin");
  assert.ok(preAllow === DEV_ORIGIN || preAllow === "*", "preflight allows dev origin");
});

// ════════════════════════════════════════════════════════════
// FALSIFY: "a bad path crashes or 200s." → must 404 JSON, process survives.
// ════════════════════════════════════════════════════════════
test("[robustness] unknown path → 404 JSON, and the service keeps serving the overview afterwards", async () => {
  const res = await fetch(`${baseUrl}/api/v1/nope`, { headers: { Origin: DEV_ORIGIN } });
  assert.equal(res.status, 404, "unknown path → 404");

  const ok = await get({ "X-Company-Id": FIRM_A, "X-User-Role": "founder" });
  assert.equal(ok.status, 200, "service still serves overview after a 404");
});

// ════════════════════════════════════════════════════════════
// DB-session-state telltale: after all the above requests, the warm
// connection's request.* is whatever the LAST request set — proving the
// handler always re-sets it (no stale anonymous default lingering).
// ════════════════════════════════════════════════════════════
test("[state-bleed/db] warm connection request.* reflects the LAST request only (always re-set, never stale)", async () => {
  // Drive a known-last request, then read the session config directly.
  await get({ "X-Company-Id": FIRM_B, "X-User-Role": "finance" });
  const r = await db.query(
    `select current_setting('request.company_id',true) as c, current_setting('request.role',true) as role`,
  );
  assert.equal(r.rows[0].c, FIRM_B, "session company reflects the LAST request (re-set each call)");
  assert.equal(r.rows[0].role, "finance", "session role reflects the LAST request (re-set each call)");
});

// ════════════════════════════════════════════════════════════
// RESIDUAL GAP (not a slice regression) — documented, not a bare red.
// Mock-fallback-masking: with the flag ON and the backend DOWN, api.ts
// silently falls back to the mock with NO visible signal (per contract).
// This cannot be asserted from the backend test process (it is a frontend
// api.ts behaviour proven by overview-backend.test.ts's fallback case), so
// it is recorded here as a labelled todo pointing at the owning step.
// ════════════════════════════════════════════════════════════
test("[gap/mock-fallback-masking] flag-ON + backend-DOWN silently serves mock with no visible signal", { todo: true }, () => {
  // Owned by Step 4 (TRUST_ENVELOPE) / api.ts hardening: add a `source:'mock'|'backend'`
  // marker (or stale/degraded banner) so a backend OUTAGE is not invisible. The
  // fallback path itself is correct (card never blanks) and is covered green by
  // app/src/lib/archintel/__tests__/overview-backend.test.ts ('⑦ ON fallback').
  // No backend assertion exists for the *visibility* of the fallback — that is the gap.
  assert.ok(true);
});

// ════════════════════════════════════════════════════════════
// RESIDUAL GAP (carried from spike G3) — RLS is NOT enforced under the pglite
// superuser; tenant isolation is the function's company_id predicate only.
// Recorded as a labelled skip so the fan-out brief carries it forward.
// ════════════════════════════════════════════════════════════
test("[gap/rls-superuser] isolation rides on function-scope, not RLS (superuser bypasses policies)", { skip: "Step-2 (RLS/role hardening): run under a non-superuser role so policies are defence-in-depth. Today isolation is the company_id predicate inside recompute_portfolio_summary — proven HOLDS via [cross-tenant], but a future mart fn that omits the predicate would NOT be caught under the superuser test path." }, () => {});
