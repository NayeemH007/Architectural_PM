# ============================================================
# serializers.py — Python port of the Node semantic serializers
# (backend/semantic/{serialize,finance,profitability,aios,arrays}.mjs).
#
# The Metric JSON is the INVARIANT across the language + runtime port: these
# emit byte-shape-identical camelCase Metric envelopes to the frontend producers
# (managementOverview / financeOverview / profitabilityByProject / aiosKpis) so
# the ⑦ seam swap is drop-in. Where a Node helper exists, this mirrors it:
#   * MONEY_KEYS / isFinanceEligible / redactRow            <- serialize.mjs
#   * buildOverdueMetric / serializeOverviewFull            <- serialize.mjs
#   * computeFinance / grossMetric / collectionRate         <- finance.mjs
#   * serializeProfitability / buildProjectA                <- profitability/arrays.mjs
#   * serializeAiosKpis (autonomy REFUSES)                  <- aios.mjs
#
# Locked decisions honoured (CONTEXT.md):
#   ⑤ tax DEFERRED -> gross figures, confidence 'low', GROSS_NOTE.
#   ④ coverage RETIRED -> margin fee-only, confidence 'low', never 'insufficient'.
#   finance band -> non-finance principal money keys OMITTED / Metrics REFUSED.
#
# pg numerics arrive from psycopg as Decimal -> coerced to float/int via _num().
# ============================================================
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any

KPI_VERSION = 1
GROSS_NOTE = "Gross figure — VAT/VDS/AIT withholding not modeled."
GROSS_NOTE_OVERDUE = "Gross overdue receivable — VAT/VDS/AIT withholding not modeled."
GROSS_NOTE_COLLECTION = "Gross collection — VAT/VDS/AIT withholding not modeled."
MARGIN_NOTE = (
    "Fee-only margin — no labour cost; PROJECT_COST is a modeled input, not measured."
)

# ── Money keys to redact for non-finance principals (mirror serialize.mjs:20). ──
MONEY_KEYS = {
    k.lower()
    for k in [
        "contract_value", "contractValue", "amount", "gross_amount",
        "net_receivable", "margin", "overdueAmount", "overdueamount",
        "totalContract", "totalcontract", "total_contract", "received",
        "billable", "contract", "cost", "profit", "income", "collection_rate",
        "collectionRate", "receivables", "overdue", "monthIncome",
        "monthExpense", "monthNet", "ytdIncome", "ytdExpense", "ytdNet",
        "received_amount", "receivedAmount", "vat", "vds_withheld",
        "ait_withheld",
    ]
}


def is_money_key(key: str) -> bool:
    return str(key).lower() in MONEY_KEYS


def is_finance_eligible(principal: dict) -> bool:
    """serialize.mjs:isFinanceEligible — role founder|finance OR a finance grant."""
    if not isinstance(principal, dict):
        return False
    role = str(principal.get("role") or "").lower()
    if role in ("founder", "finance"):
        return True
    if principal.get("financeGrant") is True:
        return True
    if principal.get("finance_grant") is True:
        return True
    return False


def _is_metric(v: Any) -> bool:
    """A Metric envelope is {value, confidence, ...} (types.ts:50-62)."""
    return isinstance(v, dict) and "value" in v and "confidence" in v


def _refuse_metric(metric: dict) -> dict:
    """Non-finance refusal: blank the number, mark insufficient (promise ②)."""
    out = dict(metric)
    out["value"] = None
    out["confidence"] = "insufficient"
    return out


def redact_row(row: Any, principal: dict) -> Any:
    """serialize.mjs:redactRow — finance band response filter.

    Finance-eligible -> as-is. Non-finance -> money keys OMITTED; money Metrics
    rewritten to the refusal shape; recurse into nested plain objects/arrays so a
    designer never sees project.contractValue via a sub-object (R1 band).
    """
    if not isinstance(row, dict):
        return row
    if is_finance_eligible(principal):
        return dict(row)

    out: dict = {}
    for k, v in row.items():
        if is_money_key(k):
            if _is_metric(v):
                out[k] = _refuse_metric(v)
            # else OMIT entirely (absent, not present-with-null)
            continue
        if _is_metric(v):
            out[k] = v  # non-money Metric -> pass through whole
        elif isinstance(v, list):
            out[k] = [
                redact_row(el, principal)
                if isinstance(el, dict) and not _is_metric(el)
                else el
                for el in v
            ]
        elif isinstance(v, dict):
            out[k] = redact_row(v, principal)
        else:
            out[k] = v
    return out


