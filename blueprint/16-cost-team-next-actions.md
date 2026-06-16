# Cost Categories, Team Requirements & Next Actions

> PracticeLens (placeholder) — the AI reporting & analytics layer above a Dhaka architecture firm's existing, mostly informal tools. This section turns the blueprint into a fundable plan: **what it costs**, **who builds it**, and **what we do in the next 90 days**. It assumes the decisions already fixed elsewhere — Supabase/managed PostgreSQL hosted in **Singapore or Mumbai**, **Next.js + TypeScript** frontend, **Claude as a tool-calling narrator over deterministic semantic-layer functions**, a single Postgres for OLTP + analytics, manual capture as a first-class connector, and an MVP integration surface of `templated Excel/CSV import + Google connector + Microsoft connector + email/calendar metadata + manual capture`. Rich API connectors (Tally, QuickBooks/Xero, Autodesk APS, Procore, Deltek, BQE) are **pluggable and post-MVP**.
>
> **Costing posture.** This is a funded startup running a **single-firm pilot (~6 months)** then productizing. So we separate **one-time pilot build cost** from **monthly run-rate**, and we keep the run-rate deliberately tiny — a 5-30 staff firm produces kilobytes-to-megabytes of structured data a month, so we are not paying warehouse/streaming bills. The expensive line is **people**, and Bangladesh is where that line is cheapest without sacrificing quality.
>
> **Currency.** Figures are given in **USD and BDT**. FX assumption for this document: **USD 1 ≈ BDT 120** (round-number planning rate; FX-capture at actual settlement is a product feature, not a planning concern here). All ranges are *indicative planning bands for a funded BD startup*, not quotes — validate salaries against live local market and infra against actual provider pricing before committing budget.

---

## A. Cost Categories

Seven categories. For each: what it actually buys for *this* product, the **one-time pilot cost** (spread across the ~6-month build), and the **monthly run-rate** once the pilot is live. The single most important framing: **build/engineering (people) is ~80-85% of the pilot spend; everything cloud/AI/tooling combined is a rounding error by comparison.** Anyone proposing a heavy infra/warehouse spend at pilot stage is solving a problem we do not have yet.

### A.1 Build / engineering (the dominant cost)

This is salaried team time for the ~6-month pilot — covered in detail in Section B. It builds: the canonical schema + RLS multi-tenant spine, the four dashboards (MONEY → DELIVERY → PEOPLE → PIPELINE), the manual-capture forms + templated Excel/CSV importers, the Google + Microsoft + email/calendar-metadata connectors, the versioned semantic-layer KPI functions, the Claude narration/anti-hallucination layer with provenance + "insufficient data" states, and the bilingual (Bangla/English) UI with Bijoy→Unicode normalization.

| Item | One-time (pilot, ~6 mo) USD | One-time BDT | Monthly run-rate USD | Monthly run-rate BDT |
|---|---|---|---|---|
| Engineering team payroll (see Section B) | **$60,000 – $110,000** | **৳7.2M – ৳13.2M** | $10,000 – $18,000 (continuing post-pilot) | ৳1.2M – ৳2.2M |
| Code tooling (GitHub, CI/CD minutes, Linear/Jira, Figma, Sentry, password mgr) | $1,500 – $3,000 (setup + 6 mo) | ৳180K – ৳360K | $250 – $500 | ৳30K – ৳60K |

**Note:** the engineering payroll *is* the pilot. It is shown here as one-time-for-pilot and also as a run-rate because the team continues into productization. Do not double-count it against Section B — Section B is the breakdown of this same line.

### A.2 Infrastructure / hosting

Deliberately minimal. One managed Postgres (Supabase) in **Singapore** (service breadth) or **Mumbai** (lowest RTT to Dhaka), app + worker compute, object storage for raw landing payloads (JSONB + files), a cron/queue worker for connector polling and the weekly AI report, and a CDN. **No warehouse, no Kafka, no Snowflake/BigQuery at pilot scale** — that is target-tier only.

