# Module Documentation: Intelligence

> **Prototype reality check.** SPACE ESSE · Practice Intelligence is a **frontend-only, high-fidelity interactive prototype**. There is no backend, no database, no authentication, and no real AI inference. Every "AI" answer and every "AI" report you see in this module is **pre-written mock content** served from `src/lib/mock/*` through a simulated ~280 ms transport (`src/lib/api.ts` `resolve()`) and the assistant's own 650 ms `setTimeout`. Where this document says a feature "works," it means it works **in the browser, in client state only** — a page refresh resets everything. Persistence, real generation, sending, and scheduling are not built.

This module covers the six surfaces that make up the firm's "intelligence layer":

| # | Module | Route / Trigger | One-line role |
|---|--------|-----------------|----------------|
| 1 | AI Reports & Briefings | `/reports` | Read pre-authored, cited report narratives |
| 2 | AI Assistant ("Ask Space Esse") | Slide-over (Ctrl/Cmd+J or "Ask AI") | Ask natural-language questions; get canned cited answers |
| 3 | Review Queue | `/review` | Maker–checker sign-off on captures and client-facing reports |
| 4 | Scheduled Reports | `/schedules` | Configure who gets which report, when, and how |
| 5 | Activity Log | `/activity` | Append-only, provenance-stamped audit trail |
| 6 | Global Search | `/search` | One query across six mock datasets |

A recurring design theme across all six: **trust signals travel with the data**. Confidence levels, source citations, completeness percentages, and explicit "insufficient data" refusals are surfaced everywhere — and they are the genuine, working part of the prototype, even though the underlying data is mock.

---

## Status legend (used throughout)

- **[IMPLEMENTED]** — interactive and working in the frontend (client-side only; not persisted).
- **[MOCK]** — renders from mock data; the read/calc/generation it represents is simulated, not live.
- **[BACKEND]** — designed in the UI; needs an API / database / persistence to actually function.
- **[INTEGRATION]** — needs a third-party connector (email, WhatsApp, accounting, Drive, etc.).
- **[PLANNED] / [RECOMMENDED]** — not built; a future enhancement.

---

# 1. AI Reports & Briefings

**Route:** `/reports` · **Component:** `AIReports.tsx` · **Data:** `useAIReports()` → mock `aiReports` (`src/lib/mock/insights.ts`)

## 1.1 Purpose

A reading room for AI-authored briefings. The premise (stated verbatim in the header) is: *"Every figure cites the source record, the date it was observed and a confidence level. The AI writes the narrative around verified facts — and refuses when the data is missing."* The honest framing is accurate to the **design intent**; in the prototype the narratives are fixed strings, not generated.

## 1.2 What is actually there

There are **3 mock reports** in the library. The data model allows 5 report kinds; only 3 are populated.

| Report id | Kind | Status | Scope | Completeness | Blocks | Block confidences |
|-----------|------|--------|-------|--------------|--------|-------------------|
| `rep_daily` | `daily_brief` | published | Firm-wide | 73 | 4 | high, high, low, **insufficient** (block 4) |
| `rep_weekly_p1` | `weekly_project` | published | p1 (project) | 74 | 3 | medium, high, low |
| `rep_cash` | `cash_warning` | needs_review | Firm-wide | 88 | 1 | high |

**The five report kinds (`KIND_META`)** — three are populated above; the other two are advertised in the footer "Report types" strip but have no sample content:

| Kind | Label | Tone | Populated? |
|------|-------|------|------------|
| `daily_brief` | Daily brief | blue | Yes |
| `weekly_project` | Weekly project | sage | Yes |
| `monthly_company` | Monthly company | neutral | No (label only) [PLANNED] |
| `risk_summary` | Risk summary | ochre | No (label only) [PLANNED] |
| `cash_warning` | Cash warning | rust | Yes |

## 1.3 Layout & components

