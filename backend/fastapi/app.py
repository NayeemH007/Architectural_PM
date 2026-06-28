# ============================================================
# app.py — the PRODUCTION FastAPI semantic layer over Supabase Postgres.
#
# Replaces backend/server/index.mjs (node:http over pglite) with the decided
# production stack (Supabase + FastAPI), emitting the SAME camelCase Metric JSON
# contract the Node/pglite backend + frontend use. Each endpoint:
#   1. verifies the Supabase-Auth JWT (auth.verify_jwt) -> 401 on any failure;
#   2. opens an RLS-bound txn (auth.rls_session: SET LOCAL ROLE authenticated +
#      request.jwt.claims) so the canonical/mart RLS policies enforce tenant
#      isolation (no Firm-B bleed into Firm-A);
#   3. calls the SAME SQL recompute fns (mart.recompute_*) at the pinned clock;
#   4. serializes via the ported Python serializers (serializers.py) so the JSON
#      is shape-identical to the frontend producers.
#
# Endpoints mirror the Node DERIVED_ROUTES + overview:
#   GET /api/v1/overview        -> managementOverview()  (Metric envelope)
#   GET /api/v1/finance         -> financeOverview()      (11 Metric leaves)
#   GET /api/v1/profitability   -> profitabilityByProject() (rows w/ margin Metric)
#   GET /api/v1/aios/kpis       -> aiosKpis()             (autonomy REFUSES)
#   GET /api/v1/payments|projects|clients -> raw arrays (band-redacted)
# ============================================================
from __future__ import annotations

from fastapi import FastAPI, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import auth
import serializers as S
from auth import AS_OF_PINNED, KPI_VERSION

app = FastAPI(title="ArchIntel semantic layer (FastAPI/Supabase)")

