# Product Vision & Definition

> Working name: **PracticeLens** (placeholder). This document defines what the product *is*, what it is *not*, the 12 capabilities it must deliver, how it is positioned, why a small Dhaka architecture practice would adopt it, and the principles that govern every downstream design decision in this blueprint.

---

## 1. Elevator Pitch

**PracticeLens is an AI-powered intelligence and reporting layer that sits on top of the tools a small architecture firm already uses — Excel, Tally, Google Drive, Microsoft 365, email, and the WhatsApp threads where the real decisions actually happen — and turns that scattered, half-verbal mess into trustworthy answers about money, deadlines, authority approvals, and people.** It does not replace AutoCAD, your accountant, or your project folders; it reads from them (and from lightweight forms your team fills in 30 seconds a day), stitches every record back to the right Project, computes a standard set of KPIs the same way every time, and gives the principal a daily/weekly picture plus plain-language answers to questions like *"which projects are losing money and why?"* — with every number traceable back to the source record, the date, and the calculation behind it. When the data isn't there, it says so instead of guessing.

---

## 2. North-Star Outcome

**Within one project lifecycle, the firm's principal can answer — in under a minute, in Bangla or English, with evidence — the four questions they currently answer by gut feel:**

1. **Money:** *Which projects, clients, and service types make or lose money, and how much fee is sitting uncollected right now?*
2. **Delivery:** *What is late or about to be late, and exactly where is each RAJUK / Fire Service / DoE / utility approval stuck and for how long?*
3. **People:** *Who is overloaded, who has capacity, and where is our effort actually going?*
4. **Pipeline:** *What work is coming, how much is it worth weighted, and are we winning?*

The deeper north-star: **PracticeLens converts a firm whose system-of-record is "the principal's head > WhatsApp > email > Excel > paper" into a firm that has its first real, queryable, audited dataset — without forcing it to abandon any of those tools or adopt a heavy new platform.** Success is measured not by features shipped but by whether the owner stops making BDT-scale staffing, pricing, and collection decisions on intuition.

---

## 3. What PracticeLens Is

PracticeLens is a **read-first analytics, reporting, and AI-summarization layer** for architecture and AEC practices. It is built as a multi-tenant-ready SaaS but proven first as a **single-firm pilot** (~6 months) with one Dhaka practice of 5-30 staff.

It does four things in sequence, prioritized for the small-firm pain order:

1. **Connects** to the firm's existing systems and to a **manual-capture layer** — read-only first, never owning the source data.
2. **Unifies** every record into a central analytics data model keyed on the canonical entities (`Company`, `Project`, `Milestone`, `Approval`, `Invoice`, `Fee`, `Timesheet`, …), resolving the fact that the same project is named five different ways across five tools via `ProjectCrossReference`.
3. **Computes** a fixed, standardized set of KPIs (Project Health Score, Forecast Project Margin, Invoice Aging, Collection Rate, Schedule Variance, Milestone Completion Rate, Utilization Rate, Weighted Pipeline, Data Completeness Score, …) the *same way every time*, so numbers are comparable across projects and over time.
4. **Explains** the data through dashboards, scheduled reports, AI management summaries, anomaly/risk detection, and a natural-language Q&A interface — where **every AI claim cites its source records, dates, and calculation logic, carries a confidence level, and refuses to answer when the underlying data is missing.**

PracticeLens treats the **manual-capture layer (smart web/mobile forms + templated Excel/CSV imports) as a first-class connector, equal in priority to API integrations** — because in a small Dhaka firm the highest-value data (a verbal client approval on WhatsApp, a RAJUK query received by phone, an unbilled scope change agreed on site) is *uncaptured by any system that has an API*. Building only API connectors would capture the cheap data and miss the valuable data.

---

## 4. What PracticeLens Is NOT (at this stage)

This is a positioning decision, not a hedge. Scope discipline is the difference between an adoptable layer and another abandoned heavy platform.

| PracticeLens is **NOT** | Because | What it does instead |
|---|---|---|
| An **ERP** (Deltek / BQE replacement) | The firm has no appetite or budget to migrate financials; Tally/Excel/QuickBooks stay the books of record | Reads finance data, computes WIP / EAC / margin / aging on top — never the ledger of record |
| A **BIM / CAD tool** (Revit / AutoCAD / ArchiCAD) | These have no practice-data API; the firm's drawing workflow is sacred | Treats `.dwg` / `.skp` / model files as **file-presence / deliverable signals** (existence, name, last-modified, revision) via the cloud file store |
| A **project-management app** (Asana / ClickUp / Procore) replacement | We refuse to add another daily task tool to manage; adoption dies on day three | Ingests PM-tool data *if it exists*, but assumes most tracking lives in WhatsApp/Excel and captures it lightly |
| A **source of truth** | Original systems stay authoritative; provenance must trace back to them | A derived, read-only analytics mirror with full lineage; if PracticeLens and Tally disagree, **Tally wins** |
| An **accounting / tax-filing tool** | NBR VAT/VDS/AIT filing is the accountant's job | Models VAT (15%), VDS, and AIT/TDS withholding so *cash-collected* is reported correctly — but does not file |
| A **WhatsApp client / CRM-of-record** | We don't own the conversation | Captures structured outcomes (approvals, decisions, scope changes) *from* conversations into the data model |

