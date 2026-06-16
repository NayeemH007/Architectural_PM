# Development Roadmap

> PracticeLens — the AI reporting & analytics layer above a Dhaka architecture firm's existing (mostly informal) tools. This section is the **build plan**: nine phases, paced for a funded small team to reach a working single-firm pilot in ~6 months, then productize into multi-tenant SaaS. It commits to a sequence, names the dependencies, and calls the critical path. Currency is **BDT** unless a foreign-client/USD case applies.

## How this roadmap is paced (read first)

Three constraints shape every date below.

1. **The pilot's hardest problem is not engineering — it is that the data does not exist yet.** No timesheets, verbal approvals, WhatsApp scope `Change`s, fee basis in the principal's head. So the roadmap front-loads the **Manual Capture Layer** and a *data audit* before anything else, and refuses to ship a dashboard until the underlying `Data Completeness Score` can support it. We build the capture wedge, then the analytics, then the AI narration — never the reverse.
2. **Multi-tenant-ready from day one, single-tenant in the pilot.** Phases 1–7 deliver the pilot. They are *built on* multi-tenant primitives (tenant-scoped `Company`, Postgres Row-Level Security, provenance on every record) so Phase 9 is a productization, not a rewrite. We pay the small upfront tax (a `company_id` on every row, RLS policies) and defer the expensive parts (warehouse, billing, self-serve onboarding) until there is a second tenant to justify them.
3. **A small team cannot parallelize everything.** Assume a realistic funded-startup squad: **2 full-stack/data engineers, 1 AI/backend engineer, 1 product/design lead (part-time founder), and a fractional Dhaka-based domain liaison** for field interviews and authority/finance ground truth. The plan sequences work so this team is never blocked on itself.

The **critical path** runs: *Data audit → canonical data model + RLS foundation → Manual Capture Layer + finance import → MONEY dashboards → AI narration over deterministic KPIs → pilot deployment*. Integrations beyond Google/Microsoft, and all BIM/construction analytics, are deliberately **off** the critical path.

---

## Timeline at a glance

| # | Phase | Duration | Calendar (indicative) | Exit criteria |
|---|---|---|---|---|
| 1 | Discovery & Data Audit | 3 weeks | Wk 1–3 | Signed data map of the pilot firm; confirmed finance source (Tally/Excel); `DataSource` inventory; ranked blind-spot list; IAB fee/tax assumptions verified |
| 2 | Data Model & Platform Foundation | 4 weeks | Wk 3–7 (overlaps Ph1 tail) | Canonical schema migrated; RLS enforced + tested; auth/RBAC (MVP roles); provenance + `IntegrationRecord` plumbing; semantic-layer function harness empty-but-working |
| 3 | First Integrations | 4 weeks | Wk 6–10 | Manual Capture forms live; templated Excel/CSV importer live; Google **or** Microsoft connector pulling file-presence + email/calendar; first real firm data in canonical tables |
| 4 | MVP Dashboards | 5 weeks | Wk 9–14 | MONEY + DELIVERY KPIs computed deterministically with provenance + `Data Completeness Score`; bilingual dashboard shipped; owner can see profitability/collections/approvals views |
| 5 | AI Reporting Layer | 4 weeks | Wk 13–18 | Claude tool-calling narrator over KPI functions; daily briefing + cash/fee/approval alerts; anti-hallucination + refusal verified; provenance chips on every claim |
| 6 | Pilot Deployment | 3 weeks | Wk 18–21 | Production in Singapore region; firm onboarded with real data; users trained; capture habit forming; support loop running |
| 7 | Feedback & Improvement | 4 weeks | Wk 21–25 | Iterated against real usage; PEOPLE/utilization unlocked if timesheets took; PIPELINE added; KPI accuracy validated against firm's own books |
| — | **PILOT COMPLETE** | **~6 months** | **end Wk 25** | Owner makes a real BDT decision on a PracticeLens report; renewal/expansion intent confirmed |
| 8 | Construction & BIM Analytics | 6–8 weeks | Post-pilot | APS/Procore/Newforma pluggable connectors; CA/RFI/Submittal/Approval cycle analytics; richer-market readiness |
| 9 | Multi-Tenant SaaS Expansion | 8–12 weeks | Post-pilot | Self-serve onboarding; connector marketplace; warehouse tier; BDT+USD billing; second paying tenant live |

> Phases overlap by design (the tail of one seeds the next). The 6-month figure is to *pilot complete*, not to feature-complete. Productization (Phases 8–9) is a separate funding/scope conversation.

