# AI Reporting Layer Design

> PracticeLens — the AI reporting & analytics layer above a Dhaka architecture firm's existing (mostly informal) tools. This section specifies the 14 AI capabilities and the anti-hallucination architecture that lets a small firm trust automated reports about its own money, deadlines, people and pipeline.

## Design stance (read this first)

The single hardest constraint here is **not** the LLM — it is that the firm's most valuable data is missing or informal (no timesheets, verbal approvals, WhatsApp scope changes, fee basis in the principal's head). An AI layer that papers over those gaps with confident prose is worse than no AI at all, because the owner will make BDT decisions on fabricated numbers and stop trusting the product within weeks.

Therefore the architecture is built around one inversion that everything else follows from:

**The LLM never computes a number. The LLM never queries the database. Numbers come from deterministic, versioned SQL/semantic-layer functions; the LLM only (a) decides which functions to call, (b) reads their structured output, and (c) writes the narrative around facts it was handed.** Every fact in every output carries a provenance pointer (which `IntegrationRecord` / `DataSource` / record IDs, observed-at date, calculation version) and a `Data Completeness Score`. When the data is missing — which in a small Dhaka firm it routinely will be — the system says so explicitly and refuses to guess.

This is enforceable, testable, and demoable to an owner who is (correctly) skeptical of "AI".

---

## 1. The 14 AI capabilities

Capabilities are grouped by the owner's priority order: **MONEY (1) → DELIVERY (2) → PEOPLE (3) → PIPELINE (4)**, with cross-cutting reporting/NL on top. Each capability is a thin LLM-narration shell over a **deterministic detector** (a scheduled function over the semantic layer). The detector decides *whether there is something to say and what the numbers are*; the LLM decides *how to say it*. A capability that fires with `Data Completeness Score` below its threshold downgrades to a "we can't tell you this yet, here's what to capture" message instead of a confident claim.

Frequency legend: **RT** = event-triggered (near-real-time on ingest), **D** = daily batch, **W** = weekly, **M** = monthly, **OD** = on-demand.

### MONEY (priority 1)

| # | Capability | Trigger | Primary inputs (entities / KPIs) | Output format | Freq |
|---|---|---|---|---|---|
| 1 | **Daily executive briefing** | Scheduled 07:30 Asia/Dhaka; only sends if ≥1 material change since last run | Cross-cutting: `Project Health Score`, `Invoice Aging`, `Collection Rate`, `Schedule Variance`, `Milestone` (Approval) due/slipped, `Resource Capacity`, `Data Completeness Score` | Push card + email; 5–8 bullets, each a single fact + delta + source chip; "what needs you today" CTA list | D |
| 5 | **Cash collection warnings** | RT on `Invoice`/`Payment` ingest, or daily aging recompute; fires when an `Invoice` crosses an aging bucket (30/60/90 days) or `Collection Rate` drops | `Invoice`, `Payment`, `Client`, `Contract`, `Fee`; KPIs `Invoice Aging`, `Collection Rate`, `Unbilled Revenue`. Models BDT + VAT (15%) + **AIT/TDS withheld (~10%)** so "expected cash ≠ invoice face value" | Alert card per client/invoice with aged amount, days overdue, last contact, suggested follow-up | RT / D |
| 6 | **Fee overrun detection** | Daily; fires when `Fee Burn Rate` or `Estimate at Completion (EAC)` projects `Forecast Project Margin` below threshold (e.g. <10% or negative) | `Fee`, `Budget`, `Expense`, `Timesheet` (if present), `ProjectPhase`, `Service`; KPIs `Fee Burn Rate`, `EAC`, `Forecast Project Margin`, `Planned vs Actual Hours`, `Work in Progress (WIP)` | Per-project alert: fee base, % consumed, projected margin, top driver, confidence. **Hard caveat when no `Timesheet` data** (labour cost unknown) | D |
| 3 | **Monthly company performance report** | Scheduled 1st business day of month | Firm-wide rollup: `Forecast Project Margin`, `Collection Rate`, `Invoice Aging`, `WIP`, `Unbilled Revenue`, `Utilization Rate` (if timesheets), `Weighted Pipeline`, `Project Health Score` distribution | Structured PDF/web report (Bangla/English), exec summary + sections + trend deltas vs prior 3 months; **draft, owner-gated before any external use** | M |

