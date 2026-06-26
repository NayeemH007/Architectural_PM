// ============================================================
// Step 1 — CLOCK UNIFICATION · ACCEPTANCE LEDGER (reviewer-authored, RED today)
// ------------------------------------------------------------
// Closes F7. THREE date authorities exist today and disagree:
//   A1  format.ts  daysFromNow → new Date("2026-06-17")
//   A2  data.ts / aios.ts / Approvals.tsx → TODAY = "2026-06-22"
//   A3  format.ts  relative()  → wall clock (formatDistanceToNowStrict)
// This ledger asserts ONE injected `as_of`:
//   (a) grep-guard: no shipped module carries a literal date anchor
//       (2026-06-17 / a standalone TODAY="2026-06-22" / new Date("…")).
//   (b) daysFrom/relativeTo compute from the injected as_of — pinning
//       2026-06-22 reproduces today (pm10 → -18), advancing 2026-06-24 → -20,
//       relativeTo is pure (never Date.now()).
//   (c) the frontend literals are slated for removal (the single permitted
//       2026-06-22 lives only in clock.ts).
//
// This file is the FAILING contract. The BUILDER makes it green by adding
// app/src/lib/clock.ts and removing the three anchors per
// backend/spike/CONTRACT-clock-unify.md. Reviewer MUST NOT implement.
//
// RED today because:
//   • app/src/lib/clock.ts does not exist (import throws), AND
//   • the literal anchors (A1/A2/A3) are still present in the shipped tree.
//
// Determinism: every as_of is injected; no test reads the wall clock.
// ============================================================

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, "../../.."); // app/src

const AS_OF_PINNED = "2026-06-22";
const AS_OF_ADVANCED = "2026-06-24";
// pm10 (data.ts) — the live oracle row: Concept sign-off, due 2026-06-04.
const PM10_DUE = "2026-06-04";

// --- recursively collect shipped .ts/.tsx under app/src, excluding tests + clock.ts ---
function shippedFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (name === "__tests__" || name === "node_modules") continue;
      out.push(...shippedFiles(full));
    } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

// clock.ts is the SOLE permitted home of the 2026-06-22 literal.
const CLOCK_FILE = path.join(SRC, "lib", "clock.ts");
function isClockFile(f: string) {
  return path.resolve(f) === path.resolve(CLOCK_FILE);
}