| Item | One-time USD / BDT | Monthly USD | Monthly BDT |
|---|---|---|---|
| Managed Postgres + Auth + storage (Supabase Pro tier-ish) | — | $25 – $120 | ৳3K – ৳14.4K |
| App + worker compute (small container/VM, e.g. Fly.io / Render / a single cloud VM) | — | $40 – $150 | ৳4.8K – ৳18K |
| Object storage + egress (raw webhooks, imported files, PDF exports) | — | $10 – $40 | ৳1.2K – ৳4.8K |
| CDN + DNS + TLS (managed certs) | — | $0 – $30 | ৳0 – ৳3.6K |
| Staging + preview environment | — | $30 – $80 | ৳3.6K – ৳9.6K |
| **Subtotal infra** | negligible | **~$105 – $420** | **~৳12.6K – ৳50.4K** |

> **Forex reality (from the BD research):** AWS/GCP/Azure/Supabase all bill in **USD**, and Bangladesh Bank exchange controls make paying foreign USD cloud bills from a BD company friction-heavy. **Mitigation:** pay cloud spend via the planned **offshore (US/SG) entity or an international card** rather than fighting forex clearance every month. Budget a small FX/processing premium (~3-6%) on all USD line items.

### A.3 AI / LLM usage

Claude is used as a **narrator only** — it never computes a number; it explains deterministic SQL/semantic-function output with provenance. That keeps token volume low and predictable: a handful of NL queries per user per day plus one weekly AI report per project/firm. For a 3-10 user pilot this is a small bill. Prompt caching on the system/schema preamble and the anti-hallucination "refuse on missing data" rule (which short-circuits before generation) both suppress spend.

| Item | One-time USD / BDT | Monthly USD | Monthly BDT |
|---|---|---|---|
| Claude API — pilot inference (NL queries + weekly reports, caching on) | — | $50 – $300 | ৳6K – ৳36K |
| Embeddings for `ProjectCrossReference` alias matching + RAG over captured records (pgvector, no separate vector DB) | $20 – $80 one-time backfill | ৳2.4K – ৳9.6K | $10 – $40 | ৳1.2K – ৳4.8K |
| OCR / document parse (bilingual Bangla/English scans — budget human verification, not just API) | — | $20 – $100 | ৳2.4K – ৳12K |
| Prompt/eval harness + observability (LLM tracing, regression set for anti-hallucination) | $500 – $1,500 setup | ৳60K – ৳180K | $20 – $80 | ৳2.4K – ৳9.6K |
| **Subtotal AI** | ~$520 – $1,580 | **~$100 – $520** | **~৳12K – ৳62.4K** |

> **Watch item:** Bengali OCR is materially harder than Latin (conjuncts, ligatures, mixed-script addresses). The cost here is **less in API spend and more in the human-verification loop** for extracted names/addresses/holding numbers — staff that to the Pilot Success role, not to compute.

### A.4 Data / integration tooling

The MVP integration surface is intentionally narrow, so most of this is OAuth app registration + the manual-capture/Excel-import machinery (which is *our own code*, not a third-party iPaaS). We explicitly **do not** buy a heavyweight iPaaS (Fivetran/Airbyte/Workato) at pilot stage — it is the wrong shape for "thin webhooks + Excel imports + manual forms" and adds USD cost and a data hop.

| Item | One-time USD / BDT | Monthly USD | Monthly BDT |
|---|---|---|---|
| Google Cloud + Microsoft Entra app registration / verification (connector OAuth) | $0 – $200 (verification fees if any) | ৳0 – ৳24K | $0 | ৳0 |
| Meta WhatsApp Business Platform setup (deferred; persist-from-day-one if enabled) | $0 – $100 | ৳0 – ৳12K | usage-based, low | low |
| Lightweight queue/cron (can be the same worker — no separate spend) | — | included above | included above |
| Optional embedded Metabase (read-only "explore" tab, self-hosted) | $0 (OSS) | ৳0 | $20 – $60 (compute) | ৳2.4K – ৳7.2K |
| **Subtotal integration tooling** | ~$0 – $300 | **~$20 – $60** | **~৳2.4K – ৳7.2K** |

### A.5 Security / compliance

