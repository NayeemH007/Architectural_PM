// ============================================================
// semantic/finance.mjs — financeOverview() family, backend-backed (S3).
//
// Converts the live frontend financeOverview() (finance.ts:82) to a pglite
// semantic function returning the SAME object shape (income / billable /
// receivables / collectionRate as gross-low Metrics) so the ⑦ seam swap is
// drop-in. value = Σ over the cited milestone lineage (VALUE = Σ LINEAGE);
// each money figure is a Metric envelope (types.ts:50-62).
//
// Locked decisions honoured:
//   * ⑤ tax DEFERRED → gross figures, confidence:'low', GROSS_NOTE.
//   * A-5 → received/billable enveloped (Metric, never a bare pg-numeric STRING).
//   * Finance band → a non-finance principal (designer) gets every money key
//     OMITTED, money Metrics refused ({value:null, confidence:'insufficient'}).
//     Reuses redactRow/MONEY_KEYS from serialize.mjs (do not reinvent).
//   * monthlyFlow-derived ytd*/month* figures STAY frontend mock (PD-F) — the
//     backend serves ONLY the milestone-backed figures.
//
// pg-numeric arrives as a JS STRING under pglite → coerce to Number before
// building any Metric value (the bare-scalar half of G1/A-5).
// ============================================================
import { redactRow } from "./serialize.mjs";

const KPI_VERSION = 1;
const GROSS_NOTE = "Gross figure — VAT/VDS/AIT withholding not modeled.";

function toIso(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

// One Provenance per lineage row, with the REAL record_ref from kpi_lineage
// (e.g. 'tally:pm10') — drop-in popover parity with the frontend.
function provenanceFromLineage(rows) {
  return rows.map((r) => ({
    sourceId: String(r.source_id),
    sourceName: "TallyPrime",
    recordRef: r.record_ref,
    observedAt: toIso(r.observed_at),
  }));
}

// Build a gross-low BDT Metric from its lineage rows. value = Σ contribution.
function grossMetric(rows, asOf, label, formula) {
  const value = rows.reduce((s, r) => s + Number(r.contribution_value), 0);
  return {
    value,
    unit: "bdt",
    label,
    confidence: "low", // ⑤ tax DEFERRED → gross is low-trust
    completeness: 100, // gross-complete at the milestone grain (not net)
    asOf: toIso(asOf),
    formula,
    note: GROSS_NOTE,
    sources: provenanceFromLineage(rows),
  };
}

/**
 * Recompute the finance lineage for the principal at the pinned clock, read it
 * back, and build the financeOverview() object. Returns the RAW (unredacted)
 * Metric object; callers that need band-redaction use serializeFinance.
 */
async function computeFinance(db, asOf, principal) {
  await db.query(`select set_config('request.company_id', $1, false)`, [principal.companyId]);
  await db.query(`select set_config('request.user_id', $1, false)`, [principal.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [principal.role ?? ""]);

  const v_company = principal.companyId;
  const res = await db.query(
    `select * from mart.recompute_finance($1::timestamptz, $2::int)`,
    [asOf, KPI_VERSION],
  );
  // A-3: explicit company predicate on the lineage read (superuser bypasses RLS).
  const all = res.rows.filter((r) => String(r.company_id) === String(v_company));
  const income = all.filter((r) => r.metric_key === "income");
  const billable = all.filter((r) => r.metric_key === "billable");
  const receivables = all.filter((r) => r.metric_key === "receivables");

  const incomeMetric = grossMetric(income, asOf, "Income received (gross)", "Σ received_amount over payments");
  const billableMetric = grossMetric(billable, asOf, "Billable (gross)", "Σ amount over payments");
  const receivablesMetric = grossMetric(
    receivables, asOf, "Receivables outstanding (gross)", "Σ (amount − received) where status≠'paid'",
  );

  // collectionRate is a RATIO of two Σ's → derived from the income/billable
  // sums (NOT a fake per-row lineage). Cites the same milestone sources so the
  // popover is drillable. value = round(income ÷ billable × 100).
  const collectionVal = billableMetric.value
    ? Math.round((incomeMetric.value / billableMetric.value) * 100)
    : 0;
  const collectionRate = {
    value: collectionVal,
    unit: "pct",
    label: "Collection rate (gross)",
    confidence: "low",
    completeness: 100,
    asOf: toIso(asOf),
    formula: "Σ income ÷ Σ billable (gross)",
    note: "Gross collection — VAT/VDS/AIT withholding not modeled.",
    sources: provenanceFromLineage(billable),
  };

  return {
    income: incomeMetric,
    billable: billableMetric,
    receivables: receivablesMetric,
    collectionRate,
  };
}

/**
 * serializeFinance(db, asOf, principal) → financeOverview() shape, band-redacted.
 *   Finance-eligible → the gross-low Metrics pass through.
 *   Non-finance (designer) → every money Metric refused (value:null,
 *   confidence:'insufficient') / omitted, via the shared redactRow.
 */
export async function serializeFinance(db, asOf, principal) {
  const raw = await computeFinance(db, asOf, principal);
  return redactRow(raw, principal);
}

/**
 * serializeOverviewMoney(db, asOf, principal) → A-5 carried: the OTHER overview
 * money fields (received / total_contract / billable) as enveloped Metrics, NOT
 * bare pg strings. received === income (Σ received_amount); billable === Σ gross;
 * total_contract === Σ active project contract. Band-redacted like the rest.
 */
export async function serializeOverviewMoney(db, asOf, principal) {
  const fin = await computeFinance(db, asOf, principal);

  // total_contract: Σ active contract_value (a separate Σ, cited per project).
  const projRes = await db.query(
    `select id, contract_value, company_id
       from canonical.project
      where company_id = $1 and status = 'active'`,
    [principal.companyId],
  );
  const projRows = projRes.rows.filter((r) => String(r.company_id) === String(principal.companyId));
  const totalContractVal = projRows.reduce((s, p) => s + Number(p.contract_value ?? 0), 0);
  const totalContract = {
    value: totalContractVal,
    unit: "bdt",
    label: "Total active contract value (gross)",
    confidence: "low",
    completeness: 100,
    asOf: toIso(asOf),
    formula: "Σ contract_value over active projects",
    note: GROSS_NOTE,
    sources: projRows.map((p) => ({
      sourceId: "projects",
      sourceName: "ArchIntel · Projects",
      recordRef: `project:${p.id}`,
      observedAt: toIso(asOf),
    })),
  };

  const raw = {
    received: fin.income,        // received === income (Σ received_amount)
    total_contract: totalContract,
    billable: fin.billable,
  };
  return redactRow(raw, principal);
}

export default serializeFinance;
