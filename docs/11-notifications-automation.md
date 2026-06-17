# Notifications, Approvals & Automation

This document describes how SPACE ESSE · Practice Intelligence surfaces signals (alerts and notifications), generates and schedules AI reports, and gates human approvals (the maker–checker review flow and the client-facing report sign-off).

**Read this first.** SPACE ESSE is a **frontend-only, high-fidelity interactive prototype** — Vite + React + TypeScript, served entirely from mock data. There is **no backend, no database, no message bus, no scheduler, no email/WhatsApp/in-app delivery pipeline, and no AI inference engine**. Everything described here renders from static mock arrays (`src/lib/mock/{data,ops,insights,integrations}.ts`) cloned through `api.ts → resolve()` after a simulated ~280 ms delay, and consumed by read-only TanStack Query hooks. The few things a user can change (toggling a schedule, approving a review item) live in **React component state only and reset on refresh**.

Each capability below is tagged with the status legend:

- **[IMPLEMENTED]** — interactive and working in the frontend (client-side only).
- **[MOCK]** — renders from mock data; the underlying read/calc/trigger is simulated.
- **[BACKEND]** — designed in the UI but needs an API / database / persistence to actually work.
- **[INTEGRATION]** — needs a third-party connector (email, WhatsApp, accounting, Drive, etc.).
- **[PLANNED]** / **[RECOMMENDED]** — not built; a future enhancement.

---

## 1. The Notifications & Alerts Model

### 1.1 What an alert is

Alerts are the firm's "needs attention" signals — overdue receivables, stuck authority approvals, thin margins, overloaded staff, schedule slips and data-quality gaps. They are the data layer behind both the **topbar bell popover** and the **dashboard alert feed**, and they also appear (filtered) on the Risks page as "AI-detected anomalies".

The entire alert set is a **static array of 8 records** in `src/lib/mock/insights.ts` (`alerts: Alert[]`), read via the `useAlerts()` hook (`queryKey: ["alerts"]`). **[MOCK]** — there is no detector generating these; they are authored by hand. The `acknowledged` field exists on the data but **no code path ever flips it** — there is no acknowledge/dismiss/mark-read mutation anywhere in the app.

### 1.2 Alert record shape (`Alert`)

| Field | Type | Notes |
|---|---|---|
| `id` | string | e.g. `al1`–`al8` |
| `severity` | `critical \| warning \| info \| positive` | drives icon, dot color, left border |
| `title` | string | one-line headline |
| `detail` | string | body (clamped to 2 lines in the bell popover) |
| `projectId` | string \| null | enables the "View project →" deep-link |
| `category` | string | e.g. "Authority approval", "Collections", "Profitability", "Resourcing", "Schedule", "Data quality" |
| `createdAt` | string (ISO) | rendered as a relative time ("… ago") |
| `confidence` | `high \| medium \| low \| insufficient` | shown as a `ConfidenceBadge` (4-bar meter) |
| `source` | `Provenance` | `{ sourceId, sourceName, recordRef, observedAt }` |
| `acknowledged` | boolean | **stored but never used/mutated in the UI** |

### 1.3 Severity legend (`ALERT_TONE`, `alert-row.tsx`)

| Severity | Icon | Color tone | Meaning |
|---|---|---|---|
| `critical` | `AlertOctagon` | rust | Act now — blocking or cash-at-risk |
| `warning` | `AlertTriangle` | ochre | Watch — trending wrong |
| `info` | `Info` | blue | Informational, no action forced |
| `positive` | `CheckCircle2` | sage | Good news (e.g. a payment landed) |

### 1.4 The seeded alerts (current mock content)

| id | severity | confidence | project | category | source | acknowledged |
|---|---|---|---|---|---|---|
| al1 | critical | high | p2 | Authority approval | RAJUK ECPS | false |
| al2 | critical | high | p4 | Collections | TallyPrime | false |
| al3 | warning | low | p4 | Profitability | Manual capture | false |
| al4 | warning | high | — | Resourcing | Timesheet capture | false |
| al5 | warning | medium | p1 | Schedule | Google Drive | **true** |
| al6 | warning | high | — | Data quality | TallyPrime | false |
| al7 | info | medium | p2 | Authority approval | Phone note | false |
| al8 | positive | high | p3 | Collections | TallyPrime | **true** |

### 1.5 Where alerts surface