- **Anti-hallucination strip** (top, blue tint, ShieldCheck): static copy explaining that numbers are computed deterministically and the AI only writes narrative around cited facts. **[MOCK]** — accurate as a *description of intent*, not of a running engine.
- **Report library (left rail)** — `ReportListCard` per report; each is a `<button>`. Selecting one sets `selectedId`. **[IMPLEMENTED]** (client selection only). Shows kind badge, status badge, title, `Generated {relative}`, and a `DataCompleteness` bar.
- **Reader (right)** — `ReportReader` renders the selected report: kind/audience/status badges, title, `Generated {date} · {project or "Firm-wide"}`, completeness bar, action buttons, and the report blocks.
- **Footer "Report types"** — badges for all five kinds plus the closing line: *"The AI never invents a number. When records are insufficient, it says so — by name and section."*

## 1.4 Report block rendering

Each `ReportBlock` shows a heading and body. Two paths:

| Block type | Renders | Status |
|------------|---------|--------|
| Normal block | Body + `ConfidenceBadge level={block.confidence}` + citation chips | [MOCK] |
| Insufficient block (`block.insufficient === true`) | `InsufficientData` component with the heading as the metric name | [MOCK] |

**Citations:** if a block has `citations.length === 0`, it renders italic *"No source records cited."* Otherwise each citation becomes a `SourceChip` labelled `{sourceName} · {ref}`. Citation **dates are not shown** in these chips.

> **Important caveat — the insufficient-block hint is hardcoded.** When a block is insufficient, the `InsufficientData` hint text is the literal string *"four of eight projects have timesheet coverage below 65%, so labour cost is incomplete."* This text is **not derived from data** — it is the same regardless of which block triggered it. **[MOCK]**

## 1.5 Action buttons — all visual-only

The reader chooses its button set based on `externalReview = audience === "external" && status === "needs_review"`. In the current mock data all three reports are `internal`, so the external branch is effectively unreachable with shipped data.

| Button | Condition shown | Wired? |
|--------|-----------------|--------|
| New report (PageHeader, Sparkles) | always | **No onClick — [BACKEND]** |
| Approve & send (Check) | externalReview branch | **No onClick — [BACKEND]/[INTEGRATION]** |
| Regenerate (RefreshCw) | both branches | **No onClick — [BACKEND]** |
| Export (Send) | non-external branch | **No onClick — [BACKEND]** |

**Reader footer line (verbatim):** *"Every figure traces to a cited record. The narrative is generated; the numbers are not."*

## 1.6 States

| State | Behavior |
|-------|----------|
| Loading | Left rail shows 3 `Skeleton h-28` only when `isLoading && reports.length === 0`; reader shows `Skeleton h-[420px]` if nothing selected |
| Empty | None — a mock fallback (`const list = reports.length ? reports : aiReports`) guarantees the list is never empty |
| Error | None — no error boundary or failure UI |

## 1.7 Lifecycle (as designed vs. as built)

| Stage | Designed intent | Prototype reality |
|-------|-----------------|-------------------|
| Generation | AI composes narrative around computed figures | Reports are static objects in `insights.ts` [MOCK] |
| Cite & confidence-rate | Each block carries citations + a confidence level | Present and rendered; values are authored, not measured [MOCK] |
| Review (external) | Needs-review reports gated before sending | `Approve & send` is a dead button here; real gate lives in Review Queue [BACKEND] |
| Export / send | Email/PDF delivery | `Export` / `Regenerate` not wired [BACKEND]/[INTEGRATION] |

---

# 2. AI Assistant — "Ask Space Esse"

**Trigger:** Ctrl/Cmd+J, the Topbar "Ask AI" button, or the Command Palette "Ask Space Esse AI" action · **Component:** `AssistantPanel.tsx`

## 2.1 Purpose

A right-side slide-over chat panel. Header subtitle: *"Cited answers · refuses when data is missing."* The disclaimer below the input reads: *"Space Esse only uses verified records. It will say when it doesn't know."*

## 2.2 How it actually answers — a fixed lookup map

This is the single most important thing to understand: **the assistant does not reason or call any model.** When you submit a question `q`, it runs:

```
ANSWERS[q] ?? genericAnswer(q)
```

after a fixed **650 ms `setTimeout`** (the "Checking the records…" thinking animation). If your text exactly matches one of the five canned keys, you get that canned answer; otherwise you get the generic refusal. **[MOCK]** — there is no NLP, no fuzzy matching, and no data lookup. Typing a near-miss of a suggested question returns the refusal.

**Interaction mechanics that genuinely work [IMPLEMENTED] (client state only):**

