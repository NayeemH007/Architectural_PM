// ============================================================
// Slice 3 — ACCEPTANCE LEDGER (reviewer-authored, RED today)
// ------------------------------------------------------------
// Neutralizes the hand-authored FABRICATED numbers the app presents
// as insight. This is the first slice that makes promises ② (refuse,
// don't fabricate) and ③ (AI narrates, never computes) VISIBLE on the
// AIOS/Automation page and the Risk Radar.
//
// Each fabricated literal becomes either:
//   • COMPUTE  → a Metric with a real, recomputed value + provenance
//                (the computed value DIFFERS from the literal — the point), OR
//   • REFUSE   → { value:null, confidence:'insufficient', note }, OR
//   • a cited QUALITATIVE BAND derived from real signals.
// NEVER a fabricated precise number on a trust surface.
//
// This file is the FAILING contract. The BUILDER makes it green by
// editing aios.ts + intelligence.ts + the render sites per
// backend/spike/SLICE-3-CONTRACT.md. Reviewer MUST NOT implement.
//
// Determinism: every expected value is RECOMPUTED from the same source
// arrays the producer reads (projectsA / members / payments / auditTasks),
// never a hardcoded literal, never the wall clock.
// ============================================================

import { describe, it, expect } from "vitest";
import { aiosKpis, auditSummary, auditTasks } from "@/lib/archintel/aios";
import { predictedRisks, RISK_ANSWERS } from "@/lib/archintel/intelligence";
import { projectsA, members } from "@/lib/archintel/data";
import type { Confidence } from "@/lib/types";

// ---- The LITERALS_TO_REPLACE (CONTEXT.md). None may reach a trust ----
// ---- surface as a bare number without a confidence field.         ----
const FAB_RISK_LIKELIHOODS = [86, 64, 58, 47, 72];
const VALID_CONFIDENCE: Confidence[] = ["high", "medium", "low", "insufficient"];

// Recompute the honest `output` from the SAME live arrays the producer reads.
// Active projects ÷ design staff (role === 'designer', per SLICE-3-CONTRACT §1).
const ACTIVE = projectsA.filter((p) => p.status === "active").length;
const DESIGNERS = members.filter((m) => m.role === "designer").length;
const EXPECTED_OUTPUT = ACTIVE / DESIGNERS; // 6 / 2 = 3.0  (NOT the fabricated 1.5)

// Helpers tolerant of either treatment shape the builder may choose.
function kpiByKey(key: string) {
  return aiosKpis().find((k) => k.key === key) as Record<string, unknown> | undefined;
}
function isRefusal(x: unknown): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    "value" in (x as object) &&
    (x as { value: unknown }).value === null &&
    "confidence" in (x as object) &&
    (x as { confidence: unknown }).confidence === "insufficient"
  );
}
function confidenceOf(x: unknown): unknown {
  return typeof x === "object" && x !== null ? (x as { confidence?: unknown }).confidence : undefined;
}

