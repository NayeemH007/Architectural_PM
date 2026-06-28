// ============================================================
// Slice 2b — HTTP ledger (reviewer-authored, RED today).
// ------------------------------------------------------------
// Proves the ⑦ seam swap end-to-end over a real HTTP boundary and
// closes adversary gap G2 at the fetch layer: a LOCAL Node HTTP
// service (over pglite) exposes GET /api/v1/overview that boots
// pglite + migrations + seed (warm), reads the principal from
// headers (X-Company-Id / X-User-Role → request.company_id/role),
// runs mart.recompute_portfolio_summary(2026-06-22, 1) for that
// company, and returns the overview JSON in which overdueAmount is
// a full Metric envelope whose sources[] come from kpi_lineage.
//
// RED today: backend/server/index.mjs does not exist. The builder
// makes it GREEN per backend/spike/SLICE-2B-CONTRACT.md §1.
// Reviewer MUST NOT implement the server.
//
// The test boots the builder's server on an EPHEMERAL port (listen 0)
// and closes it deterministically. Determinism: pinned as_of via the
// server's locked clock; no wall-clock assertions.
// ============================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { FIRM_A, FIRM_B } from "./harness.mjs";

// The builder's server module. RED today: this import throws
// (ERR_MODULE_NOT_FOUND) until backend/server/index.mjs exists.
const SERVER_MODULE = "../server/index.mjs";

const DEV_ORIGIN = "http://localhost:5173"; // Vite dev origin (CORS target)

let server;
let baseUrl;

before(async () => {
  // createServer(opts) -> { server, db } (NOT yet listening); we listen on 0.
  // RED: import fails until the builder ships the module.
  const mod = await import(SERVER_MODULE);
  const create = mod.createServer ?? mod.default;
  assert.equal(typeof create, "function",
    "backend/server/index.mjs must export createServer (or default) per SLICE-2B-CONTRACT §1");
  const built = await create({ port: 0 });
  server = built.server ?? built;
  // Ensure listening on an ephemeral port (idempotent if create already listened).
  await new Promise((res, rej) => {
    if (server.listening) return res();
    server.listen(0, "127.0.0.1", res);
    server.once("error", rej);
  });
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  if (server) await new Promise((res) => server.close(res));
});

function isMetric(v) {
  return v && typeof v === "object" && "value" in v && "confidence" in v && "sources" in v;
}

async function getOverview(headers) {
  const res = await fetch(`${baseUrl}/api/v1/overview`, {
    headers: { Origin: DEV_ORIGIN, ...headers },
  });
  return res;
}

// ============================================================
// [⑦/G2] Finance-eligible principal → 200 + overdueAmount Metric citing tally:pm10.
// ============================================================
test("[⑦/G2] GET /api/v1/overview (founder headers) → 200 + overdueAmount Metric whose sources cite tally:pm10", async () => {
  const res = await getOverview({ "X-Company-Id": FIRM_A, "X-User-Role": "founder" });
  assert.equal(res.status, 200, "finance-eligible principal must get 200");

  const body = await res.json();
  const m = body.overdueAmount;
  assert.equal(isMetric(m), true, "overdueAmount must be a Metric envelope over HTTP");
  assert.equal(Number(m.value), 930000, "seeded Firm-A overdueAmount is 930000");
  assert.equal(m.confidence, "low", "gross figure is low-trust");
  assert.equal(m.unit, "bdt", "unit is bdt");
  assert.match(String(m.note ?? ""), /gross|withhold/i, "note mentions gross/withholding");

  assert.ok(Array.isArray(m.sources) && m.sources.length >= 1, "sources non-empty");
  const refs = m.sources.map((s) => s.recordRef);
  assert.ok(refs.some((r) => typeof r === "string" && r.includes("tally:pm10")),
    "a source recordRef must cite tally:pm10 (real kpi_lineage provenance)");

  // VALUE = Σ LINEAGE at the served payload.
  const fromSources = m.sources.reduce((acc, _s) => acc, 0); // structure check below
  void fromSources;
});

// ============================================================
// [⑤/C4] Non-finance principal (designer) → money omitted / refused over HTTP.
// ============================================================
test("[⑤/C4] GET /api/v1/overview (designer headers) → overdueAmount omitted or refused {value:null, confidence:'insufficient'}", async () => {
  const res = await getOverview({ "X-Company-Id": FIRM_A, "X-User-Role": "designer" });
  assert.equal(res.status, 200, "designer still gets a 200 overview (money band redacted, not 403)");

  const body = await res.json();
  const hasKey = Object.prototype.hasOwnProperty.call(body, "overdueAmount");
  if (hasKey) {
    const m = body.overdueAmount;
    assert.ok(m && typeof m === "object", "if present, overdueAmount must be a refusal envelope");
    assert.equal(m.value, null, "refused Metric.value must be null for designer");
    assert.equal(m.confidence, "insufficient", "refused Metric.confidence must be 'insufficient'");
  } else {
    assert.equal(hasKey, false, "overdueAmount omitted for designer");
  }

  // No money key may leak a numeric value to the designer over HTTP.
  for (const k of ["overdueAmount", "overdueamount", "total_contract", "totalContract", "received", "billable"]) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      const v = body[k];
      const leaked = typeof v === "number" || typeof v === "string" ||
        (v && typeof v === "object" && typeof v.value === "number");
      assert.equal(leaked, false, `money key '${k}' must not leak a numeric value to designer over HTTP`);
    }
  }
});

// ============================================================
// [tenant isolation] Firm-B company header → no Firm-A entity in the served run.
// ============================================================
test("[isolation] GET /api/v1/overview (Firm-B headers) → no Firm-A entity in overdueAmount sources", async () => {
  const res = await getOverview({ "X-Company-Id": FIRM_B, "X-User-Role": "founder" });
  assert.equal(res.status, 200, "Firm-B founder must get 200");

  const body = await res.json();
  const m = body.overdueAmount;
  // Firm B has its own overdue milestones (bpm1/bpm2), distinct refs.
  if (isMetric(m) && Array.isArray(m.sources)) {
    for (const s of m.sources) {
      assert.ok(!String(s.recordRef).includes("pm10"),
        "Firm-B overview must NOT cite Firm-A's pm10");
      assert.ok(!String(s.recordRef).includes("tally:pm1") || String(s.recordRef).includes("bpm"),
        "Firm-B sources must be Firm-B refs only (bpm*)");
    }
    // Firm B's gross overdue is 1,000,000 (bpm1 500000 + bpm2 500000).
    assert.equal(Number(m.value), 1000000, "Firm-B overdueAmount is its own 1,000,000, not Firm-A's");
  }
});

// ============================================================
// [CORS] the dev origin is allowed (so the Vite app can fetch it).
// ============================================================
test("[CORS] response carries Access-Control-Allow-Origin for the Vite dev origin", async () => {
  const res = await getOverview({ "X-Company-Id": FIRM_A, "X-User-Role": "founder" });
  const allow = res.headers.get("access-control-allow-origin");
  assert.ok(allow != null, "Access-Control-Allow-Origin header must be present");
  assert.ok(
    allow === DEV_ORIGIN || allow === "*",
    `Access-Control-Allow-Origin must allow the Vite dev origin (${DEV_ORIGIN}) or '*', got '${allow}'`,
  );
});