# ── coercion helpers (psycopg returns Decimal for numeric, date/datetime). ──
def _num(v: Any) -> float | int:
    """pg numeric/Decimal -> number (serialize.mjs:num, NULL->0)."""
    if v is None:
        return 0
    if isinstance(v, Decimal):
        f = float(v)
        return int(f) if f.is_integer() else f
    if isinstance(v, (int, float)):
        return v
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return 0


def _to_iso(v: Any) -> str:
    """pg timestamptz/date -> non-empty ISO string (serialize.mjs:toIso)."""
    if v is None:
        return ""
    if isinstance(v, datetime):
        # mirror JS Date.toISOString(): UTC, milliseconds, trailing Z
        return v.astimezone(tz=_UTC).strftime("%Y-%m-%dT%H:%M:%S.") + (
            f"{v.microsecond // 1000:03d}Z"
        )
    if isinstance(v, date):
        return f"{v.isoformat()}T00:00:00.000Z"
    return str(v)


from datetime import timezone as _tz  # noqa: E402

_UTC = _tz.utc


def _date_iso(v: Any) -> str:
    """A pinned-clock date string ('2026-06-22') -> ISO (asOf fields)."""
    if v is None:
        return ""
    if isinstance(v, str):
        # already a date-only literal
        if len(v) == 10:
            return f"{v}T00:00:00.000Z"
        return v
    return _to_iso(v)


# ─────────────────────────── OVERVIEW (managementOverview) ───────────────────
def build_overdue_metric(summary_row: dict, lineage_rows: list[dict]) -> dict:
    """serialize.mjs:buildOverdueMetric — value = Σ contribution_value."""
    value = sum(_num(r["contribution_value"]) for r in lineage_rows)
    sources = [
        {
            "sourceId": str(r["source_id"]),
            "sourceName": "TallyPrime",
            "recordRef": r["record_ref"],
            "observedAt": _to_iso(r["observed_at"]),
        }
        for r in lineage_rows
    ]
    n = len(lineage_rows)
    return {
        "value": value,
        "unit": "bdt",
        "label": f"Overdue payments (gross) — {n} milestone{'' if n == 1 else 's'}",
        "confidence": "low",
        "completeness": 100,
        "asOf": _date_iso(summary_row.get("as_of") if summary_row else None),
        "formula": "Σ (gross_amount − received_amount) over status='overdue' milestones",
        "note": GROSS_NOTE_OVERDUE,
        "sources": sources,
    }


def build_pending_approvals(rows: list[dict], as_of: str) -> dict:
    """server/index.mjs:buildPendingApprovals — complete count, confidence 'high'."""
    return {
        "value": len(rows),
        "unit": "count",
        "label": "Pending approvals",
        "confidence": "high",
        "completeness": 100,
        "asOf": _date_iso(as_of),
        "formula": "count(approvals where status='pending')",
        "sources": [
            {
                "sourceId": "approvals",
                "sourceName": "ArchIntel · Approvals",
                "recordRef": f"approval:{a['id']}",
                "observedAt": _to_iso(a.get("submitted_date")),
            }
            for a in rows
        ],
    }


def build_collection_rate(rows: list[dict], as_of: str) -> dict:
    """server/index.mjs:buildCollectionRate — Σreceived ÷ Σbillable × 100 (gross)."""
    received = sum(_num(r.get("received_amount")) for r in rows)
    billable = sum(_num(r.get("gross_amount")) for r in rows)
    value = round((received / billable) * 100) if billable else 0
    return {
        "value": value,
        "unit": "pct",
        "label": "Collection rate (gross)",
        "confidence": "low",
        "completeness": 100,
        "asOf": _date_iso(as_of),
        "formula": "Σ received ÷ Σ billable (gross)",
        "note": GROSS_NOTE_COLLECTION,
        "sources": [
            {
                "sourceId": "tally",
                "sourceName": "TallyPrime",
                "recordRef": pm["source_record_ref"],
                "observedAt": _to_iso(pm.get("due_date")),
            }
            for pm in rows
        ],
    }


