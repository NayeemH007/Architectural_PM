// ============================================================
// semantic/profitability.mjs — profitabilityByProject() family (S3).
//
// Converts the live frontend profitabilityByProject() (finance.ts:135) to a
// pglite semantic function returning the SAME row shape
//   { project, contract, received, cost, profit, margin:Metric }
// so the ⑦ seam swap is drop-in.
//
// ④ coverage RETIRED → margin is ALWAYS a fee-only, low-confidence Metric:
//   * NEVER a bare number, NEVER 'insufficient' (we have a number, just low-trust).
//   * value = round((contract − modeled_cost) ÷ contract × 100) — read from the
//     kpi_lineage row recompute_profitability emits (one per project; VALUE = Σ).
//   * sources cite the contract (project:aN, real) + the modeled cost input
//     (model:PROJECT_COST:aN — a DECLARED input, not a measured source).
//
// PROJECT_COST is a CONTEXT non-migratable literal: it is NOT a canonical fact.
// recompute_profitability materialises it into mart.cost_model (the model
// surface) and the lineage join is real; this serializer cites it as the second
// source so the honesty mechanism (declared input, low confidence) is explicit.
//
// Finance band: margin is a money/finance percentage → a non-finance principal
// (designer) gets it refused ({value:null, confidence:'insufficient'}) via the
// shared redactRow machinery (margin is already a MONEY_KEY).
// ============================================================
import { redactRow } from "./serialize.mjs";

const KPI_VERSION = 1;
const MARGIN_NOTE = "Fee-only margin — no labour cost; PROJECT_COST is a modeled input, not measured.";

function toIso(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

/**
 * serializeProfitability(db, asOf, principal) → rows[].
 *   Each row: { project, contract, received, cost, profit, margin:Metric }.
 *   margin.value = the per-project margin lineage row (Σ over the 1 cited row).
 *   Band-redacted per row (designer → margin + money columns refused/omitted).
 */
export async function serializeProfitability(db, asOf, principal) {
  await db.query(`select set_config('request.company_id', $1, false)`, [principal.companyId]);
  await db.query(`select set_config('request.user_id', $1, false)`, [principal.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [principal.role ?? ""]);

  const v_company = principal.companyId;

  // Recompute the margin lineage (one row per active+archived project).
  const linRes = await db.query(
    `select * from mart.recompute_profitability($1::timestamptz, $2::int)`,
    [asOf, KPI_VERSION],
  );
  // A-3: explicit company predicate (superuser bypasses RLS).
  const marginRows = linRes.rows.filter((r) => String(r.company_id) === String(v_company));

  // Project + cost facts for the row body (contract / received / cost / profit).
  const projRes = await db.query(
    `select p.id, p.code, p.name, p.contract_value, p.status, p.company_id,
            coalesce(cm.modeled_cost, 0) as modeled_cost,
            coalesce(rcv.received, 0)    as received
       from canonical.project p
       left join mart.cost_model cm
         on cm.company_id = p.company_id and cm.project_id = p.id
       left join (
         select project_id, company_id, sum(received_amount) as received
           from canonical.payment_milestone
          where company_id = $1
          group by project_id, company_id
       ) rcv on rcv.project_id = p.id and rcv.company_id = p.company_id
      where p.company_id = $1
        and p.status in ('active','archived')
      order by p.id`,
    [v_company],
  );
  const projects = projRes.rows.filter((r) => String(r.company_id) === String(v_company));

  const marginByProject = new Map(marginRows.map((r) => [r.entity_id, r]));

  const rows = projects.map((p) => {
    const lin = marginByProject.get(p.id);
    const marginVal = lin ? Number(lin.contribution_value) : 0;
    const contract = Number(p.contract_value ?? 0);
    const cost = Number(p.modeled_cost ?? 0);
    const received = Number(p.received ?? 0);

    const margin = {
      value: marginVal,
      unit: "pct",
      label: `Margin (fee-only) — ${p.code}`,
      confidence: "low", // ④ fee-only, no labour cost; cost is a modeled input
      completeness: 60, // < 100 — labour cost absent, cost modeled not measured
      asOf: toIso(asOf),
      formula: "(contract − modeled project cost) ÷ contract",
      note: MARGIN_NOTE,
      sources: [
        {
          sourceId: "projects",
          sourceName: "ArchIntel · Projects",
          recordRef: `project:${p.id}`,
          observedAt: toIso(asOf),
        },
        {
          sourceId: "cost-model",
          sourceName: "ArchIntel · Cost model (modeled input)",
          recordRef: `model:PROJECT_COST:${p.id}`,
          observedAt: toIso(asOf),
        },
      ],
    };

    // Mirror the frontend row shape (finance.ts:156). `project` carries id/code/name.
    const row = {
      project: { id: p.id, code: p.code, name: p.name, status: p.status, contractValue: contract },
      contract,
      received,
      cost,
      profit: contract - cost,
      margin,
    };
    // Band redaction: designer → margin refused, money columns omitted.
    return redactRow(row, principal);
  });

  return rows;
}

export default serializeProfitability;
