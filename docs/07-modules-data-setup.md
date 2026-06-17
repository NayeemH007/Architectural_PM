# Module Documentation: Data & Setup

> **Read this first.** SPACE ESSE · Practice Intelligence is a **frontend-only, high-fidelity interactive prototype**. The four screens documented here — Manual Capture, Data Sources, Data Quality, and Settings — render entirely in the browser. There is **no backend, no database, no authentication, no validation service, and no persistence**. All data is mock data (`src/lib/mock/{data,ops,insights,integrations}.ts`) served through a simulated transport (`src/lib/api.ts`'s `resolve()`, ~280ms latency) and consumed by React Query hooks. Anything you type, toggle, connect, save, or confirm on these pages lives in React component state at most, and **resets on every page refresh**. Nothing is written anywhere.
>
> This section is where the product's central honesty thesis is most visible: the "Data & Setup" group exists because *the highest-value data has no API*, and the prototype is candid about which controls actually do something versus which are designed-but-inert.
>
> **Status legend** — every feature below carries one tag:
> - **[IMPLEMENTED]** — interactive and working in the frontend (client-side only; resets on refresh).
> - **[MOCK]** — renders from mock data; the underlying read/sync/calculation is simulated, not live.
> - **[BACKEND]** — designed in the UI but needs an API / database / persistence to actually function.
> - **[INTEGRATION]** — needs a third-party connector (accounting, Drive, email, authority portal, etc.) to function.
> - **[PLANNED] / [RECOMMENDED]** — not built; a future enhancement.

---

## 0. The group at a glance

| Module | Route | Primary job | Reads | Persists? |
|---|---|---|---|---|
| **Manual Capture** | `/capture` | Log decisions, approvals, scope changes, effort, site notes, and WhatsApp threads that no system exposes via API | `useDecisions()` (recent feed) | **No** — submit is local state only |
| **Data Sources** | `/data-sources` | Browse the connector catalog (connected + available), inspect each source | `useDataSources()` | **No** — Connect/Sync/Disconnect are visual-only |
| **Data Quality** | `/data-quality` | The "trust backbone": freshness, completeness-by-domain, and the alias-matching queue | `useDataSources()`, `useProjects()` | **No** — Confirm match is visual-only |
| **Settings** | `/settings` | Owner/admin controls: firm profile, users & roles, project matching, KPI thresholds, localization & residency | `useEmployees()`, `firm` mock | **No** — every Save/Invite/Confirm is visual-only |

A recurring theme across all four: the **read paths are real client-side behavior over mock data ([MOCK])**, while the **write paths (save, connect, sync, confirm, invite, disconnect) are designed but inert ([BACKEND] / [INTEGRATION])**. The honest framing throughout is that source systems remain authoritative and Space Esse only observes.

---

# 1. Manual Capture (`/capture`)

**Page identity:** kicker "Data & setup", title "Quick capture".
**Purpose (verbatim):** *"The highest-value data — decisions, approvals, scope changes, effort — has no API. Capture it here in under a minute, and it lands in the project record, cited to you."*

Manual Capture is the conceptual heart of the whole product. The premise is that the most decision-relevant facts in an architecture practice — *who approved what, what the client changed their mind about, how many hours someone actually worked* — live in meetings, phone calls, and WhatsApp threads, not in any integrable system. This screen is the front door for turning those facts into citable records.

> **Critical honesty note:** In the prototype, capture **does not persist**. Submitting shows an inline success panel, but **no write to any store or API occurs, and nothing is added to the recent-captures feed**. The feed below is read independently from mock decisions. To be a working feature this needs a write API and a datastore. **[BACKEND]**

### 1.1 KPI row — four cards, all hardcoded

These four `KpiCard`s are **hardcoded literals**, not derived from any data. They are illustrative, not live. **[MOCK]** (will need real aggregation to be [BACKEND]).

| Card | Value | Footnote |
|---|---|---|
| Captures this week | `18` | "6 of 10 staff contributing" |
| Pending promotions | `2` | Badge "Unverified decisions" |
| Timesheet coverage | `64%` | "Low — capacity answers blocked" |
| Avg capture time | `42s` | "Faster than a phone call" |

### 1.2 Capture-type selector

Six buttons choose the form variant. Selecting a type sets `type` and clears any prior confirmation. Default is **Decision**. This selection is genuine client state. **[IMPLEMENTED]**

| ID | Label | Hint |
|---|---|---|
| `decision` | Decision | "Who decided what, when" |
| `approval` | Approval update | "Authority status change" |
| `scope` | Scope change | "Change order / variation" |
| `timesheet` | Quick timesheet | "Log hours fast" |
| `site` | Site report | "Field note from site" |
| `whatsapp` | Promote WhatsApp | "Paste a thread" |

### 1.3 The capture forms — exact fields per variant

Every variant shares a **common project field** at the top and **common footer fields** at the bottom:

| Common field | Control | Behavior |
|---|---|---|
| **Project** (hint "canonical record") | Select, options from `projects` mock | Placeholder "Select a project…", bound to `projectId` |
| **Date** | Input `type=date` | Defaults to `TODAY` = "2026-06-17"; not enforced |
| **Cite this to me** | Switch (`citeMe`) | Default **on**; always optional |

The variant-specific fields:

| Variant | Field (label / hint) | Control | Notes |
|---|---|---|---|
| **decision** | Decision summary ("one line is enough") | Textarea `note` | Placeholder "e.g. Client approved upgraded reception stone — cost impact pending" |
| | Decided by | Input `decidedBy` | Placeholder "Name or client" |
| | Channel | Select `channel` | Meeting / WhatsApp / Email / Phone call / Site visit; default "meeting" |
| **approval** | Authority | Select `authority` | RAJUK / FSCD (Fire) / CAAB / Dept. of Environment / City Corporation / DPDC; default "RAJUK" |
| | New status | Select `approvalStatus` | Submitted / In review / Query raised / Approved / Rejected; default "submitted" |
| | What changed? ("ref no., query detail, next step") | Textarea `note` | |
| **scope** | Scope change / variation | Textarea `note` | |
| | Est. cost impact (BDT) ("optional") | Input `costImpact`, inputMode numeric | |
| | Requested by | Input `decidedBy` | Placeholder "Client / consultant" |
| **timesheet** | Team member | Select `employeeId` | From employees mock; placeholder "Who logged time?" |
| | Hours ("this entry") | Input `hours`, inputMode decimal | Placeholder "6.5" |
| | What was worked on? ("optional") | Textarea `note`, 2 rows | Static note: "Coverage is 64% — every entry here lifts the confidence on capacity and margin answers." |
| **site** | Site note ("what you saw on the ground") | Textarea `note`, 4 rows | Single field |
| **whatsapp** | Pasted thread | Textarea `paste`, 5 rows, mono | Preceded by a dashed callout explaining extraction is draft-only and nothing auto-publishes |

**WhatsApp "extraction" — what it really is:** When `paste` is non-empty, an "Extracted draft" preview appears showing the **last pasted line sliced to 120 characters**, with a `ConfidenceBadge level="low"` and a "Confirm to record" label. This is **pure client string manipulation — there is no NLP or extraction logic**. A real version needs a parsing/AI service. **[MOCK]** → **[BACKEND]**.

### 1.4 Validation (Input → Validation → Processing → Approval → Storage flow)

The capture flow is deliberately minimal, and the prototype only implements the first two stages:

| Stage | What happens | Status |
|---|---|---|
| **Input** | User picks a type, fills the variant fields | [IMPLEMENTED] |
| **Validation** | A single `ready` gate. The "Capture" button is `disabled={!ready}`. `ready` = `projectId` set **AND** (timesheet → `employeeId` && `hours`; whatsapp → `paste` non-empty; else → `note` non-empty). **No per-field error messages, no required asterisks. Date defaulted but not enforced.** | [IMPLEMENTED] (the gate is real; the rules are minimal) |
| **Processing** | `submit` calls `preventDefault()` and sets `confirmed = { label, project }` from local state. No transformation, no parsing. | [IMPLEMENTED] (local only) |
| **Approval / promotion** | Designed concept ("Unverified" → promoted to verified via the Review Queue), but capture writes nothing for the queue to receive. | [BACKEND] |
| **Storage** | **None.** Nothing is written; the recent-captures feed is unchanged. | [BACKEND] |
| **Reporting** | A captured decision would feed dashboards, the activity log, and AI answers — but only once storage exists. | [BACKEND] |
| **Follow-up** | "Capture another" / "Review entry" / "Clear" buttons reset local state. | [IMPLEMENTED] |

### 1.5 Success panel and reset behavior

On confirm, the form is replaced by an inline success panel. It is convincing but ephemeral:

- Headline: "Captured — {label} added to {project}."
- Subline: "Recorded {date}" + ", cited to you" or ", uncredited" (driven by the `citeMe` switch).
- Badges: "Captured" (sage) and "Unverified" (ochre), plus a `SourceChip`.
- Buttons: **"Capture another"** (`reset`) and **"Review entry"** (`confirmed = null`).
- A footer **"Clear"** ghost button also calls `reset`.

`reset` clears `note` / `paste` / `hours` / `costImpact` / `decidedBy` and `confirmed` only — it intentionally **leaves `projectId`, `date`, and `channel` intact** so a user can log several entries against the same project quickly. **[IMPLEMENTED]** (as local-state UX; persists nothing).

### 1.6 Right-column panels

| Panel | Content | Status |
|---|---|---|
| **Why WhatsApp is paste-only** | Two paragraphs explaining there is no WhatsApp history API and the paste-only flow is by design; StatusDot `manual` + provenance note; a button "Promote a WhatsApp thread" that switches the form to the `whatsapp` variant | Explainer is static; the button is [IMPLEMENTED] (switches type). The underlying lack of API is [INTEGRATION]. |
| **Capture health** | "Manual records this week" = `18` (hardcoded); `DataCompleteness value={64}` (hardcoded); static insufficient-data note | [MOCK] (hardcoded literals) |

### 1.7 Recent captures feed

Sourced from `useDecisions()` (falling back to a seed), sorted by date descending. This is the one genuinely data-bound region on the page. **[MOCK]** (reads mock data; does not reflect anything just captured).

- Each row: decision summary, decided-by, short date, relative date, channel Badge (sage if "whatsapp"), `SourceChip`, and a status Badge "Verified" (if `promoted`) or "Unverified".
- **Empty state** (`EmptyState`, icon PencilLine): title "Nothing captured yet" with a description about citable records. **[IMPLEMENTED]**
- No loading/skeleton or error state here — hook data is consumed directly.

### 1.8 Manual Capture — what works vs. what doesn't

| Element | Reality | Tag |
|---|---|---|
| Type selector, form fields, `ready` gate, success panel, reset | Genuine client state | [IMPLEMENTED] |
| WhatsApp "extraction" preview | Last-line slice, no parsing | [MOCK] → [BACKEND] |
| Submit / persistence / promotion to Review Queue | Nothing is saved | [BACKEND] |
| KPI row, capture-health numbers | Hardcoded literals | [MOCK] |
| Recent captures feed | Mock decisions, not live captures | [MOCK] |
| "Ask about captures" header button | No onClick | [BACKEND] (needs the AI/data layer) |
| No-API premise for decisions/WhatsApp/effort | Accurate framing | [INTEGRATION] (where an API could ever exist) |

---

# 2. Data Sources (`/data-sources`)

**Page identity:** kicker "Data & setup", title "Data sources & integrations".
**Purpose (verbatim):** *"Space Esse reads from the tools you already use — it never replaces them and never writes back. Connect a source, or capture manually where no API exists."*

This screen is the integration catalog. It presents seventeen connectors split into a **connected/MVP stack** and an **available/pluggable shelf**, and lets you inspect each in a dialog. Crucially, **every action that would change a connection's state is visual-only** — the page is a faithful design of the integration surface, not a working integration manager.

> **Critical honesty note:** Connect, Sync now, Disconnect, Auto-sync, and "Add a source" are all **non-functional**. The statuses shown ("connected", "stale", "syncing", etc.) are **fields in the mock catalog, not the result of any live connection**. Real connectors require OAuth flows, credential storage, schedulers, and ingestion pipelines. **[INTEGRATION]**

### 2.1 Summary counts (derived from `useDataSources()`)

Four cards, computed live from the mock catalog. **[MOCK]** (the math is real; the inputs are mock).

| Card | Derivation | Tone |
|---|---|---|
| Live | count(status ∈ connected, syncing) | sage |
| Needs attention | count(status ∈ stale, error) | ochre |
| Manual | count(status === manual) | sienna |
| Available | count(status === not_connected) | ink-faint |

A static **read-only assurance banner** reinforces the design principle: *"Read-only by design. Every connector requests least-privilege, read-only access. Your source systems remain the single source of truth — Space Esse only observes."* This is accurate to the catalog (`readOnly: true` on every connected source). **[IMPLEMENTED]** (as static copy).

### 2.2 Category filter

A `Select` (size sm) with "All categories" plus every entry from `KIND_LABELS`. Filters the grouped tiles by `kind`. This is genuine client state. **[IMPLEMENTED]**

### 2.3 The full connector catalog (17 sources)

Sources are grouped by kind, each section headed by an icon + `KIND_LABELS[kind]` + count. The table below is the complete catalog from the mock data.

#### 2.3.1 Connected / MVP sources (`mvp: true`) — [MOCK]

| Name | Vendor | Category (kind) | Status | Method | Cadence | Read-only | Feeds |
|---|---|---|---|---|---|---|---|
| Manual Capture | Space Esse | Manual Capture | connected | manual | realtime | No | Decision, Approval, Change, SiteReport, Timesheet, Milestone |
| Google Drive | Google Workspace | File Storage | connected | api | near_realtime | Yes | Document, Deliverable, Drawing, Revision |
| Gmail | Google Workspace | Communication | connected | email | near_realtime | Yes | Decision, Approval, Consultant |
| Google Calendar | Google Workspace | Calendar | connected | api | near_realtime | Yes | Meeting, Milestone |
| TallyPrime | Tally Solutions | Accounting & Finance | **stale** | csv_import | scheduled | Yes | Invoice, Payment, Expense, Fee |
| Excel / CSV Import | Spreadsheets | Accounting & Finance | connected | csv_import | manual | Yes | Fee, Budget, Task, Deliverable |
| AutoCAD (via Drive) | Autodesk | BIM / CAD | connected | file_watch | scheduled | Yes | Drawing, Revision, Deliverable |
| Trello | Atlassian | Project Management | **syncing** | api | near_realtime | Yes | Task, Milestone |
| RAJUK ECPS | RAJUK | Authority Portals | **manual** | manual | manual | Yes | Approval, Milestone |
| WhatsApp | Meta | Communication | **manual** | manual | manual | Yes | Decision, Approval, Change, SiteReport |

#### 2.3.2 Available / pluggable sources (`mvp: false`, `status: not_connected`) — [INTEGRATION] / [PLANNED]

For all of these: `lastSync` and `freshnessHours` are null, `recordsIngested` is 0, and `health` is 0. They render with a dashed border and a (visual-only) "Connect" button.

| Name | Vendor | Category (kind) | Method | Cadence | Read-only | Auth | Feeds |
|---|---|---|---|---|---|---|---|
| QuickBooks Online | Intuit | Accounting & Finance | api | near_realtime | Yes | OAuth 2.0 | Invoice, Payment, Expense |
| Xero | Xero | Accounting & Finance | api | near_realtime | Yes | OAuth 2.0 | Invoice, Payment, Expense |
| Autodesk Construction Cloud | Autodesk | BIM / CAD | api | scheduled | Yes | APS (OAuth 2.0) | Model, Drawing, Deliverable |
| Microsoft 365 / SharePoint | Microsoft | Document Management | api | near_realtime | Yes | Microsoft Graph (OAuth 2.0) | Document, Deliverable |
| Procore | Procore | Project Management | api | near_realtime | Yes | OAuth 2.0 | RFI, Submittal, SiteReport |
| Clockify | Clockify | Time Tracking | api | near_realtime | Yes | API key | Timesheet |
| Dropbox | Dropbox | File Storage | api | near_realtime | Yes | OAuth 2.0 | Document, Deliverable |

### 2.4 Source tile rendering

Each `SourceTile` shows `logoGlyph`, name, vendor, a "MVP" badge (only if `mvp && connected`), a `StatusDot` (pulses only when `syncing`) + status label, and — if connected — the cadence label (Real-time / Near real-time / Scheduled / Manual).

- **Connected tiles:** "Synced {relative(lastSync)}", record count, and a `Progress` health bar (sage >80, ochre >55, else rust). **[MOCK]**
- **Not-connected tiles:** dashed border + a **"Connect"** button. **The button has no handler** — clicking anywhere on the tile (including the button) opens the detail dialog instead. **[INTEGRATION]**

Clicking any tile sets `selected` and opens the detail dialog. **[IMPLEMENTED]** (dialog open/close is real client state).

### 2.5 Detail dialog (`SourceDetail`)

Opens via a Radix `Dialog` bound to `selected`. **[MOCK]** for the displayed data; the action buttons are visual-only.

Body fields (2-column grid): Status, Method (underscore→space), Cadence, Auth (`authMethod`), Access (`readOnly ? "Read-only" : "Read / write"`), Last sync (`relative(lastSync)` or "—"), plus a `notes` paragraph and "Feeds these records" badges from `s.feeds`.

| Control | State | Status |
|---|---|---|
| Auto-sync Switch (connected sources) | `defaultChecked` uncontrolled; **no `onCheckedChange`** | Visual-only — [INTEGRATION] |
| "Sync now" (connected) | No handler | Visual-only — [INTEGRATION] |
| "Disconnect" (connected) | No handler | Visual-only — [INTEGRATION] |
| "Connect {name}" (not connected) | No handler | Visual-only — [INTEGRATION] |

### 2.6 Data Sources — what works vs. what doesn't

| Element | Reality | Tag |
|---|---|---|
| Summary counts, tiles, statuses, health bars | Computed from / rendered from mock catalog | [MOCK] |
| Category filter, tile-click → dialog, dialog open/close | Genuine client state | [IMPLEMENTED] |
| Connect / Sync now / Disconnect / Auto-sync / "Add a source" | No handlers, no effect | [INTEGRATION] |
| The 7 "available" connectors | Catalog entries only; not wired | [INTEGRATION] / [PLANNED] |
| Empty state for zero sources | None — tiles simply render nothing | [RECOMMENDED] |
| Loading / error states | None | [RECOMMENDED] |

---

# 3. Data Quality (`/data-quality`)

**Page identity:** kicker "Data & setup", title "Data quality & integration health".
**Purpose (verbatim):** *"The trust backbone. Freshness, matching and completeness are tracked here so no KPI is ever shown as confident when the data behind it isn't."*

This screen exists to make the product's confidence claims accountable. It surfaces *why* a number might be low-confidence: a stale feed, an unmatched alias, or a weak data domain. The reads are real; the one action (Confirm match) is inert.

> **Data note:** the page calls `usePortfolio()` but **does not use the result** — `portfolio` is fetched and ignored. Everything shown derives from `useDataSources()` and `useProjects()`.

### 3.1 KPI row (four `KpiCard`s with verbatim formulas)

All four are computed client-side from mock data, each carrying a `formula` string surfaced in its "Why this number?" popover. **[MOCK]**

| Card | Value | Formula (verbatim) | Confidence |
|---|---|---|---|
| Firm data completeness | mean(project.completeness) | `mean(project.completeness) across the active portfolio` | high ≥75 / medium ≥60 / else low; trend `[62,64,66,67,68,…]` |
| Live sources | count(connected/syncing) | `count(status ∈ {connected, syncing})` | high |
| Stale / error sources | count(stale/error) | `count(status ∈ {stale, error})` | high if 0 else medium; note "TallyPrime export is 5 days old — finance KPIs may lag." |
| Unmatched aliases | count(crossRefs where matched=false) | `count(crossRefs where matched = false)` | high if 0 else low |

### 3.2 Source freshness table

Rows = active sources (status ≠ not_connected). **[MOCK]**

| Column | Content |
|---|---|
| Source | KIND_ICON + name + `KIND_LABELS[kind]` |
| Status | StatusDot + label |
| Method | `method` (underscore→space) |
| Last sync | `relative(lastSync)` |
| Freshness | `{fh}h` — rust if stale (>48h = `STALE_HOURS`), ochre if >12h, else neutral; "—" when `freshnessHours` is null |
| Records | `recordsIngested` |
| Health | `Progress` bar (sage >80 / ochre >55 / rust) + numeric |

Footer copy: "Freshness flagged when older than 48h. Read-only feeds — source systems stay authoritative." + active-feed count. No skeleton / empty / error state (renders an empty `<TBody>` if there are no rows). **[RECOMMENDED]** for empty/error handling.

### 3.3 Completeness by domain — static, NOT data-derived

A 4-card grid built from a hardcoded `DOMAINS` array. Each card shows label, feeds, percentage, a toned `Progress` bar, a note, and a `ConfidenceBadge`. These numbers are **literals, not computed from the mock data**. **[MOCK]** (would be [BACKEND] to compute for real).

| Domain | Value | Confidence | Tone | Feeds |
|---|---|---|---|---|
| Money — fees, billing, collections | 85% | high | sage | TallyPrime · Excel |
| Delivery — drawings, tasks, milestones | 70% | medium | ochre | Google Drive · AutoCAD · Trello |
| People — timesheets & effort | 40% | low | rust (rendered with a "weak" highlight border) | Manual Capture only |
| Approvals — authority status | 65% | medium | ochre | RAJUK ECPS (manual) · Manual Capture |

Below the grid: a static rust callout, "People & timesheets is the weak domain" (40% hardcoded via `pct(40)`). This is the narrative spine connecting Data Quality to Resourcing and Profitability, where the same 40%/~64% coverage caps confidence on capacity and margin answers.

### 3.4 Project matching queue

`unmatched` = every `crossRef` where `!matched`, across all projects. The reads are real; the action is not. **[MOCK]** for the list, **[BACKEND]** for the action.

- Section action Badge: "{n} pending" (rust if any, else sage).
- **Empty state** (`EmptyState`, CheckCircle2): "Every alias is matched" / "All source records are confidently linked…". **[IMPLEMENTED]**
- Each `MatchRow`: GitMerge icon, project name, project code (mono), `xref.sourceName`, the quoted alias, and a match label — "no signal" when confidence is "insufficient", else "{confidence} match" colored per the `CONFIDENCE` map.
- **"Confirm match"** button (subtle): **no onClick** — visual-only. A working version needs to write the match back. **[BACKEND]**

### 3.5 Known data-health limits — static explainer cards

Two cards make the limitations explicit and honest:

| Card | Content | Confidence | Status |
|---|---|---|---|
| Communication · WhatsApp — "No backfill API" | No history/replay API; capture is forward/screenshot | low | [INTEGRATION] (the limitation is real) |
| Accounting · TallyPrime — "Export is 5 days stale" | Hardcoded last export "12 Jun"; `relative("2026-06-12T17:10:00")` | medium | [MOCK] (illustrates the [INTEGRATION] gap) |

### 3.6 Data Quality — what works vs. what doesn't

| Element | Reality | Tag |
|---|---|---|
| KPI row (completeness, live/stale sources, unmatched aliases) | Computed from mock data | [MOCK] |
| Source freshness table | Rendered from mock sources | [MOCK] |
| Completeness-by-domain cards | Hardcoded literals | [MOCK] → [BACKEND] |
| Matching queue list + empty state | Real reads, real empty state | [MOCK] / [IMPLEMENTED] |
| "Confirm match" button | No handler | [BACKEND] |
| WhatsApp / TallyPrime limit cards | Static, but accurate to the design | [INTEGRATION] |
| `usePortfolio()` | Fetched but unused | (dead read) |
| Loading / error states | None | [RECOMMENDED] |

---

# 4. Settings (`/settings`)

**Page identity:** kicker "Administration", title "Settings".
**Purpose (verbatim):** *"Owner & admin controls for Space Esse — firm profile, who sees what, how projects are matched across your tools, and where data lives."*

Settings is organized as five tabs (`Tabs` default "firm"). **Tab switching is genuine client state ([IMPLEMENTED])**, and a small number of controls hold live local state. **Everything that would *save* anything is visual-only.** The single most important fact about this page is captured in §4.6: the KPI-weight inputs are the one place where a control's state genuinely gates another control (the Save button's disabled state).