PDPO 2025 (+2026 amendment, enforcement ~May 2027) is the driver. Our cheapest compliance strategy is **data minimization** — the Band P sensitive identifiers (NID/TIN/passport/biometric) we never ingest need no localization and cannot leak. So compliance cost at pilot is mostly **legal review + a security baseline**, not infrastructure.

| Item | One-time USD | One-time BDT | Monthly USD | Monthly BDT |
|---|---|---|---|---|
| Legal: PDPO + cross-border-transfer review, pilot DPA/data-processing agreement with the firm, ToS/privacy policy | $1,500 – $4,000 | ৳180K – ৳480K | — | — |
| Cloud KMS (per-tenant data keys, field-level encryption for Band F/P + OAuth tokens) | — | — | $5 – $30 | ৳600 – ৳3.6K |
| Secrets manager / vault for connector tokens | — | — | $0 – $40 | ৳0 – ৳4.8K |
| Security baseline: dependency scanning, light pen-test before pilot go-live | $1,000 – $3,000 | ৳120K – ৳360K | $0 – $50 | ৳0 – ৳6K |
| Backups + PITR (point-in-time recovery) + offsite copy | — | — | $20 – $60 | ৳2.4K – ৳7.2K |
| **Subtotal security/compliance** | **$2,500 – $7,000** | **৳300K – ৳840K** | **~$25 – $180** | **~৳3K – ৳21.6K** |

> **Deferred (productization, not pilot):** the **Bangladesh local-mirror** for any restricted/CII data — design the `requires_local_mirror` capability now, but **do not pay for a named Tier-III/IV BD data center until a restricted-data tenant actually onboards.** This is a real future cost (VERIFY specific provider) but zero at pilot, because we minimize Band P aggressively.

### A.6 Support / ops

A single-firm pilot's "support" is mostly **white-glove onboarding and adoption hand-holding** — the Pilot Success role (Section B), not a ticketing org. Tooling here is light.

| Item | One-time USD / BDT | Monthly USD | Monthly BDT |
|---|---|---|---|
| Monitoring/alerting + uptime + log aggregation (Sentry/Grafana Cloud/Better Stack) | $0 – $300 setup | ৳0 – ৳36K | $30 – $120 | ৳3.6K – ৳14.4K |
| Support channel for the pilot firm (shared WhatsApp + email + a simple help doc) — meets the firm where it already lives | $0 | ৳0 | ~$0 | ~৳0 |
| On-site visits / training within Dhaka (travel, printing, Nikosh-rendered handouts) | $300 – $800 | ৳36K – ৳96K | $50 – $150 | ৳6K – ৳18K |
| **Subtotal support/ops** | ~$300 – $1,100 | ~৳36K – ৳132K | **~$80 – $270** | **~৳9.6K – ৳32.4K** |

### A.7 Sales / marketing

Near-zero during the pilot **by design** — the pilot firm is a hand-picked design partner, not a sale, and the goal is a reference + a productizable case study, not pipeline. Marketing spend belongs to the productization phase.

| Item | One-time USD / BDT | Monthly USD | Monthly BDT |
|---|---|---|---|
| Pilot partner acquisition (likely founder relationship / IAB network — effectively free) | $0 – $500 | ৳0 – ৳60K | — | — |
| Brand basics: name finalization (replace "PracticeLens"), domain, logo, one-page site | $500 – $2,000 | ৳60K – ৳240K | $20 – $50 | ৳2.4K – ৳6K |
| Case-study / demo asset production (end-of-pilot, for productization) | $300 – $1,000 | ৳36K – ৳120K | — | — |
| **Subtotal sales/marketing** | ~$800 – $3,500 | ~৳96K – ৳420K | **~$20 – $50** | **~৳2.4K – ৳6K** |

### A.8 Pilot totals (the number to fund)

