// ============================================================
// contract/manifest.ts — the CONTRACT OF RECORD (executable).
//
// Promise ⑦ — "swap mock→backend without rewriting the React tree"
// — is enforced today only by convention. This module makes the
// contract machine-checkable: one manifest entry per derived
// endpoint, mapping `queryKey → endpoint → runtime → row-shape`,
// where the row-shape is DERIVED from the LIVE producer (never a
// hand-typed literal), so a stale manifest can never satisfy the
// diff. `assertContract` diffs each served payload against its
// manifest shape and THROWS naming the first diverging key.
//
// Surface covered (CONTRACT §0 / PD-N): exactly the 10 derived /
// aggregate endpoints — the 6 ai-* function-wrappers + the 4 aios-*
// — which become server aggregates / semantic functions (NOT path
// swaps) and whose JSON can silently drift from a Metric envelope.
// The raw-array passthroughs (ai-projects, ai-members, …) are path
// swaps covered by a lighter follow-up audit, not here.
// ============================================================

import { managementOverview } from "@/lib/archintel/api";
import {
  financeOverview,
  profitabilityByProject,
  expenseByCategory,
} from "@/lib/archintel/finance";
import { stageRisk, riskInsights } from "@/lib/archintel/intelligence";
import {
  auditTasks,
  aiosKpis,
  dailyBrief,
  agentActions,
} from "@/lib/archintel/aios";
import { describeShape, diffShape } from "./shape";

export type LeafKind =
  | "metric"
  | "metric[]" // Metric envelope (value+confidence+sources) / array of
  | "number"
  | "string"
  | "boolean"
  | "null"
  | "array"
  | "object";

export type ShapeNode =
  | { kind: Exclude<LeafKind, "object" | "array"> }
  | { kind: "object"; children: Record<string, ShapeNode> }
  | { kind: "array"; element: ShapeNode };

export type Runtime = "pglite" | "frontend" | "supabase" | "fastapi";

export interface ContractEntry {
  queryKey: string; // exact live key — ai-* / aios-*, preserved verbatim (⑦)
  endpoint: string; // /api/v1/… versioned route this key maps to
  runtime: Runtime;
  shape: ShapeNode; // === describeShape(producer()) — enforced by the ledger
}

// ── The live producers, keyed by the EXACT React-Query queryKey ──────────
// These are the same functions/arrays the hooks call (managementOverview /
// financeOverview / aiosKpis / …). The manifest shape is computed from these,
// so manifest == producer by construction (the ledger's [diff-identical-empty]
// test re-proves it).
const PRODUCERS = {
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
} as const satisfies Record<string, () => unknown>;

// The 6 ai-* + 4 aios-* derived/aggregate query keys (CONTRACT §0).
export const HEADLINE_KEYS: string[] = Object.keys(PRODUCERS);

// queryKey → the versioned /api/v1/* KPI route it maps to (promise ③: a
// deterministic, versioned semantic layer — not a bare table path).
const ENDPOINTS: Record<string, string> = {
  "ai-overview": "/api/v1/overview",
  "ai-finance": "/api/v1/finance/overview",
  "ai-profit": "/api/v1/finance/profitability",
  "ai-expcat": "/api/v1/finance/expense-by-category",
  "ai-stagerisk": "/api/v1/risk/stage",
  "ai-insights": "/api/v1/risk/insights",
  "aios-audit": "/api/v1/aios/audit",
  "aios-kpis": "/api/v1/aios/kpis",
  "aios-brief": "/api/v1/aios/brief",
  "aios-actions": "/api/v1/aios/actions",
};

// Runtime each endpoint resolves on. Today everything serves on pglite (the
// overview is the only LIVE route — Slice 2b); finance/risk/aios become FastAPI
// semantic functions over the same DB during the port (CONTRACT §4). The guard
// proves the Metric shape is invariant across that move.
const RUNTIMES: Record<string, Runtime> = {
  "ai-overview": "pglite",
  "ai-finance": "fastapi",
  "ai-profit": "fastapi",
  "ai-expcat": "fastapi",
  "ai-stagerisk": "fastapi",
  "ai-insights": "fastapi",
  "aios-audit": "fastapi",
  "aios-kpis": "fastapi",
  "aios-brief": "fastapi",
  "aios-actions": "fastapi",
};

// Derive the authoritative shape from the live producer (JSON round-trip so it
// matches exactly what resolve() serves — undefined fields dropped, the same
// transform the hooks apply). This is why the manifest can never encode a stale
// hand-typed shape.
function shapeOf(queryKey: keyof typeof PRODUCERS): ShapeNode {
  const served = JSON.parse(JSON.stringify(PRODUCERS[queryKey]()));
  return describeShape(served);
}

export const CONTRACT: ContractEntry[] = HEADLINE_KEYS.map((queryKey) => ({
  queryKey,
  endpoint: ENDPOINTS[queryKey],
  runtime: RUNTIMES[queryKey],
  shape: shapeOf(queryKey as keyof typeof PRODUCERS),
}));

/**
 * assertContract — the CI guard. Given a `servedByKey` map (queryKey → served
 * JSON), diff EACH manifest entry against its served payload and THROW a
 * readable Error naming the FIRST diverging queryKey (and the diff). Returns
 * void on full match.
 *
 * MUST iterate CONTRACT, not the input, so an endpoint that DISAPPEARS from
 * `servedByKey` is a diff (missing → throw), not a silent skip.
 */
export function assertContract(servedByKey: Record<string, unknown>): void {
  for (const entry of CONTRACT) {
    if (!(entry.queryKey in servedByKey)) {
      throw new Error(
        `[contract] '${entry.queryKey}' (${entry.endpoint}) is missing from the served payload — ` +
          `an endpoint vanished. Every manifest key must be served.`,
      );
    }
    const served = servedByKey[entry.queryKey];
    const actual = describeShape(served);
    const diffs = diffShape(entry.shape, actual);
    if (diffs.length > 0) {
      const summary = diffs
        .map((d) => `  • ${d.path}: ${d.reason} (expected '${d.expected}', got '${d.actual}')`)
        .join("\n");
      throw new Error(
        `[contract] shape drift on '${entry.queryKey}' (${entry.endpoint}):\n${summary}`,
      );
    }
  }
}
