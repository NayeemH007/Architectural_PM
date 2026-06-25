// ============================================================
// Slice 4 — ACCEPTANCE LEDGER (reviewer-authored, RED today)
// ------------------------------------------------------------
// Finishes the frontend trust surface: neutralizes the REMAINING
// hand-authored fabricated numbers and envelopes the REAL KPIs still
// rendered as bare numbers, so promises ①②③ hold across the whole
// headline surface (Dashboard / Finance / Intelligence cards).
//
// Each item is COMPUTE → Metric (real recomputed value + provenance),
// REFUSE → {value:null, confidence:'insufficient', note}, or a cited
// qualitative BAND {band, basis[], confidence}. Never a fabricated
// precise number, never a bare trust number on a headline card.
//
// This file is the FAILING contract. The BUILDER makes it green by
// editing intelligence.ts + finance.ts + api.ts + the render sites per
// backend/spike/SLICE-4-CONTRACT.md. Reviewer MUST NOT implement.
//
// Determinism: every expected value is RECOMPUTED from the same source
// arrays the producer reads (payments / approvalsA / projectsA), never a
// hardcoded literal, never the wall clock.
// ============================================================

import { describe, it, expect } from "vitest";
import { managementOverview } from "@/lib/archintel/api";
import { financeOverview, profitabilityByProject } from "@/lib/archintel/finance";
import { stageRisk, riskInsights, RISK_ANSWERS } from "@/lib/archintel/intelligence";
import { payments, approvalsA, projectsA } from "@/lib/archintel/data";
import type { Confidence } from "@/lib/types";

const VALID_CONFIDENCE: Confidence[] = ["high", "medium", "low", "insufficient"];

// ---- The remaining fabricated stage-risk indices (CONTEXT LITERALS_TO_REPLACE).
const FAB_STAGE_INDEX = [22, 81, 64, 48];

// ---- Deterministic recomputes from the SAME source arrays the producers read.
const RECEIVED = payments.reduce((s, p) => s + p.receivedAmount, 0);
const BILLABLE = payments.reduce((s, p) => s + p.amount, 0);
const RECEIVABLES = payments
  .filter((p) => p.status !== "paid")
  .reduce((s, p) => s + (p.amount - p.receivedAmount), 0);
const EXPECTED_COLLECTION = BILLABLE ? Math.round((RECEIVED / BILLABLE) * 100) : 0;
const PENDING = approvalsA.filter((a) => a.status === "pending");
const EXPECTED_PENDING = PENDING.length;

// ---- shape helpers tolerant of either treatment the builder may choose ----
function isMetric(x: unknown): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    "confidence" in (x as object) &&
    "sources" in (x as object) &&
    "value" in (x as object)
  );
}
function isRefusal(x: unknown): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    (x as { value?: unknown }).value === null &&
    (x as { confidence?: unknown }).confidence === "insufficient"
  );
}
function isBand(x: unknown): boolean {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { band?: unknown }).band === "string" &&
    Array.isArray((x as { basis?: unknown }).basis) &&
    (x as { basis: unknown[] }).basis.length > 0
  );
}
function confidenceOf(x: unknown): unknown {
  return typeof x === "object" && x !== null ? (x as { confidence?: unknown }).confidence : undefined;
}
function numericValue(x: unknown): unknown {
  // a Metric carries .value; a bare number is itself the value
  if (typeof x === "object" && x !== null && "value" in (x as object)) {
    return (x as { value: unknown }).value;
  }
  return x;
}

// ============================================================
describe("Slice 4 — sanity: recompute inputs are non-vacuous (guards a false green)", () => {
  it("the live arrays produce the signals this ledger relies on", () => {
    expect(BILLABLE).toBeGreaterThan(0);
    expect(RECEIVED).toBeGreaterThan(0);
    expect(EXPECTED_PENDING).toBeGreaterThan(0);
    expect(stageRisk.length).toBeGreaterThan(0);
    // NOTE (orchestrator fix): the "fabricated indices present today" probe was
    // removed — it read the LIVE post-fix array and so was self-contradictory with
    // the §A1 assertions (riskIndex gone) in this same always-run suite. The RED
    // baseline already proved the indices existed; killing them stays asserted below.
  });
});

