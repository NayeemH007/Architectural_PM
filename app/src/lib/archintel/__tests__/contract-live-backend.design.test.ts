// ============================================================
// LIVE-BACKEND CONTRACT LEDGER (reviewer-authored, RED today)
// ------------------------------------------------------------
// The S0 contract guard (contract/shape.ts + manifest.ts) has only ever
// been exercised against its OWN mock producers (the "layer-1" / static
// ledger in contract-ci-and-prod-port.design.test.ts). Its "layer-2" — the
// LIVE cross-check that boots the real backend and diffs the SERVED JSON
// against the frontend contract — was specified (CONTRACT §3, layer 2) but
// never written. So the integration blocker shipped: with the flags ON the
// backend serializers emit a DIFFERENT field contract than the pages consume,
// and Dashboard + Finance CRASH.
//
//   * Dashboard.tsx:218 reads `overview.collectionRate.note` — but the LIVE
//     /api/v1/overview serves the raw mart row in SNAKE_CASE (active_count,
//     pending_approvals, overdue_count, blocked_count, total_contract,
//     collection_rate) with collectionRate DEMOTED to a bare number → crash.
//   * Finance.tsx:87 reads `fin.overdue.value` — but the LIVE /api/v1/finance
//     omits `overdue` entirely (and every month*/ytd* key) → crash.
//
// This ledger boots backend/server/index.mjs over pglite (warm: migrations +
// seed), fetches EACH endpoint the frontend consumes when VITE_USE_BACKEND_AI /
// VITE_USE_BACKEND_AIOS are ON, as the locked FOUNDER principal (Firm A), and
// asserts via the S0 guard that
//
//     describeShape(servedByBackend) deep-equals describeShape(mockProducer())
//
// key-for-key. A snake_case key, a missing key (overdue), or a Metric demoted
// to a bare number is a DRIFT → the diff is non-empty → this test FAILS (RED).
//
// RED today: the backend serializers are wrong (the drift is real). A LATER
// BUILDER fixes the serializers (serialize.mjs / finance.mjs / server) to emit
// the camelCase Metric contract; this ledger then goes GREEN. The reviewer
// authors ONLY this failing test — it does NOT touch the serializers, the
// producers, the guard, or any existing test.
//
// Runtime: vitest (node env) hosts pglite fine (probed) and natively resolves
// the TS S0 guard (@/lib/...) + the @electric-sql/pglite-backed .mjs server via
// a relative import. So the SAME runner imports both halves — no node:test
// fallback needed. The pinned clock (server's AS_OF_PINNED=2026-06-22) keeps the
// served shape deterministic; we assert SHAPE, never a wall-clock value.
// ============================================================

import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ── The S0 guard (TS) — the contract-of-record machinery. ──
import { describeShape, diffShape, type ShapeDiff } from "@/lib/archintel/contract/shape";

// ── The LIVE frontend producers — the shape the pages consume (the contract). ──
// These are the EXACT functions the hooks fall back to when the flag is OFF, so
// "served must match producer" is literally "swap mock→backend without rewriting
// the React tree" (promise ⑦).
import { managementOverview } from "@/lib/archintel/api";
import { financeOverview, profitabilityByProject } from "@/lib/archintel/finance";
import { payments, projectsA, clientsA } from "@/lib/archintel/data";
import { aiosKpis } from "@/lib/archintel/aios";

// ── The REAL backend (pglite over node:http). Relative import (5 levels up to
//    the repo root) so vitest resolves the .mjs directly; startServer boots a
//    warm db (migrations + seed) and listens on an ephemeral port. ──
import {
  startServer as startBackend,
} from "../../../../../backend/server/index.mjs";

// Locked demo principal — a FINANCE-ELIGIBLE FOUNDER for Firm A, exactly as the
// frontend seam sends (api.ts FINANCE_HEADERS / fetchOverview headers).
const FIRM_A = "00000000-0000-0000-0000-00000000aaaa";
const FOUNDER_HEADERS = { "X-Company-Id": FIRM_A, "X-User-Role": "founder" };