#### Topbar bell popover **[MOCK]**
- Bell button in the topbar (`Topbar.tsx`), reading `useAlerts()`.
- **Unread count** = alerts where `!a.acknowledged`. A rust badge shows the count when `unread > 0`. Because nothing ever sets `acknowledged = true` at runtime, this count is effectively fixed by the seed data (6 of the 8 are unread) and never decreases through use.
- The popover header reads "Alerts · {unread} new". It lists `alerts.slice(0, 6)` (max 6): severity dot, title, 2-line detail, and footer "{relative time} · {category}".
- There is **no empty-state markup** — if the array were empty the popover would render an empty list. There is no "mark all read", no per-alert dismiss, and no link off the popover.

#### Dashboard "Top alerts" card **[MOCK]**
- On `/` (Dashboard), kicker "Needs attention".
- Renders `alerts.filter(severity === "critical" || "warning").slice(0, 4)` as `AlertRow` components. Positive and info alerts are excluded here.
- An "All" link points to `/risks`. No explicit empty state (an empty filtered array renders blank).

#### `AlertRow` component (shared) **[MOCK]** + **[IMPLEMENTED]** (one link)
- Shows severity icon, title, relative time, detail, a `SourceChip` (`{sourceName} · {recordRef}`), and a `ConfidenceBadge`.
- The only interactive element is a **"View project →"** router link to `/projects/{projectId}`, rendered only when `projectId` is truthy. **[IMPLEMENTED]** as client-side navigation.
- Note: `AlertRow` does **not** render or use the `acknowledged` field.

#### Risks page — "AI-detected anomalies" **[MOCK]**
- `/risks` re-uses the same alert data, filtering severities `critical | warning | info` and rendering each via `AlertRow`. The section is labelled "Space Esse AI" with a `Sparkles` icon, framing alerts as anomaly detections.
- Empty state: `EmptyState` titled "No anomalies right now".
- This is presentation only — there is no anomaly detector; the "AI-detected" framing describes intent, not running code.

### 1.6 What's missing vs. a real notification system

| Capability | Status |
|---|---|
| Real-time alert generation from source data (thresholds, anomaly detection) | **[BACKEND]** |
| Acknowledge / dismiss / snooze an alert (persist read state) | **[BACKEND]** |
| Push delivery (email / WhatsApp / in-app web push / mobile) | **[INTEGRATION]** |
| Per-user notification preferences and routing | **[BACKEND]** |
| Deduplication, escalation, and re-fire rules | **[PLANNED]** |
| Audit of who saw / acted on each alert | **[BACKEND]** |

---

## 2. AI Reports — Generation & Auto-Briefing

### 2.1 What exists today **[MOCK]**

AI Reports (`/reports`, `AIReports.tsx`) presents pre-written briefings. Each report is a static record in `src/lib/mock/insights.ts` (`aiReports: AIReport[]`, **3 reports**), read via `useAIReports()` with a fallback to the same mock array. The narrative text, the cited records, and the per-block confidence are **all authored by hand** — no model runs and no number is computed at view time on this page.

There are **5 report kinds defined** in the type system, of which **3 are present in mock data**:

| Kind | Label | Present in mock? |
|---|---|---|
| `daily_brief` | Daily brief | Yes (`rep_daily`, published) |
| `weekly_project` | Weekly project | Yes (`rep_weekly_p1`, published) |
| `monthly_company` | Monthly company | No (footer badge only) |
| `risk_summary` | Risk summary | No (footer badge only) |
| `cash_warning` | Cash warning | Yes (`rep_cash`, needs review) |

### 2.2 Report structure

| Level | Fields |
|---|---|
| `AIReport` | `id`, `kind`, `title`, `projectId`, `generatedAt`, `status` (`draft \| published \| needs_review`), `audience` (`internal \| external`), `summary`, `completeness`, `blocks[]` |
| `AIReportBlock` | `heading`, `body`, `confidence`, `citations[]`, optional `insufficient` |
| `AICitation` | `ref`, `sourceName`, `observedAt` |

### 2.3 The "anti-hallucination" / honesty design

This is the product's core promise and it is genuinely reflected in the UI, even though the generation is mocked:

- **Insufficient-data blocks render a refusal, not a number.** When a block carries `insufficient: true`, the reader renders an `InsufficientData` component instead of body text. The daily brief's 4th block (`Portfolio margin forecast`) does exactly this, with **empty citations** (`citations: []`). **[IMPLEMENTED]** as a rendered state.
  - Caveat: the refusal hint string in `ReportReader` ("four of eight projects have timesheet coverage below 65%…") is a **hardcoded literal**, not derived from data.
