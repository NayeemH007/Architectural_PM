# SPACE ESSE · Practice Intelligence — System Documentation

**The definitive reference for the Architectural Project Management & Analytics System.** For founders, partners, architects, project managers, developers, QA, and investors. Use it for product planning, partner presentations, developer handover, backend development, QA testing, onboarding, and future expansion.

This documentation was written by **inspecting the actual frontend implementation**, not only the original plan — every module, page, tab, field, action, status, KPI, chart, form, and state currently built is documented. ~84,000 words across 18 sections.

---

## ⚠️ Read this first — what the system *is* today

**SPACE ESSE · Practice Intelligence is a frontend-only, high-fidelity interactive prototype.** It is a read-first *intelligence and reporting layer* designed to sit **above** an architecture firm's existing tools (accounting, files, email, calendar, manual capture) — explicitly **not** an ERP, BIM/CAD, accounting, or project-management replacement.

In the current build:
- **All data is mock**, served through a `~280ms resolve()` shim and React Query — there is **no backend, database, authentication, persistence, real AI inference, or live integration**. A page refresh resets all state.
- **KPIs are real calculations** but run **client-side over mock data**.
- Some interactions have **ephemeral client state** (capture forms, review approve/reject, filters, command palette, AI assistant); many buttons are **visual-only** (Connect, Sync, Export, Save, Generate brief).

This is stated honestly throughout so the document can serve as a truthful handover artifact. **Nothing is described as working unless it truly is.**

---

## Status legend (used on every feature)

| Tag | Meaning |
|---|---|
| **[IMPLEMENTED]** | Interactive and working in the frontend (client-side only; not persisted). |
| **[MOCK]** | Renders from mock data; the underlying read / sync / calculation is simulated, not live. |
| **[BACKEND]** | Designed in the UI but needs an API / database / persistence / auth to function. |
| **[INTEGRATION]** | Needs a third-party connector (accounting, Drive, email, authority portal…) to function. |
| **[PLANNED] / [RECOMMENDED]** | Not built; a future enhancement. |

Many features carry **dual tags** — e.g. a table that renders **[MOCK]** data with an action button that is **[BACKEND]**.

**Roll-up (see [17](17-status-limitations-roadmap.md) for the full matrix):** ~25 features are [IMPLEMENTED] but client-only and ephemeral · ~30 are [MOCK] (all data reads, KPIs, charts, AI answers) · ~20 actions are [BACKEND] · all 17 connectors + report delivery are [INTEGRATION].

---

## How to read this set (by audience)

| You are a… | Start with |
|---|---|
| **Founder / partner / investor** | [01 Overview](01-system-overview.md) → [10 Dashboards & KPIs](10-dashboards-kpis.md) → [17 Status & Roadmap](17-status-limitations-roadmap.md) |
| **Architect / project manager** | [01](01-system-overview.md) → [04–07 Modules](04-modules-dashboard-projects.md) → [15 Workflows](15-workflows-end-to-end.md) |
| **Developer (handover / backend)** | [03 IA](03-information-architecture-navigation.md) → [08 Data](08-data-architecture-lifecycle.md) → [13 Backend & DB](13-backend-database-requirements.md) → [09 Validation](09-validation-framework.md) → [12 Integrations](12-integration-architecture.md) |
| **QA / test** | [09 Validation](09-validation-framework.md) → [14 Security & states](14-security-audit-error-handling.md) → [17 Status matrix](17-status-limitations-roadmap.md) |

---

## Table of contents