| Bucket | One-time pilot (low) | One-time pilot (high) | Monthly run-rate (low) | Monthly run-rate (high) |
|---|---|---|---|---|
| Build / engineering (people) | $60,000 | $110,000 | $10,000 | $18,000 |
| Infra / hosting | — | — | $105 | $420 |
| AI / LLM | $520 | $1,580 | $100 | $520 |
| Data / integration tooling | $0 | $300 | $20 | $60 |
| Security / compliance | $2,500 | $7,000 | $25 | $180 |
| Support / ops | $300 | $1,100 | $80 | $270 |
| Sales / marketing | $800 | $3,500 | $20 | $50 |
| Code/dev tooling | $1,500 | $3,000 | $250 | $500 |
| **TOTAL** | **~$65,600** | **~$126,500** | **~$10,600** | **~$20,000** |
| **TOTAL (BDT @120)** | **~৳7.9M** | **~৳15.2M** | **~৳1.27M** | **~৳2.4M** |

**Read this table the right way:** the *entire* non-people pilot cost (infra + AI + integration + security + support + marketing + tooling) lands at roughly **$5,600 – $16,500 one-time and ~$600 – $2,000/month** — i.e. cloud/AI is **under 10%** of the pilot. The lever that moves the budget is **team size and seniority**, and that is exactly where Bangladesh gives a 4-8x cost advantage over a US/EU build. The honest risk is **scope and timeline**, not infra bills.

---

## B. Team Requirements (~6-month pilot)

**Principle: smallest senior team that can ship, not the org chart of the productized company.** Six-ish people, several fractional. We over-index on a strong **Product/Tech Lead** and a dedicated **Data/Integration Engineer** because the hard, differentiated work is (1) the canonical model + multi-tenant spine + provenance, and (2) wrangling heterogeneous, informal, bilingual data into a trustworthy schema. We under-index on anything that can be deferred to productization (DevOps platform team, dedicated QA org, sales).

**Bangladesh talent context.** Dhaka has a deep, capable full-stack / React / Node / Python pool at **roughly 1/4 to 1/8 of US salaries**, and strong English working proficiency. Senior engineers and a true product-minded tech lead are scarcer and command a premium, but are findable. The **AEC domain consultant is the genuinely scarce role** — that is a relationship hire (a practicing IAB architect / firm principal), not a job-board hire. Salary bands below are **indicative monthly Dhaka market** for the seniority described; verify against live market.

| Role | Allocation | Indicative monthly (USD) | Indicative monthly (BDT) | Core responsibilities | Fractional? |
|---|---|---|---|---|---|
| **Product / Tech Lead** | Full-time | $3,000 – $6,000 | ৳360K – ৳720K | Owns architecture decisions already fixed in the blueprint; sets the build order (MONEY → DELIVERY → PEOPLE → PIPELINE); guards the two non-negotiables — **read-only-first** and **anti-hallucination**; runs the pilot firm relationship day-to-day; final call on scope cuts. | No — anchor role. |
| **Full-stack Engineer #1 (senior)** | Full-time | $2,000 – $4,000 | ৳240K – ৳480K | Next.js/React bilingual dashboards + manual-capture forms; the four KPI dashboard surfaces with provenance chips and "insufficient data" states; RBAC enforcement in the UI (Finance restricted to Owner/Finance/Admin). | No. |
| **Full-stack Engineer #2 (mid)** | Full-time (or 0.5-1.0 FTE) | $1,200 – $2,500 | ৳144K – ৳300K | Templated Excel/CSV importers; weekly-report rendering + PDF export with embedded **Nikosh** for Bangla; semantic-layer KPI functions (paired with Lead); CRUD on canonical entities. | Can start at 0.5 FTE, scale to full. |
| **Data / Integration Engineer** | Full-time | $2,000 – $4,000 | ৳240K – ৳480K | Canonical schema + RLS multi-tenant spine; Google + Microsoft + email/calendar-metadata connectors; raw-landing → canonical → mart pipeline; **Bijoy/ANSI → Unicode normalization on ingest**; `ProjectCrossReference` alias matching; `Data Completeness Score` computation; provenance + `AuditLog` plumbing. | No — second anchor role. |
| **AI Engineer** | **Fractional (~0.4-0.5 FTE)** | $1,200 – $3,000 (pro-rated) | ৳144K – ৳360K | Claude tool-calling narrator over the deterministic functions; anti-hallucination guardrails + refuse-on-missing; prompt caching; the eval/regression harness; pgvector RAG + alias-match embeddings. **Critically not full-time** — the AI layer is thin orchestration, not model hosting; the real work is in the deterministic functions the Data Engineer owns. | Yes — fractional. |
| **Product Designer** | **Fractional (~0.4 FTE)** | $800 – $2,000 (pro-rated) | ৳96K – ৳240K | Bilingual UI/UX; the 30-second-a-day timesheet form and other low-friction capture flows (adoption is the whole game); provenance/confidence visual language; "insufficient data" empty-states; mobile-web site-report capture. | Yes — heavy at start, tapers. |
| **AEC Domain Consultant** | **Fractional (~0.2-0.3 FTE / advisory)** | $1,000 – $3,000 (retainer) | ৳120K – ৳360K | Validates the BD phase model, RAJUK/FSCD/DoE/CAAB/utility **Approval** modeling, IAB fee/staged-billing conventions, VAT/VDS/AIT mechanics; pressure-tests every `[ASSUMED]` in the research against real practice; warm intro / credibility with the pilot firm. **Ideally a practicing IAB architect or firm principal.** | Yes — advisory retainer. |
| **Pilot Success / Onboarding Lead** | **Fractional → ramps full-time at pilot go-live** | $1,000 – $2,500 | ৳120K – ৳300K | White-glove onboarding; runs the manual-capture rollout (gets the firm actually entering timesheets — the make-or-break adoption task); seeds historical data via Excel templates; the human-verification loop for Bengali OCR output; weekly check-ins; turns usage into the productization case study. | Starts fractional; full-time from month ~3. |