// The endpoints the frontend FETCHES when the flags are ON, paired with the
// queryKey it stores under and the mock producer whose shape is the contract.
//   - api.ts:    fetchOverview → /api/v1/overview            (ai-overview)
//                fetchFinance → /api/v1/finance               (ai-finance)
//                fetchProfitability → /api/v1/profitability   (ai-profit)
//                fetchPayments → /api/v1/payments             (ai-payments)
//                fetchProjects → /api/v1/projects             (ai-projects)
//                fetchClients → /api/v1/clients               (ai-clients)
//   - aios.ts:   fetchAiosKpis → /api/v1/aios/kpis            (aios-kpis)
// `producer()` returns the SAME JSON the hook serves with the flag OFF (we JSON
// round-trip it, exactly as resolve() does, so undefined fields drop).
const CONSUMED: ReadonlyArray<{
  queryKey: string;
  path: string;
  producer: () => unknown;
}> = [
  { queryKey: "ai-overview", path: "/api/v1/overview", producer: () => managementOverview() },
  { queryKey: "ai-finance", path: "/api/v1/finance", producer: () => financeOverview() },
  { queryKey: "ai-profit", path: "/api/v1/profitability", producer: () => profitabilityByProject() },
  { queryKey: "ai-payments", path: "/api/v1/payments", producer: () => payments },
  { queryKey: "ai-projects", path: "/api/v1/projects", producer: () => projectsA },
  { queryKey: "ai-clients", path: "/api/v1/clients", producer: () => clientsA },
  { queryKey: "aios-kpis", path: "/api/v1/aios/kpis", producer: () => aiosKpis() },
];

type Built = { server: { close: (cb?: () => void) => unknown }; url: string };

let backend: Built;
// queryKey → the live JSON the backend served the founder principal.
const served: Record<string, unknown> = {};

beforeAll(async () => {
  backend = (await startBackend({ port: 0 })) as Built;
  for (const { queryKey, path } of CONSUMED) {
    const res = await fetch(`${backend.url}${path}`, { headers: FOUNDER_HEADERS });
    // A non-200 is itself a contract break (the page would fall back / blank),
    // but the SHAPE assertions below are the load-bearing proof of drift.
    served[queryKey] = res.ok ? await res.json() : { __status: res.status };
  }
}, 60_000);

afterAll(async () => {
  if (backend?.server) await new Promise<void>((r) => backend.server.close(() => r()));
});

// The frontend-contract shape, derived from the LIVE mock producer (never a
// hand-typed literal) via the SAME JSON round-trip resolve()/the manifest use.
function producerShape(producer: () => unknown) {
  return describeShape(JSON.parse(JSON.stringify(producer())));
}

// Render a diff list compactly so the RED output names every drifting key.
function summarize(diffs: ShapeDiff[]): string {
  return diffs.map((d) => `    • ${d.path}: ${d.reason} (expected '${d.expected}', got '${d.actual}')`).join("\n");
}

describe("LIVE backend response SHAPE matches the frontend contract [⑦/F5/F6 — layer-2]", () => {
  // One parametrised case per consumed endpoint: the served JSON, shaped, must
  // diff-empty against the mock producer's shape. This is the guard's layer-2.
  for (const { queryKey, path, producer } of CONSUMED) {
    it(`[live-shape:${queryKey}] ${path} served shape == ${queryKey} producer shape (no drift)`, () => {
      const expected = producerShape(producer);
      const actual = describeShape(served[queryKey]);
      const diffs = diffShape(expected, actual);
      expect(
        diffs,
        `Shape drift on '${queryKey}' (${path}) — backend serializer emits a different\n` +
          `field contract than the frontend page consumes:\n${summarize(diffs)}\n`,
      ).toEqual([]);
    });
  }

  // The two crash sites, pinned EXPLICITLY so the RED output names the exact
  // field the page reads (independent of the diff engine, so a builder who only
  // skims sees the precise crash).
  it("[crash:dashboard] /api/v1/overview carries collectionRate as a Metric (Dashboard.tsx:218 reads .note)", () => {
    const overview = served["ai-overview"] as Record<string, unknown>;
    const cr = overview?.collectionRate as { value?: unknown; confidence?: unknown; sources?: unknown } | undefined;
    // Dashboard reads overview.collectionRate.note / .value / .confidence — it
    // MUST be a Metric envelope, not the served bare `collection_rate` number.
    expect(
      cr && typeof cr === "object" && "value" in cr && "confidence" in cr && "sources" in cr,
      `Dashboard.tsx:218 reads overview.collectionRate.note — but the live overview has no\n` +
        `camelCase 'collectionRate' Metric. Served keys: ${JSON.stringify(Object.keys(overview ?? {}))}`,
    ).toBe(true);
  });

  it("[crash:finance] /api/v1/finance carries `overdue` as a Metric (Finance.tsx:87 reads fin.overdue.value)", () => {
    const fin = served["ai-finance"] as Record<string, unknown>;
    const overdue = fin?.overdue as { value?: unknown; confidence?: unknown } | undefined;
    expect(
      overdue && typeof overdue === "object" && "value" in overdue,
      `Finance.tsx:87 reads fin.overdue.value — but the live finance payload omits 'overdue'.\n` +
        `Served keys: ${JSON.stringify(Object.keys(fin ?? {}))}`,
    ).toBe(true);
  });
});