### 4.1 Tabs

| Value | Label |
|---|---|
| `firm` | Firm profile |
| `users` | Users & roles |
| `matching` | Project matching |
| `kpis` | KPIs & thresholds |
| `locale` | Localization & residency |

### 4.2 Firm profile (`FirmTab`)

Header Badge: "{firm.staff} staff". Inputs are uncontrolled `defaultValue` from the `firm` mock.

| Control | Type | Editable / interactive? | Status |
|---|---|---|---|
| Studio name | Input (defaultValue) | Renders mock value; not wired to save | [BACKEND] |
| Legal entity | Input (defaultValue) | Not wired | [BACKEND] |
| Registered office | Input (defaultValue) | Not wired | [BACKEND] |
| Established | Input `type=number` | Not wired | [BACKEND] |
| Base currency | Select (`currency`) | **Holds live client state** (BDT / USD) | [IMPLEMENTED] (state only) |
| Fiscal year | Select value="jul-jun" | **No `onValueChange`** | Visual-only — [BACKEND] |
| Timezone | Select value="asia-dhaka" | No handler | Visual-only — [BACKEND] |
| "Save profile" | Button (primary) | No handler | Visual-only — [BACKEND] |

### 4.3 Users & roles (`UsersTab`) — reads `useEmployees()`