| Element | Behavior |
|---------|----------|
| Input + submit (ArrowUp) | Submit disabled when input is empty/whitespace; on submit calls `ask(input)`, clears input |
| Thinking indicator | Three pulsing blue dots + "Checking the records…" for 650 ms |
| Thread | User question bubble (blue, right) above each answer card; auto-scrolls to newest |
| Empty state | Intro copy + 5 suggestion buttons (clicking one submits it) |

## 2.3 The five canned answers (`ANSWERS`)

These five strings are the only inputs that return a curated answer. Each carries a confidence level and citations.

| Suggested question (exact key) | Confidence | Summary of canned answer | Citations |
|--------------------------------|-----------|--------------------------|-----------|
| "Which projects are losing money?" | **low** | Flags Meghna Textiles HQ Interior: cost-to-date ৳46.5L over ৳42.0L budget, ~৳1.4L unbilled change orders (WhatsApp 9 Jun), forecast margin ~4% but low-confidence at 60% timesheet coverage; Aldenair & Cantonment positive | Manual capture · Change log (2026-06-09); TallyPrime · cost-to-date (2026-06-12) |
| "What's overdue in collections right now?" | **high** | ৳58.0L overdue across three invoices; ৳39.0L Meghna (INV-2026-019 @97d, INV-2026-022 @51d), ৳18.0L Aldenair (INV-2026-028 @46d); net cash at risk ~৳49L after VAT/VDS/~10% AIT | TallyPrime · INV-2026-019; TallyPrime · INV-2026-028 |
| "Where are we stuck on authority approvals?" | **high** | Bashati Corporate Tower blocker: RAJUK Construction Permit (Form 301) in review 61 days vs 30-day window, caps health at 49; FSCD refuge-floor query, resubmission targeted 20 Jun | RAJUK ECPS · ECPS-2024-88213; Phone note · Decision #219 |
| "Can we take on a new project next month?" | **insufficient** | **Refuses.** Capacity needs billable utilization; only 6/10 staff log time (64% coverage); won't estimate from incomplete data; notes Arif Chowdhury >90% six weeks, Nusrat Jahan down to 71% | Timesheet capture · coverage 64% |
| "Who is overloaded this week?" | **medium** | Arif Chowdhury >90% six consecutive weeks (92% coverage); Kamrul Pasha ~90%; principal/finance/liaison don't log time so load unknown | Timesheet capture · series e3 |

## 2.4 The deliberate refusal — `genericAnswer(q)`

Any question **not** in the map returns a hard-coded refusal with **confidence `insufficient` and empty citations**:

> *"I answer from verified records only. I don't have enough linked data to answer that confidently yet. Try one of the suggested questions, or capture the underlying records first — I'll show my sources and confidence on every answer."*

This refusal-by-default behavior is intentional and is one of the product's signature trust moves. Combined with the `insufficient` canned answer ("Can we take on a new project next month?"), there are **two refusal paths**.

## 2.5 Answer rendering & trust visuals [IMPLEMENTED]

| Element | Behavior |
|---------|----------|
| Answer card border | **Dashed** (`border-dashed border-line-strong`) when `insufficient`; solid otherwise — a visual cue that an answer is a refusal/low-trust |
| ConfidenceBadge | 4-bar meter + label. high→4 bars/sage; medium→3/ochre; low→2/sienna; insufficient→0 bars and the literal label **"No data"** |
| SourceChip | One per citation, showing the source name only (no date) |

## 2.6 What the assistant is **not**

- **Not** connected to the mock data hooks — it does not read `useProjects`, invoices, etc. The figures inside the canned answers are baked into the strings.
- **Not** persisted — the thread resets on refresh.
- **Not** generative — there is no LLM call. [BACKEND]/[PLANNED] for any real Q&A.

---

# 3. Review Queue

**Route:** `/review` · **Component:** `Review.tsx` · **Data:** `useReviewQueue()` → 6 mock `ReviewItem`s

## 3.1 Purpose

The human gate. Header: *"Verify captured records and approve client-facing AI reports before they're sent — every item shows its source and confidence."* The model is **maker–checker**: a maker proposes (a capture, a match, a draft report); a checker (Owner/Director) approves or rejects. The header badge reads `Maker–checker` (visual).

