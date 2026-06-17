# Reporting, AI & Analytics Capabilities

> **Prototype reality check (read first).** SPACE ESSE · Practice Intelligence is a **frontend-only, high-fidelity interactive prototype** (Vite + React + TypeScript + Tailwind v4, React Router, TanStack Query, Recharts, Radix UI). There is **no backend, no database, no authentication, no persistence, no real network, and — most relevant to this document — no AI inference of any kind.** Every "AI" report and every "AI" answer is **pre-authored mock content** held in `src/lib/mock/{insights,data,ops}.ts`, served through `src/lib/api.ts` `resolve()` (a deep-clone + ~280 ms `setTimeout`) and the assistant's own 650 ms `setTimeout`. No LLM is called. No number is computed by a model. When this document describes a capability as "working," it means it works **in the browser, in client state only**, and a page refresh resets it.
>
> This document is the **capability and architecture** companion to `docs/06-modules-intelligence.md` (which inventories the UI surfaces screen-by-screen). Where the two overlap, 06 is the surface-level reference; this file explains the *reporting framework*, the *AI capability catalogue*, and the *anti-hallucination architecture* — separating clearly what the prototype shows today from what a production build would require. The production design is specified in `blueprint/06-ai-reporting-design.md`; this file maps that blueprint onto the shipped prototype.

---

## Status legend (applied to every feature below)

- **[IMPLEMENTED]** — interactive and working in the frontend (client-side only; not persisted).
- **[MOCK]** — renders from mock data; the read / calc / generation it represents is simulated, not live.
- **[BACKEND]** — designed in the UI; needs an API / database / persistence / semantic layer to actually function.
- **[INTEGRATION]** — needs a third-party connector (Claude/LLM API, email, WhatsApp, accounting, Drive, etc.).
- **[PLANNED] / [RECOMMENDED]** — not built; a future enhancement.

**The single most important framing for this whole document:** the prototype's *trust UX* is real and working — confidence meters, source chips, completeness bars, dashed "refusal" cards, and explicit "insufficient data" states all render faithfully in the browser **[IMPLEMENTED]**. The *intelligence behind them* — generation, retrieval, deterministic computation by a semantic layer, model reasoning, sending, and scheduling — is **not built**; it is mock content and canned strings awaiting **[BACKEND]** + **[INTEGRATION]** work.

---

## 1. The reporting framework

### 1.1 The data model (what a report *is*)

A report in Space Esse is a typed object, not free text. Three interfaces (from `types.ts`) define the contract, and the prototype renders exactly this shape:

| Interface | Key fields | Role |
|---|---|---|
| `AIReport` | `id`, `kind: AIReportKind`, `title`, `projectId \| null`, `generatedAt`, `status: "draft" \| "published" \| "needs_review"`, `audience: "internal" \| "external"`, `summary`, `blocks: AIReportBlock[]`, `completeness` | The report envelope: metadata + an ordered list of blocks + a firm-wide completeness score |
| `AIReportBlock` | `heading`, `body`, `citations: AICitation[]`, `confidence: Confidence`, `insufficient?: boolean` | One narrative section. Carries its own confidence and citations; can be flagged `insufficient` instead of asserting a number |
| `AICitation` | `ref`, `sourceName`, `observedAt` | A single source pointer (record ref + source name + observation date) |

`Confidence` is a first-class union: `"high" | "medium" | "low" | "insufficient"`. The presence of `insufficient` in the *type itself* is the architectural signal — refusal is a designed, typed outcome, not an error path.

**Structure summary: a report = envelope (metadata + completeness) + ordered blocks; each block = heading + body + confidence + citations (+ optional `insufficient` flag).** This nesting is what lets the UI show a report that is mostly high-confidence yet honestly flags one section as un-computable.

### 1.2 The five report kinds (`AIReportKind`)

The type system defines five kinds. The UI advertises all five in the `/reports` footer "Report types" strip, but **only three are populated with mock content**:

| Kind | `KIND_META` label | Tone | Populated in mock? | Status |
|---|---|---|---|---|
| `daily_brief` | Daily brief | blue | Yes (`rep_daily`) | [MOCK] |
| `weekly_project` | Weekly project | sage | Yes (`rep_weekly_p1`) | [MOCK] |
| `monthly_company` | Monthly company | neutral | **No — label only** | [PLANNED] |
| `risk_summary` | Risk summary | ochre | **No — label only** | [PLANNED] |
| `cash_warning` | Cash warning | rust | Yes (`rep_cash`) | [MOCK] |