### DELIVERY (priority 2)

| # | Capability | Trigger | Primary inputs | Output format | Freq |
|---|---|---|---|---|---|
| 2 | **Weekly project reports** | Scheduled Thursday PM (pre-weekend in BD); one per active `Project` | `Project`, `ProjectPhase`, `Milestone`, `Approval`, `Deliverable`, `Task`, `Decision`, `Change`; KPIs `Schedule Variance`, `Milestone Completion Rate`, `Deliverable Completion Rate`, `Task Overdue Rate` | Per-project digest: phase status, approvals movement, deliverables shipped, open decisions, risks; PM-facing, owner-summary header | W |
| 7 | **Schedule delay detection** | Daily; fires when `Schedule Variance` exceeds tolerance or a milestone/approval due date passes without completion | `Milestone`, `Approval` (RAJUK LUC/CP, FSCD NOC, DoE ECC, CAAB, utilities), `ProjectPhase`, `Task`, `Client Approval Time`; KPI `Schedule Variance`, `Milestone Completion Rate` | Alert per project: which milestone, planned vs actual/forecast date, downstream impact, cause if known (e.g. "waiting on RAJUK query response 18 days") | D |
| 12 | **Document / deliverable completeness checks** | RT on `Document`/`Drawing`/`Deliverable`/`Revision` ingest; also pre-milestone (e.g. before RAJUK CP submission needs **5 drawing sets**) | `Deliverable`, `Document`, `Drawing`, `Model`, `Revision`, `Milestone`, `Submittal`; KPIs `Deliverable Completion Rate`, `Drawing Revision Rate`, `Data Completeness Score` | Checklist card: required vs present set (e.g. Architectural / Structural / Plumbing / Electrical / Fire for CP), missing/stale items, latest-revision ambiguity flags | RT |
| 4 | **Project risk summaries** | Daily recompute; surfaced in briefings + on-demand | `Risk`, `Issue`, `Change`, `Approval`, `Milestone`, `RFI`, `Submittal`, `Invoice`; KPIs `Project Health Score`, `Schedule Variance`, `Change Exposure`, `RFI Aging`, `Submittal Aging` | Ranked risk list per project with severity, evidence records, trend (worsening/stable), and the one suggested action | D / OD |

### PEOPLE (priority 3 — depends on timesheets the platform must help create)

| # | Capability | Trigger | Primary inputs | Output format | Freq |
|---|---|---|---|---|---|
| 8 | **Resource overload warnings** | Weekly + RT on `ResourceAssignment` change | `Employee`, `ResourceAssignment`, `Timesheet`, `Task`, `ProjectPhase`; KPIs `Utilization Rate`, `Billable Utilization`, `Resource Capacity`, `Planned vs Actual Hours` | Per-person/team card: assigned load vs capacity, overload weeks, which projects compete. **Degrades to assignment-count proxy when no `Timesheet`** | W / RT |
| 10 | **Consultant performance analysis** | Monthly + on-demand | `Consultant`, `RFI`, `Submittal`, `Meeting`, `Decision`, `IntegrationRecord` (email/WhatsApp-captured); KPIs `Consultant Response Time`, `RFI Aging`, `Submittal Aging` | Per-consultant scorecard: median response time, open items aging, trend; firm-level ranking | M / OD |
| 11 | **Client decision delay analysis** | Weekly + on-demand | `Client`, `Decision`, `Approval`, `Meeting`, `Document` (sent), manual-capture approval log; KPI `Client Approval Time` | Per-client/project: median approval latency, currently-pending decisions and their age (schedule driver), trend | W / OD |

### PIPELINE (priority 4 — lightest, later)

| # | Capability | Trigger | Primary inputs | Output format | Freq |
|---|---|---|---|---|---|
| (in 3) | **Pipeline rollup** (folded into monthly report + NL) | Monthly | `Opportunity`, `Proposal`, `Contract`; KPIs `Pipeline Value`, `Weighted Pipeline`, `Proposal Win Rate` | Section in monthly report + NL queries | M |

### Cross-cutting AI surfaces