# ── CORS: the browser SPA calls this API cross-origin from the Vite dev server
# carrying the Supabase session JWT in the Authorization header. Allow the dev
# origins + the Authorization header on the read methods (GET/OPTIONS preflight).
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_methods=["GET", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


# ── Generic 4xx/5xx bodies (A-6: never echo raw PG error / attacker input). ──
def _unauth() -> JSONResponse:
    return JSONResponse(status_code=401, content={"error": "unauthorized"})


def _authed(authorization: str | None):
    """Verify the JWT; return claims or None (caller emits 401)."""
    try:
        return auth.verify_jwt(authorization)
    except auth.AuthError:
        return None


@app.get("/api/v1/overview")
def overview(authorization: str | None = Header(default=None)):
    claims = _authed(authorization)
    if claims is None:
        return _unauth()
    with auth.rls_session(claims) as (conn, principal):
        with conn.cursor() as cur:
            cur.execute(
                "select * from mart.recompute_portfolio_summary(%s::timestamptz, %s::int)",
                (AS_OF_PINNED, KPI_VERSION),
            )
            summary = cur.fetchone()
            cur.execute(
                """select kpi_run_id, metric_key, entity_id, contribution_value,
                          source_id, record_ref, observed_at, company_id
                     from mart.kpi_lineage
                    where metric_key = 'overdueAmount' and kpi_run_id = %s""",
                (summary["kpi_run_id"],),
            )
            lineage = cur.fetchall()
            cur.execute(
                """select id, submitted_date from canonical.design_approval
                    where status = 'pending' order by id"""
            )
            pending = cur.fetchall()
            cur.execute(
                """select id, gross_amount, received_amount, source_record_ref, due_date
                     from canonical.payment_milestone order by id"""
            )
            pm = cur.fetchall()
            # The count/sum overview leaves are computed from canonical via THIS
            # RLS-bound session (company-isolated), mirroring the Node
            # managementOverview() — NOT read from the summary row (whose
            # active_count/.../billable columns are NULL). blockedCount uses
            # health='at_risk' on active projects (canonical carries no phase
            # 'blocked' status; the Node `phases.some(blocked)` term has no
            # canonical analogue, so the at_risk term is the available signal).
            cur.execute(
                """select
                     count(*) filter (where status = 'active')   as active_count,
                     count(*) filter (where status = 'archived') as completed_count,
                     count(*) filter (where status = 'active'
                                        and health = 'at_risk')  as blocked_count,
                     coalesce(sum(contract_value)
                              filter (where status = 'active'), 0) as total_contract
                   from canonical.project"""
            )
            proj_agg = cur.fetchone()
            cur.execute(
                """select
                     count(*) filter (where status = 'overdue')  as overdue_count,
                     coalesce(sum(received_amount), 0)            as received,
                     coalesce(sum(gross_amount), 0)               as billable
                   from canonical.payment_milestone"""
            )
            pm_agg = cur.fetchone()
    counts = {
        "activeCount": proj_agg["active_count"],
        "completedCount": proj_agg["completed_count"],
        "blockedCount": proj_agg["blocked_count"],
        "totalContract": proj_agg["total_contract"],
        "overdueCount": pm_agg["overdue_count"],
        "received": pm_agg["received"],
        "billable": pm_agg["billable"],
    }
    extras = {
        "counts": counts,
        "pendingApprovals": S.build_pending_approvals(pending, AS_OF_PINNED),
        "collectionRate": S.build_collection_rate(pm, AS_OF_PINNED),
    }
    return JSONResponse(S.serialize_overview_full(summary, lineage, extras, principal))


@app.get("/api/v1/finance")
def finance(authorization: str | None = Header(default=None)):
    claims = _authed(authorization)
    if claims is None:
        return _unauth()
    with auth.rls_session(claims) as (conn, principal):
        with conn.cursor() as cur:
            cur.execute(
                "select * from mart.recompute_finance(%s::timestamptz, %s::int)",
                (AS_OF_PINNED, KPI_VERSION),
            )
            fin_lineage = cur.fetchall()
            cur.execute(
                """select id, gross_amount, received_amount, source_record_ref, observed_at
                     from canonical.payment_milestone
                    where status = 'overdue' order by id"""
            )
            overdue_ms = cur.fetchall()
    return JSONResponse(S.build_finance(fin_lineage, overdue_ms, AS_OF_PINNED, principal))


@app.get("/api/v1/profitability")
def profitability(authorization: str | None = Header(default=None)):
    claims = _authed(authorization)
    if claims is None:
        return _unauth()
    with auth.rls_session(claims) as (conn, principal):
        with conn.cursor() as cur:
            cur.execute(
                "select * from mart.recompute_profitability(%s::timestamptz, %s::int)",
                (AS_OF_PINNED, KPI_VERSION),
            )
            margin_rows = cur.fetchall()
            cur.execute(
                """select p.id, p.code, p.name, p.client_id, p.lead_id, p.type, p.status,
                          p.current_phase, p.contract_value, p.health, p.blocker,
                          coalesce(cm.modeled_cost, 0) as modeled_cost,
                          coalesce(rcv.received, 0)    as received
                     from canonical.project p
                     left join mart.cost_model cm
                       on cm.company_id = p.company_id and cm.project_id = p.id
                     left join (
                       select project_id, sum(received_amount) as received
                         from canonical.payment_milestone group by project_id
                     ) rcv on rcv.project_id = p.id
                    where p.status in ('active','archived')
                    order by p.id"""
            )
            projects = cur.fetchall()
            teams = _teams_by_project(cur)
    return JSONResponse(
        S.build_profitability(margin_rows, projects, teams, AS_OF_PINNED, principal)
    )


@app.get("/api/v1/aios/kpis")
def aios_kpis(authorization: str | None = Header(default=None)):
    claims = _authed(authorization)
    if claims is None:
        return _unauth()
    with auth.rls_session(claims) as (conn, principal):
        with conn.cursor() as cur:
            cur.execute(
                "select * from mart.recompute_aios(%s::timestamptz, %s::int)",
                (AS_OF_PINNED, KPI_VERSION),
            )
            rows = cur.fetchall()
    # AIOS is operational, not finance -> NOT money-gated (no redactRow).
    return JSONResponse(S.build_aios_kpis(rows, AS_OF_PINNED))


@app.get("/api/v1/payments")
def payments(authorization: str | None = Header(default=None)):
    claims = _authed(authorization)
    if claims is None:
        return _unauth()
    with auth.rls_session(claims) as (conn, principal):
        with conn.cursor() as cur:
            cur.execute(
                """select id, project_id, label, linked_phase, type,
                          gross_amount, received_amount, due_date, received_date, status
                     from canonical.payment_milestone order by id"""
            )
            rows = cur.fetchall()
    return JSONResponse(S.serve_payments(rows, principal))


@app.get("/api/v1/projects")
def projects(authorization: str | None = Header(default=None)):
    claims = _authed(authorization)
    if claims is None:
        return _unauth()
    with auth.rls_session(claims) as (conn, principal):
        with conn.cursor() as cur:
            cur.execute(
                """select id, code, name, client_id, lead_id, type, status,
                          current_phase, contract_value, health, blocker
                     from canonical.project order by id"""
            )
            rows = cur.fetchall()
            teams = _teams_by_project(cur)
    return JSONResponse(S.serve_projects(rows, teams, principal))


@app.get("/api/v1/clients")
def clients(authorization: str | None = Header(default=None)):
    claims = _authed(authorization)
    if claims is None:
        return _unauth()
    with auth.rls_session(claims) as (conn, principal):
        with conn.cursor() as cur:
            cur.execute(
                """select id, name, contact_name, phone, email, whatsapp_group, type
                     from canonical.client order by id"""
            )
            rows = cur.fetchall()
    return JSONResponse(S.serve_clients(rows, principal))


def _teams_by_project(cur) -> dict[str, list[str]]:
    """teamIds per project from canonical.project_member (RLS-scoped, lead first)."""
    cur.execute(
        """select project_id, member_id, role_on_project
             from canonical.project_member
            order by project_id, role_on_project desc, member_id"""
    )
    out: dict[str, list[str]] = {}
    for r in cur.fetchall():
        out.setdefault(r["project_id"], [])
        if r["member_id"] not in out[r["project_id"]]:
            out[r["project_id"]].append(r["member_id"])
    return out


@app.exception_handler(Exception)
async def _generic_error(_request: Request, _exc: Exception) -> JSONResponse:
    # A-6: generic 5xx body — never echo the raw PG error / attacker input.
    return JSONResponse(status_code=500, content={"error": "internal error"})