> Note: the `/reports` reader uses one tone map (`KIND_META`) and the `/schedules` table uses a slightly different one (there `monthly_company`→ochre, `risk_summary`→sienna). The labels match; only the colours differ between the two screens.

### 1.3 The three mock reports actually in the library

`useAIReports()` returns these three; if the hook returns empty the page falls back to the mock `aiReports` array, so the library is **never** empty (there is no empty state for `/reports`).

| Report id | Kind | Status | Scope | Completeness | Blocks | Block confidences (in order) |
|---|---|---|---|---|---|---|
| `rep_daily` | `daily_brief` | published | Firm-wide (`projectId: null`) | 73 | 4 | high, high, low, **insufficient** (block 4) |
| `rep_weekly_p1` | `weekly_project` | published | Project `p1` | 74 | 3 | medium, high, low |
| `rep_cash` | `cash_warning` | needs_review | Firm-wide | 88 | 1 | high |

Block headings actually authored: `rep_daily` → "Money", "Delivery & Approvals", "People", "Portfolio margin forecast"; `rep_weekly_p1` → "Schedule", "Money", "Margin"; `rep_cash` → "Overdue receivables". All three reports are `audience: internal` in the mock data — which means the **external-review button branch is effectively unreachable** with shipped data (see §1.5).

### 1.4 How a report block renders — citations and the insufficient state

Each block (`ReportBlock`) shows its heading and body, then branches:

| Block type | Renders | Status |
|---|---|---|
| Normal block | body + `<ConfidenceBadge level={block.confidence}>` + a `SourceChip` per citation (`{sourceName} · {ref}` — **date not shown** in the chip) | [MOCK] |
| Zero-citation block | body + the italic line *"No source records cited."* | [MOCK] |
| Insufficient block (`block.insufficient === true`) | the `<InsufficientData>` component with the block heading as the metric name | [MOCK] |

> **Caveat that matters for evaluators — the insufficient-block hint is hardcoded.** When a block is `insufficient`, the `InsufficientData` hint is the *literal* string *"four of eight projects have timesheet coverage below 65%, so labour cost is incomplete."* It is **not derived from data** and is identical regardless of which block triggered it. **[MOCK]** In production this hint would name the actual missing entities for that specific block (see §4.4).

The reader footer states the design promise verbatim: *"Every figure traces to a cited record. The narrative is generated; the numbers are not."* In the prototype the second half is technically true only because the numbers are *authored* into the mock strings — neither half runs through a live engine yet.

### 1.5 Report actions — all visual-only today

The reader picks its button set from `externalReview = audience === "external" && status === "needs_review"`. Because all mock reports are `internal`, the external branch never shows with shipped data.

| Button | Shown when | Wired? | Production tag |
|---|---|---|---|
| New report (PageHeader, Sparkles) | always | No `onClick` | [BACKEND] + [INTEGRATION] (generation) |
| Approve & send (Check) | external-review branch | No `onClick` | [BACKEND] (gate) + [INTEGRATION] (delivery) |
| Regenerate (RefreshCw) | both branches | No `onClick` | [BACKEND] + [INTEGRATION] |
| Export (Send) | non-external branch | No `onClick` | [BACKEND] + [INTEGRATION] |

### 1.6 Report lifecycle — designed vs. built

| Stage | Designed intent (blueprint/06) | Prototype reality |
|---|---|---|
| **Trigger** | Scheduled (daily 07:30, weekly Thu PM, monthly 1st business day) or change-gated by a deterministic detector | Reports are static objects in `insights.ts`; nothing triggers them [MOCK] |
| **Compute** | Numbers come from versioned semantic-layer functions (read-only typed tools) | Numbers are authored into the strings; no computation [MOCK] |
| **Narrate** | Claude writes prose *around* the computed fact bundle | Prose is pre-written [MOCK] |
| **Validate** | Post-generation validator rejects any number not in the fact bundle | Not present [BACKEND] |
| **Review (external)** | `audience: external` reports route to a sign-off queue before send | `Approve & send` is a dead button on `/reports`; the real gate lives in Review Queue (local-state only) [BACKEND] |
| **Deliver** | Email / WhatsApp / in-app dispatch | Nothing is sent [INTEGRATION] |
| **Audit** | Every generation + approval logged immutably | Activity Log shows mock events; not enforceable [BACKEND] |