- **Every normal block shows a `ConfidenceBadge`** (high / medium / low / insufficient → "No data") and a list of `SourceChip`s (`{sourceName} · {ref}`). Blocks with no citations render the italic line "No source records cited." **[IMPLEMENTED]** rendering.
- A static blue-tint strip ("How these reports stay honest") and a footer ("The narrative is generated; the numbers are not.") reinforce the model. **[MOCK]** copy.

### 2.4 Report actions — all visual-only

Every action button on the AI Reports page is **[BACKEND]** (no `onClick`, no effect):

| Button | Where | Status |
|---|---|---|
| `New report` | page header | **[BACKEND]** — no generation engine |
| `Regenerate` | reader | **[BACKEND]** |
| `Export` (Send icon) | reader (internal reports) | **[BACKEND]** / **[INTEGRATION]** (no file/email export) |
| `Approve & send` | reader (external + `needs_review`) | **[BACKEND]** — sign-off + delivery, see §4 |

The only working interaction on this page is **selecting a report in the left library** (`setSelectedId`), which swaps the reader pane. **[IMPLEMENTED]** (local state).

### 2.5 What a real auto-briefing needs

| Capability | Status |
|---|---|
| Deterministic KPI computation pulled into report blocks at generation time | **[BACKEND]** (today's KPIs are computed client-side per page, not baked into reports) |
| LLM narrative generation around verified facts | **[BACKEND]** + AI inference service |
| Real "Regenerate" that re-runs the pipeline | **[BACKEND]** |
| Export to PDF / link / email | **[BACKEND]** + **[INTEGRATION]** |
| Persisted report history with versioning | **[BACKEND]** |

---

## 3. Scheduled Reports — Cadence, Recipients & Delivery

### 3.1 What exists today **[MOCK]** + **[IMPLEMENTED]** (toggle only)

Scheduled Reports (`/schedules`, `Schedules.tsx`) is the configuration surface for "which AI report goes to whom, and when." It reads `useSchedules()` → **6 mock `ScheduledReport` records** in `src/lib/mock/ops.ts`.

**Critical reality:** nothing actually runs on a schedule. There is **no scheduler, no cron, no `nextRun` evaluation, and no delivery**. The `nextRun` / `lastRun` dates are static fields displayed as-is. The page is a faithful mock of a delivery configuration screen.

### 3.2 `ScheduledReport` shape

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `name` | string | the report label |
| `kind` | `AIReportKind` | daily_brief / weekly_project / monthly_company / risk_summary / cash_warning |
| `cadence` | `daily \| weekly \| monthly` | |
| `schedule` | string | human-readable schedule text |
| `recipients` | `Recipient[]` | `{ name, role }` |
| `channel` | `email \| whatsapp \| in_app` | intended delivery channel |
| `active` | boolean | on/off |
| `nextRun` | string | displayed, never evaluated |
| `lastRun` | string \| null | "Never" when null |
| `audience` | `internal \| external` | external → requires sign-off |

### 3.3 Delivery channels (`CHANNEL_META`) — all **[INTEGRATION]**

| Channel | Label | Icon | Real delivery status |
|---|---|---|---|
| `email` | Email | `Mail` | **[INTEGRATION]** — no email service wired |
| `whatsapp` | WhatsApp | `MessageSquare` | **[INTEGRATION]** — no WhatsApp connector (note: WhatsApp is paste-only by design even for capture) |
| `in_app` | In-app | `Bell` | **[BACKEND]** — no in-app delivery store |

### 3.4 The one thing that works: the Active toggle **[IMPLEMENTED]** (local state)

- Each row has a Radix `Switch` ("Toggle {name}"). Toggling updates a local `activeById` map (`setActiveById`), and the row recomputes its displayed state. Inactive rows dim (`opacity-60`) and show "Paused" in place of the next-run date.
- This is **client state only** — it does **not** write back to the mock module, so a refresh restores the seed `active` values. There is no real pause/resume of any job (there is no job).

### 3.5 Other Scheduled Reports elements

| Element | Status |
|---|---|
| `New schedule` button (header and empty-state) | **[BACKEND]** — visual-only, no handler |
| `Edit` button per row (Pencil) | **[BACKEND]** — visual-only, no handler |
| Stat row: Active schedules / Next run / Client-facing counts | **[MOCK]** — derived from current rows |
| `Review queue` link in the explainer card | **[IMPLEMENTED]** — routes to `/review` |
| Audience "Client-facing" badge (external) | **[IMPLEMENTED]** — links to `/review` |
| Footer "Open review queue" link | **[IMPLEMENTED]** — routes to `/review` |
| "Needs approval" badge (external rows) | **[MOCK]** — static badge, not a link |

### 3.6 What a real scheduler needs

| Capability | Status |
|---|---|
| Cron / job scheduler evaluating `nextRun` and firing | **[BACKEND]** |
| Report generation triggered on schedule | **[BACKEND]** (depends on §2) |
| Email send | **[INTEGRATION]** (e.g. transactional email provider) |
| WhatsApp send | **[INTEGRATION]** (e.g. WhatsApp Business API) |
| In-app delivery + read tracking | **[BACKEND]** |
| Persisted active/paused state, recipient management | **[BACKEND]** |
| Delivery receipts / failure retries | **[PLANNED]** |

---

## 4. The Review Queue — Maker–Checker Approval Flow

### 4.1 Concept

The Review Queue (`/review`, `Review.tsx`) is the firm's **maker–checker trust gate**: a person proposes a record (the "maker"), and an owner/director approves or rejects it (the "checker"). It is where four kinds of work always need a human before they count:

| Kind | Label | Icon / tone | What it is |
|---|---|---|---|
| `report` | AI report | `FileText` / blue | Client-facing narrative — sign off before sending |
| `capture` | Capture | `PencilLine` / sage | A note or thread promoted to a citable record |
| `match` | Project match | `GitMerge` / ochre | A proposed link between an alias and a project |
| `discrepancy` | Discrepancy | `AlertTriangle` / rust | Two sources disagree — pick the truth |

### 4.2 `ReviewItem` shape

| Field | Type | Notes |
|---|---|---|
| `id` | string | |
| `kind` | `capture \| report \| discrepancy \| match` | |
| `title`, `detail` | string | |
| `projectId` | string \| null | enables project deep-link |
| `submittedBy` | string | the "maker" |
| `submittedAt` | string | relative time shown |
| `confidence` | `Confidence` | `ConfidenceBadge` |
| `status` | `pending \| approved \| rejected` | drives tab placement |
| `source` | `Provenance` | `SourceChip` |

Data: `useReviewQueue()` → **6 mock `ReviewItem` records** in `src/lib/mock/ops.ts`.

### 4.3 The approval flow (Input → Approval → Storage → Follow-up)

| Stage | Behavior | Status |
|---|---|---|
| **Input** | Items arrive pre-seeded from mock; the page copies them into local state once (`if (!seeded && data) { setItems(data); setSeeded(true) }`). In a real system, captures/reports/matches/discrepancies would be enqueued by their respective producers. | **[MOCK]** intake; **[BACKEND]** real enqueue |
| **Validation** | None beyond the kind/confidence/source already attached to each item. No field-level checks at the gate. | n/a |
| **Approval (checker action)** | A pending row shows two buttons. **Approve**: for `report` items it is primary, labelled **"Approve & send"** (ShieldCheck); for all other kinds it is sienna, labelled **"Verify & promote"** (Check). **Reject**: ghost/rust, labelled "Reject" (X). Both call `resolveItem(id, status)`. | **[IMPLEMENTED]** (local state) |
| **Processing** | `resolveItem` maps over local `items` and sets the item's `status` to `approved`/`rejected`. The item moves from the Pending tab to the Resolved tab. | **[IMPLEMENTED]** (local state) |
| **Storage** | **None.** State lives in `useState`; a refresh restores all items to `pending`. No write to mock module, no API, no DB. | **[BACKEND]** |
| **Reporting** | Resolved rows render a status badge — sage "Signed off" (reports) / "Verified" (others) on approve, rust "Rejected" on reject — and dim to `opacity-65`. KPI cards recount pending items. | **[IMPLEMENTED]** (local state) |
| **Follow-up** | "Approve & send" implies the report would actually be delivered to the client. **There is no send.** Promotion of a capture to a citable record, and resolution of a discrepancy, similarly have **no downstream write**. | **[BACKEND]** + **[INTEGRATION]** |

### 4.4 Filtering, tabs and counts **[IMPLEMENTED]** (local state)

- **Kind filter** Select: All kinds / AI reports / Captures / Discrepancies / Project matches → `setKindFilter`.
- **Tabs**: `Pending` and `Resolved`, each showing a count (e.g. "Pending (3)"). `pending = items where status === "pending"` (after kind filter); `resolved = the rest`.
- **KPI cards** (computed over pending items): Pending review; Reports awaiting sign-off (kind `report`); Captures to verify (kind `capture` or `match`); Discrepancies (kind `discrepancy`). These recount live as items are resolved.

### 4.5 Per-row deep-link **[IMPLEMENTED]**
Each row links its project name to `/projects/{projectId}` (when resolvable via `projectById`).

### 4.6 Explainer content **[MOCK]**
A right-column card ("The trust control") and a "What lands here" section describe the maker–checker model with hardcoded descriptions per kind. The header "Maker–checker" badge is decorative. A footer shows "As of {12 Jun 2026}" and a manual `SourceChip`.

---

## 5. Client-Facing Report Sign-Off Gate

The sign-off gate is the intersection of §2, §3 and §4 — the rule that **a client-facing (external) AI report never sends automatically; it must pass a human checker first.**

### 5.1 How the gate is expressed across the UI

| Surface | Behavior | Status |
|---|---|---|
| **AI Reports reader** | When `audience === "external" && status === "needs_review"`, the action set becomes **`Approve & send`** + **`Regenerate`** (instead of Regenerate + Export). The buttons exist but are not wired. | **[BACKEND]** (visual-only) |
| **Scheduled Reports** | External rows show a sienna **"Needs approval"** badge and an Audience "Client-facing" badge that **links to `/review`**. The explainer states client-facing reports "pass through the Review queue for owner sign-off first." | **[IMPLEMENTED]** link; **[MOCK]** copy |
| **Review Queue** | `report`-kind items get the primary **"Approve & send"** button (vs "Verify & promote" for other kinds). On approve, the resolved badge reads **"Signed off"** for reports. | **[IMPLEMENTED]** local state |

### 5.2 End-to-end flow (design intent vs. reality)

| Step | Design intent | Reality |
|---|---|---|
| 1. Generate | A scheduled or ad-hoc external report is generated. | **[BACKEND]** — no generator |
| 2. Hold | It enters `needs_review` and lands in the Review Queue as a `report` item. | **[MOCK]** — exists only if seeded |
| 3. Review | Owner/director inspects narrative + cited records + confidence. | **[IMPLEMENTED]** — visible, evidence-attached |
| 4. Sign off | Checker clicks "Approve & send"; status → approved ("Signed off"). | **[IMPLEMENTED]** local state only |
| 5. Send | The report is delivered to the client via the configured channel. | **[INTEGRATION]** — nothing is sent |
| 6. Record | The sign-off (who, when) is persisted to the audit trail. | **[BACKEND]** — not persisted |

The audit framing exists on the **Activity Log** (`/activity`) — an append-only, provenance-stamped timeline with event types including `report`, `approval`, `match` and `capture` — but it reads **14 static mock `ActivityEvent`s** (`useActivity()`) and is **not** appended to when a review item is approved. **[MOCK]**.

---

## 6. Automated / Detector Behaviors

The product is positioned around automation (anomaly detection, freshness monitoring, auto-briefing). In the prototype these are **presented but not running**.

| Behavior | What the UI implies | What actually happens | Status |
|---|---|---|---|
| Anomaly detection feeding alerts | "AI-detected anomalies" on Risks; alerts on Dashboard/bell | Static 8-record `alerts` array; no detector | **[MOCK]** / **[BACKEND]** |
| Cash / collections warnings | `cash_warning` report; overdue-receivable alerts | Hand-authored mock; overdue KPI is computed client-side from mock invoices, not a triggered warning | **[MOCK]** |
| Authority-approval overdue detection | Dashboard/Delivery flag approvals past their statutory window | Computed client-side (`daysInStage > statutoryDays`) from mock approvals — a live calc over fake data, not a scheduled monitor | **[MOCK]** (calc) |
| Resourcing / overload detection | "Arif Chowdhury >90% for 6 weeks" warning | Hardcoded ID (`e3`) + mock utilization; no detector | **[MOCK]** |
| Data-freshness monitoring | Data Quality flags sources stale > 48h; "TallyPrime export is 5 days old" | Reads `freshnessHours` from mock sources; thresholds applied client-side; "5 days old" partly hardcoded | **[MOCK]** |
| Scheduled report firing | `nextRun` per schedule | Never evaluated; no scheduler | **[BACKEND]** |
| Auto-promote WhatsApp to a Decision | Capture "Promote WhatsApp" extracts a draft | Pure string slice of the last pasted line (120 chars); no NLP extraction; not saved | **[IMPLEMENTED]** (cosmetic) / **[BACKEND]** real extraction |
| AI assistant "answers" | Cited answers with confidence + refusal | Fixed `ANSWERS` map + generic refusal fallback; 650 ms fake "thinking"; no inference | **[MOCK]** |

### 6.1 The AI assistant as an automation surface **[MOCK]**

The assistant panel (Ctrl/Cmd+J) is worth noting because it models the "honest automation" stance: it returns canned answers from a fixed map, and for anything unmatched it **refuses** with an "insufficient data" / "No data" confidence rather than fabricating. One canned answer ("Can we take on a new project next month?") is a **deliberate refusal** keyed on incomplete timesheet coverage. This is **[IMPLEMENTED]** as an interaction (the refusal renders, the thinking delay runs) but **[MOCK]** as intelligence — there is no model and no live data evaluation.

---

## 7. Consolidated Notification / Automation Matrix

Type → Trigger → Channel → Status. "Trigger" describes the intended cause; in the prototype the actual cause is "seeded in mock data" unless noted.

| Type | Intended trigger | Channel(s) | Current status |
|---|---|---|---|
| Critical alert (e.g. blocking RAJUK permit) | Authority status past statutory window | In-app bell, Dashboard feed | **[MOCK]** render; **[BACKEND]** trigger; **[INTEGRATION]** push |
| Collections alert (overdue receivable) | Invoice past due / aging threshold | In-app bell, Dashboard feed | **[MOCK]** render; **[BACKEND]** trigger |
| Profitability / margin warning | Forecast margin below tolerance, low coverage | In-app bell, Dashboard feed, Risks | **[MOCK]** |
| Resourcing / overload warning | Utilization > 90% sustained | In-app bell, Risks | **[MOCK]** |
| Schedule-slip warning | Milestone overdue / negative variance | In-app bell, Dashboard, Delivery | **[MOCK]** |
| Data-quality warning | Source stale > 48h, unmatched alias | In-app bell, Data Quality | **[MOCK]** render; client-side calc |
| Info / positive notice | Payment received, status update | In-app bell | **[MOCK]** |
| Daily executive briefing | Daily schedule fires | Email / WhatsApp / in-app (per schedule) | **[MOCK]** content; **[BACKEND]** schedule; **[INTEGRATION]** delivery |
| Weekly project report | Weekly schedule fires | Email / WhatsApp / in-app | **[MOCK]** / **[BACKEND]** / **[INTEGRATION]** |
| Cash-warning report | Cash threshold breached / schedule | Email / in-app | **[MOCK]** / **[BACKEND]** |
| Client-facing report ready | External report generated → `needs_review` | Review Queue (in-app), then client channel on approve | **[IMPLEMENTED]** queue (local); **[BACKEND]** send |
| Review-needed (capture / match / discrepancy) | New capture / proposed match / source conflict | Review Queue (in-app) | **[IMPLEMENTED]** local state; **[BACKEND]** enqueue + persist |
| Activity-log entry (approval, report, sync, match) | Any recorded event | In-app audit timeline | **[MOCK]** static; **[BACKEND]** append-on-action |

---

## 8. Summary for Stakeholders

- **What genuinely works (client-side):** selecting and reading reports; approving/rejecting review items (Pending↔Resolved with live KPI recount); toggling a schedule active/paused; filtering by kind; alert "View project" deep-links; the Review-queue sign-off framing for client-facing reports; the AI assistant's canned answers and honest refusals. **All of this resets on refresh.**
- **What is mock (renders from static data, no live trigger):** the 8 alerts and unread bell count; the 3 AI reports and their cited blocks; the 6 schedules and their next/last-run dates; the activity log; anomaly/freshness/overload "detections."
- **What needs a backend:** persistence of approvals, acknowledgements and schedule state; a real scheduler to fire reports; deterministic KPI baking + LLM narrative generation; an append-on-action audit trail; per-user notification preferences.
- **What needs integrations:** email, WhatsApp and in-app **delivery** of reports and notifications; live reads from accounting (TallyPrime/QuickBooks/Xero), Drive, calendar and authority portals that today are manual or simulated.

The honesty model — confidence on every figure, citations on every claim, and an explicit refusal when data is missing — is the most faithfully realized part of this layer. The notification, scheduling, delivery and persistence machinery behind it is **designed in the UI but not yet built**.