def serialize_overview_full(
    summary_row: dict | None,
    lineage_rows: list[dict],
    extras: dict,
    principal: dict,
) -> dict:
    """serialize.mjs:serializeOverviewFull — FULL camelCase managementOverview shape.

    VALUE SOURCE: the count/sum leaves are computed from canonical via the same
    RLS-bound session (passed in as `extras['counts']`), mirroring the Node
    managementOverview() — NOT read from the mart.recompute_portfolio_summary
    summary row (which only populates overdue_count/overdueAmount; the other
    summary columns are NULL → would serve 0). pendingApprovals/collectionRate
    remain cited Metrics; overdueAmount is built from kpi_lineage. The summary
    row is retained only for the overdueAmount asOf pin.
    """
    row = summary_row or {}
    counts = extras.get("counts") or {}
    overdue_amount = build_overdue_metric(row, lineage_rows or [])
    shape = {
        "activeCount": _num(counts.get("activeCount")),
        "completedCount": _num(counts.get("completedCount")),
        "pendingApprovals": extras.get("pendingApprovals"),
        "overdueCount": _num(counts.get("overdueCount")),
        "overdueAmount": overdue_amount,
        "blockedCount": _num(counts.get("blockedCount")),
        "totalContract": _num(counts.get("totalContract")),
        "received": _num(counts.get("received")),
        "billable": _num(counts.get("billable")),
        "collectionRate": extras.get("collectionRate"),
    }
    return redact_row(shape, principal)


# ─────────────────────────── FINANCE (financeOverview) ───────────────────────
MONTHLY_FLOW = [
    {"m": "Jan", "income": 1_500_000, "expense": 1_180_000},
    {"m": "Feb", "income": 980_000, "expense": 1_210_000},
    {"m": "Mar", "income": 1_240_000, "expense": 1_260_000},
    {"m": "Apr", "income": 2_740_000, "expense": 1_300_000},
    {"m": "May", "income": 1_360_000, "expense": 1_340_000},
    {"m": "Jun", "income": 600_000, "expense": 1_373_000},
]
MONTH_EXPENSE_2026_06 = 1_050_000 + 120_000 + 65_000 + 28_000 + 40_000 + 45_000 + 32_000
ILLUSTRATIVE_NOTE = (
    "Illustrative — sample monthly totals, not yet reconciled to TallyPrime."
)


def _provenance_from_lineage(rows: list[dict]) -> list[dict]:
    return [
        {
            "sourceId": str(r["source_id"]),
            "sourceName": "TallyPrime",
            "recordRef": r["record_ref"],
            "observedAt": _to_iso(r["observed_at"]),
        }
        for r in rows
    ]


def _gross_metric(rows: list[dict], as_of: str, label: str, formula: str) -> dict:
    value = sum(_num(r["contribution_value"]) for r in rows)
    return {
        "value": value,
        "unit": "bdt",
        "label": label,
        "confidence": "low",
        "completeness": 100,
        "asOf": _date_iso(as_of),
        "formula": formula,
        "note": GROSS_NOTE,
        "sources": _provenance_from_lineage(rows),
    }


def build_finance(
    fin_lineage: list[dict],
    overdue_ms: list[dict],
    as_of: str,
    principal: dict,
) -> dict:
    """finance.mjs:computeFinance + serializeFinance — financeOverview() shape."""
    income = [r for r in fin_lineage if r["metric_key"] == "income"]
    billable = [r for r in fin_lineage if r["metric_key"] == "billable"]
    receivables = [r for r in fin_lineage if r["metric_key"] == "receivables"]

    income_m = _gross_metric(income, as_of, "Income received (gross)", "Σ received_amount over payments")
    billable_m = _gross_metric(billable, as_of, "Billable (gross)", "Σ amount over payments")
    receivables_m = _gross_metric(
        receivables, as_of, "Receivables outstanding (gross)",
        "Σ (amount − received) where status≠'paid'",
    )

    overdue_lineage = [
        {
            "contribution_value": _num(pm["gross_amount"]) - _num(pm["received_amount"]),
            "source_id": "tally",
            "record_ref": pm["source_record_ref"],
            "observed_at": pm["observed_at"],
        }
        for pm in overdue_ms
    ]
    overdue_m = _gross_metric(
        overdue_lineage, as_of, "Overdue (gross)",
        "Σ (amount − received) where status='overdue'",
    )

    collection_val = (
        round((income_m["value"] / billable_m["value"]) * 100)
        if billable_m["value"]
        else 0
    )
    collection_rate = {
        "value": collection_val,
        "unit": "pct",
        "label": "Collection rate (gross)",
        "confidence": "low",
        "completeness": 100,
        "asOf": _date_iso(as_of),
        "formula": "Σ income ÷ Σ billable (gross)",
        "note": GROSS_NOTE_COLLECTION,
        "sources": _provenance_from_lineage(billable),
    }

    def illustrative(value: float, label: str) -> dict:
        return {
            "value": value,
            "unit": "bdt",
            "label": label,
            "confidence": "low",
            "completeness": 60,
            "asOf": _date_iso(as_of),
            "note": ILLUSTRATIVE_NOTE,
            "sources": [
                {
                    "sourceId": "sample",
                    "sourceName": "Illustrative · monthly flow",
                    "recordRef": "sample:monthly-flow",
                    "observedAt": _date_iso(as_of),
                }
            ],
        }

    month_income_val = MONTHLY_FLOW[-1]["income"]
    ytd_income_val = sum(r["income"] for r in MONTHLY_FLOW)
    ytd_expense_val = sum(r["expense"] for r in MONTHLY_FLOW)
    month_expense_val = MONTH_EXPENSE_2026_06

    raw = {
        "income": income_m,
        "billable": billable_m,
        "receivables": receivables_m,
        "overdue": overdue_m,
        "monthIncome": illustrative(month_income_val, "This month income (illustrative)"),
        "monthExpense": illustrative(month_expense_val, "This month expense"),
        "monthNet": illustrative(month_income_val - month_expense_val, "This month net (illustrative)"),
        "ytdIncome": illustrative(ytd_income_val, "YTD income (illustrative)"),
        "ytdExpense": illustrative(ytd_expense_val, "YTD expense (illustrative)"),
        "ytdNet": illustrative(ytd_income_val - ytd_expense_val, "Net YTD (illustrative)"),
        "collectionRate": collection_rate,
    }
    return redact_row(raw, principal)