---

## 2. The AI Assistant — "Ask Space Esse"

**Trigger:** Ctrl/Cmd+J, the Topbar "Ask AI" button, or the Command Palette "Ask Space Esse AI" action · **Component:** `AssistantPanel.tsx`

### 2.1 What it is

A right-side slide-over chat panel for natural-language Q&A. Header subtitle: *"Cited answers · refuses when data is missing."* Input disclaimer: *"Space Esse only uses verified records. It will say when it doesn't know."* The framing is accurate to the **design intent**; the mechanism is a lookup table.

### 2.2 How it answers — a fixed map, not a model

This is the central thing to understand. On submit of question `q`, after a fixed **650 ms `setTimeout`** ("Checking the records…"), the panel returns:

```
ANSWERS[q] ?? genericAnswer(q)
```

If `q` **exactly** matches one of five canned keys, you get that authored answer; otherwise you get a generic refusal. **There is no NLP, no fuzzy matching, no embedding search, and no data lookup** — a near-miss of a suggested question returns the refusal. The assistant does not even read the mock data hooks (`useProjects`, `useInvoices`, …); the figures inside the canned answers are baked into the strings. **[MOCK]** answers; **[IMPLEMENTED]** chat mechanics.

**Genuinely working interaction mechanics [IMPLEMENTED] (client state only):**

| Element | Behaviour |
|---|---|
| Input + submit (ArrowUp) | Submit disabled on empty/whitespace; on submit calls `ask(input)`, clears input |
| Thinking indicator | Three pulsing blue dots + "Checking the records…" for 650 ms |
| Thread | User bubble (blue, right) above each answer card; auto-scrolls to newest; resets on refresh |
| Empty state | Intro copy + a "Try" label + 5 suggestion buttons (clicking one submits it) |

### 2.3 The five canned answers (`ANSWERS`) — natural-language analytics, simulated

These five exact strings are the only inputs that return a curated, cited answer. They are deliberately authored to demonstrate the four owner priorities — money, delivery, people, capacity — and the refusal contract.

| Suggested question (exact key) | Confidence | What the answer says (summary) | Citations |
|---|---|---|---|
| "Which projects are losing money?" | **low** | Flags Meghna Textiles HQ Interior: cost-to-date ৳46.5L over ৳42.0L budget, ~৳1.4L unbilled change orders (WhatsApp 9 Jun); forecast margin ~4% but low-confidence at 60% timesheet coverage; Aldenair & Cantonment positive | Manual capture · Change log (2026-06-09); TallyPrime · cost-to-date (2026-06-12) |
| "What's overdue in collections right now?" | **high** | ৳58.0L overdue across three invoices; ৳39.0L Meghna (INV-2026-019 @97d, INV-2026-022 @51d), ৳18.0L Aldenair (INV-2026-028 @46d); net cash at risk ~৳49L after VAT/VDS/~10% AIT | TallyPrime · INV-2026-019; TallyPrime · INV-2026-028 |
| "Where are we stuck on authority approvals?" | **high** | Bashati Corporate Tower blocker: RAJUK Construction Permit (Form 301) in review 61 days vs 30-day window, caps health at 49; FSCD refuge-floor query, resubmission targeted 20 Jun | RAJUK ECPS · ECPS-2024-88213; Phone note · Decision #219 |
| "Can we take on a new project next month?" | **insufficient** | **Refuses.** Capacity needs billable utilization; only 6/10 staff log time (64% coverage); won't estimate from incomplete data; notes Arif Chowdhury >90% six weeks, Nusrat Jahan down to 71% | Timesheet capture · coverage 64% |
| "Who is overloaded this week?" | **medium** | Arif Chowdhury >90% six consecutive weeks (92% coverage); Kamrul Pasha ~90%; principal/finance/liaison don't log time so load unknown | Timesheet capture · series e3 |

### 2.4 The deliberate refusal — `genericAnswer(q)`

Any unmatched question returns a hard-coded refusal at **confidence `insufficient` with empty citations**:

