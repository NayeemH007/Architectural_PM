// ============================================================
// backend/server/index.mjs — local Node HTTP service over pglite
// (Slice 2b §1). Boots pglite → migrations → seed ONCE (warm), then
// serves GET /api/v1/overview: reads the principal from headers,
// set_config's request.*, recomputes the portfolio summary at the
// pinned clock, reads back the summary + its overdueAmount kpi_lineage,
// and serializes a Metric envelope (finance-eligible) or a redacted /
// refused payload (non-finance) over HTTP.
//
// No external HTTP deps (node:http only). Importable by the test (no
// auto-listen on import) AND runnable as a script for the live demo:
//   $env:PORT='8787'; node backend/server/index.mjs
//
// pglite HARD RULES obeyed downstream (migrations/seed already comply);
// pg-numeric arrives as a JS STRING → the serializer coerces to Number.
// ============================================================
import http from "node:http";
import { PGlite } from "@electric-sql/pglite";
import { applyMigrations, runSeed } from "../test/harness.mjs";
import { serializeOverviewFull } from "../semantic/serialize.mjs";
import { serializeFinance, serializeOverviewMoney } from "../semantic/finance.mjs";
import { serializeProfitability } from "../semantic/profitability.mjs";
import { serializeAiosKpis } from "../semantic/aios.mjs";
import { servePayments, serveProjects, serveClients } from "../semantic/arrays.mjs";

// Locked constants (mirror harness.mjs / CONTEXT.md).
const FIRM_A = "00000000-0000-0000-0000-00000000aaaa";
const AS_OF_PINNED = "2026-06-22"; // pinned clock oracle
const KPI_VERSION = 1;
const DEV_ORIGIN = "http://localhost:5173"; // Vite dev origin
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": DEV_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type, X-Company-Id, X-User-Role, X-User-Id",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/**
 * Boot pglite, apply all up-migrations, run the live seed ONCE (warm).
 * Reuses the harness primitives so the served data is the SAME seed the
 * ledgers use (pm10 = 930000 overdue). Returns the warm PGlite instance.
 */
export async function buildDb() {
  const db = new PGlite();
  await applyMigrations(db);
  await runSeed(db);
  return db;
}

// Read the JWT-claim-emulating principal from request headers.
function principalFromHeaders(req) {
  const h = req.headers;
  const get = (k) => {
    const v = h[k.toLowerCase()];
    return Array.isArray(v) ? v[0] : v;
  };
  return {
    companyId: get("x-company-id") || FIRM_A, // demo default = Firm A
    role: get("x-user-role") || "",
    userId: get("x-user-id") || "",
  };
}

function sendJson(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    // Disable HTTP keep-alive: no lingering sockets to race the pglite handle
    // during `--test-force-exit` teardown (libuv UV_HANDLE_CLOSING abort).
    Connection: "close",
    ...CORS_HEADERS,
    ...extraHeaders,
  });
  res.end(payload);
}