If, post-productization, a richer-market tenant wants write-back or deeper PM features, those become **opt-in pluggable modules** — not a change to this core thesis.

---

## 5. The 12 Required Capabilities

These are the contractual capabilities of the product. Every one must be demonstrable in the pilot (some at MVP depth, some at thin-slice depth as noted).

| # | Capability | What it means concretely for a Dhaka firm | Pilot depth |
|---|---|---|---|
| **1** | **Connect to existing systems** | Pluggable connectors: templated Excel/CSV import, Google Workspace, Microsoft 365, email/calendar, **and the manual-capture layer**. Rich API connectors (Tally, QuickBooks/Xero, Autodesk APS, Procore) are pluggable and mostly post-MVP. | MVP: Excel/CSV + Google + Microsoft + email + manual capture |
| **2** | **Preserve source-of-truth** | Read-only-first. Original systems stay authoritative. No silent two-way sync. Every ingested record carries a `DataSource` + `IntegrationRecord` pointer. | MVP |
| **3** | **Central analytics data model** | One canonical model across all sources using the canonical entities. Heterogeneous inputs normalize to `Project`, `Fee`, `Invoice`, `Milestone`, `Approval`, `Timesheet`, etc. Unicode/UTF-8 storage; Bijoy→Unicode normalization on ingest. | MVP |
| **4** | **Map records to the same Project** | `ProjectCrossReference` resolves aliases — "Gulshan Apt", "Mr. Rahman House", `PRJ-014`, the Drive folder name, and the Tally ledger name are one Project. Bilingual / mixed-script matching, human-confirm on low-confidence matches. | MVP (with human-in-the-loop) |
| **5** | **Standardized KPIs** | The canonical KPI set computed by a single, versioned definition. "Margin" means one thing firm-wide. Each KPI states its formula, inputs, and a `Data Completeness Score`. | MVP (Money + Delivery KPIs first) |
| **6** | **Dashboards** | Role-aware dashboards: Owner (firm money + delivery + risk), Project Director/Manager (their projects), Project Architect (deliverables/approvals), Finance/Admin (invoicing/collections). | MVP |
| **7** | **Scheduled reports** | Auto-generated daily/weekly/monthly digests (PDF + in-app) — e.g., a Monday "money + deadlines + stuck approvals" brief to the owner, with Bangla-capable rendering (bundled Nikosh font). | MVP (weekly owner report) |
| **8** | **AI management summaries** | Plain-language narrative over the KPIs: *"Project margin forecast on the Bashundhara villa dropped 12% this month; cause: 3 unbilled scope changes (BDT 180k) + RAJUK CP delay pushing CA effort."* | MVP (templated + grounded) |
| **9** | **Detect delays / risks / anomalies / missing info** | Rules + models flag: overdue `Milestone`/`Approval`, stalled RAJUK/Fire/DoE submissions, aging invoices, negative margin trend, **and missing data** (e.g., "no timesheets logged for Project X → margin unknowable"). | MVP (rule-based first) |
| **10** | **Natural-language Q&A** | Ask in Bangla or English: *"Gulshan project e koto taka baki ache?"* / *"Which clients owe us more than 90 days?"* Answers grounded strictly in the data model. | MVP (thin slice over Money + Delivery) |
| **11** | **Source references behind every AI answer** | **Anti-hallucination is a hard requirement.** Every AI claim cites the source records, dates, and calculation logic, shows a confidence level, and **refuses when data is missing** rather than fabricating. | MVP (non-negotiable) |
| **12** | **Permissions + audit logs** | Moderate RBAC (canonical roles; MVP subset = Owner, Project Director/Manager, Project Architect, Finance/Admin). Project-level access; **finance data restricted to Owner + Finance/Admin.** Full `AuditLog` of who saw/changed/exported what. | MVP |

---

## 6. Positioning: The Intelligence & Reporting Layer

PracticeLens occupies a deliberately thin, high-leverage slice of the stack:

```
┌──────────────────────────────────────────────────────────────┐
│  PRACTICELENS — Intelligence & Reporting Layer                 │
│  Q&A · AI summaries · dashboards · scheduled reports ·         │
│  anomaly/risk detection · standardized KPIs · provenance       │
├──────────────────────────────────────────────────────────────┤
│  Central analytics data model (canonical entities + KPIs)      │
│  ProjectCrossReference · DataSource · AuditLog                 │
├──────────────────────────────────────────────────────────────┤
│  CONNECTOR LAYER (read-first, pluggable)                       │
│  Excel/CSV import · Google · Microsoft · email/cal ·           │
│  MANUAL CAPTURE (forms) ││ post-MVP: Tally/QBO/Xero/APS/...     │
├──────────────────────────────────────────────────────────────┤
│  THE FIRM'S EXISTING WORLD (sources of truth — untouched)      │
│  AutoCAD/SketchUp/Revit · Tally/Excel/QuickBooks ·             │
│  Drive/SharePoint/local servers · WhatsApp · email · paper     │
└──────────────────────────────────────────────────────────────┘
```

The competitive framing for the buyer: this is **not** "switch to Monograph/BQE/Deltek." Those are heavy platforms that demand the firm change how it works (mandatory timesheets, formal project setup, migrated books) — and small Dhaka firms reject them for exactly that reason. PracticeLens is the **opposite bet**: *keep working the way you work; we'll make sense of it and gently add the few missing primitives.* It is closer in spirit to "a BI + AI analyst that already knows architecture practice and Dhaka's approval regime" than to a PM tool.

---

## 7. The Manual-Capture-as-Connector Thesis

This is the load-bearing idea of the whole product, and it is contrarian to how most integration platforms are built.

**The central insight:** in a small Dhaka firm the system-of-record is, in descending order, *the principal's head → WhatsApp → email → Excel → paper → the ECPS portal.* The data with the **highest analytic value is precisely the data with no API**:

- **Client approvals** given verbally / on WhatsApp ("client said yes to the elevation").
- **Authority-submission status** known only via phone calls and the liaison's memory ("RAJUK asked for a revised mouza map").
- **Progress %** that is a gut feel in the project lead's head.
- **Scope changes** agreed informally on site — the single largest silent margin leak.
- **Effort/time** — because timesheets very likely *do not exist yet*.

If we built only API connectors, we'd faithfully capture file timestamps and ledger balances while **missing every decision, approval, delay-cause, and scope change** — the data the owner actually needs. So the manual-capture layer is **co-equal with API integrations**, not a fallback:

- **Smart, ultra-light forms** (web + mobile, Bangla/English): "Log an approval" (who/what/when/source = WhatsApp/phone/email), "Log a scope change," "Quick time entry," "Update milestone %." Designed for sub-30-second entry because adoption dies otherwise.
- **Templated Excel/CSV imports** that match how the firm *already* keeps registers — we meet them in Excel rather than forcing data entry into a new UI.
- **WhatsApp as a structured-capture funnel** (forward-looking only): because the WhatsApp Cloud API has **no message-history/backfill** and Meta retains nothing queryable, we cannot mine old chats — but we *can* let staff turn a chat outcome into a `Decision`/`Approval`/`Change` record going forward, and persist every raw inbound webhook from day one.

**The thesis in one line:** *the manual-capture layer is how we turn the principal's head and the WhatsApp threads into the firm's first real dataset — and it is a connector, not a feature.*

---

## 8. Value Proposition for a Small Dhaka Firm Owner

Framed in the owner's own pains (and BDT terms):

| Owner's pain today | What PracticeLens gives them | Priority |
|---|---|---|
| *"I don't know which projects make money — I just watch the bank balance."* | Per-`Project` and per-client **Forecast Project Margin**, fed by light effort capture + fee/invoice data. Finally answers "which work-type pays best." | **MONEY (1)** |
| *"Clients owe me but I lose track of who and how much; AIT withholding confuses the cash picture."* | **Invoice Aging** + **Collection Rate** + correct modeling of VAT (15%), VDS, and AIT/TDS so *net cash collected* is reported, not just invoiced. | **MONEY (1)** |
| *"I find out a deadline slipped only when the client is angry."* | **Schedule Variance**, **Milestone Completion Rate**, early-warning anomaly flags. | **DELIVERY (2)** |
| *"Where is the RAJUK approval stuck? Nobody can tell me."* | RAJUK LUC/CP, Fire Service NOC, DoE ECC, CAAB clearance, utility connections modeled as first-class `Approval` milestones with **Client/authority cycle-time** and stuck-status detection. | **DELIVERY (2)** |
| *"I don't know who's overloaded — and we don't even keep timesheets."* | A path to **Utilization Rate** by first *helping the firm create* lightweight time capture, then computing capacity. | **PEOPLE (3)** |
| *"I chase work and never know my win rate."* | **Weighted Pipeline** + **Proposal Win Rate** once `Opportunity`/`Proposal` are captured. | **PIPELINE (4)** |
| *"Reports take me a weekend in Excel."* | Auto **scheduled reports** + **NL Q&A** in Bangla/English; the owner stops being the dashboard. | All |
| *"I can't trust a black-box AI with my numbers."* | **Every answer cites sources, dates, math, and confidence; refuses when data is missing.** Trust is the product. | All |