## 3.2 The maker-checker behavior — local state only [IMPLEMENTED]

This is the most genuinely interactive module in the Intelligence section, but the interactivity is **client-state only**:

- On first load it seeds a mutable local copy once: `if (!seeded && data) { setItems(data); setSeeded(true); }`.
- `resolveItem(id, status)` maps over `items` and sets `{ ...it, status }`.
- Approve/Reject update local React state and move the item from the **Pending** tab to **Resolved**.

> **No write occurs.** There is no `useMutation`, no POST/PATCH, no persistence. Refresh the page and every approval/rejection is gone. **[BACKEND]** is required for a durable maker-checker audit. The "send" half of "Approve & send" is also **[INTEGRATION]** (no email/WhatsApp dispatch exists).

## 3.3 Item kinds (`KIND_META`)

| Kind | Label | Icon | Tone | "What lands here" description (verbatim) |
|------|-------|------|------|------------------------------------------|
| `report` | AI report | FileText | blue | "Client-facing narrative — sign off before sending." |
| `capture` | Capture | PencilLine | sage | "A note or thread promoted to a citable record." |
| `match` | Project match | GitMerge | ochre | "A proposed link between an alias and a project." |
| `discrepancy` | Discrepancy | AlertTriangle | rust | "Two sources disagree — pick the truth." |

## 3.4 Row actions (pending vs resolved)

| Item state | Action / badge | Label | Status |
|------------|----------------|-------|--------|
| Pending + `report` | Primary button (ShieldCheck) | **Approve & send** | [IMPLEMENTED] local move only; "send" is [INTEGRATION] |
| Pending + non-report | Sienna button (Check) | **Verify & promote** | [IMPLEMENTED] local move only |
| Pending (any) | Ghost/rust button (X) | **Reject** | [IMPLEMENTED] local move only |
| Resolved + approved | sage dot badge | "Signed off" (report) / "Verified" (other) | visual badge |
| Resolved + rejected | rust dot badge | "Rejected" | visual badge |

Resolved rows render at `opacity-65`. Each row also shows: kind badge + title, detail, a project `Link` to `/projects/:id`, the submitter, a relative timestamp, a `ConfidenceBadge`, and a `SourceChip` (`{sourceName} · {recordRef}`).

## 3.5 Filters & tabs [IMPLEMENTED]

| Control | Options | Behavior |
|---------|---------|----------|
| Kind filter (Select) | All kinds / AI reports / Captures / Discrepancies / Project matches | Filters `items` → `byKind` (client state) |
| Tabs | `Pending` / `Resolved` | Switches view; count appended to label when not loading and count > 0 |

`pending` = `byKind` where `status === "pending"`; `resolved` = the rest.

## 3.6 KPIs (computed over current local items)

| KPI | Value | Footnote |
|-----|-------|----------|
| Pending review | count `status === "pending"` | "Awaiting a human check" |
| Reports awaiting sign-off | pending with `kind === "report"` | blue "Client-facing" if > 0, else sage "All cleared" |
| Captures to verify | pending with `kind ∈ {capture, match}` | "Notes & matches" |
| Discrepancies | pending with `kind === "discrepancy"` | rust "Conflicting sources" if > 0, else sage "None open" |

Because the KPIs read from local `items`, they **update live** as you approve/reject (until refresh). [IMPLEMENTED]

## 3.7 Explainer panel & states

- Right column: a "Why this gate exists / The trust control" card with the ochre note *"Confidence and source travel with every item — you approve evidence, not guesses."* and footer `Maker proposes · checker approves` + `Owner / Director` badge. The "What lands here" section lists the four kinds. As-of date is `2026-06-17`; a `SourceChip name="Review queue" status="manual"` is shown.

| State | Behavior |
|-------|----------|
| Loading (`isLoading \|\| !seeded`) | KPIs show 4 skeleton cards; queue shows 3-row `QueueSkeleton` |
| Empty pending | EmptyState (ShieldCheck) "Queue is clear" |
| Empty resolved | EmptyState (Check) "Nothing resolved yet" — *"keeping an auditable trail of every decision"* |
| Error | None |

---

# 4. Scheduled Reports