> *"I answer from verified records only. I don't have enough linked data to answer that confidently yet. Try one of the suggested questions, or capture the underlying records first — I'll show my sources and confidence on every answer."*

Refusal-by-default is a deliberate trust move. Combined with the one canned answer that is itself `insufficient` ("Can we take on a new project next month?"), there are **two refusal paths** in the prototype.

### 2.5 Answer rendering & trust visuals [IMPLEMENTED]

| Element | Behaviour |
|---|---|
| Answer card border | **Dashed** (`border-dashed border-line-strong`) when `insufficient`; solid otherwise — a visual cue that the answer is a refusal / low-trust |
| `ConfidenceBadge` | 4-bar meter + label: high→4 bars/sage; medium→3/ochre; low→2/sienna; insufficient→**0 bars and the literal label "No data"** |
| `SourceChip` | One per citation, source name only (no date) |

### 2.6 What the assistant is *not*

- **Not** model-backed — no LLM call, no reasoning, no tool use. [BACKEND] + [INTEGRATION] for real Q&A.
- **Not** connected to data — figures are inside the strings, not read from hooks.
- **Not** persisted — the thread is gone on refresh.

---

## 3. The AI capability catalogue (blueprint/06 mapped to the prototype)

The production blueprint specifies **14 AI capabilities**, each a thin LLM-narration shell over a deterministic detector, grouped by owner priority: **MONEY → DELIVERY → PEOPLE → PIPELINE**, plus cross-cutting NL/reporting surfaces. The table below lists all 14 and marks, honestly, what the prototype demonstrates today versus what remains to build. "Demonstrated" means a static/canned artefact exists that *illustrates* the capability — not that the detector or generation runs.

| # | Capability (blueprint) | Priority | Designed trigger | Prototype evidence today | Status |
|---|---|---|---|---|---|
| 1 | **Daily executive briefing** | Money | Scheduled 07:30, change-gated | `rep_daily` mock report (4 blocks, incl. one insufficient); Dashboard "Daily executive briefing" card surfaces `brief.summary` | [MOCK] / [BACKEND] to generate |
| 5 | **Cash collection warnings** | Money | RT on invoice/payment; aging bucket crossings | `rep_cash` mock report (`needs_review`); assistant "What's overdue in collections" canned answer; Financials aging buckets computed client-side | [MOCK] / [BACKEND] + [INTEGRATION] (accounting) |
| 6 | **Fee overrun / margin detection** | Money | Daily; EAC/burn below threshold | Assistant "Which projects are losing money?" (low conf); Profitability page fee-based margins; insufficient-margin handling | [MOCK] / [BACKEND] |
| 3 | **Monthly company performance report** | Money | 1st business day of month | Kind label only — **no sample content** | [PLANNED] |
| 2 | **Weekly project reports** | Delivery | Scheduled Thu PM, one per active project | `rep_weekly_p1` mock report (3 blocks) | [MOCK] / [BACKEND] |
| 7 | **Schedule delay detection** | Delivery | Daily; variance over tolerance | Assistant "Where are we stuck on authority approvals?"; Delivery/Approvals pages flag stuck items vs statutory window | [MOCK] / [BACKEND] |
| 12 | **Document / deliverable completeness checks** | Delivery | RT on doc/drawing ingest; pre-milestone | Document Control page shows file-presence signals, revision churn, "manual" chips for missing files | [MOCK] / [INTEGRATION] (Drive) |
| 4 | **Project risk summaries** | Delivery | Daily recompute + on-demand | `risk_summary` kind label only (no sample); Risks page shows logged risks + mock "AI-detected anomalies" via `alerts` | [MOCK] (anomalies) / [PLANNED] (report kind) |
| 8 | **Resource overload warnings** | People | Weekly + RT on assignment change | Assistant "Who is overloaded this week?"; Resourcing page overload card (Arif Chowdhury) + coverage gating | [MOCK] / [BACKEND] |
| 10 | **Consultant performance analysis** | People | Monthly + on-demand | None — no consultant entity or screen in the prototype | [PLANNED] |
| 11 | **Client decision delay analysis** | People | Weekly + on-demand | Partial — Decisions are captured/listed, but no latency analysis is computed | [PLANNED] |
| (in 3) | **Pipeline rollup** | Pipeline | Monthly (folded into monthly report) | Pipeline page computes weighted pipeline / by-stage client-side; no narrative rollup | [MOCK] / [PLANNED] (narrative) |
| 9 | **Scope creep detection** | Cross-cut | RT on change/decision/capture ingest | Illustrated only inside the "losing money" canned answer (unbilled change orders from WhatsApp); no detector | [MOCK] / [BACKEND] |
| 13 | **Natural-language analytics** | Cross-cut | User query (Bangla/English) | AI Assistant — 5 canned answers + generic refusal (§2) | [MOCK] answers / [IMPLEMENTED] UI / [BACKEND] for real |
| 14 | **Automatic narrative explanations of dashboard changes** | Cross-cut | RT/daily when a KPI tile moves | Partial cue only — KPIs carry `deltaPct` and a "Why this number?" provenance popover (formula + sources), but **no generated "why it changed" narrative** | [MOCK] (provenance) / [PLANNED] (narrative) |