The adoption promise: **low friction (no platform migration), fast first value (Money + Delivery answers in the pilot), and honest AI.** A firm spending, say, low-tens-of-thousands of BDT/month would justify it by recovering even one unbilled scope change or one aged invoice per quarter.

---

## 9. Single-Firm Pilot → Multi-Tenant Productization Narrative

**Phase 0 — Pilot (single firm, ~6 months).** One Dhaka practice (5-30 staff; residential-dominant full-service). Single-tenant *deployment*, but **multi-tenant-ready architecture from day one** (tenant-scoped data isolation, `Company`/`Office` partitioning, region-selectable residency baked in). Connector surface = Excel/CSV + Google + Microsoft + email/calendar + manual capture. KPI focus = **Money then Delivery**. Goal: prove the north-star outcome and harden the anti-hallucination + provenance machinery against real, messy, bilingual data.

**Why multi-tenant-ready now, despite a single pilot:** retrofitting tenancy is the classic SaaS rewrite trap. The pilot firm's data is tenant #1 in a model that already isolates by `Company` — so productization is onboarding, not re-architecture.

**Phase 1 — Productize (multi-tenant SaaS).** Generalize connectors (the pilot's "swap real stack later" connectors become a connector catalog), add the **People** and **Pipeline** KPI tiers, and open **pluggable rich API connectors** (Tally, QuickBooks/Xero first; Autodesk APS, Procore, Newforma, Deltek, BQE for richer markets) as opportunistic, opt-in modules. Data residency selectable (Singapore / Mumbai, with a **Bangladesh local-mirror option** for any data classed "restricted/CII" under the PDPO 2025 + 2026 amendment).

**Phase 2 — Scale.** Multi-office/multi-studio tenants (medium firms), benchmarking across anonymized tenants (utilization vs. the ~75-90% sweet spot, fee-adequacy by project type), and market-specific connector packs.

The pilot is not a throwaway prototype — it is **tenant #1 of the SaaS, run in single-tenant mode.**

---

## 10. Guiding Principles

These principles arbitrate every design trade-off in the rest of this blueprint.

1. **Reduce complexity — do not add another heavy platform.** If a capability requires the firm to change how it works daily, it's wrong by default. Meet them in Excel, WhatsApp, and email; add primitives only where the payoff is undeniable.

2. **Original systems are the source of truth; integrations are read-first.** PracticeLens is a derived mirror. No silent write-back. If our number disagrees with Tally or the bank statement, the source wins and we flag the discrepancy.

3. **Anti-hallucination is the product, not a feature.** Every AI claim cites source records + dates + calculation logic + confidence, and **refuses when data is missing.** A confident wrong answer about money is worse than no answer. Trust, once lost with an owner, ends the pilot.

4. **Provenance on every record.** Every entity, KPI, and AI statement is traceable to its `DataSource`, `IntegrationRecord`, ingestion timestamp, and (for derived values) its formula version. Auditability is not optional given finance + client data and the PDPO.

5. **Manual capture is a first-class connector.** The uncaptured, verbal, WhatsApp-resident data is the most valuable; designing for it is co-equal with API work, not an afterthought.

6. **Honest about data gaps — the `Data Completeness Score` is always visible.** When timesheets don't exist, we say "margin unknowable — labor cost uncaptured" rather than inventing a number. The product's job is partly to *make the gaps visible and naggable* so the firm closes them.

7. **Multi-tenant-ready, region-aware, and data-minimizing from day one.** Tenant isolation, BDT-first/multi-currency, Bangla/English bilingual, Unicode-normalized, and PDPO-aware residency (Singapore/Mumbai + BD local-mirror option) are foundational — not bolted on at productization.

---

## 11. Definition of "Done" for This Vision

The pilot validates this vision if, by month six, the principal of the pilot firm:

- gets a **weekly auto-report** they actually read, in their language;
- can **ask a money or delivery question in Bangla/English and get a sourced, confidence-rated answer** — or an honest refusal;
- can see **which projects are losing money** and **where every authority approval is stuck**, with provenance;
- trusts the numbers enough to **change a staffing, pricing, or collection decision** because of them;
- and has, for the first time, a **queryable dataset of their own practice** that didn't exist before — built without abandoning AutoCAD, Tally, Drive, or WhatsApp.

Everything else in this blueprint — the data model, the connector specs, the KPI definitions, the AI grounding architecture, the RBAC and audit design, the multi-tenant and residency plan — exists to make that paragraph true.