**Route:** `/schedules` · **Component:** `Schedules.tsx` · **Data:** `useSchedules()` → 6 mock `ScheduledReport`s

## 4.1 Purpose

The delivery roster: *"Which AI reports go to whom, and when. Owners and admins control cadence, recipients, and the channel each report is delivered through."*

## 4.2 The active toggle — the one working control [IMPLEMENTED]

Each schedule row has a `Switch` for active/paused. The state is held in a local override map:

```
rows: active = (r.id in activeById) ? activeById[r.id] : r.active
toggleActive(id, current): setActiveById({ ...prev, [id]: !current })
```

Toggling pauses/resumes the row in the UI (inactive rows go `opacity-60` and show "Paused" for next run). **It does not write back to the mock module** — refresh resets it. **[BACKEND]** for durable scheduling; **[INTEGRATION]** for actual delivery, because nothing is ever sent.

## 4.3 Delivery schedule table

Columns (in order): **Report · Cadence · Recipients · Channel · Audience · Next run · Last run · Active · Edit**

| Cell | Content / source |
|------|------------------|
| Report | `report.name` + kind badge (`KIND_META`; here `monthly_company`→ochre, `risk_summary`→sienna); external reports also show a sienna **"Needs approval"** badge (static, not a link) |
| Cadence | `report.schedule` text + capitalized `report.cadence` (daily/weekly/monthly) |
| Recipients | First 3 `Avatar`s; names joined `, `; roles joined ` · ` |
| Channel | `CHANNEL_META`: email→Mail, whatsapp→MessageSquare, in_app→Bell (neutral badge) |
| Audience | external → `Link to="/review"` wrapping sienna "Client-facing" badge (**functional cross-link** [IMPLEMENTED]); else neutral "Internal" badge |
| Next run | active → `shortDate(nextRun)` + relative; inactive → "Paused" |
| Last run | `shortDate(lastRun)` or "Never" |
| Active | `Switch` — [IMPLEMENTED] local toggle |
| Edit | Ghost Pencil button, `aria-label="Edit {name}"` — **no onClick — [BACKEND]** |

## 4.4 Stat row

| Stat | Derivation |
|------|------------|
| Active schedules | count of `rows` where `active` |
| Next run | earliest `nextRun` among active (relative), else "—" |
| Client-facing | count of `audience === "external"` |

## 4.5 Cross-links & non-functional controls

- **Functional links to `/review`:** the explainer card link, the Audience "Client-facing" badge, and the footer "Open review queue" link. The explainer states client-facing reports *"never send automatically — they pass through the Review queue for owner sign-off first."*
- **Visual-only:** `New schedule` (header **and** empty-state, Plus icon) and the per-row `Edit` button — **no handlers — [BACKEND]**.

## 4.6 States

| State | Behavior |
|-------|----------|
| Loading | 3 skeleton stat cards + 4 row skeletons |
| Empty (`rows.length === 0`) | EmptyState (Send) "No scheduled reports" + subtle `New schedule` button (visual-only) |
| Error | None |

---

# 5. Activity Log

**Route:** `/activity` · **Component:** `ActivityLog.tsx` · **Data:** `useActivity()` → 14 mock `ActivityEvent`s

## 5.1 Purpose

The audit trail of record: *"An append-only, provenance-stamped trail of every capture, sync, approval, report and match — so every number in Space Esse can be traced back to who recorded it, when, and from where."* The page anchors "today" to `parseISO("2026-06-17")`.

This page is **read-only by nature** [MOCK] — it displays the mock event stream. The "append-only / tamper-evident" guarantee is **design copy**, not an enforced mechanism; there is no backend to make it tamper-evident. **[BACKEND]** would be required to make this a true immutable audit log.

## 5.2 Event types (`TYPE_META`)

| Type | Label | Icon | Tone |
|------|-------|------|------|
| `capture` | Capture | PencilLine | sage |
| `sync` | Sync | RefreshCw | blue |
| `approval` | Approval | Check | sage |
| `report` | Report | FileText | blue |
| `match` | Match | GitMerge | ochre |
| `invoice` | Invoice | Receipt | ochre |
| `alert` | Alert | AlertTriangle | rust |

## 5.3 Timeline rendering [MOCK]