**Net read:** of the 14 capabilities, the prototype *demonstrates the surface* of roughly nine (1, 5, 6, 2, 7, 12, 8, 13, and partial 14) via static reports, canned assistant answers, or client-side computed KPIs; capabilities 3, 10, 11, and the pipeline narrative are not demonstrated at all (labels only or absent). **Zero of the 14 run a live detector or model** — all narrative is authored.

### 3.1 Automatic detection — what exists vs. what is designed

The blueprint's automatic-detection layer is **change-gated deterministic detectors** that decide whether there is anything to say before any narration runs. In the prototype:

- **What exists [MOCK]:** a static `alerts` array (8 items in `insights.ts`) surfaced on the Dashboard ("Top alerts") and the Risks page ("AI-detected anomalies"). Each alert carries a `severity` (critical / warning / info / positive), a `confidence`, a `category`, and a `source` provenance block. These *look like* detector output but are hand-authored — nothing computes them, and `acknowledged` is a stored field with no mutation path.
- **What exists [IMPLEMENTED]:** genuinely client-side computed signals that a detector *could* drive — e.g. `computePortfolio()` derives `overdueApprovals` and `overdueTotal`, `agingBuckets()` derives bucket crossings, `utilizationSummary()` derives `overloaded`/`coverage`/`confidence`. These are real calculations over mock data and are the closest thing to a deterministic layer in the prototype.
- **What is missing [BACKEND]:** the scheduler, the change-gating ("fire only on a material delta since last run"), the per-capability `min_completeness` threshold enforcement, and any model narration. No alert is ever generated, escalated, or acknowledged durably.

---

## 4. Anti-hallucination architecture

This is the design's centre of gravity. The threat model is specific to a small Dhaka firm whose most valuable data is missing or informal (no timesheets, verbal approvals, WhatsApp scope changes): **an AI that papers over gaps with confident prose is worse than no AI**, because the owner makes BDT decisions on fabricated numbers. The blueprint's defence is layered; the prototype implements the *visible contract* of that defence and stubs the engine.

### 4.1 The core inversion (designed)

> **The LLM never computes a number, never queries the database, and never sees raw SQL.** Numbers come from deterministic, versioned semantic-layer functions. The LLM only (a) chooses which typed tool to call, (b) reads its structured output, and (c) writes narrative around facts it was handed. Every fact carries provenance + a completeness score; when data is missing, the system refuses.

Status: **[BACKEND]** in full. The prototype shows the *output side* of this contract (cited blocks, confidence levels, refusals) but has no semantic layer, no tool catalogue, and no model. The four `api.ts` derived functions (`computePortfolio`, `agingBuckets`, `pipelineByStage`, `utilizationSummary`) are the only deterministic computation present and would be the seed of a real semantic layer.

### 4.2 The seven defence layers — designed vs. prototype