**Team monthly burn (people):** roughly **$10,000 – $18,000 / month (৳1.2M – ৳2.2M)** depending on seniority mix and how many fractional roles you keep light early. Over ~6 months that is the **$60K – $110K** engineering line in Section A.1.

**Roles deliberately NOT hired for the pilot (deferred to productization):** dedicated DevOps/platform engineer (the team uses managed services — Supabase/Fly/Render — and shares ops), dedicated QA (engineers test + the eval harness covers AI; a part-time tester can be added if velocity demands), sales/BD (no selling during pilot), customer support org (Pilot Success covers one firm), HR/finance hire (founder/ops handles a 6-person team).

**Hiring sequence:** Tech Lead + Data/Integration Engineer first (week 1 — they set the spine), then Full-stack #1, then Designer (fractional, front-loaded), then Full-stack #2, then AI Engineer (fractional, needed when the deterministic functions exist to narrate ~month 2-3), with the Domain Consultant secured **before** schema work hardens and Pilot Success ramping toward go-live.

---

## C. Recommended Next Actions

Sequenced and concrete. The through-line: **secure the pilot firm and the domain truth first, stand up the spine second, ship MONEY first, prove trust (provenance + completeness) throughout.** Do not start coding dashboards before the canonical schema and the pilot firm are locked.

### This week (days 1-7) — lock the foundations you cannot build without