A static finance-restriction notice explains that fees/invoices/payments are visible only to Owner and Finance/Admin roles, with per-person exceptions. Table columns: **Member · Role · Finance access**.

| Per-row control | Editable / interactive? | Status |
|---|---|---|
| Role Select (`role`) | **Holds live client state**; options: Owner / Principal, Project Director, Project Architect, Design Lead, Finance / Admin, Authority Liaison, Viewer (read-only) | [IMPLEMENTED] (state only; does not persist) |
| Finance access Switch | `defaultChecked` (owner/finance), uncontrolled; **the "Full financials"/"Hidden" label is derived from the initial role only and does NOT react to the switch** | Visual-only — [BACKEND] |
| "Invite member" | No handler | Visual-only — [BACKEND] |

Roles "sync to Space Esse permissions" only in copy — there is no permission engine. **[BACKEND]**

### 4.4 Project matching (`MatchingTab`) — reads mock

Mirrors the Data Quality matching queue from an admin angle. Intro card "Project cross-reference"; a "{unmatched} need review" badge when any are pending. Table columns: **Canonical project · Source · Alias in source · Match · Action**.

| Element | Reality | Status |
|---|---|---|
| Match Badge "Matched"/"Unmatched" | From `ref.matched` | [MOCK] |
| "Re-match" (matched) / "Confirm" (unmatched) | No handlers | Visual-only — [BACKEND] |