// ============================================================
describe("Slice 4 — managementOverview() bare KPIs become cited Metrics [① / ⑤]", () => {
  it("[B1 COMPUTE] collectionRate is a gross low-confidence Metric, NOT a bare number", () => {
    const ov = managementOverview();
    const cr = ov.collectionRate as unknown;
    expect(typeof cr).not.toBe("number");
    expect(isMetric(cr)).toBe(true);
    // value === the deterministic recompute (received ÷ billable, gross)
    expect(numericValue(cr)).toBe(EXPECTED_COLLECTION);
    // gross stamp (⑤ tax DEFERRED)
    expect(confidenceOf(cr)).toBe("low");
    const note = (cr as { note?: unknown }).note;
    expect(typeof note).toBe("string");
    expect(note as string).toMatch(/gross|withhold/i);
    // drillable
    const sources = (cr as { sources?: unknown[] }).sources ?? [];
    expect(Array.isArray(sources)).toBe(true);
    expect(sources.length).toBeGreaterThan(0);
  });

  it("[B2 COMPUTE] pendingApprovals is a complete count Metric citing the approval records, NOT a bare number", () => {
    const ov = managementOverview();
    const pa = ov.pendingApprovals as unknown;
    expect(typeof pa).not.toBe("number");
    expect(isMetric(pa)).toBe(true);
    expect(numericValue(pa)).toBe(EXPECTED_PENDING);
    // a present, valid confidence (contract: 'high' — a complete internal count)
    expect(VALID_CONFIDENCE).toContain(confidenceOf(pa) as Confidence);
    // one source per pending approval, each ref tracing to a real approval id
    const sources = ((pa as { sources?: Array<{ recordRef?: string }> }).sources ?? []);
    expect(sources.length).toBe(EXPECTED_PENDING);
    const refs = sources.map((s) => String(s.recordRef ?? ""));
    for (const a of PENDING) {
      expect(refs.some((r) => r.includes(a.id)), `pendingApprovals lineage must cite ${a.id}`).toBe(true);
    }
  });
});

// ============================================================
describe("Slice 4 — financeOverview() headline figures are cited Metrics [① / ⑤]", () => {
  const HEADLINE = ["income", "billable", "receivables", "collectionRate"] as const;

  it("[B4] each headline figure is a Metric carrying a confidence, not a bare number", () => {
    const fin = financeOverview() as Record<string, unknown>;
    for (const key of HEADLINE) {
      const m = fin[key];
      expect(typeof m, `finance.${key} must not be a bare number`).not.toBe("number");
      expect(isMetric(m), `finance.${key} must be a Metric`).toBe(true);
      expect(VALID_CONFIDENCE, `finance.${key} must carry a valid confidence`).toContain(
        confidenceOf(m) as Confidence,
      );
    }
  });

  it("[B4 VALUE=Σ] income / billable / receivables / collectionRate values equal the recompute over payments", () => {
    const fin = financeOverview() as Record<string, unknown>;
    expect(numericValue(fin.income)).toBe(RECEIVED);
    expect(numericValue(fin.billable)).toBe(BILLABLE);
    expect(numericValue(fin.receivables)).toBe(RECEIVABLES);
    expect(numericValue(fin.collectionRate)).toBe(EXPECTED_COLLECTION);
  });

  it("[B4 ⑤ gross] income / receivables / collectionRate are stamped low with a gross/withholding note + drillable sources", () => {
    const fin = financeOverview() as Record<string, unknown>;
    for (const key of ["income", "receivables", "collectionRate"] as const) {
      const m = fin[key];
      expect(confidenceOf(m), `finance.${key} should be gross-low`).toBe("low");
      const note = (m as { note?: unknown }).note;
      expect(typeof note, `finance.${key} needs a gross note`).toBe("string");
      expect(note as string).toMatch(/gross|withhold/i);
      const sources = (m as { sources?: unknown[] }).sources ?? [];
      expect(Array.isArray(sources)).toBe(true);
      expect((sources as unknown[]).length, `finance.${key} must cite its lineage`).toBeGreaterThan(0);
    }
  });
});