| # | Defence (blueprint/06) | What it does | Prototype status |
|---|---|---|---|
| 2.1 | **Restricted retrieval** | Model sees only the semantic layer + an approved-document index; no open internet, no raw file scan; chat captures citable only after promotion to a typed record | [BACKEND] — no retrieval layer exists; capture-promotion gate is illustrated by the Review Queue (local-state only) |
| 2.2 | **Typed tool calls, never free-form SQL** | Model calls a curated, unit-tested tool catalogue returning pre-computed JSON + provenance + completeness | [BACKEND] — no tools; nearest analogue is the four `api.ts` functions |
| 2.3 | **Deterministic facts vs. LLM narrative separation** | A fact bundle (JSON) is computed first; the model narrates only; a **post-validator** rejects any number not in the bundle | [BACKEND] — no validator; the prototype's numbers are authored, not validated |
| 2.4 | **Explicit "insufficient data" state** | Each capability declares `min_completeness` + required entities; missing entity → capture prompt, not a number; partial → number with caveat band | **[IMPLEMENTED] as UX** — `Confidence: "insufficient"`, `Metric.value: null`, `InsufficientData` component, dashed answer cards, KpiCard "— —" branch all render. The *gating logic* is [BACKEND] |
| 2.5 | **Provenance + confidence on every output** | Source chip on every fact (`[INV-2031 · calc v3 · conf: High]`); confidence computed deterministically from source type, recency, completeness, estimation | **[IMPLEMENTED] as UX** — `SourceChip`, `ConfidenceBadge`/`ConfidenceMeter`, `DataCompleteness`, and the "Why this number?" `ProvenancePopover` (formula + sources + as-of date) all render. The *deterministic confidence computation* is [BACKEND] |
| 2.6 | **Human approval gate for external reports** | `audience: external` reports are drafted and routed to an Owner/Finance approval queue before send; logged in audit | **[IMPLEMENTED] as UX** — Review Queue maker-checker (approve/reject) works in local state; Schedules links client-facing reports to `/review`. **No write, no send** — [BACKEND] + [INTEGRATION] |
| 2.7 | **Eval / test harness + runtime guardrails** | Golden-fixture eval set, hallucination regression tests, determinism + calc-parity tests; read-only tool scope; per-tenant row filter; PII minimization (no NID/TIN/passport in prompts) | [PLANNED] — none of this exists in a frontend prototype |

### 4.3 The trust UX that *is* real (the prototype's genuine contribution)

Even with no engine, the prototype proves the **trust vocabulary** an owner needs, and these components are shared across every screen:

| Component | Where defined | What it renders | Status |
|---|---|---|---|
| `ConfidenceMeter` / `ConfidenceBadge` | `components/trust.tsx` | 4-bar meter; high=4/sage, medium=3/ochre, low=2/sienna, insufficient=0/"No data" | [IMPLEMENTED] |
| `DataCompleteness` | `components/trust.tsx` | % bar, banded sage ≥75 / ochre ≥50 / sienna below | [IMPLEMENTED] |
| `ProvenancePopover` ("Why this number?") | `components/trust.tsx` | Formula (mono) + completeness + confidence + source list (`recordRef` + observed-at) + note + "As of" | [IMPLEMENTED] |
| `InsufficientData` | `components/states.tsx` | Dashed box, *"…can't be computed reliably yet — … We show nothing rather than a fabricated number."* + optional capture CTA | [IMPLEMENTED] |
| `SourceChip` / `StatusDot` | `components/data-source.tsx`, `alert-row.tsx` | Cited source name (+ optional status dot) | [IMPLEMENTED] |

This is why the prototype is a convincing *demonstration* of anti-hallucination design: the refusal and provenance behaviours are visible, consistent, and faithful to the blueprint — they are simply driven by authored data rather than a live deterministic layer.

### 4.4 Where the prototype's honesty has a crack

Two places where the prototype's own copy slightly out-runs its mechanism (worth flagging to evaluators, both [MOCK]):

1. **The insufficient-block hint is hardcoded** (§1.4) — it claims "four of eight projects have timesheet coverage below 65%" regardless of which block is insufficient. A real engine would name the actual missing entities for *that* block.
2. **The reader footer claims "the numbers are not [generated]."** True only because they are authored constants; there is no deterministic engine producing them yet. The statement is aspirational until the semantic layer exists.

Neither undermines the design — they mark exactly the seams where [BACKEND] work attaches.

---

## 5. Natural-language analytics & narrative explanations