### 4.5 KPIs & thresholds (`KpisTab`)

This tab contains the page's one genuinely wired interaction.

**Health-score weights — live, interactive, and gating.** Five `Input type=number` (step 0.05, min 0, max 1), each bound to `weights[key]` via `onChange`:

| Weight | Default |
|---|---|
| Budget | 0.30 |
| Schedule | 0.25 |
| Deliverable | 0.20 |
| Approval | 0.15 |
| Completeness | 0.10 |

A live `sum = Σ values` is computed; `balanced = |sum − 1| < 0.001`. The header Badge shows "Σ {sum}" (sage when balanced, rust otherwise), and the "Total weight" row echoes the sum with the same coloring. When not balanced, a message reads "Weights must total 1.00 before the model will save." **[IMPLEMENTED]** (the editing, live sum, and balance check are all real client state).

**Thresholds card (right):** four uncontrolled `Input type=number` (`defaultValue`):

| Threshold | Default |
|---|---|
| Overdue invoice | 30 days |
| Approval pending | 30 days |
| Fee-burn tolerance | 10 % |
| Utilization overload | 90 % |

The **"Save thresholds"** button is `disabled={!balanced}` — and this disabled state is *real*, driven by the weights sum in the adjacent card. **But the save action itself has no onClick** — it persists nothing. So the gating logic is [IMPLEMENTED]; the save is [BACKEND]. This is the cleanest example in the app of a designed-but-inert control whose *guard* is real while its *effect* is not.