# ─────────────────────── PROFITABILITY (profitabilityByProject) ──────────────
def build_project_a(r: dict, team_ids: list[str]) -> dict:
    """arrays.mjs:buildProjectA — FULL live ProjectA shape (camelCase)."""
    phases = [{"index": i + 1, "status": "not_started", "done": [False]} for i in range(4)]
    cv = r.get("contract_value")
    return {
        "id": r["id"],
        "code": r["code"],
        "name": r["name"],
        "clientId": r.get("client_id"),
        "leadId": r.get("lead_id"),
        "teamIds": team_ids if isinstance(team_ids, list) else [],
        "type": r.get("type"),
        "address": "",
        "status": r.get("status"),
        "currentPhase": r.get("current_phase"),
        "startDate": "",
        "targetDate": "",
        "paymentPlan": "phased",
        "contractValue": None if cv is None else _num(cv),
        "whatsappLink": "",
        "tone": "",
        "phases": phases,
        "health": r.get("health"),
        "blocker": r.get("blocker"),
    }


def build_profitability(
    margin_rows: list[dict],
    project_rows: list[dict],
    teams: dict[str, list[str]],
    as_of: str,
    principal: dict,
) -> list[dict]:
    """profitability.mjs:serializeProfitability — rows[] with margin Metric."""
    margin_by_project = {r["entity_id"]: r for r in margin_rows}
    out = []
    for p in project_rows:
        lin = margin_by_project.get(p["id"])
        margin_val = _num(lin["contribution_value"]) if lin else 0
        contract = _num(p.get("contract_value"))
        cost = _num(p.get("modeled_cost"))
        received = _num(p.get("received"))
        margin = {
            "value": margin_val,
            "unit": "pct",
            "label": f"Margin (fee-only) — {p['code']}",
            "confidence": "low",
            "completeness": 60,
            "asOf": _date_iso(as_of),
            "formula": "(contract − modeled project cost) ÷ contract",
            "note": MARGIN_NOTE,
            "sources": [
                {
                    "sourceId": "projects",
                    "sourceName": "ArchIntel · Projects",
                    "recordRef": f"project:{p['id']}",
                    "observedAt": _date_iso(as_of),
                },
                {
                    "sourceId": "cost-model",
                    "sourceName": "ArchIntel · Cost model (modeled input)",
                    "recordRef": f"model:PROJECT_COST:{p['id']}",
                    "observedAt": _date_iso(as_of),
                },
            ],
        }
        row = {
            "project": build_project_a(p, teams.get(p["id"], [])),
            "contract": contract,
            "received": received,
            "cost": cost,
            "profit": contract - cost,
            "margin": margin,
        }
        out.append(redact_row(row, principal))
    return out