| Surface | Designed behaviour | Prototype behaviour | Status |
|---|---|---|---|
| **NL analytics (cap. 13)** | Typed/spoken Bangla or English query → semantic-layer tool calls → conversational answer with inline citations + figure table; "insufficient data" when unmapped | AI Assistant: 5 exact-match canned answers + generic refusal; 650 ms fake thinking; no NLP, no Bangla handling beyond the topbar label toggle | [MOCK] answers / [IMPLEMENTED] UI |
| **Narrative explanations of KPI moves (cap. 14)** | When a dashboard tile moves beyond a noise threshold, a one-paragraph fact-cited "why this changed" tooltip is generated | KPI cards carry `deltaPct` + a "Why this number?" popover (formula + sources). **No generated "why it changed" prose** | [MOCK] provenance / [PLANNED] narrative |
| **Cited answers** | Every fact carries a source chip; tapping it drills into the underlying records + formula + calc version | `SourceChip` renders citation names; the ProvenancePopover shows formula + record refs + observed-at; chips are not yet drill-through links to record detail | [IMPLEMENTED] (display) / [BACKEND] (drill-through) |
| **Refuse-when-missing** | First-class "insufficient data" output; guessing is a CI failure | Two refusal paths in the assistant; `InsufficientData` + dashed cards across pages | [IMPLEMENTED] as UX |
| **Bilingual (Bangla/English)** | Reports/NL in both languages; Bijoy→Unicode normalization at ingest | Only select mock fields are bilingual (e.g. `project.nameBn`); the topbar language toggle flips the **EN/বাংলা label only** and does not translate the UI | [MOCK] data / [PLANNED] i18n |

---

## 6. Model strategy (production design)

The blueprint pins the **Claude family** and is explicit that the architecture is *model-portable* — because facts come from the semantic layer, swapping models changes narration quality, never the numbers. None of this is wired in the prototype (no API key, no inference); it is the target.

| Workload | Designed model | Why | Prototype |
|---|---|---|---|
| Daily briefing, weekly/monthly reports, NL analytics, risk/scope narration | **Claude Sonnet** (current generation) | Strong instruction-following + tool use; good Bangla/English; low enough latency/cost for daily + per-project volume | Not wired [INTEGRATION] |
| High-stakes external monthly report drafting; ambiguous scope-creep judgement on messy captured text | **Claude Opus** (current generation) | Better reasoning on noisy bilingual evidence; used selectively to control cost | Not wired [INTEGRATION] |
| Lightweight extraction/classification (promote a captured WhatsApp note into a typed `Decision`/`Change`; language detection) | **Claude Haiku** (current generation) | Cheap, fast, high-volume ingest-time work | Not wired [INTEGRATION] |

**Why Claude specifically (per blueprint):** reliable structured tool use (the backbone of the fact/narrative separation), strong adherence to "refuse when data is missing" instructions, competent Bangla comprehension, and deployability in Singapore/Mumbai-adjacent regions consistent with the PDPO 2025 data-residency posture (sensitive identifiers — NID/TIN/passport — never enter prompts). Model IDs would be pinned per release and treated as a versioned dependency so eval results stay reproducible.

---

## 7. End-to-end flow: from a captured fact to a cited, approved report

This is the intended production lifecycle (Input → Validation → Processing → Approval → Storage → Reporting → Follow-up), annotated with what the prototype does at each step.

| Stage | Designed (production) | Prototype today | Status |
|---|---|---|---|
| **Input** | A fact is captured (manual capture, API sync, file ingest, WhatsApp/email forward) | Capture forms collect input (`useState`), inline success message | [IMPLEMENTED] form / not saved |
| **Validation** | Provenance attached; Bijoy→Unicode normalized; OCR confidence recorded; promotion required before a chat capture is citable | The only validation is the `ready` gate on the Capture form (project + required field present) | [IMPLEMENTED] (gate) / [BACKEND] (the rest) |
| **Processing** | Deterministic semantic-layer functions compute KPIs; detectors decide if there's something to report | `computePortfolio` / `agingBuckets` / `pipelineByStage` / `utilizationSummary` compute client-side over mock data | [IMPLEMENTED] (4 functions) / [BACKEND] (detectors, full layer) |
| **Generation** | Claude narrates around the computed fact bundle; post-validator checks every number | Reports are authored mock strings; assistant returns canned answers | [MOCK] / [BACKEND] + [INTEGRATION] |
| **Approval** | `audience: external` artefacts route to Review Queue; maker proposes, checker (Owner/Director) approves/rejects; logged | Review Queue approve/reject works in **local state only**; "Approve & send" moves the item but sends nothing | [IMPLEMENTED] (local) / [BACKEND] + [INTEGRATION] |
| **Storage** | Report + fact bundle + decisions persisted; append-only audit | Nothing persists; refresh resets all state | [BACKEND] |
| **Reporting** | Cited report renders on `/reports`; scheduled delivery via email/WhatsApp/in-app | `/reports` renders mock reports; `/schedules` shows roster with a working active-toggle (local) | [MOCK] render / [IMPLEMENTED] toggle / [INTEGRATION] delivery |
| **Follow-up** | Activity Log captures every generation/approval immutably; alerts escalate | Activity Log shows 14 mock events read-only; "append-only/tamper-evident" is stated intent | [MOCK] / [BACKEND] |

