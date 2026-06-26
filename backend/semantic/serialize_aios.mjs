// ============================================================
// serialize_aios.mjs — read-layer serializer for the AIOS proposal
// ledger (S4 / W7). Mirrors serialize.mjs: pure JS, takes raw rows + principal.
//
// LOAD-BEARING rule (W7): an action is "handled" ONLY when a real
// delivery_receipt is present (equivalently state='executed'). A proposed /
// approved (receipt-less) action is "pending", NEVER "handled" — the live
// frontend's `status==='done'` framing is replaced by the receipt rule so a
// proposal is never shown as a confirmed send.
// ============================================================

// An action is handled iff it carries a real delivery_receipt.
function isHandled(row) {
  return row?.delivery_receipt != null;
}

// Coerce a pg timestamptz (Date | ISO string | null) to a string (or null).
function toAt(v) {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/**
 * serializeAiosActions(rows, principal) -> array
 * Each item: { id, projectId, taskId, summary, detail, state, handled, at }.
 * handled === (row.delivery_receipt != null) — NEVER true for a null-receipt row.
 * Preserves the `aios-actions` query-key shape.
 */
export function serializeAiosActions(rows, _principal) {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id ?? r.projectId ?? null,
    taskId: r.task_id ?? r.taskId,
    summary: r.summary,
    detail: r.detail ?? "",
    state: r.state,
    handled: isHandled(r),
    at: toAt(r.proposed_at ?? r.proposedAt ?? r.at),
  }));
}

/**
 * serializeDailyBrief(rows, principal) -> { date, summary, needsYou[], handled[] }
 * handled[] is built ONLY from rows with delivery_receipt != null. A proposed /
 * needs-approval row appears in needsYou, never handled.
 */
export function serializeDailyBrief(rows, principal, opts = {}) {
  const list = serializeAiosActions(rows, principal);
  const handled = list
    .filter((a) => a.handled)
    .map((a) => ({ id: a.id, text: a.summary, meta: a.detail }));
  const needsYou = list
    .filter((a) => !a.handled)
    .map((a) => ({
      id: a.id,
      text: a.summary,
      meta: a.detail,
      projectId: a.projectId,
      tone: "ochre",
    }));
  return {
    date: opts.date ?? null,
    summary: opts.summary ?? "",
    needsYou,
    handled,
  };
}

export default { serializeAiosActions, serializeDailyBrief };
