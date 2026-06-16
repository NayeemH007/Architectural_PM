# PracticeLens — Product & Build Blueprint
### An AI-powered reporting & analytics layer for architecture firms
**Pilot target:** a small (5–30 staff) full-service architecture practice in Dhaka, Bangladesh
**Build posture:** funded small team → single-firm pilot in ~6 months → productize to multi-tenant SaaS
**Status:** blueprint v1 (2026-06-14). Working product name *PracticeLens* is a placeholder.

> This is the front door. The 16 detailed section files below contain the full specification (~61,000 words). Read this master first: it carries the executive summary, the opinionated cross-cutting decisions, the deliverables map, and the single most actionable artifact — the **validation & access checklist** you must run with the pilot firm before committing code.

---

## 1. What PracticeLens is (in one paragraph)

PracticeLens is a **read-first intelligence and reporting layer that sits on top of the tools a firm already uses** — Excel, Tally/QuickBooks, Google Drive/Microsoft 365, email, and WhatsApp — and turns scattered, mostly-uncaptured operational reality into a single queryable, audited dataset with trustworthy KPIs, dashboards, scheduled reports, and an AI that answers "how is the business doing?" **with citations and the discipline to refuse when the data isn't there.** It is explicitly **not** an ERP, a BIM platform, or a project-management app, and it never becomes the source of truth — the original systems stay authoritative. The product's promise is not "more software"; it is **trust**: every number is traceable to a source record, a date, and a calculation, and every gap is shown rather than hidden.

---

## 2. Executive summary

**The opportunity, and the hard truth.** A small Dhaka architecture firm runs almost entirely on informal data. The system-of-record hierarchy is, literally, *the principal's head → WhatsApp → email → Excel → paper → the RAJUK portal.* Almost nothing the owner needs to manage the business — true per-project profitability, who's overloaded, which approvals are stuck, where scope crept unbilled — lives in any queryable database. The conventional "connect their APIs and build dashboards" playbook **fails on contact** here, because the high-value data was never recorded anywhere an API can reach. This single fact reshapes the entire product.

**The central pivot: capture before integration.** Because the valuable data is uncaptured, a **lightweight manual-capture layer — sub-30-second smart forms plus templated Excel/CSV imports — is a first-class connector, ranked equal to (in the pilot, ahead of) any API integration.** API connectors fetch the *cheap* data (file presence in Drive/SharePoint, email metadata for response-time signals); manual capture creates the *expensive, decisive* data (decisions, approvals, scope changes, and the firm's first-ever effort/timesheet records). The pilot's first three months stand up entirely on manual capture + a finance export, with **zero third-party API dependency**, and still deliver the owner's top two priorities.

**Anti-hallucination is the product, not a feature.** The architecture enforces a hard separation: **the LLM never computes a number and never queries the database.** All figures come from a deterministic, versioned, provenance-stamped semantic layer (KPI functions in Python); Claude only chooses which typed read-only tools to call and writes narrative around facts it is handed, with a post-generation validator that rejects any number in prose not present in the fact bundle. Every output cites source records, dates, calculation logic, and a computed confidence level, and **"insufficient data" is a first-class output state** — when timesheets don't exist, the system shows a capture prompt instead of a fabricated margin. An omnipresent **Data Completeness Score** means users never mistake "no data" for "good data."

**Bangladesh is in the bones, not bolted on.** Three local realities are modeled as core, not edge cases:
- **Finance reality:** every invoice separates gross fee, 15% VAT, VDS withheld, and ~10% AIT/TDS withheld (≈20% non-resident), in BDT-native with USD/FX captured at both invoice and settlement — so the system reports **net cash collected, not invoice face value** (a naïve build mis-states collections and cash).
- **Authority approvals as the flagship feature:** RAJUK (Land Use Clearance + Construction Permit), plus FSCD, CAAB, DoE, City Corporation, and occupancy-stage utility connections (DESCO/DPDC, WASA, Titas) are the dominant, opaque, external schedule milestones and the owner's #1 delivery worry. Modeling them as dependency-aware Approval/Milestone records with expected-vs-actual cycle times — making "where is approval stuck, and for how long" measurable for the first time — is the most defensible pilot "wow."
- **Bilingual data hazard:** Bangla/English with the **Bijoy(ANSI)↔Unicode incompatibility** is the top data-engineering risk. Store UTF-8, normalize Bijoy→Unicode on ingest, keep dual-script fields, render Nikosh in review/PDF, and make project/client matching tolerant of script, transliteration, and code aliases.

**The build shape.** Single-tenant *run*, multi-tenant *ready*: `tenant_id` leads every key, Postgres Row-Level Security ships in the pilot (tested, not bolted on later), and the expensive productization parts (warehouse, USD+BDT billing, self-serve onboarding) wait for a real second tenant — making the SaaS phase a productization, not a rewrite. Value is sequenced to the owner's priorities: **MONEY (profitability, fees, collections) → DELIVERY (deadlines, schedule, authority approvals) → PEOPLE (utilization — which must be *bootstrapped* because timesheets don't exist) → PIPELINE (BD, lightest, last).**

