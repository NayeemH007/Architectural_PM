// ============================================================
// Step 0 — CONTRACT-GUARD ACCEPTANCE LEDGER (reviewer-authored, RED today)
// ------------------------------------------------------------
// Concrete enforcement of promise ⑦ ("swap mock→backend without rewriting
// the React tree"). The drift that produced docs 13/14 vs. live-code
// disagreement is structural: nothing FAILS when a hook's TS row-shape
// diverges from the JSON the backend serves. This ledger demands a single
// machine-checkable CONTRACT MANIFEST and a SHAPE-DIFF guard that the CI
// runs, so the next drift fails the build instead of shipping.
//
// THE BUILDER (≠ reviewer) makes this green by authoring exactly two
// modules per backend/spike/CONTRACT-contract-ci-and-prod-port.md §1–§2:
//
//   app/src/lib/archintel/contract/manifest.ts
//     export const CONTRACT: ContractEntry[]
//       — one row per derived endpoint: { queryKey, endpoint, runtime,
//         shape } where `shape` is a structural descriptor (the keys + the
//         leaf kind: 'metric' | 'metric[]' | 'number' | 'string' | 'array'
//         | 'object') of the resolve()/fetch JSON the hook returns.
//     export const HEADLINE_KEYS: string[]   — the 6 ai-* + 4 aios-* keys.
//
//   app/src/lib/archintel/contract/shape.ts
//     export function describeShape(value: unknown): ShapeNode
//       — derive the structural descriptor from a concrete JSON value.
//     export function diffShape(expected, actual): ShapeDiff[]
//       — [] when the served JSON satisfies the manifest shape; one entry
//         per divergence (missing key / extra key / kind mismatch) otherwise.
//     export function isMetricShape(node): boolean
//
// RED today: app/src/lib/archintel/contract/ does NOT exist, so every import
// throws and every case fails for the RIGHT reason (guard absent). The
// reviewer MUST NOT author those modules — only the failing contract.
//
// Determinism: each expected shape is derived from the SAME live producers
// the hooks call (managementOverview / financeOverview / aiosKpis / …),
// never a hardcoded literal — so a stale manifest cannot satisfy the diff.
// No network, no wall clock; env is left at its default (flag OFF).
// ============================================================

import { describe, it, expect } from "vitest";
import { managementOverview } from "@/lib/archintel/api";
import { financeOverview, profitabilityByProject, expenseByCategory } from "@/lib/archintel/finance";
import { stageRisk, riskInsights } from "@/lib/archintel/intelligence";
import { auditTasks, aiosKpis, dailyBrief, agentActions } from "@/lib/archintel/aios";

// The 6 derived ai-* endpoints (function-wrapping, become server aggregates
// per CONTEXT.md) + the 4 aios-* endpoints. These are the surface the guard
// must cover; raw array passthroughs (ai-projects, ai-members, …) are
// path-swaps, not aggregates, and are covered by a separate row-shape audit.
const HEADLINE = {
  "ai-overview": () => managementOverview(),
  "ai-finance": () => financeOverview(),
  "ai-profit": () => profitabilityByProject(),
  "ai-expcat": () => expenseByCategory(),
  "ai-stagerisk": () => stageRisk,
  "ai-insights": () => riskInsights,
  "aios-audit": () => auditTasks,
  "aios-kpis": () => aiosKpis(),
  "aios-brief": () => dailyBrief(),
  "aios-actions": () => agentActions,
} as const;

const HEADLINE_KEY_LIST = Object.keys(HEADLINE);

// Lazy import so the file is collectable even while the modules are absent
// (the absence is the RED state we assert, not a collection crash).
async function loadManifest() {
  return await import("@/lib/archintel/contract/manifest");
}
async function loadShape() {
  return await import("@/lib/archintel/contract/shape");
}