1. **Confirm the pilot firm in writing.** Get a named Dhaka practice (5-30 staff, residential-dominant) and a signed pilot LOI / design-partner agreement covering scope, the 6-month term, data access, and the case-study right. Without a real firm, every `[ASSUMED]` stays an assumption.
2. **Secure the AEC Domain Consultant** (practicing IAB architect / principal) on retainer. This is the scarcest hire and gates schema correctness — start now.
3. **Hire the two anchors:** Product/Tech Lead and Data/Integration Engineer. Begin sourcing Full-stack #1 + the fractional Designer.
4. **Stand up the skeleton:** GitHub org + repo, Linear/Jira, the cloud account/**offshore billing entity** (to dodge forex friction on USD cloud bills), and a **Supabase project in Singapore or Mumbai** (decide region now — Mumbai for latency, Singapore for breadth).
5. **Replace the working name.** Run a quick name + domain check; "PracticeLens" is a placeholder and the brand basics (Section A.7) start the clock on legal/trademark.
6. **Book the legal PDPO review** (data-minimization posture, cross-border transfer, pilot DPA) — it runs in parallel, not on the critical path.

### Days 8-30 — discovery + the spine

7. **Run a 1-2 week field discovery at the pilot firm** with the Domain Consultant and Pilot Success: inventory their *actual* tools (which accounting? Tally/Excel/QBO?), their folder/naming chaos, their WhatsApp/approval reality, and grab 5-10 real projects' worth of historical data. This **swaps the archetype for the real stack** and tells the connector roadmap.
8. **Finalize and migrate the canonical schema** (`Company`…`ProjectCrossReference`) with **tenant_id on everything, RLS on, provenance + `AuditLog` from row one**. Bake in bilingual Bangla/Latin fields and UTF-8 throughout. This is the single most consequential build artifact — get the Domain Consultant to sign off the phase model and `Approval` types (RAJUK LUC/CP, FSCD, DoE, CAAB, utilities) before it hardens.
9. **Build the manual-capture + Excel-import skeleton** end-to-end for one entity (`Project`), proving the raw-landing → canonical → provenance path and the `Data Completeness Score`.
10. **Define the first semantic-layer KPI functions for MONEY** — `Fee Burn Rate`, `Invoice Aging`, `Collection Rate`, `Forecast Project Margin` — as versioned, testable functions with the **BD finance model done right** (gross fee → VAT 15% → VDS → AIT/TDS → net cash collected).
11. **Set up the AI eval/regression harness** *before* wiring Claude, so anti-hallucination is testable from the first narration.

### Days 31-60 — ship MONEY, wire the cloud connectors

12. **Ship the MONEY dashboard** (the firm's strongest pain) with `Fee/Invoice/Payment/Expense/Budget`, phase/milestone-triggered billing, multi-currency, and every tile carrying "Why this number?" provenance.
13. **Build the Google + Microsoft + email/calendar-metadata connectors** (read-only, metadata-first), OAuth tokens field-encrypted in the vault. Use the firm's *real* platform mix found in discovery to prioritize which to do first.
14. **Wire Claude as the narrator** over the MONEY semantic functions; ship NL queries + the first weekly AI report with refuse-on-missing behavior and the RBAC/finance-band enforcement at the tool layer.
15. **Begin the timesheet adoption push** (Pilot Success-led): roll out the 30-second-a-day capture form to the 3-10 MVP users. **Start early — adoption, not code, is the long pole for PEOPLE.**
16. **First real owner review:** sit the principal in front of the MONEY dashboard. Validate that it tells them something they could not previously know. Capture every correction.

### Days 61-90 — DELIVERY + PEOPLE, prove the thesis

17. **Ship the DELIVERY dashboard:** `Milestone`/`Approval` tracking (RAJUK/FSCD/DoE/CAAB/utilities as first-class milestones with statutory-duration variance), `Schedule Variance`, `Milestone Completion Rate`, deliverable/drawing status from file-presence signals.
18. **Ship the PEOPLE slice** gated by `Data Completeness Score` — `Utilization Rate`/`Planned vs Actual Hours` rendered honestly as proxy-only until timesheet data matures; do **not** show confident utilization on thin data.
19. **Harden trust + security:** completeness badges on every domain header, light pen-test, backups/PITR verified, audit trail spot-checked.
20. **Mid-pilot review + go/no-go on connector depth:** decide — based on the firm's real accounting tool — whether a Tally or QuickBooks/Xero API connector earns its place in the back half, or whether templated Excel import is sufficient. Keep PIPELINE a thin slice.
21. **Stand up the productization evidence:** instrument adoption metrics, start the case study, and draft the multi-tenant onboarding/billing backlog (BDT via bKash/SSLCOMMERZ for local, USD via the offshore entity for foreign) for the post-pilot phase.

**The 90-day success test:** the pilot firm's owner relies on the **MONEY dashboard + weekly AI report** for a real decision they couldn't make before, every number is traceable to source records with a confidence badge, and at least the MVP users are entering timesheets. Hit that, and the build is de-risked and the productization story writes itself.