| # | Section | Covers |
|---|---|---|
| [01](01-system-overview.md) | **System Overview & Business Objectives** | What it is/isn't, the business problem, objectives, Money→Delivery→People→Pipeline ordering, value, ground-truth caveat |
| [02](02-user-types-roles-permissions.md) | **User Types, Roles & Permissions** | 8 user types & responsibilities; single implied super-user reality; target RBAC matrix |
| [03](03-information-architecture-navigation.md) | **Information Architecture & Navigation** | Full 24-route sitemap, sidebar/topbar, command palette, AI assistant, shortcuts |
| [04](04-modules-dashboard-projects.md) | **Modules: Dashboard & Projects** | Dashboard, Delivery & Ops, Portfolio, Project Detail (7 tabs), Approvals, Document Control, Risks, Calendar |
| [05](05-modules-finance-clients-people.md) | **Modules: Finance, Clients, Growth & People** | Financials, Profitability, Clients (+detail), Pipeline, Goals, Resourcing |
| [06](06-modules-intelligence.md) | **Modules: Intelligence** | AI Reports, AI Assistant, Review Queue, Scheduled Reports, Activity Log, Global Search |
| [07](07-modules-data-setup.md) | **Modules: Data & Setup** | Manual Capture (6 forms), Data Sources, Data Quality, Settings |
| [08](08-data-architecture-lifecycle.md) | **Data Architecture & Lifecycle** | 21-entity model, ERD/relationships, full data lifecycle (entry→storage→archiving) |
| [09](09-validation-framework.md) | **Validation Framework** | All 16 validation types as a target spec; what's enforced now vs [BACKEND] |
| [10](10-dashboards-kpis.md) | **Dashboards & KPI Calculation Logic** | All 10 dashboards, exact formulas, sources, decisions supported |
| [11](11-notifications-automation.md) | **Notifications, Approvals & Automation** | Alerts model, AI report scheduling, maker-checker approvals |
| [12](12-integration-architecture.md) | **Integration Architecture** | 17-source connector catalog, cadence classes, connection methods |
| [13](13-backend-database-requirements.md) | **Backend & Database Requirements** | Swappable API contract, hook→endpoint→table map, Postgres schema, multi-tenancy |
| [14](14-security-audit-error-handling.md) | **Security, Audit & Error Handling** | Finance band, RBAC target, audit log, UI states & error handling |
| [15](15-workflows-end-to-end.md) | **End-to-End Architectural Workflows** | 24 firm workflows as Input→Validation→Processing→Approval→Storage→Reporting→Follow-up + examples |
| [16](16-reporting-ai-analytics.md) | **Reporting, AI & Analytics** | Report model & kinds, AI assistant, anti-hallucination design |
| [17](17-status-limitations-roadmap.md) | **Feature Status, Limitations & Roadmap** | Master status matrix, current limitations, future requirements, phased plan |
| [18](18-glossary.md) | **Glossary** | Domain (RAJUK, VAT/VDS/AIT…), product, and technical terms |

---

## The system in one paragraph

The app surfaces an architecture firm's operations across four lanes — **Money** (fees, billing, collections, profitability), **Delivery** (schedule, authority approvals, deliverables), **People** (resourcing/utilization), and **Pipeline** (BD) — through dashboards, cited AI reports, a natural-language assistant, and a first-class **manual-capture** layer for the high-value data (decisions, approvals, scope, effort) that has no API. Its signature is **trust**: every figure carries a confidence level and a "Why this number?" provenance trail, and the system **refuses to fabricate** — showing an *insufficient-data* state rather than a guessed number (e.g. firm-wide margin and spare capacity are deliberately withheld until timesheet coverage clears threshold). It is tuned for Bangladesh: BDT-native finance that models the **VAT → VDS → AIT** withholding chain (so "billed never equals cash"), and **RAJUK/FSCD/CAAB/DoE/utility** approvals as first-class, schedule-driving milestones.

## Companion documents

- [`../blueprint/`](../blueprint/00-BLUEPRINT.md) — the upstream product & build blueprint (industry research, data/integration architecture, KPI dictionary, roadmap, pilot plan).
- [`../app/`](../app/README.md) — the running frontend prototype (Vite + React + TypeScript).

> Cross-reference note: where this documentation says **[BACKEND]** or **[INTEGRATION]**, the *design* for that capability already lives in the blueprint — this set records what is **built**, the blueprint records what is **planned in depth**.