### 4.6 Localization & residency (`LocaleTab`)

| Control | Editable / interactive? | Status |
|---|---|---|
| Interface language Select (value="en"; English / "বাংলা — Bangla") | No handler | Visual-only — [PLANNED] (ties to the cosmetic topbar language toggle; no real i18n) |
| Hosting region Select (Singapore / Mumbai) | No handler | Visual-only — [BACKEND] |
| **Bangladesh local mirror** Switch (`mirror`, default off) | **Holds live client state** but drives no other UI | [IMPLEMENTED] (state only) |
| "View data map" | No handler | Visual-only — [BACKEND] |

Static notes cover Bangla typesetting (Bijoy→Unicode, Nikosh font), a "PDPO 2025" residency badge, and a data-minimization note (never stores NID/TIN/passport). Footer: "Coverage benchmark · 80% of records carry full provenance." These are accurate-sounding compliance framing but are **static copy**, not enforced behavior. **[PLANNED]** for any real residency/compliance enforcement.

### 4.7 Settings — interactive vs. visual-only summary

| Genuinely interactive (client state, resets on refresh) | Visual-only (no handler / no effect) |
|---|---|
| Tab switching | All Firm `defaultValue` inputs |
| Firm "Base currency" Select | Fiscal year, Timezone Selects |
| Each UserRow "Role" Select | "Save profile" |
| KPI weight inputs (+ live Σ + balanced check) | Finance access Switches, "Invite member" |
| "Bangladesh local mirror" Switch | "Re-match" / "Confirm" matching actions |
| The Save buttons' *disabled* state (driven by weights) | Threshold inputs + "Save thresholds" *action* |
| | Interface language, Hosting region Selects, "View data map" |