# ─────────────────────────────── AIOS (aiosKpis) ─────────────────────────────
def build_aios_kpis(rows: list[dict], as_of: str) -> list[dict]:
    """aios.mjs:serializeAiosKpis — [autonomy(refused), automated(low), output]."""
    as_of_iso = _date_iso(as_of)
    output_rows = [r for r in rows if r["metric_key"] == "output"]
    automated_rows = [r for r in rows if r["metric_key"] == "automated"]

    active_rows = [r for r in output_rows if r["record_ref"].startswith("project:")]
    designer_rows = [r for r in output_rows if r["record_ref"].startswith("member:")]
    active_count = len(active_rows)
    designer_count = len(designer_rows)
    output_val = (active_count / designer_count) if designer_count else 0
    output_sources = [
        {
            "sourceId": "archintel-projects",
            "sourceName": "ArchIntel · Projects",
            "recordRef": r["record_ref"],
            "observedAt": as_of_iso,
        }
        for r in active_rows
    ] + [
        {
            "sourceId": "archintel-members",
            "sourceName": "ArchIntel · Members",
            "recordRef": r["record_ref"],
            "observedAt": as_of_iso,
        }
        for r in designer_rows
    ]

    total_tasks = len(automated_rows)
    credit_sum = sum(_num(r["contribution_value"]) for r in automated_rows)
    automated_val = round((credit_sum / total_tasks) * 100) if total_tasks else 0
    automated_count = sum(1 for r in automated_rows if _num(r["contribution_value"]) == 1)
    automated_sources = [
        {
            "sourceId": "archintel-audit",
            "sourceName": "ArchIntel · Task Audit",
            "recordRef": r["record_ref"],
            "observedAt": as_of_iso,
        }
        for r in automated_rows
    ]

    return [
        {
            "key": "autonomy",
            "label": "Studio autonomy",
            "value": None,
            "unit": "pct",
            "sub": "gates · approvals · payments moving without a principal chasing",
            "confidence": "insufficient",
            "completeness": 0,
            "asOf": as_of_iso,
            "sources": [],
            "note": (
                "No signal yet — needs an intervention/escalation log (who chased "
                "which gate/approval/payment) to measure autonomy. Not estimated."
            ),
        },
        {
            "key": "automated",
            "label": "Coordination automated",
            "value": automated_val,
            "unit": "pct",
            "sub": f"{automated_count} of {total_tasks} recurring tasks automated",
            "confidence": "low",
            "completeness": 100,
            "asOf": as_of_iso,
            "sources": automated_sources,
            "formula": "(#automated + 0.5·#assisted) ÷ total recurring tasks",
            "note": "Based on editorial task-status classification, not an observed automation rate.",
        },
        {
            "key": "output",
            "label": "Output per designer",
            "value": output_val,
            "unit": "ratio",
            "sub": "active projects per designer (design-production staff) — rises as overhead falls",
            "confidence": "low",
            "completeness": 100,
            "asOf": as_of_iso,
            "sources": output_sources,
            "formula": "active projects ÷ design staff (role='designer')",
            "note": (
                "Head-count load per designer, not a productivity measure. Design "
                "staff = the two designer-role members."
            ),
        },
    ]


# ─────────────────────── RAW ARRAY ENDPOINTS (payments/projects/clients) ─────
def serve_payments(rows: list[dict], principal: dict) -> list[dict]:
    """arrays.mjs:servePayments — camelCase PaymentMilestone, money redacted."""
    out = []
    for r in rows:
        row = {
            "id": r["id"],
            "projectId": r["project_id"],
            "label": r["label"],
            "linkedPhase": r["linked_phase"],
            "type": r["type"],
            "amount": None if r["gross_amount"] is None else _num(r["gross_amount"]),
            "dueDate": _iso_date_only(r.get("due_date")),
            "receivedAmount": None if r["received_amount"] is None else _num(r["received_amount"]),
            "receivedDate": _iso_date_only(r.get("received_date")),
            "status": r["status"],
        }
        out.append(redact_row(row, principal))
    return out


def serve_projects(rows: list[dict], teams: dict[str, list[str]], principal: dict) -> list[dict]:
    """arrays.mjs:serveProjects — full ProjectA, contractValue redacted."""
    return [redact_row(build_project_a(r, teams.get(r["id"], [])), principal) for r in rows]


def serve_clients(rows: list[dict], principal: dict) -> list[dict]:
    """arrays.mjs:serveClients — camelCase client, no money."""
    return [
        {
            "id": r["id"],
            "name": r["name"],
            "contactName": r["contact_name"],
            "phone": r["phone"],
            "email": str(r["email"]) if r["email"] is not None else None,
            "whatsappGroup": r["whatsapp_group"],
            "type": r["type"],
        }
        for r in rows
    ]


def _iso_date_only(v: Any) -> str | None:
    """The live arrays carry dueDate/receivedDate as 'YYYY-MM-DD' (date)."""
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v.isoformat()
    return str(v)