// ============================================================
describe("Slice 4 — profitabilityByProject() margin is fee-only low, never a bare margin [④]", () => {
  it("[B5] no row exposes a bare numeric margin lacking a confidence", () => {
    const rows = profitabilityByProject() as Array<Record<string, unknown>>;
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      // accept either: margin is itself a Metric, OR a parallel marginMetric carries the trust.
      const marginIsBareNumber = typeof row.margin === "number";
      const marginMetric = (row.marginMetric ?? (typeof row.margin === "object" ? row.margin : undefined)) as
        | Record<string, unknown>
        | undefined;
      expect(
        !marginIsBareNumber || marginMetric !== undefined,
        "a bare numeric margin must be accompanied by a marginMetric carrying confidence",
      ).toBe(true);
      expect(marginMetric, "row must carry a margin Metric (margin or marginMetric)").toBeTruthy();
      expect(VALID_CONFIDENCE).toContain(confidenceOf(marginMetric) as Confidence);
    }
  });

  it("[B5 ④] the margin Metric is confidence='low' with a fee-only / labour / modeled note + cited sources", () => {
    const rows = profitabilityByProject() as Array<Record<string, unknown>>;
    for (const row of rows) {
      const marginMetric = (row.marginMetric ?? (typeof row.margin === "object" ? row.margin : undefined)) as
        | Record<string, unknown>
        | undefined;
      expect(marginMetric).toBeTruthy();
      expect(confidenceOf(marginMetric)).toBe("low");
      const note = (marginMetric as { note?: unknown }).note;
      expect(typeof note).toBe("string");
      expect(note as string).toMatch(/fee-only|labour|labor|modeled|modelled/i);
      const sources = (marginMetric as { sources?: unknown[] }).sources ?? [];
      expect(Array.isArray(sources)).toBe(true);
      expect((sources as unknown[]).length).toBeGreaterThan(0);
    }
  });

  it("[B5 VALUE] the margin value equals the deterministic per-project recompute", () => {
    const rows = profitabilityByProject() as Array<Record<string, unknown>>;
    for (const row of rows) {
      const project = (row.project ?? {}) as { id?: string; contractValue?: number };
      const contract = (row.contract as number) ?? project.contractValue ?? 0;
      const cost = (row.cost as number) ?? 0;
      const expected = contract ? Math.round(((contract - cost) / contract) * 100) : 0;
      const marginMetric = (row.marginMetric ?? (typeof row.margin === "object" ? row.margin : undefined)) as
        | Record<string, unknown>
        | undefined;
      const got = marginMetric ? numericValue(marginMetric) : row.margin;
      expect(got, `margin for ${project.id} must be the recompute`).toBe(expected);
    }
  });
});

// ============================================================
describe("Slice 4 — stageRisk[].riskIndex fabrications (22/81/64/48) are neutralized [②]", () => {
  it("no stage exposes a bare numeric riskIndex at all", () => {
    for (const s of stageRisk as Array<Record<string, unknown>>) {
      expect(typeof s.riskIndex, "stageRisk must no longer carry a bare numeric riskIndex").not.toBe("number");
    }
  });

  it("the specific fabricated indices 22/81/64/48 are gone", () => {
    for (const s of stageRisk as Array<Record<string, unknown>>) {
      // probe both the (removed) riskIndex and a new band/refusal `risk` field
      const probedIndex = s.riskIndex;
      expect(FAB_STAGE_INDEX).not.toContain(probedIndex as number);
      const risk = s.risk ?? s.riskIndex;
      expect(FAB_STAGE_INDEX).not.toContain(numericValue(risk) as number);
    }
  });

  it("each stage carries a refusal OR a cited band, with a present confidence", () => {
    for (const s of stageRisk as Array<Record<string, unknown>>) {
      const risk = s.risk;
      const ok = isRefusal(risk) || isBand(risk);
      expect(ok, `stage '${String(s.stage)}' risk must be a refusal or a cited band`).toBe(true);
      expect(VALID_CONFIDENCE).toContain(confidenceOf(risk) as Confidence);
    }
  });
});

// ============================================================
describe("Slice 4 — prose no longer echoes the fabricated stage index [③]", () => {
  it("no RISK_ANSWERS body or ref contains the fabricated 81 / an NN/100 stage index", () => {
    for (const a of Object.values(RISK_ANSWERS)) {
      const haystacks = [a.body, ...(a.refs ?? [])];
      for (const h of haystacks) {
        expect(h, "RISK_ANSWERS must not echo the fabricated 81").not.toMatch(/\b81\b/);
        expect(h, "RISK_ANSWERS must not echo an NN/100 stage index").not.toMatch(/\b\d{1,3}\s*\/\s*100\b/);
      }
    }
  });

  it("no riskInsights title/detail embeds a fabricated index or NN/100 figure", () => {
    for (const ins of riskInsights) {
      for (const text of [ins.title, ins.detail]) {
        for (const n of FAB_STAGE_INDEX) {
          expect(text, `riskInsights must not embed fabricated ${n}`).not.toMatch(new RegExp(`\\b${n}\\b`));
        }
        expect(text, "riskInsights must not embed an NN/100 figure").not.toMatch(/\b\d{1,3}\s*\/\s*100\b/);
      }
    }
  });
});

// ============================================================
describe("Slice 4 — cross-cutting guard: no bare fabricated/trust number on the closed surfaces [②]", () => {
  it("stageRisk exposes no numeric riskIndex in the fabricated set", () => {
    const indices = (stageRisk as Array<Record<string, unknown>>).map((s) => s.riskIndex);
    for (const v of indices) expect(FAB_STAGE_INDEX).not.toContain(v as number);
  });

  it("managementOverview collectionRate + pendingApprovals both carry a confidence (not bare)", () => {
    const ov = managementOverview() as Record<string, unknown>;
    expect(VALID_CONFIDENCE).toContain(confidenceOf(ov.collectionRate) as Confidence);
    expect(VALID_CONFIDENCE).toContain(confidenceOf(ov.pendingApprovals) as Confidence);
  });
});