// ============================================================
describe("Slice 3 — aiosKpis() literals neutralized [promises ②③ / LITERALS_TO_REPLACE]", () => {
  it("sanity: the recompute inputs are non-vacuous (guards a false green)", () => {
    expect(ACTIVE).toBeGreaterThan(0);
    expect(DESIGNERS).toBeGreaterThan(0);
    // The honest value must DIFFER from the fabricated literal, or the whole
    // exercise is pointless. 6/2 = 3.0 ≠ 1.5.
    expect(EXPECTED_OUTPUT).not.toBe(1.5);
  });

  it("[COMPUTE] `output` is a Metric with a COMPUTED value (active ÷ designers), NOT 1.5", () => {
    const output = kpiByKey("output");
    expect(output, "aiosKpis() must still expose an `output` entry").toBeTruthy();
    // It must no longer be a bare ratio number 1.5.
    expect(output!.value).not.toBe(1.5);
    // It must equal the deterministic recompute over the live arrays.
    expect(output!.value).toBe(EXPECTED_OUTPUT);
    // It must carry trust metadata (a Metric, not a bare number).
    expect(VALID_CONFIDENCE).toContain(output!.confidence as Confidence);
    expect(Array.isArray(output!.sources)).toBe(true);
    expect((output!.sources as unknown[]).length).toBeGreaterThan(0);
  });

  it("[COMPUTE/① drillable] `output` sources trace to real active projects + designer members", () => {
    const output = kpiByKey("output")!;
    const sources = output.sources as Array<{ recordRef?: string }>;
    const refs = sources.map((s) => String(s.recordRef ?? ""));
    const activeIds = projectsA.filter((p) => p.status === "active").map((p) => p.id);
    const designerIds = members.filter((m) => m.role === "designer").map((m) => m.id);
    // every active project and every designer must be citable somewhere in the lineage
    for (const id of activeIds) {
      expect(refs.some((r) => r.includes(id)), `output lineage must cite project ${id}`).toBe(true);
    }
    for (const id of designerIds) {
      expect(refs.some((r) => r.includes(id)), `output lineage must cite designer ${id}`).toBe(true);
    }
  });

  it("[REFUSE] `autonomy` is the refusal shape {value:null, confidence:'insufficient', note}, NOT 64", () => {
    const autonomy = kpiByKey("autonomy");
    expect(autonomy, "aiosKpis() must still expose an `autonomy` entry").toBeTruthy();
    // The fabricated 64 must be gone.
    expect(autonomy!.value).not.toBe(64);
    // It must be an honest refusal — null value + 'insufficient' confidence.
    expect(autonomy!.value).toBeNull();
    expect(autonomy!.confidence).toBe("insufficient");
    // A refusal must say WHY there is no basis.
    expect(typeof autonomy!.note).toBe("string");
    expect((autonomy!.note as string).length).toBeGreaterThan(0);
  });

  it("[COMPUTE/stamped] `automated` carries a confidence (not a bare number) and keeps its computed value", () => {
    const automated = kpiByKey("automated");
    expect(automated, "aiosKpis() must still expose an `automated` entry").toBeTruthy();
    // Confidence must be PRESENT (a bare number has none) and valid.
    expect(VALID_CONFIDENCE).toContain(automated!.confidence as Confidence);
    // The value stays the live computed automation % from auditSummary.
    const expectedPct = auditSummary(auditTasks).pct;
    expect(automated!.value).toBe(expectedPct);
  });

  it("[② guard] aiosKpis() exposes no entry whose value is a LITERAL_TO_REPLACE (64 or 1.5)", () => {
    for (const k of aiosKpis() as Array<{ value: unknown }>) {
      expect(k.value).not.toBe(64);
      expect(k.value).not.toBe(1.5);
    }
  });

  it("[② guard] every aiosKpis() entry carries a confidence field", () => {
    for (const k of aiosKpis() as Array<{ key: string; confidence?: unknown }>) {
      expect(VALID_CONFIDENCE, `KPI '${k.key}' must carry a valid confidence`).toContain(
        k.confidence as Confidence,
      );
    }
  });
});

// ============================================================
describe("Slice 3 — predictedRisks likelihood is band-or-refuse, never a fabricated % [promise ②]", () => {
  it("no predicted risk exposes a bare numeric likelihood at all", () => {
    expect(predictedRisks.length).toBeGreaterThan(0);
    for (const r of predictedRisks as Array<{ likelihood: unknown }>) {
      // The whole point: `likelihood` is no longer a bare number (a fabricated %).
      expect(typeof r.likelihood).not.toBe("number");
    }
  });

  it("the specific fabricated likelihoods 86/64/58/47/72 are gone", () => {
    for (const r of predictedRisks as Array<{ likelihood: unknown }>) {
      // works whether likelihood is now an object (band/refusal) or string band
      const probed =
        typeof r.likelihood === "object" && r.likelihood !== null
          ? (r.likelihood as { value?: unknown })
          : { value: r.likelihood };
      expect(FAB_RISK_LIKELIHOODS).not.toContain(probed.value as number);
      expect(FAB_RISK_LIKELIHOODS).not.toContain(r.likelihood as number);
    }
  });

  it("each likelihood is EITHER an insufficient refusal OR a cited qualitative band", () => {
    for (const r of predictedRisks as Array<{ likelihood: unknown }>) {
      const L = r.likelihood;
      const refusal = isRefusal(L);
      const band =
        typeof L === "object" &&
        L !== null &&
        typeof (L as { band?: unknown }).band === "string" &&
        Array.isArray((L as { basis?: unknown }).basis) &&
        ((L as { basis: unknown[] }).basis.length > 0);
      expect(refusal || band, "likelihood must be a refusal OR a cited band").toBe(true);
      // either way it must carry a confidence (no fabricated-confidence number)
      expect(VALID_CONFIDENCE).toContain(confidenceOf(L) as Confidence);
    }
  });
});

// ============================================================
describe("Slice 3 — RISK_ANSWERS prose no longer echoes fabricated percentages [promise ③]", () => {
  it("no answer body contains a fabricated risk likelihood or a precise '% likely' figure", () => {
    for (const a of Object.values(RISK_ANSWERS)) {
      const body = a.body;
      // the exact fabricated numbers must not survive as risk likelihoods
      for (const n of FAB_RISK_LIKELIHOODS) {
        expect(body, `RISK_ANSWERS body must not echo fabricated ${n}`).not.toMatch(
          new RegExp(`\\b${n}\\b`),
        );
      }
      // and no precise "NN% likely / likely to ..." fabricated probability
      expect(body, "RISK_ANSWERS body must not state a precise % likelihood").not.toMatch(
        /\d{1,3}\s*%\s*(likely|likelihood|chance|probable)/i,
      );
    }
  });
});