describe("Step 0 — contract manifest exists and covers the headline surface [⑦/F5/F6]", () => {
  it("[manifest-present] a CONTRACT manifest module is exported", async () => {
    const m = await loadManifest();
    expect(Array.isArray((m as Record<string, unknown>).CONTRACT)).toBe(true);
    expect((m.CONTRACT as unknown[]).length).toBeGreaterThan(0);
  });

  it("[covers-10] the manifest covers all 6 ai-* + 4 aios-* derived endpoints", async () => {
    const m = await loadManifest();
    const keys = new Set((m.CONTRACT as { queryKey: string }[]).map((e) => e.queryKey));
    for (const k of HEADLINE_KEY_LIST) {
      expect(keys.has(k), `manifest missing queryKey '${k}'`).toBe(true);
    }
    // Exactly the 10 headline keys (no silent omission, no padding).
    expect(keys.size).toBe(HEADLINE_KEY_LIST.length);
    expect((m as Record<string, unknown>).HEADLINE_KEYS).toBeDefined();
    expect(new Set(m.HEADLINE_KEYS as string[])).toEqual(new Set(HEADLINE_KEY_LIST));
  });

  it("[maps-endpoint+runtime] every entry maps queryKey → endpoint → runtime", async () => {
    const m = await loadManifest();
    for (const e of m.CONTRACT as { queryKey: string; endpoint: string; runtime: string; shape: unknown }[]) {
      expect(typeof e.endpoint, `${e.queryKey}.endpoint`).toBe("string");
      // Derived endpoints are versioned KPI routes (promise ③ deterministic
      // versioned semantic layer) — /api/v1/… not a bare table path.
      expect(e.endpoint).toMatch(/^\/api\/v1\//);
      expect(["pglite", "frontend", "supabase", "fastapi"]).toContain(e.runtime);
      expect(e.shape, `${e.queryKey}.shape`).toBeTruthy();
    }
  });
});

describe("Step 0 — describeShape/diffShape are sound on the LIVE producers [⑦]", () => {
  it("[describe-overview] describeShape captures overdueAmount as a metric leaf", async () => {
    const { describeShape, isMetricShape } = await loadShape();
    const node = describeShape(managementOverview());
    // structural: overdueAmount is a Metric leaf (value+confidence+sources),
    // overdueCount is a number leaf — the guard must tell them apart.
    const children = (node as { children?: Record<string, unknown> }).children ?? {};
    expect(isMetricShape(children["overdueAmount"])).toBe(true);
    expect(isMetricShape(children["overdueCount"])).toBe(false);
  });

  it("[diff-identical-empty] manifest shape vs. its own producer JSON diffs to []", async () => {
    const { CONTRACT } = await loadManifest();
    const { describeShape, diffShape } = await loadShape();
    for (const entry of CONTRACT as { queryKey: string; shape: unknown }[]) {
      const produce = HEADLINE[entry.queryKey as keyof typeof HEADLINE];
      if (!produce) continue;
      const served = JSON.parse(JSON.stringify(produce())); // resolve() does this
      const actual = describeShape(served);
      const diff = diffShape(entry.shape, actual);
      expect(diff, `manifest shape for '${entry.queryKey}' must match its producer`).toEqual([]);
    }
  });

  it("[diff-detects-missing-key] a served payload missing a manifest key is a diff (drift fails the build)", async () => {
    const { CONTRACT } = await loadManifest();
    const { describeShape, diffShape } = await loadShape();
    const entry = (CONTRACT as { queryKey: string; shape: unknown }[]).find((e) => e.queryKey === "ai-overview")!;
    const served = managementOverview() as Record<string, unknown>;
    delete served["overdueAmount"]; // simulate the backend dropping a field
    const diff = diffShape(entry.shape, describeShape(served));
    expect(diff.length).toBeGreaterThan(0);
    expect(JSON.stringify(diff)).toContain("overdueAmount");
  });

  it("[diff-detects-kind-mismatch] a Metric demoted to a bare number is a diff (promise ① regression)", async () => {
    const { CONTRACT } = await loadManifest();
    const { describeShape, diffShape } = await loadShape();
    const entry = (CONTRACT as { queryKey: string; shape: unknown }[]).find((e) => e.queryKey === "ai-overview")!;
    const served = managementOverview() as Record<string, unknown>;
    served["overdueAmount"] = 930000; // bare scalar, the F2 drift we forbid
    const diff = diffShape(entry.shape, describeShape(served));
    expect(diff.length).toBeGreaterThan(0);
    expect(JSON.stringify(diff)).toMatch(/overdueAmount/);
  });
});

describe("Step 0 — the CI guard fails on divergence and passes on match [F5/F6]", () => {
  it("[guard-runnable] assertContract(servedByKey) throws a readable error on drift, returns on match", async () => {
    const { assertContract } = await loadManifest();
    expect(typeof assertContract).toBe("function");

    // A served-by-key map that MATCHES the manifest (each producer's JSON) → no throw.
    const good: Record<string, unknown> = {};
    for (const k of HEADLINE_KEY_LIST) {
      good[k] = JSON.parse(JSON.stringify(HEADLINE[k as keyof typeof HEADLINE]()));
    }
    expect(() => assertContract(good)).not.toThrow();

    // Drift one key (Metric → bare number) → the guard throws and names the key.
    const bad = { ...good, "ai-overview": { ...(good["ai-overview"] as object), overdueAmount: 1 } };
    expect(() => assertContract(bad)).toThrow(/ai-overview/);
  });
});