Events are grouped by day (`groupByDay`, key `yyyy-MM-dd`), days sorted newest-first, events within a day newest-first. Each day header shows `EEE, d MMM yyyy`, a blue "Today" badge when it matches the anchor date, and a mono `{n} event(s)` count.

Each `EventRow` (display-only, **no per-row actions**) shows: a circular timeline node (type icon + tone), `**{actor}** {summary}`, then a meta line with the type badge, a project `Link` to `/projects/:id` (when `projectById` resolves), a `SourceChip` (`{sourceName}` + ` · {recordRef}` when present), and a relative timestamp (with `title` showing the full short date).

## 5.4 Filters [IMPLEMENTED]

| Control | Behavior |
|---------|----------|
| Type Select | "All event types" + one option per type label; filters before grouping |
| Search input | Case-insensitive substring over `summary` OR `actor` |

## 5.5 KPIs (computed on the full, unfiltered set)

| KPI | Value | Footnote |
|-----|-------|----------|
| Events today | events where `isSameDay(timestamp, TODAY)` | "Recorded 17 Jun 2026" |
| Captures this week | `type === "capture"` and within last 7 days | sage "Manual records" |
| Last sync | relative of newest `sync` event (else "—") | `SourceChip` of last sync source, or "No sync recorded" |

While loading, KPI values render "—".

## 5.6 Tamper-evidence note (verbatim)

> *"Append-only — tamper-evident. Entries are never edited or deleted in place; corrections are recorded as new events. This is the audit trail of record for the firm."*

Treat this as **stated intent**; enforcement is [BACKEND].

## 5.7 States

| State | Behavior |
|-------|----------|
| Loading | `TimelineSkeleton` (2 day groups × 3 rows) |
| Empty (filtered) | EmptyState (History) "No matching events" — *"Try a different type or clear your search"* |
| Empty (unfiltered) | EmptyState "Activity will appear here as captures, syncs, approvals and reports are recorded" |
| Error | None |

---

# 6. Global Search

**Route:** `/search` (also reachable from the Command Palette "Search everywhere for …" item) · **Component:** `Search.tsx`

## 6.1 Purpose

A single index across the practice: *"One query across projects, clients, invoices, people, decisions and deliverables — matched into a single index."* In reality it is a **client-side substring match across six React Query mock datasets** — there is no search server or index. **[MOCK]** data, **[IMPLEMENTED]** matching.

## 6.2 Query handling [IMPLEMENTED]

- Reads `?q=` from the URL (`useSearchParams`). The page title becomes `Results for "{q}"` or "Search".
- Local `term` state seeds from `q`; a `useEffect` re-syncs `term` when the URL `q` changes.
- Submitting the form sets the URL param `{ q: value }` (or clears it). The input is `autoFocus`.

## 6.3 Datasets, match fields, and links

Matching uses a case-insensitive substring helper (`has`). Only non-empty groups render, in this order:

| Group (icon/tone) | Match fields | Secondary text | Trailing / badge | Row link |
|-------------------|--------------|----------------|------------------|----------|
| Projects (Layers/blue) | name, code, client | `{code} · {client} · {stage}` | `HealthBadge` | `/projects/:id` |
| Clients (Building2/ochre) | name, city | `{city} · {n} active project(s)` | `{type}` badge; `{outstanding} due` if > 0 | `/clients/:id` |
| Invoices (Receipt/sage) | number, client | `{client} · issued {date}` | status badge; `{netReceivable}` | `/projects/:id` |
| People (User/sienna) | name, role, title | `{title} · {role}` | `{n} projects` badge | **none — `to: null`, non-clickable** |
| Decisions (MessageSquare/neutral) | summary, decidedBy | `{decidedBy} · {channel} · {relative}` | verified/unconfirmed badge | `/projects/:id` |
| Deliverables (FileStack/ink) | name, discipline | `{discipline} · {revision} · due {date}` | status badge | `/projects/:id` |

**Note:** People rows are intentionally **not linked** (there is no person-detail route) — they render as static `<div>`s with no "open →" affordance.

## 6.4 States