---

## 8. Current vs. target — at a glance

| Capability | Current (prototype) | Target (production) |
|---|---|---|
| Read AI reports & blocks | [MOCK] 3 static reports; 5 kinds advertised | Generated per schedule/trigger; all 5 kinds populated |
| Report citations & confidence | [MOCK] authored values, rendered faithfully | Computed deterministically; confidence from source/recency/completeness |
| Insufficient-data state | [IMPLEMENTED] as UX; hint hardcoded | Gated by `min_completeness` + required entities; hint names real gaps |
| AI Assistant NL Q&A | [IMPLEMENTED] UI / [MOCK] 5 canned answers + refusal | Claude + semantic-layer tools; Bangla/English; cited answers |
| Refuse-when-missing | [IMPLEMENTED] (two paths) | First-class output; enforced by validator + CI regression tests |
| Anti-hallucination engine | [BACKEND] — UX contract only | Semantic layer + typed tools + fact/narrative split + post-validator |
| Automatic detection / alerts | [MOCK] 8 static alerts; 4 real client-side calcs | Change-gated deterministic detectors over the semantic layer |
| External-report approval gate | [IMPLEMENTED] local maker-checker | Persisted maker-checker + audit + send |
| Scheduled delivery | [IMPLEMENTED] active-toggle (local) | Job runner (cron/queue) + email/WhatsApp/in-app adapters |
| Model | None wired | Claude Sonnet / Opus / Haiku by workload; pinned IDs; SG/Mumbai region |
| Bilingual | [MOCK] fields + label-only toggle | Full Bangla/English reports + Bijoy→Unicode at ingest |

---

## 9. Recommended path to production (reporting, AI & analytics)

| Area | Recommendation | Tag |
|---|---|---|
| Semantic layer | Build the versioned metric/dimension layer over a canonical schema; port the four `api.ts` functions as the first metrics, each with an explicit formula + `min_completeness` gate | [BACKEND] |
| Tool catalogue | Expose read-only typed tools (`get_invoice_aging`, `get_forecast_margin`, `get_milestone_status`, …) returning pre-computed JSON + provenance + completeness; unit-test each | [BACKEND] |
| Fact/narrative split + validator | Compute a fact bundle, pass it to Claude for narration only, and add a post-generation validator that rejects any number absent from the bundle (regenerate once, then fall back to templated rendering) | [BACKEND] + [INTEGRATION] |
| AI Assistant | Replace the `ANSWERS` map with retrieval + Claude tool use; keep the refusal contract as the default; add Bangla handling | [INTEGRATION] |
| Detection | Add change-gated daily/weekly detectors; emit real alerts with provenance; make `acknowledged` a durable mutation | [BACKEND] |
| Approval & delivery | Persist the maker-checker queue + audit; wire "Approve & send" and Scheduled Reports to a job runner + channel adapters | [BACKEND] + [INTEGRATION] |
| Eval harness | Golden-fixture dataset + hallucination regression + determinism + calc-parity tests in CI; PII minimization + per-tenant row filtering at the tool layer | [PLANNED] |
| Drill-through citations | Make `SourceChip`s link to the underlying record + formula + calc version | [RECOMMENDED] |

> **Bottom line for evaluators.** The reporting and AI layer is a polished, internally-consistent **demonstration** of an anti-hallucination reporting workflow. Its trust UX — confidence meters, source chips, completeness bars, dashed refusal cards, and explicit "insufficient data" — is genuine and working in the browser **[IMPLEMENTED]**. Its intelligence, deterministic computation, generation, persistence, sending, and scheduling are **not built** — they are mock content, canned strings, and local state awaiting the semantic layer, the Claude integration, and a backend specified in `blueprint/06-ai-reporting-design.md`.
