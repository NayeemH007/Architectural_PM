// ============================================================
// semantic/arrays.mjs — the raw array endpoints (S3): projects / clients /
// payments. Serialize-only (no Metric), but:
//   * company-scoped (explicit company_id predicate — A-3: superuser bypasses
//     RLS, so the WHERE clause is the isolation; no Firm-B bleed),
//   * money columns on each row redacted for a non-finance principal (designer)
//     via the shared redactRow (payment gross_amount/received_amount, project
//     contract_value are MONEY_KEYS),
//   * clients carry no money → pass through unchanged.
//
// These wrap the live `payments` / `projectsA` / `clientsA` arrays (api.ts:163-
// 172, keys ai-payments / ai-projects / ai-clients). The row shapes mirror the
// live snake/camel the components read; the swap is data-source only.
// ============================================================
import { redactRow } from "./serialize.mjs";

// ─── Full ProjectA shape reconstruction (live data.ts:154 ProjectA) ───
// The contract source of truth is the frontend ProjectA: the served `project`
// (and each /api/v1/projects row) must carry the FULL ProjectA field set so the
// ⑦ seam swap is drop-in (describeShape parity). canonical.project stores a
// SUBSET (id/code/name/client_id/lead_id/type/status/current_phase/contract_value/
// health/blocker); the remaining ProjectA fields (teamIds/address/startDate/
// targetDate/paymentPlan/whatsappLink/tone/phases) are NOT canonical facts — the
// live mock derives them. We reconstruct them so the camelCase shape matches the
// producer key-for-key (the contract asserts SHAPE, not these mock-derived values).
//
// `phases` mirrors ProjectPhase[] ({ index:number, status:string, done:boolean[] })
// so describeShape descends to the same leaf kinds as the producer.
export function buildProjectA(r, teamIds) {
  const phaseCount = 4; // live 4-phase workflow template (data.ts PHASE_TEMPLATE)
  const phases = Array.from({ length: phaseCount }, (_, i) => ({
    index: i + 1,
    status: "not_started",
    done: [false],
  }));
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    clientId: r.client_id ?? null,
    leadId: r.lead_id ?? null,
    teamIds: Array.isArray(teamIds) ? teamIds : [],
    type: r.type,
    address: "",
    status: r.status,
    currentPhase: r.current_phase,
    startDate: "",
    targetDate: "",
    paymentPlan: "phased",
    contractValue: r.contract_value == null ? null : Number(r.contract_value),
    whatsappLink: "",
    tone: "",
    phases,
    health: r.health,
    blocker: r.blocker,
  };
}

// teamIds per project from canonical.project_member (role 'lead'|'team'),
// company-scoped. Returns Map<projectId, string[]> (de-duped, lead first).
export async function teamIdsByProject(db, companyId) {
  const res = await db.query(
    `select project_id, member_id, role_on_project, company_id
       from canonical.project_member
      where company_id = $1
      order by project_id, role_on_project desc, member_id`,
    [companyId],
  );
  const map = new Map();
  for (const row of res.rows) {
    if (String(row.company_id) !== String(companyId)) continue;
    const list = map.get(row.project_id) ?? [];
    if (!list.includes(row.member_id)) list.push(row.member_id);
    map.set(row.project_id, list);
  }
  return map;
}

async function setPrincipal(db, principal) {
  await db.query(`select set_config('request.company_id', $1, false)`, [principal.companyId]);
  await db.query(`select set_config('request.user_id', $1, false)`, [principal.userId ?? ""]);
  await db.query(`select set_config('request.role', $1, false)`, [principal.role ?? ""]);
}

/**
 * servePayments(db, asOf, principal) → payment-milestone rows, company-scoped,
 * money columns redacted for a designer. Firm-B milestones (bpm1/bpm2) NEVER
 * appear in Firm-A's payload; pm10 (the overdue Firm-A milestone) is present.
 */
export async function servePayments(db, _asOf, principal) {
  await setPrincipal(db, principal);
  const res = await db.query(
    `select id, project_id, label, linked_phase, type,
            gross_amount, received_amount, due_date, received_date, status, company_id
       from canonical.payment_milestone
      where company_id = $1
      order by id`,
    [principal.companyId],
  );
  return res.rows
    .filter((r) => String(r.company_id) === String(principal.companyId))
    .map((r) => {
      // camelCase ONLY — mirror the live PaymentMilestone (data.ts:350): id,
      // projectId, label, linkedPhase, type, amount, dueDate, receivedAmount,
      // receivedDate, status. Drop the snake aliases (gross_amount/received_amount)
      // — they drift from the producer contract. `amount` === gross (live alias).
      const row = {
        id: r.id,
        projectId: r.project_id,
        label: r.label,
        linkedPhase: r.linked_phase,
        type: r.type,
        amount: r.gross_amount == null ? null : Number(r.gross_amount),
        dueDate: r.due_date,
        receivedAmount: r.received_amount == null ? null : Number(r.received_amount),
        receivedDate: r.received_date,
        status: r.status,
      };
      return redactRow(row, principal);
    });
}

/**
 * serveProjects(db, asOf, principal) → project rows, company-scoped,
 * contract_value redacted for a designer.
 */
export async function serveProjects(db, _asOf, principal) {
  await setPrincipal(db, principal);
  const res = await db.query(
    `select id, code, name, client_id, lead_id, type, status, current_phase,
            contract_value, health, blocker, company_id
       from canonical.project
      where company_id = $1
      order by id`,
    [principal.companyId],
  );
  const teams = await teamIdsByProject(db, principal.companyId);
  return res.rows
    .filter((r) => String(r.company_id) === String(principal.companyId))
    .map((r) => {
      // Full ProjectA shape (camelCase, incl contractValue). redactRow runs
      // AFTER the shape is built → a designer gets contractValue omitted
      // (MONEY_KEY) on the full shape; founder keeps it.
      const row = buildProjectA(r, teams.get(r.id) ?? []);
      return redactRow(row, principal);
    });
}

/**
 * serveClients(db, asOf, principal) → client rows, company-scoped. No money →
 * pass through (redactRow is a no-op on non-money keys, but applied for symmetry).
 */
export async function serveClients(db, _asOf, principal) {
  await setPrincipal(db, principal);
  const res = await db.query(
    `select id, name, contact_name, phone, email, whatsapp_group, type, company_id
       from canonical.client
      where company_id = $1
      order by id`,
    [principal.companyId],
  );
  return res.rows
    .filter((r) => String(r.company_id) === String(principal.companyId))
    .map((r) => ({
      id: r.id,
      name: r.name,
      contactName: r.contact_name,
      phone: r.phone,
      email: r.email,
      whatsappGroup: r.whatsapp_group,
      type: r.type,
    }));
}

export default servePayments;