// ============================================================
// (a) [F7] GREP-GUARD — no shipped module carries a literal date anchor.
//   Forbidden anywhere outside clock.ts (and tests):
//     • the legacy anchor 2026-06-17
//     • a standalone TODAY = "<date>" const
//     • new Date("<hardcoded date>")
// ============================================================
describe("(a) [F7] grep-guard: no shipped module carries a literal date anchor", () => {
  const files = shippedFiles(SRC);

  it("sanity: the shipped-file crawl is non-vacuous (guards a false green)", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("no shipped module hardcodes the legacy 2026-06-17 clock anchor", () => {
    // Scope to the clock-ANCHOR form only — NOT incidental mock-data dates that
    // happen to equal 2026-06-17 (e.g. a FileRecord uploadedDate). The legacy
    // anchor was `new Date("2026-06-17")` in format.ts:daysFromNow; a bare
    // substring guard wrongly policed unrelated demo data (orchestrator fix).
    const re = /new\s+Date\(\s*["'`]2026-06-17|TODAY\s*=\s*["'`]2026-06-17/;
    const offenders = files.filter((f) => re.test(readFileSync(f, "utf8")));
    expect(
      offenders.map((f) => path.relative(SRC, f)),
      "the legacy 2026-06-17 clock anchor must be deleted (format.ts:daysFromNow)",
    ).toEqual([]);
  });

  it("no shipped module (except clock.ts) declares a standalone TODAY date const", () => {
    // matches  export const TODAY = "2026-..."  |  const TODAY = "2026-..."
    const re = /\bconst\s+TODAY\s*=\s*["'`]\d{4}-\d{2}-\d{2}/;
    const offenders = files
      .filter((f) => !isClockFile(f))
      .filter((f) => re.test(readFileSync(f, "utf8")));
    expect(
      offenders.map((f) => path.relative(SRC, f)),
      "TODAY date literals (data.ts, aios.ts, Approvals.tsx) must come from clock.ts",
    ).toEqual([]);
  });

  it("no shipped module (except clock.ts) hardcodes a date inside new Date(\"…\")", () => {
    const re = /new\s+Date\(\s*["'`]\d{4}-\d{2}-\d{2}/;
    const offenders = files
      .filter((f) => !isClockFile(f))
      .filter((f) => re.test(readFileSync(f, "utf8")));
    expect(
      offenders.map((f) => path.relative(SRC, f)),
      "hardcoded new Date(\"YYYY-MM-DD\") anchors must be replaced by the injected as_of",
    ).toEqual([]);
  });

  it("the single permitted 2026-06-22 literal lives in clock.ts (one clock authority)", () => {
    // Once the builder lands clock.ts it should carry the canonical literal; until
    // then this also stays RED, naming the missing single-authority file.
    let body = "";
    try {
      body = readFileSync(CLOCK_FILE, "utf8");
    } catch {
      throw new Error(
        "RED: app/src/lib/clock.ts is missing — the builder must add the single " +
          "as_of authority (AS_OF / AS_OF_DATE / daysFrom / relativeTo).",
      );
    }
    expect(body).toContain("2026-06-22");
  });
});

// ============================================================
// (b) [F7] ONE INJECTED as_of — daysFrom/relativeTo compute from it.
//   These import the builder's clock.ts; RED until it exists.
// ============================================================
describe("(b) [F7] aging/relative compute from one injected as_of", () => {
  it("daysFrom(pm10.due, 2026-06-22) === -18 (reproduces the live '18 days overdue')", async () => {
    const { daysFrom } = await import("@/lib/clock");
    expect(daysFrom(PM10_DUE, AS_OF_PINNED)).toBe(-18);
  });

  it("daysFrom advances deterministically: (pm10.due, 2026-06-24) === -20", async () => {
    const { daysFrom } = await import("@/lib/clock");
    expect(daysFrom(PM10_DUE, AS_OF_ADVANCED)).toBe(-20);
  });

  it("daysFrom defaults to the pinned as_of when none is injected (=== -18 for pm10)", async () => {
    const { daysFrom } = await import("@/lib/clock");
    // default anchor must be 2026-06-22, NOT the legacy 2026-06-17 (which gives -13).
    expect(daysFrom(PM10_DUE)).toBe(-18);
    expect(daysFrom(PM10_DUE)).not.toBe(-13);
  });

  it("relativeTo is pure — same (iso, as_of) yields the same string, never Date.now()", async () => {
    const { relativeTo } = await import("@/lib/clock");
    const a = relativeTo(PM10_DUE, AS_OF_PINNED);
    const b = relativeTo(PM10_DUE, AS_OF_PINNED);
    expect(a).toBe(b);
    expect(typeof a).toBe("string");
    // advancing the clock must change the relative string (it is anchored, not wall-clock).
    const later = relativeTo(PM10_DUE, AS_OF_ADVANCED);
    expect(later).not.toBe(a);
  });

  it("the exposed as_of constants are the locked oracle 2026-06-22", async () => {
    const clock = await import("@/lib/clock");
    expect(clock.AS_OF_DATE).toBe("2026-06-22");
    expect(clock.AS_OF).toMatch(/^2026-06-22T/);
  });
});

// ============================================================
// (c) [F7] LOAD-BEARING DEFECT — the anchor correction moves a displayed number.
//   Documents (and pins) that 13d→18d is the INTENDED change, so a builder
//   cannot "preserve" the wrong 2026-06-17 value to keep an old snapshot green.
// ============================================================
describe("(c) [F7] correcting the anchor moves the overdue Badge 13 → 18 (intended)", () => {
  it("legacy anchor 2026-06-17 would render 13d; locked anchor 2026-06-22 renders 18d", async () => {
    const { daysFrom } = await import("@/lib/clock");
    // The locked oracle value the Badge MUST now show.
    expect(Math.abs(daysFrom(PM10_DUE, AS_OF_PINNED)!)).toBe(18);
    // The legacy value the Badge USED to show — must no longer be the default.
    expect(Math.abs(daysFrom(PM10_DUE)!)).not.toBe(13);
  });
});
