// ============================================================
// serialize.mjs — the finance-BAND response filter (BUILD-CONTRACT §3).
//
// RLS gives TENANT isolation; this serializer enforces the finance band
// WITHIN a tenant (doc 14:164 — a response filter, not DOM hiding). The
// tests call these directly; a real JWT/HTTP layer is a later phase.
//
// Rules:
//   * Finance-eligible principal (role 'founder' or 'finance', or a future
//     finance grant) → money fields pass through unchanged.
//   * Non-finance principal (e.g. 'designer') → every money key is OMITTED
//     (key ABSENT, NOT present-with-null) — promise ⑤ band.
//   * If a money figure is carried as a Metric envelope, the non-finance
//     refusal shape is exactly { value: null, confidence: 'insufficient' }
//     (plus any non-money metadata) — never a computed/fake number (promise ②).
// ============================================================

// Money keys to redact for non-finance principals (all casing variants the
// tests probe; matched case-insensitively so snake/camel both fall).
const MONEY_KEYS = new Set(
  [
    "contract_value",
    "contractValue",
    "amount",
    "gross_amount",
    "net_receivable",
    "margin",
    "overdueAmount",
    "overdueamount",
    "totalContract",
    "totalcontract",
    "total_contract",
    "received",
    "billable",
    "collection_rate",
    "collectionRate",
    "receivables",
    "received_amount",
    "vat",
    "vds_withheld",
    "ait_withheld",
  ].map((k) => k.toLowerCase()),
);

function isFinanceEligible(principal) {
  if (!principal || typeof principal !== "object") return false;
  const role = String(principal.role ?? "").toLowerCase();
  if (role === "founder" || role === "finance") return true;
  // future-proof: an explicit finance grant flips the band on.
  if (principal.financeGrant === true) return true;
  return false;
}

function isMoneyKey(key) {
  return MONEY_KEYS.has(String(key).toLowerCase());
}

// A Metric envelope is { value, confidence, ... } (types.ts:50-62).
function isMetric(v) {
  return v && typeof v === "object" && "value" in v && "confidence" in v;
}

// Refused Metric for a non-finance principal: preserves non-money metadata
// (label/unit/asOf/…) but blanks the number and marks it insufficient (②).
function refuseMetric(metric) {
  return { ...metric, value: null, confidence: "insufficient" };
}

/**
 * Redact one plain object for the given principal.
 * Finance-eligible → returned as-is. Non-finance → money keys omitted; money
 * Metrics rewritten to the refusal shape.
 */
function redactRow(row, principal) {
  if (row == null || typeof row !== "object") return row;
  if (isFinanceEligible(principal)) return { ...row };

  const out = {};
  for (const [k, v] of Object.entries(row)) {
    if (isMoneyKey(k)) {
      // Money figure carried as a Metric → emit the refusal envelope (②).
      if (isMetric(v)) {
        out[k] = refuseMetric(v);
      }
      // Otherwise OMIT entirely (absent, not present-with-null).
      continue;
    }
    out[k] = v;
  }
  return out;
}

// ── Slice 2b (G1): build the overdueAmount Metric envelope FROM kpi_lineage ──
// The Metric shape is identical to Slice-2a's frontend Metric (types.ts:50-62)
// so the backend swap is drop-in. value = Σ contribution_value (coerced from the
// pg-numeric STRING → Number); sources[] are ONE per lineage row with the REAL
// record_ref from kpi_lineage (e.g. 'tally:pm10') — NOT synthesized.
function buildOverdueMetric(summaryRow, lineageRows) {
  const value = lineageRows.reduce((s, r) => s + Number(r.contribution_value), 0);

  const sources = lineageRows.map((r) => ({
    sourceId: String(r.source_id),
    sourceName: "TallyPrime",
    recordRef: r.record_ref,
    observedAt: toIso(r.observed_at),
  }));

  return {
    value,
    unit: "bdt",
    label: `Overdue payments (gross) — ${lineageRows.length} milestone${lineageRows.length === 1 ? "" : "s"}`,
    confidence: "low", // ⑤ tax DEFERRED → gross figure is low-trust
    completeness: 100, // gross-complete at the milestone grain (not net)
    asOf: toIso(summaryRow?.as_of),
    formula: "Σ (gross_amount − received_amount) over status='overdue' milestones",
    note: "Gross overdue receivable — VAT/VDS/AIT withholding not modeled.",
    sources,
  };
}

// Coerce a pg timestamptz (Date | ISO string) to a non-empty ISO string.
function toIso(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/**
 * serializeOverview(row, lineageRows, principal)  — 2b full form
 * serializeOverview(row, principal)               — 2a/spike form (still valid)
 *
 * ARITY DETECTION (REQUIRED so spike.acceptance.test.mjs stays byte-compatible):
 *   - 2nd arg is an Array → it is `lineageRows`; the 3rd arg is the principal.
 *   - else → the 2nd arg is the principal; no lineage rows (no Metric synthesized).
 *
 * row: a raw mart.portfolio_summary row (snake/lower-case keys).
 */
export function serializeOverview(row, a, b) {
  const [lineageRows, principal] = Array.isArray(a) ? [a, b] : [[], a];

  // 2a/spike form (no lineage): preserve the original byte-compatible behaviour —
  // redact for non-finance, raw bare scalars for finance. No Metric synthesized.
  if (lineageRows.length === 0) {
    return redactRow(row, principal);
  }

  // 2b full form: build the overdueAmount Metric from lineage, then apply the
  // SAME band redaction so a non-finance principal never sees the money figure.
  const overdueAmount = buildOverdueMetric(row, lineageRows);
  // Drop the raw bare overdue scalar(s) from the row, replace with the Metric,
  // then redact — the serializer's money-key set covers overdueAmount/overdueamount
  // so a designer gets it OMITTED (or refused, since it is now a Metric).
  const { overdueAmount: _oa, overdueamount: _oal, ...rest } = row ?? {};
  return redactRow({ ...rest, overdueAmount }, principal);
}

/**
 * serializeClients(rows, principal) -> array
 * Same redaction applied per client row.
 */
export function serializeClients(rows, principal) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => redactRow(r, principal));
}

export default { serializeOverview, serializeClients };