**MVP, in one breath.** A thin data spine; a frictionless capture layer; templated Excel/CSV + one cloud connector (Google *or* Microsoft) + email/calendar; four dashboards (Executive, Project Health, Financial, Resource) plus a Bangladesh-specific Authority-Approvals view; a weekly per-project AI report; and a Data-Quality/Integration-Health dashboard as the trust backbone. **Deliberately out:** BIM/CAD model analytics (files are presence signals only), deep construction-admin (RFIs/submittals are capture stubs), WhatsApp API automation (manual outcome logging only), full multi-tenant billing/self-serve onboarding, heavy ML, consultant/client portals, native mobile, and any write-back to source systems.

**Recommended MVP stack (one line).** One PostgreSQL via **Supabase** (Singapore region, RLS from day one) for OLTP + analytics + pgvector; **Python/FastAPI** for the API, the deterministic semantic layer, and Claude tool-calling orchestration; **custom React** dashboards (provenance chips + confidence + refuse-when-missing states no BI tool models), with **Metabase** optionally embedded as a read-only "explore" tab; **n8n + Prefect** for glue and scheduled jobs; **Claude** (Haiku for ingest extraction, Sonnet for narration, Opus for high-stakes bilingual judgement) behind a provider interface. No Snowflake/BigQuery at pilot scale.