// Coerce a pg date/timestamptz (Date | ISO string) to a non-empty ISO string.
function toIso(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/**
 * Build the pendingApprovals Metric from canonical.design_approval — the SAME
 * shape managementOverview() emits (api.ts:132): a complete, fully-observed count
 * of internal pending approval records → cited Metric, confidence 'high'. One
 * Provenance per pending approval (recordRef 'approval:'+id → VALUE = Σ lineage).
 */
async function buildPendingApprovals(db, principal) {
  const res = await db.query(
    `select id, submitted_date, company_id
       from canonical.design_approval
      where company_id = $1 and status = 'pending'
      order by id`,
    [principal.companyId],
  );
  const rows = res.rows.filter((r) => String(r.company_id) === String(principal.companyId));
  return {
    value: rows.length,
    unit: "count",
    label: "Pending approvals",
    confidence: "high", // a direct, complete count of internal records — no estimation
    completeness: 100,
    asOf: toIso(AS_OF_PINNED),
    formula: "count(approvals where status='pending')",
    sources: rows.map((a) => ({
      sourceId: "approvals",
      sourceName: "ArchIntel · Approvals",
      recordRef: `approval:${a.id}`,
      observedAt: toIso(a.submitted_date),
    })),
  };
}

/**
 * Build the collectionRate Metric from canonical.payment_milestone — the SAME
 * shape managementOverview() emits (api.ts:151): gross low-confidence (⑤ tax
 * deferred). value === Σreceived ÷ Σbillable × 100 over payments. One Provenance
 * per contributing payment milestone (drillable lineage, recordRef 'tally:'+ref).
 */
async function buildCollectionRate(db, principal) {
  const res = await db.query(
    `select id, gross_amount, received_amount, source_record_ref, due_date, company_id
       from canonical.payment_milestone
      where company_id = $1
      order by id`,
    [principal.companyId],
  );
  const rows = res.rows.filter((r) => String(r.company_id) === String(principal.companyId));
  const received = rows.reduce((s, r) => s + Number(r.received_amount ?? 0), 0);
  const billable = rows.reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);
  return {
    value: billable ? Math.round((received / billable) * 100) : 0,
    unit: "pct",
    label: "Collection rate (gross)",
    confidence: "low", // ⑤ gross — withholding not modeled
    completeness: 100,
    asOf: toIso(AS_OF_PINNED),
    formula: "Σ received ÷ Σ billable (gross)",
    note: "Gross collection — VAT/VDS/AIT withholding not modeled.",
    sources: rows.map((pm) => ({
      sourceId: "tally",
      sourceName: "TallyPrime",
      recordRef: pm.source_record_ref,
      observedAt: toIso(pm.due_date),
    })),
  };
}

/**
 * Recompute the portfolio summary for the principal at the pinned clock, read
 * back the summary row + its overdueAmount lineage, derive the pendingApprovals
 * + collectionRate Metrics from the CANONICAL tables, and serialize the FULL
 * camelCase managementOverview() shape (band-redacted for non-finance).
 */
async function buildOverviewPayload(db, principal) {
  // set_config request.* on the warm db, exactly as the harness/tests do.
  await db.query(`select set_config('request.company_id', $1, false)`, [principal.companyId]);
  await db.query(`select set_config('request.user_id', $1, false)`, [principal.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [principal.role ?? ""]);

  const sumRes = await db.query(
    `select * from mart.recompute_portfolio_summary($1::timestamptz, $2::int)`,
    [AS_OF_PINNED, KPI_VERSION],
  );
  const summaryRow = sumRes.rows[0];

  const linRes = await db.query(
    `select kpi_run_id, metric_key, entity_id, contribution_value,
            source_id, record_ref, observed_at, company_id
       from mart.kpi_lineage
      where metric_key = 'overdueAmount'
        and kpi_run_id = $1`,
    [summaryRow.kpi_run_id],
  );

  const pendingApprovals = await buildPendingApprovals(db, principal);
  const collectionRate = await buildCollectionRate(db, principal);

  return serializeOverviewFull(
    summaryRow,
    linRes.rows,
    { pendingApprovals, collectionRate },
    principal,
  );
}

// ── S3 derived-endpoint route table: path → serializer(db, asOf, principal). ──
// Mirrors the overview pattern. The aios family is operational (no finance band);
// the ai-* families apply the band inside their serializer. Each serializer sets
// request.* itself (the overview branch sets them via buildOverviewPayload). The
// per-request set_config in each serializer reuses the warm-db reset discipline.
const DERIVED_ROUTES = {
  "/api/v1/finance": serializeFinance,
  "/api/v1/overview-money": serializeOverviewMoney, // A-5 received/total_contract/billable
  "/api/v1/profitability": serializeProfitability,
  "/api/v1/payments": servePayments,
  "/api/v1/projects": serveProjects,
  "/api/v1/clients": serveClients,
  "/api/v1/aios/kpis": serializeAiosKpis,
};

/**
 * createHandler(db) → (req, res) Node request handler bound to a warm db.
 * GET /api/v1/overview → 200 JSON; OPTIONS → 204 preflight; other → 404;
 * any error → 500 JSON (never crashes the process).
 */
export function createHandler(db) {
  return async function handler(req, res) {
    try {
      // CORS preflight.
      if (req.method === "OPTIONS") {
        res.writeHead(204, CORS_HEADERS);
        res.end();
        return;
      }

      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/api/v1/overview") {
        const principal = principalFromHeaders(req);
        const payload = await buildOverviewPayload(db, principal);
        // eslint-disable-next-line no-console
        console.log(
          `[overview] company=${principal.companyId} role=${principal.role || "(none)"} -> 200`,
        );
        sendJson(res, 200, payload);
        return;
      }

      // ── S3 derived endpoints: each header→principal, company-scoped, recompute
      //    at the pinned clock, serialize (finance band where applicable). ──
      if (req.method === "GET" && DERIVED_ROUTES[url.pathname]) {
        const principal = principalFromHeaders(req);
        const fn = DERIVED_ROUTES[url.pathname];
        const payload = await fn(db, AS_OF_PINNED, principal);
        // eslint-disable-next-line no-console
        console.log(
          `[${url.pathname}] company=${principal.companyId} role=${principal.role || "(none)"} -> 200`,
        );
        sendJson(res, 200, payload);
        return;
      }

      sendJson(res, 404, { error: "not found" });
    } catch (err) {
      sendJson(res, 500, { error: String(err?.message ?? err) });
    }
  };
}