---

## Phase 1 — Discovery & Data Audit (Wk 1–3)

**Objectives.** Replace assumptions with the pilot firm's actual reality. Produce a signed `DataSource` map and a ranked blind-spot list that *fixes the build order*. Verify the Bangladesh-specific numbers (IAB fee scale, AIT/TDS rate, RAJUK/ECPS flow) the financial KPIs will depend on.

**Features.** None shipped to users; this is research + an internal `DataSource` inventory artifact and a populated **data map** that later seeds the `DataSource` table.

**Data sources.** The firm itself: where do `Project`, `Fee`, `Invoice`, `Payment`, `Approval`, `Decision`, `Milestone`, `Timesheet` *actually* live today (principal's head > WhatsApp > email > Excel > paper > ECPS portal). Confirm finance reality: Tally/TallyPrime vs Excel registers vs QuickBooks/Xero. Confirm Google vs Microsoft (or both).

**Integrations.** None built. We *test access*: can we get a Tally export? A Google/Microsoft admin consent? A sample of the firm's project register and invoice ledger?

**Technical work.** Stand up the repo, CI, environments, and the Supabase (managed Postgres, Singapore) project shells. No schema yet beyond a scratch space for sample-data profiling. Profile the firm's Excel registers and a Tally export to derive the real importer column maps.

**UX work.** Field interviews (owner + 2–3 project leads). Map the actual capture moments — when does an `Approval` happen, who hears it first, on what device. Sketch the Manual Capture flows against real WhatsApp/site habits, not an idealized PM workflow.

**AI work.** Define the **KPI provenance contract** and confidence thresholds on paper: every KPI's inputs, formula, minimum `Data Completeness Score` to fire, and refusal copy. This is the spec the semantic layer (Ph2) and AI layer (Ph5) implement.

**Testing.** Validate sample data parses; reconcile a sample of the firm's own invoices against their books by hand to define "correct."

**Security.** Data Processing Agreement with the firm; data-minimization decision — which sensitive identifiers (NID, TIN) we *refuse* to ingest to stay clear of PDPO 2025 cross-border-transfer approval; residency decision (Singapore primary).

**Deliverables.** Signed data map; `DataSource` inventory; ranked blind-spot list; verified BD assumptions (IAB fee %, AIT ~10% resident, VAT 15%, RAJUK two-stage); KPI provenance contract.

**Dependencies.** Firm access + admin consent willingness. Domain liaison engaged.

**Risks.** Firm over-claims its data maturity in interviews ("we have all that in Excel") — mitigate by demanding *actual file samples* before believing any source exists. IAB fee figures are paid/offline — budget liaison time to obtain.

**Acceptance criteria.** A one-page data map signed by the owner; finance source confirmed with a real export in hand; blind-spot ranking agreed.

---

## Phase 2 — Data Model & Platform Foundation (Wk 3–7)

**Objectives.** Build the multi-tenant-ready spine: canonical entities, RLS, auth/RBAC, provenance, and the empty-but-working semantic-layer function harness. Nothing user-facing — but everything downstream stands on this.

**Features.** Internal: admin can create a `Company`/`Office`, `Employee`s, `Role`s; records carry provenance.

**Data sources.** None ingested yet; we model them.

**Integrations.** None; we build the `DataSource` / `IntegrationRecord` tables and the contract every connector will write through.

**Technical work.** Migrate the full canonical schema (`Company` … `ProjectCrossReference`) with `company_id` on every table and **Postgres Row-Level Security** policies enforced and tested. Raw-landing / canonical / semantic-mart schema separation (per the technical architecture). `IntegrationRecord` + provenance columns (source, observed-at, confidence) on every canonical row. Build the **semantic-layer KPI function harness** — versioned, testable SQL/Python functions — with the first 2–3 trivial functions wired end-to-end to prove the pattern (`Data Completeness Score`, `Invoice Aging`). FastAPI app skeleton; Prefect for scheduled jobs.

**UX work.** Bilingual (Bangla/English) shell: design system, `next-intl` scaffolding, Nikosh font bundled for Bengali rendering, dual-script name/address field components. Login + RBAC-gated navigation.

**AI work.** Implement the deterministic-only contract scaffolding: the function-registry the LLM will later call, returning structured output with provenance — but no LLM yet.

**Testing.** RLS test suite — *the* foundation test: prove tenant A can never read tenant B even with a forged `company_id`. Unit tests on the harness functions. Bijoy↔Unicode normalization unit tests on ingest.

**Security.** RLS as the multi-tenant boundary (verified, not assumed). Encrypted secrets store for connector tokens. Audit logging (`AuditLog`) on read of finance-restricted data.

**Deliverables.** Migrated schema; passing RLS test suite; auth + MVP RBAC (Owner, Project Director/Manager, Project Architect, Finance/Admin); provenance plumbing; semantic-layer harness with 2–3 live functions.

**Dependencies.** Phase 1 data map (entity field reality, finance shape).

**Risks.** RLS misconfiguration is a catastrophic multi-tenant leak — mitigate with the dedicated cross-tenant test suite *now*, not at Phase 9. Over-modeling: do not build `RFI`/`Submittal`/`Model` tables richly yet — stub them; they belong to Phase 8.

**Acceptance criteria.** Cross-tenant isolation test passes; a KPI function returns a number *with* its provenance and `Data Completeness Score`; finance-restricted fields invisible to non-Finance roles.

---

## Phase 3 — First Integrations (Wk 6–10)

**Objectives.** Get *real firm data* into the canonical tables through the three MVP-critical connectors: **Manual Capture, templated Excel/CSV import, and one cloud productivity connector (Google or Microsoft)** including email/calendar.

**Features.** Smart web/mobile capture forms (`Decision`, `Approval`, `Milestone` status, scope `Change`, `SiteReport`, bootstrap `Timesheet`); forward/screenshot capture for WhatsApp/paper approvals; templated Excel/CSV upload for the `Project` register, `Fee` schedule, `Invoice`/`Payment` ledger, `Expense`, drawing/sheet index.

**Data sources.** Manual capture (event-driven); firm's Excel registers + Tally export (scheduled/manual); Google Drive/Gmail/Calendar **or** Microsoft SharePoint/OneDrive/Outlook (file-presence + email/calendar).

**Integrations.** Manual Capture Layer (M7) and templated importer (M4) — built first and treated as first-class, equal to APIs. One of {Google Workspace, Microsoft Graph} per the firm's reality, using delta/change tokens; file-presence telemetry as the design-activity proxy. Tally/Excel = export-to-importer, **not** a live API in the pilot.

**Technical work.** Connector framework writing through the `IntegrationRecord` contract with idempotency + retry. CSV/XLSX parser with the Ph1-derived column maps + Bijoy→Unicode normalization. OAuth + token refresh for the cloud connector; webhook receiver (respond <10s) + scheduled reconcile sweep. `ProjectCrossReference` matching (alias/bilingual fuzzy match) to reconcile the same `Project` across Excel, Drive folders, and email subjects.

**UX work.** Capture forms tuned for *seconds-not-minutes* entry on a phone (the adoption make-or-break). Offline-tolerant PWA for site capture. Import wizard with validation/error preview. Bilingual throughout.

**AI work.** Optional assist (not a hard dependency): LLM-extraction of a structured `Approval`/`Decision` from a pasted WhatsApp screenshot/text — human-confirmed before save (never silent).

**Testing.** Round-trip import of the firm's real registers reconciled to their books. Connector retry/idempotency tests. OCR/extraction accuracy spot-check on Bengali screenshots with human verification.

**Security.** Read-only-first verified (no connector writes to a source). OAuth scopes minimized. Tokens encrypted. Sensitive-identifier ingestion blocked per Ph1 decision.

**Deliverables.** Live capture forms; working importer; one cloud connector pulling; real pilot data in canonical tables; `ProjectCrossReference` operating.

**Dependencies.** Ph2 schema + `IntegrationRecord` contract; firm admin consent.

**Risks.** **Adoption is the top risk** — if leads won't open the capture form, the dataset stays empty and every later phase starves. Mitigate by making capture lighter than the WhatsApp message it replaces, and by seeding from imports so the firm sees value before they've entered anything. WhatsApp Cloud API has *no backfill* — out of MVP scope; forward/screenshot capture covers it manually.

**Acceptance criteria.** The firm's last-quarter `Invoice`/`Payment` ledger imports and reconciles; ≥1 cloud connector syncs file-presence + email; a project lead saves a real `Approval` via the form on a phone.

---

## Phase 4 — MVP Dashboards (Wk 9–14)

**Objectives.** Turn the canonical data into the **MONEY** and **DELIVERY** dashboards the owner actually wants — every figure deterministic, sourced, and honest about gaps.

**Features.** MONEY: `Forecast Project Margin`, `Fee Burn Rate`, `EAC`, `WIP`, `Unbilled Revenue`, `Invoice Aging`, `Collection Rate` (modeling BDT + 15% VAT + ~10% AIT/TDS withheld so "expected cash ≠ invoice face value"). DELIVERY: `Schedule Variance`, `Milestone Completion Rate`, authority `Approval` tracker (RAJUK LUC/CP, FSCD, DoE, CAAB, utilities as first-class `Milestone`s), `Deliverable Completion Rate`, `Client Approval Time`, `Project Health Score`. Every tile carries a provenance chip + `Data Completeness Score`.

**Data sources.** All Phase 3 connectors.

**Integrations.** Consume existing; no new external connectors.

**Technical work.** Build out the semantic-layer KPI functions (the bulk of the canonical KPI set), versioned and unit-tested against Ph1 hand-computed truth. Mart schema materialization + scheduled recompute (Prefect). Empty/insufficient-data states wired to `Data Completeness Score`.

**UX work.** The curated bilingual dashboards (built in React per the technical architecture, not a BI tool): Owner cockpit, Project Director/Manager project view, Finance view (RBAC-restricted). Provenance chips, "data missing — capture this" empty states, drill-down to source records.

**AI work.** None yet — dashboards must be trustworthy *without* AI first, so the owner trusts the numbers before they trust the narration.

**Testing.** KPI golden tests: each function reconciles to the firm's own books / hand calc within tolerance. Visual/i18n QA in Bangla + English. Role-based visibility tests (Finance data hidden from non-Finance).

**Security.** Finance KPIs gated to Owner + Finance/Admin; `AuditLog` on finance views.

**Deliverables.** Shipped MONEY + DELIVERY dashboards; documented, versioned KPI functions; reconciliation report vs the firm's books.

**Dependencies.** Phase 3 real data; Ph1 verified fee/tax math.

**Risks.** Garbage-in: if `Timesheet` data is absent (likely), labour-cost-dependent KPIs (`Forecast Project Margin`, `Utilization Rate`) must *visibly* degrade rather than fabricate — show fee-side margin only with a hard caveat. Do not let an empty dataset render a confident-looking dashboard.

**Acceptance criteria.** Owner confirms ≥3 MONEY figures match their own understanding; an authority `Approval` slip surfaces on the DELIVERY view; every figure has a working source drill-down.

---

## Phase 5 — AI Reporting Layer (Wk 13–18)

**Objectives.** Add the **Claude tool-calling narrator** over the deterministic KPI functions: daily briefing, cash/fee/approval alerts, monthly report, natural-language Q&A — with anti-hallucination and refusal *proven*, not promised.

**Features.** Daily executive briefing (07:30 Asia/Dhaka, only on material change); cash collection warnings (aging-bucket crossings, AIT-aware expected cash); fee overrun detection (`EAC` → `Forecast Project Margin`, hard caveat when no `Timesheet`); approval/milestone-slip alerts; monthly company performance report (owner-gated draft); NL query over the semantic layer.

**Data sources.** Semantic-layer functions only — the LLM never queries the DB or computes a number.

**Integrations.** Anthropic Claude via SDK, behind a provider interface (swappable). Notification delivery (email/push; in-app).

**Technical work.** Tool-calling orchestration: LLM selects which versioned functions to call, reads structured output, writes narrative around facts it was *handed*. Deterministic detectors decide *whether there is something to say*; the LLM decides *how to say it*. Provenance pointer + confidence threaded into every generated claim. Capability downgrades to "we can't tell you this yet — here's what to capture" below threshold.

**UX work.** Report/briefing/alert surfaces with inline provenance chips and confidence; owner-gated review before any externally-shared report; bilingual narration.

**AI work.** Anti-hallucination test harness: adversarial prompts trying to make the model invent a number, contradict a KPI, or answer past missing data — all must refuse/caveat. Prompt + tool-schema hardening.

**Testing.** Refusal/anti-hallucination suite is the gate. Every narrated number must be traceable to a function call + record IDs. Regression test that narration never contradicts the dashboard figure.

**Security.** No raw PII into prompts beyond what a report needs; prompt-injection guards on ingested text (e.g. a WhatsApp message that says "ignore instructions"); audit of AI outputs.

**Deliverables.** Daily briefing + alert engine live; monthly report generator; NL Q&A; passing anti-hallucination suite.

**Dependencies.** Phase 4 KPI functions (the AI has nothing to narrate without them).

**Risks.** A single hallucinated BDT figure destroys owner trust permanently — hence refusal-first and human-gated reports. Over-alerting fatigue — tune thresholds to "material change only."

**Acceptance criteria.** Adversarial suite passes (no fabricated numbers); a daily briefing fires on a real change with correct provenance; the model refuses cleanly when `Data Completeness Score` is below threshold.

---

## Phase 6 — Pilot Deployment (Wk 18–21)

**Objectives.** Run PracticeLens in production for the firm, get users into a daily habit, and stand up the support loop.

**Features.** Production-hardened build of everything above; onboarding flow; in-app help (bilingual).

**Data sources / Integrations.** Production connectors with live tokens; backfill of the firm's historical registers.

**Technical work.** Production environment (Singapore primary, per residency decision); backups; observability (integration-health monitoring, error tracking); rate-limit/retry tuning against real connector quotas (Google/Microsoft throttling).

**UX work.** Hands-on training with owner + leads; capture-habit nudges; quick-reference cards in Bangla.

**AI work.** Tune briefing cadence/thresholds to the firm's real rhythm; calibrate confidence wording.

**Testing.** Production smoke + a full reconcile against the firm's current month. Load is trivial (one small firm) — focus on correctness and uptime, not scale.

**Security.** Production secrets rotation; PDPO 2025 posture documented (data minimization, residency, consent); incident runbook.

**Deliverables.** Live pilot; trained users; support + monitoring loop; onboarding doc.

**Dependencies.** Phases 1–5; firm's go-live consent.

**Risks.** Capture habit fails to form post-training — schedule weekly check-ins for the first month; instrument capture frequency as a leading adoption metric.

**Acceptance criteria.** Firm uses PracticeLens in normal operations for 2 weeks; capture is happening without prompting; monitoring green.

---

## Phase 7 — Feedback & Improvement (Wk 21–25)

**Objectives.** Iterate against real usage, close KPI-accuracy gaps, and unlock **PEOPLE** (utilization) and **PIPELINE** as the dataset matures.

**Features.** PEOPLE: `Utilization Rate`, `Billable Utilization`, `Planned vs Actual Hours`, `Resource Capacity` — *only if* bootstrap `Timesheet` capture took hold (the platform helps create timesheets that didn't exist). PIPELINE: `Pipeline Value`, `Weighted Pipeline`, `Proposal Win Rate` from the `Opportunity`/`Proposal` log. Refinements to MONEY/DELIVERY from feedback.

**Data sources / Integrations.** Same set, richer data; possibly a second cloud connector if the firm is split Google+Microsoft.

**Technical work.** Bug-fix and KPI-accuracy iteration; add PEOPLE/PIPELINE semantic functions; performance polish.

**UX work.** Friction-removal on the highest-drop-off capture forms; add the views the owner asked for in pilot.

**AI work.** Add PEOPLE/PIPELINE capabilities to the narrator; expand NL coverage; retune thresholds.

**Testing.** Validate utilization against any attendance data; re-reconcile finance KPIs after a full cycle.

**Security.** Review `AuditLog` for anomalous access; confirm minimization held.

**Deliverables.** Iterated pilot; PEOPLE/PIPELINE live (data permitting); validation report; productization go/no-go input.

**Dependencies.** Phase 6 real usage; timesheet adoption for PEOPLE.

**Risks.** Timesheets may simply not take in 6 months — that's an acceptable pilot finding; PEOPLE then ships partial with explicit caveats rather than fabricated utilization.

**Acceptance criteria.** Owner makes a real BDT decision off a PracticeLens report; expansion/renewal intent confirmed; KPI accuracy signed off.

---

## Phase 8 — Construction & BIM Analytics (post-pilot, 6–8 wk)

**Objectives.** Extend into CA/construction and BIM model data for richer projects and richer markets, via **pluggable** connectors (off the pilot critical path).

**Features.** CA analytics: `RFI Aging`, `Submittal Aging`, `Consultant Response Time`, `Change Exposure`, `Defect` recurrence, `SiteReport` rollups; BIM model activity/version signals.

**Data sources / Integrations.** Pluggable: Autodesk APS (Data Management + Model Derivative; mind the 8 Dec 2025 consumption pricing), Procore (RFI/submittal/budget), Newforma Konekt; WhatsApp Cloud API for live CA chatter (persist raw webhooks from day one — no backfill). Archicad/BIMcloud as needed.

**Technical work.** Connector framework extension for async translation jobs (APS), per-project scoping (Procore), webhook persistence (WhatsApp). New semantic functions for CA KPIs. Activate the stubbed `RFI`/`Submittal`/`Model`/`Revision` entities from Phase 2.

**UX work.** CA dashboard; model-activity view.

**AI work.** CA narration capabilities (RFI/submittal turnaround, change-exposure alerts).

**Testing.** Connector integration tests against sandbox tenants; cycle-time accuracy.

**Security.** Per-connector scope review; APS region/residency.

**Deliverables.** ≥1 BIM + ≥1 CA connector; CA analytics suite.

**Dependencies.** A firm/market that actually runs Procore/APS/Revit (the Dhaka pilot largely does not — this is productization-driven).

**Risks.** Building CA analytics with no customer who needs them — gate on demand, keep pluggable.

**Acceptance criteria.** A construction-phase firm's RFI/submittal cycle times render with provenance.

---

## Phase 9 — Multi-Tenant SaaS Expansion (post-pilot, 8–12 wk)

**Objectives.** Productize: self-serve onboarding, billing, connector marketplace, and the analytics warehouse tier — landing a second paying tenant.

**Features.** Tenant self-serve signup/onboarding; connector marketplace (toggle Google/MS/Tally/QBO/Xero/PM tools per tenant); BDT + USD billing (bKash/SSLCOMMERZ local, Payoneer/Wise/offshore-entity Stripe for foreign); admin/usage console; optional cross-tenant benchmarking.

**Data sources / Integrations.** Add the pluggable finance/PM APIs (QuickBooks Online, Xero, Tally XML, Smartsheet/Asana/ClickUp/monday) as marketplace connectors.

**Technical work.** Graduate analytics to a warehouse tier (Snowflake/BigQuery) *when volume justifies it*, keeping Postgres+RLS as OLTP. Tenant provisioning automation; rate-limit isolation per tenant; Airbyte/Dagster adoption as connector count grows. Region-selectable residency (Singapore/Mumbai) + BD local-mirror option for any restricted/CII data under PDPO 2025.

**UX work.** Onboarding wizard; billing UI; tenant admin; connector management.

**AI work.** Per-tenant model config; optional cross-tenant benchmark narration with strict isolation.

**Testing.** Multi-tenant load + isolation at scale (RLS verified again under concurrency); billing flows; onboarding E2E.

**Security.** Full PDPO 2025 compliance posture (residency, cross-border-transfer controls, consent) ahead of ~May 2027 enforcement; SOC2-track controls; per-tenant audit isolation.

**Deliverables.** Self-serve multi-tenant SaaS; billing live; ≥2 paying tenants; warehouse tier (if justified).

**Dependencies.** Phase 7 validated pilot; the multi-tenant primitives built in Phase 2 (this is why we paid that tax early).

**Risks.** Forex/Stripe friction from Bangladesh (offshore entity likely required); resisting premature warehouse spend before volume warrants it.

**Acceptance criteria.** A second firm self-onboards, connects sources, is billed correctly, and is provably isolated from tenant one.

---

## Critical path & sequencing notes

```
Ph1 Audit ─▶ Ph2 Model+RLS ─▶ Ph3 Capture+Import+CloudConnector ─▶ Ph4 MONEY/DELIVERY KPIs ─▶ Ph5 AI Narration ─▶ Ph6 Deploy ─▶ Ph7 Iterate
                                      (Google/MS connector runs parallel to capture build)
Off critical path: Ph8 BIM/CA  •  Ph9 Multi-tenant productization  •  WhatsApp/Tally-XML/QBO/Xero APIs (pluggable, opportunistic)
```

- **The single longest pole** is the Phase 4 KPI semantic layer — it is large, must be exact, and the AI layer (Ph5) cannot start narrating until it exists. Start the trivial KPI functions in Phase 2 to de-risk the pattern early.
- **The single biggest non-engineering risk** is Phase 3 capture adoption. If it fails, Phases 4–7 starve regardless of code quality. It gets the most field-iteration time and is instrumented as a leading metric from day one.
- **Multi-tenant work is deliberately split:** the cheap, irreversible-if-skipped parts (RLS, `company_id`, provenance) are in Phase 2; the expensive parts (warehouse, billing, self-serve) wait for Phase 9 and a real second tenant.
- **BIM/construction (Phase 8) is explicitly off the pilot path** because the Dhaka pilot firm is AutoCAD/SketchUp-and-WhatsApp, not Revit/Procore — building it now would be effort for a customer who does not exist yet.
