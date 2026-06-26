// ============================================================
// contract/shape.ts — the structural shape descriptor + diff engine.
//
// This is the load-bearing half of the contract guard (CONTRACT
// §2). It turns a concrete JSON value (the live producer output,
// or a served backend payload) into a `ShapeNode` tree whose leaves
// record the KIND of each field — crucially telling a Metric
// envelope apart from a bare number. `diffShape` then reports any
// structural divergence between an expected (manifest) shape and an
// actual (served) shape: a missing key, an extra key, a kind
// mismatch (e.g. a Metric demoted to a scalar — the F2/① drift), or
// an array-element mismatch.
//
// Determinism: describeShape reads ONLY the value passed in — no
// env, no wall clock, no network. The same value always yields the
// same shape, so a stale manifest can never satisfy the diff.
// ============================================================

import type { LeafKind, ShapeNode } from "./manifest";

export type { LeafKind, ShapeNode };

export interface ShapeDiff {
  path: string; // dotted path to the diverging field (e.g. "overdueAmount")
  expected: string; // the expected leaf-kind (or "<absent>")
  actual: string; // the actual leaf-kind (or "<absent>")
  reason: string; // human-readable cause ("missing key" / "kind mismatch" / …)
}

// ── Metric detection (the contract's load-bearing predicate) ──────────────
// A Metric envelope is the trust wrapper from types.ts:50-62 — it carries a
// `value`, a `confidence`, and a `sources[]` array. We key off the ENVELOPE,
// not the inner value (which may legitimately be null|number — an "insufficient"
// refusal is still a Metric). This mirrors serialize.mjs:isMetric (value +
// confidence) but additionally requires `sources`, per CONTRACT §2, so a bare
// {value,confidence} band (e.g. RiskLikelihood, which has no `sources`) is NOT
// mistaken for a Metric.
function isMetricValue(v: unknown): boolean {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    "value" in (v as object) &&
    "confidence" in (v as object) &&
    "sources" in (v as object)
  );
}

/** True when a SHAPE NODE is a metric leaf (or an array of metrics). */
export function isMetricShape(node: unknown): boolean {
  if (!node || typeof node !== "object") return false;
  const kind = (node as { kind?: unknown }).kind;
  return kind === "metric" || kind === "metric[]";
}

/**
 * describeShape — derive the structural descriptor of a concrete JSON value.
 *   - a Metric envelope (value + confidence + sources) → leaf { kind:'metric' }
 *     (do NOT descend — the envelope is the contract, not the inner number).
 *   - an array whose FIRST element is a Metric → { kind:'metric[]' }.
 *   - any other array → { kind:'array', element: describeShape(first ?? {}) }.
 *   - a plain object → { kind:'object', children:{…} } recursively.
 *   - number|string|boolean|null → the matching leaf kind.
 */
export function describeShape(value: unknown): ShapeNode {
  if (value === null) return { kind: "null" };

  const t = typeof value;
  if (t === "number") return { kind: "number" };
  if (t === "string") return { kind: "string" };
  if (t === "boolean") return { kind: "boolean" };

  if (Array.isArray(value)) {
    const first = value.length > 0 ? value[0] : undefined;
    if (isMetricValue(first)) return { kind: "metric[]" };
    return { kind: "array", element: describeShape(first ?? {}) };
  }

  if (t === "object") {
    if (isMetricValue(value)) return { kind: "metric" };
    const children: Record<string, ShapeNode> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      children[k] = describeShape(v);
    }
    return { kind: "object", children };
  }

  // undefined / function / symbol — treat as null (JSON-absent).
  return { kind: "null" };
}

// Short, stable string rendering of a node's kind for diff messages.
function kindOf(node: ShapeNode | undefined): string {
  if (!node) return "<absent>";
  return node.kind;
}

/**
 * diffShape — structural diff of an `expected` (manifest) shape against an
 * `actual` (served) shape.
 *   - returns [] when `actual` satisfies `expected`.
 *   - one ShapeDiff per divergence: missing key, extra key, kind mismatch,
 *     array-element mismatch. Each carries a dotted `path` so the message can
 *     name the field (the ledger greps the path).
 */
export function diffShape(
  expected: ShapeNode,
  actual: ShapeNode,
  path = "",
): ShapeDiff[] {
  const diffs: ShapeDiff[] = [];

  // Kind mismatch at this node (e.g. metric → number, object → array).
  if (expected.kind !== actual.kind) {
    diffs.push({
      path: path || "(root)",
      expected: kindOf(expected),
      actual: kindOf(actual),
      reason: `kind mismatch: expected '${expected.kind}', got '${actual.kind}'`,
    });
    // Kinds disagree — descending further would be noise; stop at this node.
    return diffs;
  }

  if (expected.kind === "object" && actual.kind === "object") {
    const expChildren = expected.children;
    const actChildren = actual.children;
    // Missing keys (present in manifest, absent in served).
    for (const key of Object.keys(expChildren)) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in actChildren)) {
        diffs.push({
          path: childPath,
          expected: kindOf(expChildren[key]),
          actual: "<absent>",
          reason: `missing key '${key}'`,
        });
      } else {
        diffs.push(...diffShape(expChildren[key], actChildren[key], childPath));
      }
    }
    // Extra keys (present in served, absent in manifest).
    for (const key of Object.keys(actChildren)) {
      if (!(key in expChildren)) {
        const childPath = path ? `${path}.${key}` : key;
        diffs.push({
          path: childPath,
          expected: "<absent>",
          actual: kindOf(actChildren[key]),
          reason: `extra key '${key}'`,
        });
      }
    }
    return diffs;
  }

  if (expected.kind === "array" && actual.kind === "array") {
    diffs.push(...diffShape(expected.element, actual.element, `${path}[]`));
    return diffs;
  }

  // Matching scalar / metric / metric[] leaves — no further structure.
  return diffs;
}