**Cost, team, timeline (headline).** ~6-person team (3 full-time + 3 fractional, leveraging Dhaka's 4–8× cost advantage); pilot one-time **~$66k–$127k (৳7.9M–৳15.2M)** with a **~$10.6k–$20k/month** run-rate that is **80–85% people** — infra is ~$150–$500/mo and Claude usage ~$100–$520/mo. Pilot live by ~week 25. The scarcest, must-hire-week-1 role is a **practicing IAB architect as domain consultant** — they gate the correctness of the phase/fee/approval model.

**The one risk that matters most.** Not APIs — **adoption.** If the ~3–10 lead/architect users won't spend <60 seconds/day in the capture forms, every downstream KPI starves regardless of code quality, and the People lane never lights up. We treat this structurally: ruthless capture friction reduction, a 5-stage "timesheets don't exist yet" ramp, capture instrumented as a leading metric from day one, and People KPIs ring-fenced to "insufficient data" so missing effort never silently corrupts Money/Delivery.

---

## 3. Key cross-cutting decisions (the opinionated calls)

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **Manual capture is a first-class connector**, not a fallback | The decisive data (approvals, decisions, scope changes, effort) has no API in this firm |
| D2 | **LLM never computes or queries**; numbers come from a deterministic semantic layer; LLM only narrates cited facts | Structural anti-hallucination; also makes the AI model-portable |
| D3 | **"Insufficient data" is a valid output**; an omnipresent Data Completeness Score gates every KPI | Honesty over false confidence; turns gaps into a visible adoption metric |
| D4 | **Single-tenant run, multi-tenant ready** — `tenant_id` + RLS from day one; defer billing/onboarding/warehouse | Productization later becomes config, not rewrite |
| D5 | **Authority approvals (RAJUK/FSCD/CAAB/DoE/utilities) are first-class milestones** and a flagship MVP feature | Owner's top delivery concern; uniquely Bangladeshi; previously unmeasurable |
| D6 | **Finance models net cash** (gross fee − 15% VAT handling − VDS − ~10%/20% AIT) in BDT + FX | Invoice face value ≠ cash collected; naïve accounting is wrong here |
| D7 | **Bijoy→Unicode normalization + dual-script fields** on ingest | Top data-engineering hazard; ungoverned text never matches |
| D8 | **One Postgres (Supabase, Singapore), no warehouse** at pilot scale; Python/FastAPI; custom React dashboards | Right-sized for KB–MB of data; semantic layer must live in code, not a BI tool |
| D9 | **WhatsApp is forward/screenshot capture only** in MVP (no backfill exists); Cloud API persistence is a later, opt-in path | Meta provides no history/replay API |
| D10 | **Read-only everywhere; no write-back to source systems**, ever | Source systems stay authoritative; lowers trust + integration risk |
| D11 | **Build value in MONEY → DELIVERY → PEOPLE → PIPELINE order**; People is *bootstrapped*, not assumed | Matches owner pain and the data-creation reality |
| D12 | **PDPO 2025 handled by data minimization**: don't ingest NID/TIN/passport; region-selectable Singapore/Mumbai; BD local-mirror designed but built only for restricted/CII data | Sidesteps cross-border-transfer approval for the pilot |

---

## 4. Deliverables index (maps the brief's 20 required outputs to files)

| Section file | Title | ~Words | Covers brief's output(s) |
|---|---|---:|---|
| **00-BLUEPRINT.md** (this file) | Executive summary, decisions, validation checklist | — | #1 Exec summary, #20 Next actions |
| [01-industry-findings.md](01-industry-findings.md) | How architecture firms operate | 5,208 | #2 Industry findings |
| [02-software-ecosystem.md](02-software-ecosystem.md) | Current software & capability assessment | 3,479 | #3 Current software ecosystem |
| [03-product-vision.md](03-product-vision.md) | Product vision & definition | 3,047 | #4 Product vision |
| [04-user-groups.md](04-user-groups.md) | Users & stakeholder analysis | 3,778 | #5 User groups |
| [05-dashboard-specification.md](05-dashboard-specification.md) | All 15 dashboards specified | 4,248 | #8 Dashboard specification |
| [06-ai-reporting-design.md](06-ai-reporting-design.md) | AI reporting layer & anti-hallucination | 3,174 | #10 AI reporting design |
| [07-data-architecture.md](07-data-architecture.md) | Central analytics data model + cross-ref | 4,019 | #11 Data architecture |
| [08-integration-architecture.md](08-integration-architecture.md) | Integration strategy + data source map + matrix | 3,885 | #6 Data source map, #7 Integration matrix |
| [09-kpi-dictionary.md](09-kpi-dictionary.md) | KPI dictionary (26 + 5 additions) | 2,680 | #9 KPI dictionary |
| [10-technical-architecture.md](10-technical-architecture.md) | Stack comparison + MVP & scale architectures | 3,584 | #12 Technical architecture |
| [11-security-governance.md](11-security-governance.md) | Security & governance plan | 4,570 | #16 Security plan |
| [12-mvp-scope.md](12-mvp-scope.md) | MVP scope (in and explicitly out) | 3,627 | #13 MVP scope |
| [13-development-roadmap.md](13-development-roadmap.md) | 9-phase roadmap | 3,652 | #14 Development roadmap |
| [14-pilot-plan.md](14-pilot-plan.md) | Pilot implementation plan + access checklist | 5,000 | #15 Pilot plan |
| [15-risks-mitigations.md](15-risks-mitigations.md) | 21 risks scored + mitigations | 3,683 | #17 Risks & mitigations |
| [16-cost-team-next-actions.md](16-cost-team-next-actions.md) | Cost categories, team, next actions | 3,704 | #18 Cost categories, #19 Team, #20 Next actions |

---

## 5. Validate & request from the pilot firm — *before* committing the build

The detailed checklist (with what blocks what, and explicit refusal of write-access and sensitive identifiers) is in [14-pilot-plan.md](14-pilot-plan.md). Below is the deduplicated, prioritized version of the **113 open questions** the section authors surfaced. Resolve **Blockers** in discovery week 1.

### 🔴 Blockers — answer before architecture is fixed
| Theme | What to confirm |
|---|---|
| **Accounting source of truth** | Is finance in Excel/manual registers, TallyPrime (which version — pre/post 4.0 ODBC deprecation?), or QuickBooks/Xero? Decides whether MVP runs on templated Excel import alone (it's scoped to) or warrants an early connector. |
| **Cloud productivity suite** | Google Workspace, Microsoft 365, both, or mostly local servers/PCs? Decides which single cloud connector ships first, and how much sits on un-API'd local disks. Is there a reachable admin to grant read-only OAuth consent? |
| **Timesheet willingness** | Do timesheets genuinely not exist, and will the ~3–10 lead/architect users adopt <60-sec effort capture? This is the **riskiest success criterion** and gates all People/utilization/true-margin KPIs. Need the principal's explicit buy-in. |
| **Fee & tax constants** | Obtain the **IAB 2018 Scale of Minimum Fees** (exact % bands + staged-payment splits) and the **precise FY2025-26 AIT/TDS section + rate** for architect fees (resident ~10% vs non-resident ~20%) and whether clients deduct VDS at source. Currently `[ASSUMED]/[VERIFY]` — must be primary-sourced before the MONEY model is trustworthy. |
| **Data residency / PII** | Will any pilot data store sensitive identifiers (NID/TIN/passport)? If they can be excluded/minimized, the pilot sidesteps PDPO 2025 cross-border-transfer approval and the in-Bangladesh local mirror entirely. Pick region: **Singapore (service breadth) vs Mumbai (latency)** — run a Dhaka latency test. |

### 🟠 Important — calibrate during discovery / KPI workshop
| Theme | What to confirm |
|---|---|
| **Project naming tangle & count** | How many active/recently-closed projects, and how tangled are aliases (folder names vs invoice client names vs WhatsApp shorthand vs RAJUK file numbers)? Scopes the ProjectCrossReference matching effort and the human-review queue. Is the ECPS application number recorded consistently enough to be a deterministic match key? |
| **WhatsApp posture** | Manual paste/screenshot capture for the pilot (recommended), or scope a forward-only Cloud API persistence path? Confirm staff will realistically log WhatsApp decisions/approvals. |
| **Authority scope** | Which approvals are routine for the firm's dominant work (RAJUK LUC/CP + FSCD always; CAAB/DoE conditionally)? Who owns status entry — principal or RAJUK liaison/agent? |
| **Threshold & weight calibration** | Sign off Project Health Score sub-weights (0.30 budget / 0.25 schedule / 0.20 deliverable / 0.15 approval / 0.10 completeness) and the 49-cap on overdue blocking approvals; set alert thresholds (overdue-invoice days, approval-pending days, fee-burn tolerance) to the firm's real risk appetite. |
| **Finance redaction culture** | Will Project Directors accept a "restricted — finance" placeholder where margin would be, in an everyone-sees-everything single-room firm? The control is correct but needs change-management buy-in. Who is the Finance/Admin seat — owner, or a part-time bookkeeper? |
| **Seat mapping** | Validate merging Project Director + Project Manager into one MVP seat; confirm whether a capture-only login is needed for a RAJUK liaison. |
| **Scope baseline** | Will a scope baseline be captured in the Contract at setup? Change Exposure and Schedule Variance both return "insufficient data" without it. |

### 🟡 Confirm before go-live / for productization
| Theme | What to confirm |
|---|---|
| **PM tool** | Any Trello/Asana/ClickUp/monday in partial use (and any usable time data to bootstrap)? Decides whether the opportunistic PM connector is wired or left dormant. |
| **BIM maturity** | Any projects on Revit/ACC vs AutoCAD 2D + SketchUp? Decides if an Autodesk APS connector has near-term value (assumed: no, post-MVP). |
| **Commercials** | Target monthly price point (BDT) and owner willingness-to-pay, so the value framing ("recover one unbilled scope change / aged invoice per quarter") is calibrated; agree the pilot ROI baseline for scoring at close. |
| **Billing entity** | Is an offshore (US/SG) entity / international card in place to pay USD cloud + Stripe (unavailable in BD) and collect SaaS revenue (bKash/SSLCOMMERZ/Payoneer)? Budget ~3–6% FX premium. |
| **Team** | Confirm headcount and whether the team is Python-native (the FastAPI consolidation assumes it); validate Dhaka salary bands for the two anchor roles. |
| **Client-facing reports** | Does the owner want client-facing weekly reports in the pilot (triggers the human-approval gate workflow), or internal decision-support only? |
| **Local mirror provider** | If restricted/CII data is ever in scope, identify and price a named Bangladesh Tier-III/IV data center (zero-cost at pilot stage). |

---

## 6. Immediate next actions (condensed — full version in section 16)

**This week**
1. Lock the pilot firm and sign a lightweight pilot agreement with **written success criteria** and a committed internal Champion + two active users (Project Director/Manager + Finance/Admin).
2. **Secure the AEC domain consultant** (practicing IAB architect/principal) — scarcest hire, gates schema correctness.
3. Open the **🔴 Blocker** checklist above as the discovery interview agenda.

**Days 1–30**
4. Run discovery: software inventory, data-access assessment, and the **project naming/identity audit** (the spine — build the canonical Project register + alias table).
5. Stand up the **multi-tenant schema spine** (`tenant_id` + RLS + provenance + IntegrationRecord) and wire 2–3 trivial KPI functions end-to-end to de-risk the semantic layer.
6. Ship the **manual-capture layer** + templated finance importer.

**Days 30–60**
7. Ship the **MONEY** lane end-to-end (fees/invoices/payments/expenses with VAT/VDS/AIT net-cash, Invoice Aging, Collection Rate, WIP) on the Financial + Executive dashboards.
8. Light up the chosen single cloud connector (Google *or* Microsoft) for file-presence + email metadata.

**Days 60–90**
9. Ship the **DELIVERY** lane: Milestones/Approvals incl. all authorities, Schedule Variance, the Authority-Approvals dashboard, Project Health dashboard.
10. Ship a **Data-Completeness-gated PEOPLE slice** (bootstrap timesheets; KPIs render "insufficient data" until coverage clears threshold) and the **weekly AI report** with full provenance + refuse-when-missing.
**Success = the owner relies on the MONEY dashboard for a real, fully-traceable BDT decision.**

---

## 7. Confidence & source notes

- Section authors used current (2025–2026) web sources and **separated CONFIRMED from ASSUMED** throughout. The notable **`[VERIFY]`** items are: the IAB 2018 fee-scale percentages/staged-payment splits, the exact resident vs non-resident AIT/TDS section & rate for FY2025-26, CAAB OLS height limits, and a named Bangladesh data center for any future local-mirror obligation. These are flagged as Blocker validation items, not coded as fact.
- The research **corrected the brief's outdated assumption**: Bangladesh data protection is no longer a mere draft — it is treated as the **enacted PDPO 2025 + Feb 2026 amendment** with risk-based localization and ~May 2027 enforcement.
- All firm-behaviour assumptions (no timesheets, AutoCAD-2D dominance, liaison-driven RAJUK, verbal/WhatsApp approvals, no formal closeout) are **archetype assumptions to validate by field interview** before hard-coding.