---

# 5. Cross-cutting notes for the Data & Setup group

### 5.1 Persistence — the through-line

**No screen in this group writes anything anywhere.** Every "Save", "Confirm", "Connect", "Sync now", "Disconnect", "Invite", "Re-match", and the Capture "Capture" submit either does nothing or mutates only React component state that vanishes on refresh. This is the single most important caveat for anyone evaluating the prototype: the data-administration surface is **fully designed and largely inert**. To become a product it requires a write API, a datastore, an auth/permissions engine, real OAuth connectors, and a scheduler. **[BACKEND] / [INTEGRATION]**

### 5.2 States present and absent

| State type | Where present | Status |
|---|---|---|
| Loading / skeleton | **None** in any of the four files (hooks consumed with mock defaults) | [RECOMMENDED] |
| Empty | Capture recent feed ("Nothing captured yet"); Data Quality matching queue ("Every alias is matched") | [IMPLEMENTED] |
| Insufficient data | Narrative copy only (Capture health note; Data Quality "People" domain callout) — **not a rendered state branch** here | [MOCK] |
| Error / error boundary | **None** in any of the four files | [RECOMMENDED] |

Data Sources tiles and both Data Quality tables have **no dedicated empty component** — they render nothing rather than a placeholder when their source data is empty. **[RECOMMENDED]**

### 5.3 The honesty thesis, restated

The Data & Setup group is where the product argues for itself. Manual Capture exists because the most valuable facts have no API. Data Sources insists Space Esse is read-only and never authoritative. Data Quality ties every confidence claim back to freshness, matching, and completeness — and openly names its weakest domain (People/timesheets at 40%). Settings frames governance (maker-checker, finance restrictions, residency). In the current prototype these are **honest designs over mock data, not working systems** — and this documentation tags them as such precisely so the prototype's claims stay trustworthy.