| State | Behavior |
|-------|----------|
| Loading + `q` | 4 skeleton cards (2-col grid); count line shows "Searching…" |
| No `q` | EmptyState "Type a query to search" — suggests a project code, client name, or invoice number |
| `q` + 0 results | EmptyState `No results for "{q}"` |
| Results present | Footer: *"Case-insensitive substring match on names, codes, clients and free-text fields across six live datasets."* (Note: "live" here means the six mock hooks.) |
| Error | None |

---

# 7. Cross-cutting: how Intelligence modules connect

```
Capture / Sources ──► Review Queue ──► (approved) ──► AI Reports ──► Scheduled Reports
       │                  │                                              │
       └──────────────────┴──────────► Activity Log (audit) ◄───────────┘
                                              ▲
                                Global Search indexes the records
                                AI Assistant cites the same records (canned)
```

| From | To | Link | Status |
|------|----|------|--------|
| Review Queue | Project file | `/projects/:id` (ReviewRow) | [IMPLEMENTED] |
| Scheduled Reports | Review Queue | `/review` (explainer, Audience badge, footer) | [IMPLEMENTED] |
| Activity Log | Project file | `/projects/:id` (EventRow) | [IMPLEMENTED] |
| Global Search | Project / Client | `/projects/:id`, `/clients/:id` | [IMPLEMENTED] |
| AI Reports | Project | shown as **text only**, not a link | n/a |
| AI Assistant | — | no cross-links; references projects by name in prose | n/a |

---

# 8. Summary of working vs. not-working (Intelligence)

| Capability | Status | Notes |
|------------|--------|-------|
| Read AI reports & blocks | [MOCK] | 3 static reports; 5 kinds advertised |
| Report citations & confidence | [MOCK] | Authored values, rendered faithfully |
| Insufficient-data report block | [MOCK] | Hint string is hardcoded |
| Report Approve & send / Regenerate / Export / New report | [BACKEND]/[INTEGRATION] | No handlers |
| Assistant Q&A | [IMPLEMENTED] UI / [MOCK] answers | Fixed `ANSWERS` map + generic refusal; 650 ms fake "thinking" |
| Assistant refusal on unknown questions | [IMPLEMENTED] | Two refusal paths (generic + one canned insufficient) |
| Review approve/reject (maker-checker) | [IMPLEMENTED] | Local state only; resets on refresh |
| Review send (the "& send") | [INTEGRATION] | Nothing dispatched |
| Review filters / tabs / live KPIs | [IMPLEMENTED] | Client state |
| Schedules active toggle | [IMPLEMENTED] | Local override map; no write-back |
| Schedules New / Edit / actual delivery | [BACKEND]/[INTEGRATION] | No handlers; nothing is sent |
| Schedules → Review cross-links | [IMPLEMENTED] | Real router links |
| Activity Log timeline & filters | [IMPLEMENTED] UI / [MOCK] data | Read-only; "tamper-evident" is intent |
| Global Search (6 datasets) | [IMPLEMENTED] match / [MOCK] data | Substring match; People rows non-linking |

---

# 9. Recommended path to production (Intelligence)

| Area | Recommendation | Tag |
|------|----------------|-----|
| AI answers/reports | Replace canned `ANSWERS`/`aiReports` with a retrieval + LLM pipeline that computes figures deterministically and only narrates around cited records | [PLANNED] |
| Review Queue | Add persistence + a mutation API so approve/reject survives refresh and writes to the audit log; wire "& send" to delivery | [BACKEND]/[INTEGRATION] |
| Scheduled Reports | Persist schedules; add a job runner (cron/queue) and channel adapters (email, WhatsApp, in-app) | [BACKEND]/[INTEGRATION] |
| Activity Log | Make append-only enforceable (immutable store / hash chain) for genuine tamper-evidence | [BACKEND] |
| Global Search | Move to a server-side index for scale and ranked relevance; add a person-detail route to make People rows linkable | [BACKEND]/[RECOMMENDED] |
| Report actions | Wire New report / Regenerate / Export / Approve & send | [BACKEND]/[INTEGRATION] |

> **Bottom line for evaluators:** The Intelligence layer is a convincing, internally-consistent **demonstration** of an AI reporting and review workflow. Its trust UX — confidence meters, source chips, completeness bars, and explicit refusals — is real and working in the browser. Its intelligence, persistence, sending, and scheduling are **not** — they are mock content and local state awaiting a backend and AI inference layer.