/**
 * createServer(opts) → { server: http.Server, db }. The server is NOT yet
 * listening (the test listens on an ephemeral port and closes it).
 */
export async function createServer(_opts = {}) {
  const db = await buildDb();
  const server = http.createServer(createHandler(db));
  // No keep-alive: every connection closes after its response so no socket
  // handle lingers into the force-exit window (see Connection: close above).
  server.keepAliveTimeout = 0;

  // Clean teardown: when the consumer (e.g. the test's after-hook) closes the
  // server, close the warm pglite instance too — and do it BEFORE the 'close'
  // event fires / the close-callback resolves, so the async pglite handle is
  // fully released before `--test-force-exit` aborts the loop (which otherwise
  // triggers a libuv `UV_HANDLE_CLOSING` double-close on the open db).
  let dbClosed = false;
  const closeDbOnce = async () => {
    if (dbClosed) return;
    dbClosed = true;
    try {
      await db.close();
      // Let pglite's async worker handle finish tearing down before the caller
      // resolves — otherwise `--test-force-exit` can abort mid-close (libuv).
      await new Promise((r) => setImmediate(r));
    } catch {
      /* already closed / closing — ignore */
    }
  };

  const rawClose = server.close.bind(server);
  server.close = (cb) => {
    // Force any sockets shut so the http.Server handle drains promptly.
    try {
      server.closeAllConnections?.();
    } catch {
      /* older node without closeAllConnections — ignore */
    }
    // Drain the TCP server FIRST (no in-flight socket/async handles), THEN
    // tear down pglite, and only invoke the caller's cb once BOTH are fully
    // closed — so `--test-force-exit` finds nothing mid-close (which otherwise
    // aborts with a libuv `UV_HANDLE_CLOSING` on Windows).
    rawClose(() => {
      closeDbOnce().finally(() => {
        if (typeof cb === "function") cb();
      });
    });
    return server;
  };

  return { server, db };
}

/**
 * startServer({ port }) — createServer + listen. Resolves to
 * { server, db, port, url }. Default port 0 (ephemeral) unless given.
 */
export async function startServer(opts = {}) {
  const { server, db } = await createServer(opts);
  const port = opts.port ?? (process.env.PORT ? Number(process.env.PORT) : 0);
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(port, () => resolveListen());
  });
  const addr = server.address();
  const boundPort = typeof addr === "object" && addr ? addr.port : port;
  const url = `http://localhost:${boundPort}`;
  return { server, db, port: boundPort, url };
}

export default startServer;

// Run as a script (live demo) — only when invoked directly, not on import.
const invokedDirectly =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (invokedDirectly) {
  startServer()
    .then(({ url }) => {
      // eslint-disable-next-line no-console
      console.log(`[archintel-backend] overview service listening on ${url}/api/v1/overview`);
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error("[archintel-backend] failed to start:", err);
      process.exit(1);
    });
}