| # | Capability | Trigger | Primary inputs | Output format | Freq |
|---|---|---|---|---|---|
| 9 | **Scope creep detection** | RT on `Change`/`Decision`/manual-capture ingest; weekly sweep | `Change`, `Decision`, `Contract` (scope baseline), `Service`, `RFI`, `Meeting`, captured WhatsApp/email records; KPI `Change Exposure`, `Forecast Project Margin` | Alert: detected scope change, baseline reference, billable-or-not flag, estimated unbilled BDT exposure, source quote/record | RT / W |
| 13 | **Natural-language analytics** | User query (typed/spoken, Bangla or English) | Any entity/KPI via semantic-layer functions only | Conversational answer with inline citations + the underlying figure table; "insufficient data" when unmapped | OD |
| 14 | **Automatic narrative explanations of dashboard changes** | RT/daily when any dashboard KPI tile moves beyond a noise threshold | The KPI that moved + its drill-down records (`IntegrationRecord`, `AuditLog`) | One-paragraph "why this changed" tooltip on the tile, fact-cited | RT / D |

**Why these triggers, not "summarize everything nightly":** an owner of a 5–30 person firm will not read a long report daily. Capabilities are **change-gated** — they stay silent unless a deterministic detector finds a material delta — so the daily briefing is short and every alert is earned. This also bounds LLM cost: narration only runs when the detector says there is something to narrate.

---

## 2. Anti-hallucination architecture

The threat model is specific: an owner asks "are we making money on the Gulshan apartment project?" when there are **no timesheets**, and a naive RAG-over-documents system invents a margin. Our defenses are layered so that fabrication is structurally hard, not just discouraged by a prompt.

### 2.1 Retrieval is restricted to verified records + approved documents

The LLM has **no open internet, no free-text scan of arbitrary files, and no raw SQL**. Two and only two retrieval surfaces exist:

1. **The semantic layer** — a curated set of metrics, dimensions and entity views over the canonical schema (`Project`, `Invoice`, `Milestone`, … `ProjectCrossReference`). Every metric (e.g. `Collection Rate`, `EAC`, `Forecast Project Margin`) is defined once, in code, with an explicit formula, the source tables, and a `min_completeness` gate.
2. **An approved-document index** — only `Document`/`Deliverable` records that have passed ingestion validation (provenance attached, Bijoy→Unicode normalized, OCR-confidence recorded) are embedded for retrieval. WhatsApp/email captures are retrievable **only after** being promoted into a typed record (`Decision`, `Change`, `Approval`) through the manual-capture layer or a human-confirmed extraction — raw chat scrollback is never a citable source on its own.

Anything outside these two surfaces is invisible to the model. There is no "the model also knows general facts about Dhaka" path into a financial number.

### 2.2 Tool/function-calling over the semantic layer — never free-form SQL

The model is given a typed **tool catalog**, not a SQL prompt. Representative tools:

```
get_invoice_aging(project_id?, client_id?, as_of_date) -> {buckets, total_bdt, completeness}
get_forecast_margin(project_id, as_of_date)            -> {fee_base_bdt, eac_bdt, margin_pct, drivers[], completeness, caveats[]}
get_milestone_status(project_id, milestone_type?)      -> {planned, actual_or_forecast, variance_days, evidence_ids[]}
get_consultant_response_time(consultant_id, window)    -> {median_days, n, open_items[], completeness}
list_open_decisions(project_id)                        -> {decisions[], oldest_age_days, completeness}
search_approved_docs(query, project_id, doc_types[])   -> {chunks[] with doc_id+revision+page}
```

Each tool returns **structured JSON with the numbers already computed deterministically** plus a `provenance` block (`source_record_ids`, `data_sources`, `observed_at`, `calc_version`) and a `completeness` score. The LLM cannot change a number; it can only read it. If the model needs a figure for which there is no tool, it cannot get it — by design — and must return "insufficient data" (§2.4). This kills the most common hallucination class (model "estimates" a value because it sounds plausible).

Free-form SQL is rejected because (a) the model would silently join the wrong table or miss a tenant filter, and (b) we could never write a stable test harness against arbitrary generated SQL. Curated tools are individually unit-tested.

### 2.3 Strict separation: deterministic facts vs LLM narrative

