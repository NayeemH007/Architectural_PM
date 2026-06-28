// ============================================================
// semantic/aios.mjs — the 3 AIOS KPIs + brief/actions/audit feeds (S3).
//
// Converts the live frontend aiosKpis() (aios.ts:81) to a pglite semantic
// function returning the SAME AiosKpi[] shape (aios.ts:67-81) so the ⑦ seam
// swap is drop-in. Matches the Slice-3 treatment EXACTLY:
//   * autonomy  → REFUSE: value null, confidence 'insufficient', empty sources,
//                 the honest "no intervention log yet" note. NEVER the 64.
//                 Emits NO kpi_lineage — its absence is the structural proof.
//   * output    → COMPUTE: active projects ÷ designers = 6 / 2 = 3.0 (NOT 1.5).
//                 value derived from the two lineage sub-counts (project:aN +
//                 member:mN). unit 'ratio', confidence 'low', completeness 100.
//   * automated → COMPUTE low: round(Σ task-credit ÷ #tasks × 100) over the
//                 audit-task lineage. confidence 'low' (editorial classification).
//
// AIOS is OPERATIONAL, not finance → NOT money-gated (no redactRow): any
// authenticated principal sees these (⑦ READ-ONLY-STRICT is a write concern,
// not a read band). dailyBrief / agentActions / auditTasks are prose/feed
// surfaces (no Metric) — served shape-preserving.
//
// audit-task statuses are a DECLARED editorial input (PD-H / D-AIOS-2): the
// status lives in canonical.audit_task (seeded), cited as auditTask:tN with the
// KPI stamped 'low'. The autonomy-refusal + the status classification are the
// editorial parts; output is the pure-computed real-data KPI.
// ============================================================

const KPI_VERSION = 1;

function toIso(v) {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString();
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toISOString();
}

async function setPrincipal(db, principal) {
  await db.query(`select set_config('request.company_id', $1, false)`, [principal.companyId]);
  await db.query(`select set_config('request.user_id', $1, false)`, [principal.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [principal.role ?? ""]);
}

/**
 * serializeAiosKpis(db, asOf, principal) → AiosKpi[]
 *   [autonomy(refused), automated(low), output(3.0)] — same ORDER as aios.ts.
 */
export async function serializeAiosKpis(db, asOf, principal) {
  await setPrincipal(db, principal);
  const v_company = principal.companyId;
  const asOfIso = toIso(asOf);

  const linRes = await db.query(
    `select * from mart.recompute_aios($1::timestamptz, $2::int)`,
    [asOf, KPI_VERSION],
  );
  // A-3: explicit company predicate (superuser bypasses RLS).
  const rows = linRes.rows.filter((r) => String(r.company_id) === String(v_company));
  const outputRows = rows.filter((r) => r.metric_key === "output");
  const automatedRows = rows.filter((r) => r.metric_key === "automated");

  // ── output: active ÷ designers, from the lineage sub-counts. ──
  const activeRows = outputRows.filter((r) => r.record_ref.startsWith("project:"));
  const designerRows = outputRows.filter((r) => r.record_ref.startsWith("member:"));
  const activeCount = activeRows.length;
  const designerCount = designerRows.length;
  const outputVal = designerCount ? activeCount / designerCount : 0;
  const outputSources = [
    ...activeRows.map((r) => ({
      sourceId: "archintel-projects",
      sourceName: "ArchIntel · Projects",
      recordRef: r.record_ref,
      observedAt: asOfIso,
    })),
    ...designerRows.map((r) => ({
      sourceId: "archintel-members",
      sourceName: "ArchIntel · Members",
      recordRef: r.record_ref,
      observedAt: asOfIso,
    })),
  ];

  // ── automated: round(Σ task-credit ÷ #tasks × 100). ──
  const totalTasks = automatedRows.length;
  const creditSum = automatedRows.reduce((s, r) => s + Number(r.contribution_value), 0);
  const automatedVal = totalTasks ? Math.round((creditSum / totalTasks) * 100) : 0;
  const automatedCount = automatedRows.filter((r) => Number(r.contribution_value) === 1).length;
  const automatedSources = automatedRows.map((r) => ({
    sourceId: "archintel-audit",
    sourceName: "ArchIntel · Task Audit",
    recordRef: r.record_ref,
    observedAt: asOfIso,
  }));

  return [
    // #2 autonomy — REFUSE. No signal exists; never fabricate 64.
    {
      key: "autonomy",
      label: "Studio autonomy",
      value: null,
      unit: "pct",
      sub: "gates · approvals · payments moving without a principal chasing",
      confidence: "insufficient",
      completeness: 0,
      asOf: asOfIso,
      sources: [],
      note: "No signal yet — needs an intervention/escalation log (who chased which gate/approval/payment) to measure autonomy. Not estimated.",
    },
    // #3 automated — COMPUTE, stamped low (editorial classification).
    {
      key: "automated",
      label: "Coordination automated",
      value: automatedVal,
      unit: "pct",
      sub: `${automatedCount} of ${totalTasks} recurring tasks automated`,
      confidence: "low",
      completeness: 100,
      asOf: asOfIso,
      sources: automatedSources,
      formula: "(#automated + 0.5·#assisted) ÷ total recurring tasks",
      note: "Based on editorial task-status classification, not an observed automation rate.",
    },
    // #1 output — COMPUTE → value === active ÷ designers === 3.0.
    {
      key: "output",
      label: "Output per designer",
      value: outputVal,
      unit: "ratio",
      sub: "active projects per designer (design-production staff) — rises as overhead falls",
      confidence: "low",
      completeness: 100,
      asOf: asOfIso,
      sources: outputSources,
      formula: "active projects ÷ design staff (role='designer')",
      note: "Head-count load per designer, not a productivity measure. Design staff = the two designer-role members.",
    },
  ];
}

/**
 * serveAuditTasks(db, asOf, principal) → AuditTask[] (aios.ts:36), company-scoped.
 * Shape-preserving (camelCase the snake columns). No Metric, no money gate.
 */
export async function serveAuditTasks(db, asOf, principal) {
  await setPrincipal(db, principal);
  const res = await db.query(
    `select id, title, owner, cadence, min_per_week, automatable, human_gate, behavior, status, company_id
       from canonical.audit_task
      where company_id = $1
      order by id`,
    [principal.companyId],
  );
  return res.rows
    .filter((r) => String(r.company_id) === String(principal.companyId))
    .map((r) => ({
      id: r.id,
      title: r.title,
      owner: r.owner,
      cadence: r.cadence,
      minPerWeek: Number(r.min_per_week),
      automatable: r.automatable,
      humanGate: r.human_gate,
      behavior: r.behavior,
      status: r.status,
    }));
}

/**
 * serializeDailyBrief / serveAgentActions — prose/feed surfaces (no Metric, no
 * trust-surface number). PD-E keeps these frontend MOCK; the backend serves a
 * shape-preserving passthrough so the route exists, but the FLAG defaults the
 * frontend to its own mock (agentActions is additionally ⑦-bound to Step-6).
 * These return null to signal "no backend data — use the mock"; the route
 * answers 204/empty and the frontend seam falls back. (Kept minimal + honest:
 * no fabricated feed is invented here.)
 */
export async function serializeDailyBrief(_db, _asOf, _principal) {
  return null; // PD-E: stays frontend mock — no trust-surface number to back.
}
export async function serveAgentActions(_db, _asOf, _principal) {
  return null; // PD-E + ⑦: stays frontend mock — proposals/handled are Step-6's job.
}

export default serializeAiosKpis;
