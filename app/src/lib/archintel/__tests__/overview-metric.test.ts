// ============================================================
// Slice 2a — ACCEPTANCE LEDGER (reviewer-authored, RED today)
// ------------------------------------------------------------
// Closes adversary gap G1 at the APP SURFACE: the live
// managementOverview() must return `overdueAmount` as a drillable
// Metric{} (value + confidence + note + sources:Provenance[]),
// NOT the bare number it is today (api.ts:42,52).
//
// This file is the FAILING contract. The BUILDER makes it green by
// editing app/src/lib/archintel/api.ts per backend/spike/SLICE-2A-CONTRACT.md.
// Reviewer MUST NOT implement the change.
//
// Scope: pure data shape. The ProvenancePopover RENDER (KpiCard
// showing "Why this number?" with real refs in the running app) is a
// MANUAL screenshot gate — see SLICE-2A-CONTRACT §C. Not an RTL test
// (jsdom/RTL out of scope for 2a).
//
// Determinism: value is RECOMPUTED from the same `payments` source the
// producer reads (never a hardcoded literal, never the wall clock).
// ============================================================

import { describe, it, expect } from "vitest";
import { managementOverview } from "@/lib/archintel/api";
import { payments } from "@/lib/archintel/data";
import type { Metric, Provenance } from "@/lib/types";

// Deterministic expected gross overdue sum, recomputed from the SAME
// source array the producer consumes. Today only pm10 is overdue → 930000.
// We never assert the literal 930000 directly — we assert against this Σ so
// the builder cannot satisfy the ledger with a hardcoded number.
const OVERDUE = payments.filter((p) => p.status === "overdue");
const EXPECTED_GROSS = OVERDUE.reduce(
  (s, p) => s + (p.amount - p.receivedAmount),
  0,
);

// A Metric type-guard the runtime asserts against (so a bare number fails fast).
function isMetric(x: unknown): x is Metric {
  return (
    typeof x === "object" &&
    x !== null &&
    "confidence" in x &&
    "sources" in x &&
    "value" in x
  );
}

describe("Slice 2a — overdueAmount is a cited, low-confidence Metric [G1 / promise ①]", () => {
  it("[G1/①] managementOverview().overdueAmount is a Metric object, not a bare number", () => {
    const ov = managementOverview();
    // RED today: overdueAmount is `number` (a bare scalar). This is the gap.
    expect(typeof ov.overdueAmount).not.toBe("number");
    expect(isMetric(ov.overdueAmount)).toBe(true);
  });

  it("[①] value === Σ over the overdue payments (reconstructable, not a literal)", () => {
    const m = managementOverview().overdueAmount as unknown as Metric;
    // The number must equal the deterministic recomputed gross sum.
    expect(m.value).toBe(EXPECTED_GROSS);
    // Sanity: there IS an overdue milestone to cite (guards a vacuous pass).
    expect(OVERDUE.length).toBeGreaterThan(0);
  });

  it("[⑤ tax-honesty] confidence==='low' with a gross/withholding note", () => {
    const m = managementOverview().overdueAmount as unknown as Metric;
    expect(m.confidence).toBe("low");
    expect(typeof m.note).toBe("string");
    expect(m.note).toMatch(/gross|withhold/i);
  });

  it("[①] carries trust metadata: numeric completeness, unit bdt, a label, and asOf set", () => {
    const m = managementOverview().overdueAmount as unknown as Metric;
    expect(typeof m.completeness).toBe("number");
    expect(m.unit).toBe("bdt");
    expect(typeof m.label).toBe("string");
    expect(m.label.length).toBeGreaterThan(0);
    expect(typeof m.asOf).toBe("string");
    expect(m.asOf.length).toBeGreaterThan(0);
  });

  it("[① drillable] sources is a non-empty Provenance[] with real refs tracing to overdue milestones", () => {
    const m = managementOverview().overdueAmount as unknown as Metric;
    expect(Array.isArray(m.sources)).toBe(true);
    expect(m.sources.length).toBe(OVERDUE.length); // one source per overdue milestone

    for (const s of m.sources as Provenance[]) {
      expect(typeof s.sourceId).toBe("string");
      expect(typeof s.sourceName).toBe("string");
      // recordRef must be a REAL ref naming an overdue milestone id (e.g. 'tally:pm10').
      expect(typeof s.recordRef).toBe("string");
      const tracesToOverdue = OVERDUE.some((p) => s.recordRef.includes(p.id));
      expect(tracesToOverdue).toBe(true);
      // observedAt present + ISO-ish (drillable timeline).
      expect(typeof s.observedAt).toBe("string");
      expect(s.observedAt.length).toBeGreaterThan(0);
    }
  });

  it("[① VALUE = Σ LINEAGE] value reconstructable from sources tracing to the overdue payments", () => {
    const m = managementOverview().overdueAmount as unknown as Metric;
    // Re-derive the sum from the milestones each source points at: value must
    // equal Σ(amount-received) over the overdue payments the sources cite.
    const fromSources = (m.sources as Provenance[]).reduce((acc, s) => {
      const pm = OVERDUE.find((p) => s.recordRef.includes(p.id));
      return acc + (pm ? pm.amount - pm.receivedAmount : 0);
    }, 0);
    expect(fromSources).toBe(m.value);
    expect(fromSources).toBe(EXPECTED_GROSS);
  });
});

describe("Slice 2a — Metric envelope supports the refusal shape [promise ②]", () => {
  it("[②] the Metric type/contract allows value:null + confidence:'insufficient'", () => {
    // Shape guard only (a Viewer/redacted path is a later slice). This asserts
    // the envelope — not a bare number — is the contract, so 2b's Viewer path
    // can return {value:null, confidence:'insufficient'} without a type change.
    const refusal: Metric = {
      value: null,
      confidence: "insufficient",
      label: "Overdue (gross)",
      completeness: 0,
      asOf: "2026-06-22T00:00:00.000Z",
      sources: [],
    };
    expect(refusal.value).toBeNull();
    expect(refusal.confidence).toBe("insufficient");
    expect(Array.isArray(refusal.sources)).toBe(true);
  });
});