```
                 ┌──────────────────────────┐
  Schema  ─────► │  SEMANTIC LAYER (SQL)     │  ← every number lives here, versioned
 (canonical)     │  metrics • dimensions     │
                 └─────────────┬────────────┘
                               │ typed tool calls (read-only)
                               ▼
                 ┌──────────────────────────┐
  Detectors ───► │  FACT BUNDLE (JSON)       │  facts + provenance + completeness + caveats
 (scheduled)     └─────────────┬────────────┘
                               │ facts passed as context
                               ▼
                 ┌──────────────────────────┐
                 │  LLM (Claude)             │  narration ONLY; may not introduce new numbers
                 └─────────────┬────────────┘
                               │
                               ▼
                 ┌──────────────────────────┐
                 │  POST-VALIDATOR           │  every number in prose must trace to fact bundle
                 └─────────────┬────────────┘
                               │ pass → draft  │ fail → reject + regenerate
                               ▼
                 Human approval gate (external-facing only) → publish
```

A **post-generation validator** parses every numeric token, currency figure, date and named entity out of the LLM's prose and asserts it appears in the fact bundle that was handed to the model. A number in the narrative that is **not** in the fact bundle = automatic rejection and one regeneration with a stricter instruction; second failure = fall back to a templated, LLM-free rendering of the fact bundle. This makes "the model added a plausible-but-invented figure" a caught error, not a shipped one.

### 2.4 Explicit "insufficient data" behavior

This is a first-class output state, not an apology. Every capability declares a `min_completeness` and the **required entities** it depends on. Behaviour:

- If a required entity is absent (e.g. `Forecast Project Margin` requested but `Timesheet` count = 0 for the project), the tool returns `completeness: low` with `missing: [Timesheet]` and **does not return a margin number**. The capability then emits a *capture prompt* instead of a metric: *"Can't compute project margin — no time data captured for this project. Labour is your biggest cost. Log hours here →"* This directly serves the brief's goal of the platform helping the firm *create* timesheets.
- Partial data → the number is returned **with an explicit confidence band and the caveat surfaced inline** (e.g. "based on 3 of 6 phases having logged hours").
- The model is system-prompted that "insufficient data" is a correct, valued answer and that guessing is a failure. The validator backstops this.

`Data Completeness Score` is itself a canonical KPI shown on the dashboard, so the owner sees coverage improving as adoption grows — turning a weakness into a visible progress metric.

### 2.5 Provenance and confidence on every output

Every fact rendered to a user carries a **source chip**: `[INV-2031, RAJUK-CP filed 2026-04-02, calc v3, conf: High]`. Confidence is computed deterministically (not by the LLM) from: source type (API record > validated import > human-confirmed manual capture > OCR-extracted), recency, completeness, and whether the figure required estimation. Confidence levels: **High / Medium / Low / Insufficient.** Anything Low or below is visually distinct and never used as the basis for an external-facing claim without human edit.

### 2.6 Human approval gate for external-facing reports

Internal artefacts (daily briefing, alerts, NL answers, dashboard tooltips) publish automatically — they are decision-support for the owner only. **Anything that could leave the firm** (client-facing weekly project report, monthly performance report shared with a partner/bank, consultant scorecard sent outward) is generated as a **draft** and routed to a `Finance Team`/`Owner` approval queue. The approver sees the prose, the fact bundle behind it, and any Low-confidence flags, and must approve, edit, or reject before send. This is enforced by the report's `audience: external` flag, logged in `AuditLog`.

### 2.7 Evaluation / test harness and guardrails

- **Golden-fixture eval set:** a frozen synthetic firm dataset (projects with/without timesheets, overdue RAJUK approvals, VAT/AIT-withheld invoices, bilingual names, a scope-creep WhatsApp thread). For each capability we assert: correct fact extraction, correct "insufficient data" behaviour where data is missing, zero un-sourced numbers, correct BDT/VAT/AIT arithmetic.
- **Hallucination regression test:** adversarial fixtures where the *right* answer is "I can't tell you." A capability that emits a number here fails CI.
- **Determinism test:** the same fact bundle must produce the same numeric content across runs (narrative wording may vary; numbers may not — enforced by the validator).
- **Calculation parity test:** semantic-layer metrics are checked against hand-computed expected values, versioned (`calc_version`) so a metric change is an auditable event.
- **Runtime guardrails:** read-only tool scope; per-tenant row-level filter injected at the tool layer (never trusted to the model) for multi-tenant safety; numeric/date/entity validator (§2.3); rate/cost ceiling on narration; PII minimization — NID/TIN/passport never enter prompts (PDPO 2025 sensitive-data + cross-border-transfer constraints), only non-sensitive references do.

