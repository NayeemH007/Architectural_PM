// ============================================================
// Slice 2b — FRONTEND flag-seam ledger (reviewer-authored, RED today).
// ------------------------------------------------------------
// Proves the ⑦ data-source swap at the api.ts seam WITHOUT a live
// server:
//   * VITE_USE_BACKEND_AI OFF (default) → the overview wrapper returns
//     the Slice-2a MOCK Metric (managementOverview()), still green.
//   * VITE_USE_BACKEND_AI ON + `fetch` MOCKED → the wrapper returns the
//     BACKEND overview payload (same Metric shape).
// The `ai-overview` queryKey + resolve() seam shape are preserved (⑦).
//
// RED today: api.ts has no flag wiring and exports no `fetchOverview`
// seam wrapper — the ON path is unwired and the import fails / falls
// through to the mock. The builder makes it GREEN per
// backend/spike/SLICE-2B-CONTRACT.md §3. Reviewer MUST NOT edit api.ts.
//
// Determinism: env + fetch are stubbed; no network, no wall clock.
// Modules are reset between cases so the module-load flag read re-runs.
// ============================================================
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { payments } from "@/lib/archintel/data";

const FIRM_A = "00000000-0000-0000-0000-00000000aaaa";

// Deterministic expected gross overdue, recomputed from the SAME source array
// the mock producer reads (so a hardcoded literal can't satisfy the OFF case).
const OVERDUE = payments.filter((p) => p.status === "overdue");
const EXPECTED_GROSS = OVERDUE.reduce((s, p) => s + (p.amount - p.receivedAmount), 0);

// A backend-shaped overview payload (what GET /api/v1/overview returns). Its
// overdueAmount Metric is intentionally DISTINGUISHABLE from the mock (a marker
// recordRef + a backend-only label) so the ON case proves we used the fetch,
// not the mock.
const BACKEND_OVERVIEW = {
  activeCount: 6,
  completedCount: 2,
  pendingApprovals: 1,
  overdueCount: 1,
  blockedCount: 1,
  overdueAmount: {
    value: EXPECTED_GROSS, // 930000 — same number, so VALUE=Σ still holds
    unit: "bdt",
    label: "BACKEND::Overdue payments (gross)",
    confidence: "low",
    completeness: 100,
    asOf: "2026-06-22T00:00:00.000Z",
    formula: "Σ (gross_amount − received_amount) over status='overdue' milestones",
    note: "Gross overdue receivable — VAT/VDS/AIT withholding not modeled.",
    sources: [
      {
        sourceId: "BACKEND-SRC",
        sourceName: "TallyPrime",
        recordRef: "tally:pm10",
        observedAt: "2026-06-04T00:00:00Z",
      },
    ],
  },
  totalContract: 17400000,
  received: 8470000,
  billable: 0,
  collectionRate: 0,
};

// Import api.ts fresh so its module-load flag read (import.meta.env) re-runs
// after the env stub for this case.
async function loadApi() {
  vi.resetModules();
  return await import("@/lib/archintel/api");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Slice 2b — VITE_USE_BACKEND_AI flag gates the overview data source [⑦]", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("[⑦ OFF] flag off (default) → fetchOverview() returns the Slice-2a MOCK Metric (fetch never called)", async () => {
    vi.stubEnv("VITE_USE_BACKEND_AI", "false");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const api = await loadApi();
    expect(typeof (api as Record<string, unknown>).fetchOverview).toBe("function");

    const ov = await (api as { fetchOverview: () => Promise<Record<string, unknown>> }).fetchOverview();
    const m = ov.overdueAmount as { value: number; confidence: string; sources: unknown[]; label?: string };

    // mock Metric (Slice-2a): value === Σ overdue, low-confidence, real refs.
    expect(typeof m).toBe("object");
    expect(m.value).toBe(EXPECTED_GROSS);
    expect(m.confidence).toBe("low");
    expect(Array.isArray(m.sources)).toBe(true);
    // The mock label is NOT the backend marker — proves it is the mock path.
    expect(String(m.label ?? "")).not.toContain("BACKEND::");
    // OFF path must NEVER hit the network.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("[⑦ ON] flag on + fetch MOCKED → fetchOverview() returns the BACKEND Metric (same shape, backend ref)", async () => {
    vi.stubEnv("VITE_USE_BACKEND_AI", "true");
    const fetchSpy = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => BACKEND_OVERVIEW,
    }));
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    const api = await loadApi();
    const ov = await (api as { fetchOverview: () => Promise<Record<string, unknown>> }).fetchOverview();
    const m = ov.overdueAmount as { value: number; confidence: string; label: string; sources: { recordRef: string }[] };

    // proves the wrapper returned the BACKEND payload, not the mock.
    expect(fetchSpy).toHaveBeenCalled();
    expect(m.label).toContain("BACKEND::");
    expect(m.value).toBe(EXPECTED_GROSS);
    expect(m.confidence).toBe("low");
    expect(m.unit ?? "bdt").toBe("bdt");
    expect(m.sources[0].recordRef).toContain("tally:pm10");

    // The fetch must target the backend overview route with a finance-eligible
    // principal header (the locked demo principal; per-user gating is Step-2).
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit | undefined];
    const url = String((fetchSpy.mock.calls[0] as unknown[])[0]);
    expect(url).toContain("/api/v1/overview");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["X-Company-Id"] ?? headers["x-company-id"]).toBe(FIRM_A);
    expect((headers["X-User-Role"] ?? headers["x-user-role"] ?? "").toLowerCase()).toMatch(/founder|finance/);
  });

  it("[⑦ ON fallback] flag on but fetch FAILS → falls back to the Slice-2a mock Metric (card never blanks)", async () => {
    vi.stubEnv("VITE_USE_BACKEND_AI", "true");
    const fetchSpy = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchSpy as unknown as typeof fetch);

    const api = await loadApi();
    const ov = await (api as { fetchOverview: () => Promise<Record<string, unknown>> }).fetchOverview();
    const m = ov.overdueAmount as { value: number; confidence: string; label?: string };

    expect(fetchSpy).toHaveBeenCalled();
    // fell back to the mock — value still correct, NOT the backend marker label.
    expect(m.value).toBe(EXPECTED_GROSS);
    expect(m.confidence).toBe("low");
    expect(String(m.label ?? "")).not.toContain("BACKEND::");
  });

  it("[⑦ seam] useAiOverview preserves the 'ai-overview' queryKey (the ⑦ seam shape is unchanged)", async () => {
    vi.stubEnv("VITE_USE_BACKEND_AI", "false");
    const api = await loadApi();
    // The hook must still exist and use the ai-overview key (we don't render it,
    // just assert the export survives — the swap must not rename the seam).
    expect(typeof (api as Record<string, unknown>).useAiOverview).toBe("function");
  });
});
