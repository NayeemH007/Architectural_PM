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
      const row = {
        id: r.id,
        projectId: r.project_id,
        label: r.label,
        linkedPhase: r.linked_phase,
        type: r.type,
        gross_amount: r.gross_amount == null ? null : Number(r.gross_amount),
        received_amount: r.received_amount == null ? null : Number(r.received_amount),
        amount: r.gross_amount == null ? null : Number(r.gross_amount), // live `amount` alias
        dueDate: r.due_date,
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
  return res.rows
    .filter((r) => String(r.company_id) === String(principal.companyId))
    .map((r) => {
      const row = {
        id: r.id,
        code: r.code,
        name: r.name,
        clientId: r.client_id,
        leadId: r.lead_id,
        type: r.type,
        status: r.status,
        currentPhase: r.current_phase,
        contract_value: r.contract_value == null ? null : Number(r.contract_value),
        health: r.health,
        blocker: r.blocker,
      };
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