### 2.8 Model choice — Claude family, and why

| Capability | Model | Rationale |
|---|---|---|
| Daily briefing, weekly/monthly reports, NL analytics, risk/scope narration | **Claude Sonnet** (current generation) | Strong instruction-following and tool-use, good Bangla/English handling, low enough latency/cost for daily + per-project volume across the pilot's ~3–10 users |
| High-stakes external monthly report drafting; ambiguous scope-creep judgement from messy captured text | **Claude Opus** (current generation) | Better reasoning on noisy bilingual evidence and nuanced "is this in scope?" calls where a wrong claim is expensive; used selectively to control cost |
| Lightweight extraction/classification (promote a captured WhatsApp note into a typed `Decision`/`Change`, language/script detection) | **Claude Haiku** (current generation) | Cheap, fast, high-volume ingest-time work |

**Why Claude specifically:** (1) reliable structured **tool use**, which is the backbone of the fact/narrative separation — the whole anti-hallucination design depends on the model calling typed tools rather than improvising; (2) strong adherence to "refuse when data is missing" style instructions, which we need for the insufficient-data contract; (3) competent Bangla comprehension for the bilingual reality; (4) deployable in **Singapore/Mumbai-adjacent** regions consistent with the data-residency posture (PDPO 2025), keeping sensitive identifiers out of prompts entirely. Model IDs are pinned per release and treated as a versioned dependency so eval results are reproducible. The architecture is model-portable — facts come from SQL, so a model swap changes only narration quality, never the numbers.

---

## 3. Example: daily executive briefing (with inline citations)

The following is a realistic rendered output for the pilot firm on a Sunday morning (the BD work week). Note: every figure has a source chip; one item is deliberately an **insufficient-data** case, not a fabricated margin.

---

**PracticeLens — Morning Briefing · Sun 14 Jun 2026 · 07:30 Asia/Dhaka**
*3 things need you today. Firm `Data Completeness Score`: 62% (↑4 since last week).*

1. **Collections: ৳18,50,000 now 60+ days overdue.** Invoice INV-2031 to *Meghna Developers Ltd.* (Gulshan mixed-use) crossed the 60-day bucket today. Face value ৳20,00,000; expected cash ৳18,50,000 after 15% VAT handling and ~10% AIT withheld at source. Last logged client contact: 2026-05-29 (phone, manual-capture).
   `[INV-2031 · Payment ledger as of 2026-06-14 · Collection Rate calc v3 · conf: High]`

2. **RAJUK Construction Permit is the binding deadline — and it's slipping.** Project *Banani Residence (PRJ-0112)* CP submission (`Approval` milestone) was planned 2026-06-05; still not filed (9 days late). Cause on record: Structural set pending from consultant. Downstream Construction phase start at risk.
   `[Milestone APR-CP-0112 · Schedule Variance calc v2 · evidence: DLV-0431, Decision DEC-0088 · conf: High]`

3. **Document gap blocks that RAJUK CP filing.** The 5-set requirement is incomplete: Architectural ✓, Plumbing ✓, Electrical ✓ present; **Structural — missing**, **Fire design — stale (rev. 2026-04-10, superseded by client change DEC-0091)**. Latest-revision ambiguity flagged on 1 drawing.
   `[Deliverable DLV-0431 · Drawing index · Revision log · Deliverable Completion Rate calc v1 · conf: High]`

**For awareness (no action):**
- Consultant *Rahman Structural* median `Consultant Response Time` rose to 6.2 days (was 3.1) over the last 30 days, n=8 items. `[RFI/Submittal log · conf: Medium]`

**Cannot report yet — data missing:**
- *Project margin for Banani Residence* — **not computed. No `Timesheet` data exists for this project, so labour cost (your largest cost) is unknown.** This is not zero margin; it is unknown margin. Start time capture to unlock profitability → [Log hours]
   `[Forecast Project Margin · required: Timesheet · completeness: Insufficient]`

---

Note what the briefing does **not** do: it does not invent the Banani margin, it does not assert a collection probability it cannot derive, and every number traces to a record and a calc version. The owner can tap any source chip to drill into the underlying `IntegrationRecord`s and the formula. That auditability — facts from SQL, narrative from Claude, provenance on everything, and an honest "we can't tell you yet" — is the whole point of the layer.
