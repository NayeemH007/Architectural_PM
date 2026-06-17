# Information Architecture & Navigation

> **Read this first.** SPACE ESSE · Practice Intelligence is a **frontend-only, high-fidelity interactive prototype**. The navigation shell, routing, and global features described here run entirely in the browser. There is no backend, no database, no authentication, and no persistence. All data is mock data served through a simulated transport (`src/lib/api.ts`'s `resolve()`, ~280ms latency) and consumed by React Query hooks. Navigation state (which group is open, the active route, panel toggles) lives in React component state and **resets on every page refresh**.
>
> **Status legend** — every feature below carries one tag:
> - **[IMPLEMENTED]** — interactive and working in the frontend (client-side only).
> - **[MOCK]** — renders from mock data; the underlying read/sync/calc is simulated, not live.
> - **[BACKEND]** — designed in the UI but needs an API / database / persistence to function.
> - **[INTEGRATION]** — needs a third-party connector to function.
> - **[PLANNED] / [RECOMMENDED]** — not built; a future enhancement.

---

## 1. Overview: how the app is structured

The application is a single-page React app. Every screen renders inside one persistent **AppShell** (`AppShell.tsx`), which is mounted once as the parent route. The shell never unmounts as you navigate — only the `<main>` content area swaps. This gives the product a stable, app-like feel: the sidebar, topbar, command palette, and AI assistant are always present and always one keystroke away.

The shell is composed of four parts:

| Region | Component | Role |
|---|---|---|
| Left rail | `Sidebar.tsx` | Grouped navigation, brand block, firm-data-health footer |
| Top bar | `Topbar.tsx` | Search/command trigger, language toggle, data-source status, notifications, Ask AI, user menu |
| Content | `<main><Outlet/></main>` | The active route's page |
| Overlays | `CommandPalette.tsx`, `AssistantPanel.tsx` | Two global, keyboard-summoned dialogs rendered as portals |

The shell holds three booleans in React state — `navOpen` (mobile drawer), `assistantOpen`, and `paletteOpen` — and wraps everything in a Radix `<TooltipProvider>`. **[IMPLEMENTED]**

Pages are **lazy-loaded** (`React.lazy`), so each route's code is fetched on demand. While a page loads, a `<Suspense>` fallback renders a centered `Loader` of three pulsing dots (staggered 0 / 150ms / 300ms) at `h-[60vh]`. **[IMPLEMENTED]**

---

## 2. Full sitemap (24 routes + redirect)

All routes are children of a single `<Route element={<AppShell />}>`. Detail routes (`/projects/:id`, `/clients/:id`) exist as routes but are not listed in the navigation menu — they are reached by clicking into a record. Any unmatched path redirects to `/`.

### 2.1 Navigation tree

The table below is the canonical sitemap, grouped exactly as the sidebar groups them (`lib/nav.ts`). The "Nav?" column notes whether the route appears as a clickable item in the sidebar.

| Group | Route | Page | In sidebar? | Alert badge |
|---|---|---|---|---|
| *(no heading)* | `/` | Dashboard | Yes — "Dashboard" | — |
| **Projects** | `/delivery` | Delivery & Ops | Yes — "Delivery & Ops" | — |
| **Projects** | `/portfolio` | Portfolio | Yes — "Portfolio" | — |
| **Projects** | `/approvals` | Authority Approvals | Yes — "Authority Approvals" | **alert** |
| **Projects** | `/deliverables` | Document Control | Yes — "Document Control" | — |
| **Projects** | `/risks` | Risks & Issues | Yes — "Risks & Issues" | — |
| **Projects** | `/calendar` | Calendar | Yes — "Calendar" | — |
| **Projects** | `/projects/:id` | Project Detail | No (detail route) | — |
| **Finance** | `/financials` | Financials | Yes — "Financials" | — |
| **Finance** | `/profitability` | Profitability | Yes — "Profitability" | — |
| **Clients & Growth** | `/clients` | Clients | Yes — "Clients" | — |
| **Clients & Growth** | `/pipeline` | Pipeline | Yes — "Pipeline" | — |
| **Clients & Growth** | `/goals` | Goals & Targets | Yes — "Goals & Targets" | — |
| **Clients & Growth** | `/clients/:id` | Client Detail | No (detail route) | — |
| **People** | `/resourcing` | Resourcing | Yes — "Resourcing" | — |
| **Intelligence** | `/reports` | AI Reports | Yes — "AI Reports" | — |
| **Intelligence** | `/review` | Review Queue | Yes — "Review Queue" | **alert** |
| **Intelligence** | `/schedules` | Scheduled Reports | Yes — "Scheduled Reports" | — |
| **Data & Setup** | `/capture` | Manual Capture | Yes — "Manual Capture" | — |
| **Data & Setup** | `/activity` | Activity Log | Yes — "Activity Log" | — |
| **Data & Setup** | `/data-sources` | Data Sources | Yes — "Data Sources" | — |
| **Data & Setup** | `/data-quality` | Data Quality | Yes — "Data Quality" | — |
| **Data & Setup** | `/settings` | Settings | Yes — "Settings" | — |
| *(catch-all)* | `*` | — | No | redirects to `/` |

That is **24 navigable pages** (22 menu items + 2 detail routes), plus the catch-all redirect. **[IMPLEMENTED]** (routing, lazy-loading, and the redirect all work client-side.)

### 2.2 The seven navigation sections, in plain terms

| Section | What it answers | Pages |
|---|---|---|
| **Dashboard** | "What needs me this morning?" | Dashboard |
| **Projects** | "How is delivery going — schedule, approvals, drawings, risks, dates?" | Delivery & Ops, Portfolio, Authority Approvals, Document Control, Risks & Issues, Calendar |
| **Finance** | "Where is the money — billed, collected, margin?" | Financials, Profitability |
| **Clients & Growth** | "Who are our clients, what's in the pipeline, are we hitting targets?" | Clients, Pipeline, Goals & Targets |
| **People** | "Who's overloaded, who has capacity?" | Resourcing |
| **Intelligence** | "What is the AI telling us, and what needs sign-off?" | AI Reports, Review Queue, Scheduled Reports |
| **Data & Setup** | "Capture what has no API, audit the trail, manage sources, tune the system." | Manual Capture, Activity Log, Data Sources, Data Quality, Settings |

The grouping follows the practice's mental model: delivery work, then money, then growth, then people, then the intelligence layer, then the plumbing that feeds it.

---

## 3. The sidebar (`Sidebar.tsx`)

The sidebar is an off-canvas drawer (`w-64`). On large screens it is static (`lg:static lg:translate-x-0`); on small screens it slides in over a dimmed, blurred overlay (`bg-ink/20 backdrop-blur`) that closes the drawer when tapped, and it carries its own close `X` button. **[IMPLEMENTED]**

### 3.1 Brand block

At the top sits the brand tile: the `Mark` icon (a static inline SVG of two stacked frames with center breaks, `brand.tsx`) inside a blue tile, next to the firm name (`firm.name` = "SPACE ESSE", from mock data) and the label "Practice intelligence". The mark has no state or interactivity — it is purely decorative. **[MOCK]** (the name is read from mock data).

### 3.2 Collapsible groups and auto-expand

Navigation items are organized into the groups shown in section 2.1. Each group (except the heading-less Dashboard group, which always renders) is a collapsible section:

- **Collapsed by default, active group open.** On load, `openGroups` is initialized so that only the group containing the current route starts expanded (`activeGroup >= 0 ? {[activeGroup]: true} : {}`). Every other group is collapsed.
- **Auto-expand on navigation.** A `useEffect` watches the active group. When you navigate into a route whose group is currently collapsed, that group is revealed — without closing any group you had manually opened (`s[activeGroup] ? s : {...s, [activeGroup]: true}`).
- **Manual toggle.** Clicking a group header flips just that group (`toggle(i)`).
- **Active-group detection** uses the same path matcher as the nav links: `to === "/" ? pathname === "/" : pathname === to || pathname.startsWith(to + "/")`.

**[IMPLEMENTED]** — all collapse/expand behavior is real client-side state.

### 3.3 Group header cues

| Cue | When it appears | Visual |
|---|---|---|
| Chevron rotation | Group is open | `ChevronRight` rotates 90° |
| Blue heading | Group contains the active route **and** is collapsed | Heading text turns blue (`!text-blue`) — a hint that "your current page lives in here" |
| Alert dot | Group is collapsed **and** contains an item with an alert badge | A small `h-1.5 w-1.5 rounded-full bg-rust` dot beside the heading |

The alert dot surfaces on the **Projects** group (because of Authority Approvals) and the **Intelligence** group (because of Review Queue) whenever those groups are collapsed. It rolls the per-item alert up to the group level so an attention item is never fully hidden behind a collapsed header. **[IMPLEMENTED]**

### 3.4 Nav item links and badges

Each item is a React Router `NavLink` (`end={to === "/"}`). The active link is styled `bg-blue-tint font-medium text-blue`. Each link renders its icon and label, plus an optional badge:

- `badge === "alert"` → a small rust dot (used by **Authority Approvals** and **Review Queue** only).
- `typeof badge === "number"` → a pill (`bg-bone-2`) showing the number.

**Important:** no numeric badge is defined anywhere in the nav data. The numeric-badge branch is present in code but is **dead code** — only the two `"alert"` badges ever render. **[PLANNED]** for numeric counts (e.g., "3 pending reviews") — the rendering exists but no data drives it, and a live count would need a real data layer to be meaningful.

Clicking any item calls `onClose`, which closes the mobile drawer. **[IMPLEMENTED]**

### 3.5 Firm data health footer

The sidebar footer shows "Firm data health" with a literal **68%** figure, a fixed-width (`68%`) ochre bar, and the static copy *"Improving as the team captures more. Timesheets are the biggest gap."*

This is **hardcoded and not data-driven** — the percentage and bar width are literals, not computed from any source. **[BACKEND]** — to make this honest it would need a real, computed firm-completeness signal wired in (the Data Quality page computes a comparable figure from mock data, but the footer does not consume it).

---

## 4. The topbar (`Topbar.tsx`)

A sticky header (`h-16`). On small screens a hamburger `Menu` button opens the sidebar drawer (`onMenu`). The topbar holds, left to right: the command/search trigger, the language toggle, the data-source status pill, the notifications bell, the Ask AI button, and the user menu.

### 4.1 Command / search trigger

A button labeled *"Search or jump to anything…"* with a `Search` icon and a `⌘K` keyboard hint (hidden below the `sm` breakpoint). Clicking it opens the command palette (`onCommand`).

It is **not a text input** — it is a button that opens the palette. The real typing happens inside the palette. **[IMPLEMENTED]** (it reliably opens the palette).

### 4.2 Language toggle — cosmetic only

A button (hidden below `sm`) holding local `lang` state of `"en"` or `"bn"`. Clicking it flips between the two and swaps the visible label between `EN` and `বাংলা` (the Bengali label gets a `bn` font class). Its `title` is "Toggle language".

**This toggle changes the label and nothing else.** No internationalization is applied — the UI does not translate. Bangla text appears only in select mock fields (for example `project.nameBn`); the application is **not localized**. **[PLANNED]** — real localization (i18n strings, RTL/typesetting handling, translating the interface) is a future build, not present.

### 4.3 Data-source status pill and popover

Reads live mock data via `useDataSources()`. **[MOCK]**

- **Pill (trigger):** a dot colored `bg-ochre` if any source has issues, else `bg-sage`. Text reads `{connected} live`, where "connected" counts sources with status `connected` or `syncing`. If there are issues (status `stale` or `error`), it appends `· {issues} stale`.
- **Popover (`w-80`):** header "Connected sources" with `{active} of {total}` (active = any status other than `not_connected`). Then a list of active sources, each showing a `StatusDot` (which pulses only when `syncing`), the source name, and a right-aligned timestamp — `relative(lastSync)` if a last-sync time exists, otherwise the status label from the `SOURCE_STATUS` map.

The figures are computed from the 17-source mock catalog (`mock/integrations.ts`); nothing here reflects a live connection. **[MOCK]**

### 4.4 Notifications bell and popover

Reads mock alerts via `useAlerts()`. **[MOCK]**

- **Bell:** an unread count = alerts where `!acknowledged`. A rust badge shows the count when unread > 0.
- **Popover (`w-96`):** header "Alerts" with `{unread} new`. Lists the first **6** alerts (`alerts.slice(0, 6)`): a severity dot (color from `ALERT_TONE`), the alert title, the detail clamped to two lines, and a footer of `relative(createdAt) · category`.

Note there is **no empty-state markup** — if there were zero alerts, the popover would render an empty list. With the current 8-alert mock that never happens. Marking an alert read/acknowledged is a stored field on the data but no control changes it. **[BACKEND]** for acknowledge/dismiss actions.

### 4.5 Ask AI button

A primary button with a `Sparkles` icon and the label "Ask AI" (label hidden below `sm`). Clicking it opens the AI Assistant panel (`onAssistant`). **[IMPLEMENTED]** (opens the panel; the answers themselves are canned — see section 6).

### 4.6 User menu — visual only

A button showing a hardcoded `Avatar` for "Tahmid Karim" with a chevron. The popover (`w-56`) shows "Tahmid Karim" / "Owner / Principal" and three buttons: "Profile & preferences", "Switch role view", and "Sign out" (rust).

**All three buttons have no click handlers — they are non-functional.** The identity is hardcoded, not from any auth session. **[BACKEND]** — profile, role-switching, and sign-out all require real authentication and a user/session store that does not exist.

---

## 5. Global feature: Command Palette (Ctrl/Cmd + K)

`CommandPalette.tsx` — a Radix Dialog summoned with **Ctrl/Cmd + K** (the shortcut is wired in the AppShell's window `keydown` handler, using `e.metaKey || e.ctrlKey`, with `preventDefault`). It can also be opened from the topbar search button. **[IMPLEMENTED]**

### 5.1 What it does

It is a fast switcher: type a few characters and jump to a page, a project, or an AI action. On open it resets the query and highlights the first row; the highlight resets to the top whenever the query changes.

### 5.2 Item groups

| Group | Items | Action |
|---|---|---|
| **Actions** | "Ask Space Esse AI" (hint "Natural-language analytics") | Closes palette, opens the AI assistant |
| **Actions** | "New capture" (hint "Log a decision, approval or effort") | Navigates to `/capture` |
| **Pages** | One entry per nav item (generated from `NAV.flatMap`); hint = the group heading or "Navigate" | Navigates to that route |
| **Projects** | One entry per project from `useProjects()` mock data; label = project name, hint = `{code} · {client}` | Navigates to `/projects/{id}` |

**[IMPLEMENTED]** for navigation and the AI action; **[MOCK]** for the project list (sourced from the 8-project mock).

### 5.3 Search and synthetic "Ask" items

Filtering is a case-insensitive `includes` over the combined `label + hint` text. When the query is non-empty, two synthetic items are prepended in an **"Ask"** group:

- **`Ask AI: "{q}"`** (hint "Cited answer") — closes the palette and opens the assistant pre-seeded with your query.
- **`Search everywhere for "{q}"`** (hint "Projects, invoices, people, decisions") — navigates to `/search?q={encoded query}`, handing the term to the Search page.

**[IMPLEMENTED]** — both routes/actions work (the assistant's answer is still canned; see section 6).

### 5.4 Keyboard and rendering

- **Arrow Down / Arrow Up** move the highlight (clamped to the list bounds); **Enter** runs the highlighted item.
- The highlight also follows the mouse (`onMouseEnter`) and is scrolled into view (`scrollIntoView`, block "nearest").
- Group headers render only when the group changes. The active row is styled `bg-blue-tint text-blue` with a trailing `CornerDownLeft` icon.
- **Empty state:** if nothing matches, it shows `No matches for "{q}".`

**[IMPLEMENTED]** — full keyboard navigation and the empty state are real.

---

## 6. Global feature: AI Assistant panel (Ctrl/Cmd + J)

`AssistantPanel.tsx` — a right-side Radix Dialog panel (`max-w-md`) summoned with **Ctrl/Cmd + J** (wired in the AppShell alongside the palette shortcut). Header: a blue `Sparkles` tile, the title "Ask Space Esse", the subtitle "Cited answers · refuses when data is missing", and an `X` to close. **[IMPLEMENTED]** (opening; answers are canned).

### 6.1 How answering works — canned, not live

When you submit a question, the panel clears the input, shows a "thinking" indicator (three pulsing blue dots + *"Checking the records…"*), waits **650ms** (`setTimeout`), then appends an answer. The answer is looked up in a **fixed `ANSWERS` map**; if your question is not an exact key, it falls back to `genericAnswer(q)`.

**There is no language model, no inference, and no retrieval.** Answers are pre-written and matched by exact string. **[MOCK]** — the experience demonstrates the intended "cited, confidence-rated, refuses-when-unsure" behavior, but a real implementation needs **[BACKEND]** (a model + a query layer over real data).

### 6.2 Empty state and suggested questions

The empty state explains: *"Ask about money, delivery, approvals or people. Every answer cites the source records and shows a confidence level."* It offers five suggestion buttons (the `SUGGESTED` list), each of which is a recognized key in the `ANSWERS` map:

1. "Which projects are losing money?"
2. "What's overdue in collections right now?"
3. "Where are we stuck on authority approvals?"
4. "Can we take on a new project next month?"
5. "Who is overloaded this week?"

### 6.3 The canned answers (confidence + citations)

| Question | Confidence | Gist | Cited sources |
|---|---|---|---|
| Which projects are losing money? | **low** | Flags Meghna Textiles HQ Interior over budget (cost ৳46.5L vs ৳42.0L), ~৳1.4L unbilled change orders, ~4% forecast margin but low-confidence at 60% timesheet coverage | Manual capture · Change log; TallyPrime · cost-to-date |
| What's overdue in collections right now? | **high** | ৳58.0L overdue across three invoices; net cash at risk ~৳49L after VAT/VDS/AIT | TallyPrime · INV-2026-019; TallyPrime · INV-2026-028 |
| Where are we stuck on authority approvals? | **high** | Bashati Corporate Tower: RAJUK permit 61 days vs 30-day window, caps health at 49; FSCD refuge-floor query | RAJUK ECPS · ECPS-2024-88213; Phone note · Decision #219 |
| Can we take on a new project next month? | **insufficient** (refuses) | Won't estimate capacity: only 6/10 staff log time (64% coverage); notes Arif Chowdhury overloaded, Nusrat Jahan down to 71%; advises improving coverage | Timesheet capture · coverage 64% |
| Who is overloaded this week? | **medium** | Arif Chowdhury >90% for six weeks; Kamrul Pasha ~90%; non-logging roles unknown | Timesheet capture · series e3 |
| *Anything unmatched* (`genericAnswer`) | **insufficient** (refuses, empty citations) | *"I answer from verified records only. I don't have enough linked data to answer that confidently yet…"* | (none) |

This **deliberate refusal** — both the "Can we take on a new project?" answer and the generic fallback — is a core demonstration of the product's "we don't fabricate" stance.

### 6.4 Answer rendering and confidence

Each answer renders as a user question bubble (blue, right-aligned) above an answer card. The card border is **dashed** when the answer is `insufficient`, solid otherwise. The footer shows a `ConfidenceBadge` followed by one `SourceChip` per citation (chips show the source name, no date).

Confidence rendering (`trust.tsx`, `CONFIDENCE` map):

| Level | Label | Meter |
|---|---|---|
| high | "High confidence" (sage) | 4 bars |
| medium | "Medium confidence" (ochre) | 3 bars |
| low | "Low confidence" (sienna) | 2 bars |
| insufficient | "Insufficient data" (neutral) | 0 bars; badge text reads the literal "No data" |

The input box (footer form) has the placeholder *"Ask about your practice…"*; the submit button (`ArrowUp`) is disabled when the input is empty. Below it: *"Space Esse only uses verified records. It will say when it doesn't know."* **[IMPLEMENTED]** for the interaction; **[MOCK]** for the answers.

---

## 7. Per-route document titles

The AppShell sets `document.title` on every route change via a `useEffect` keyed on `pathname`. It finds the matching nav item using the same path matcher as the sidebar:

- **Match found:** title becomes `` `${item.label} · ${firm.name}` `` — e.g. *"Portfolio · SPACE ESSE"*.
- **No match (including detail routes** `/projects/:id`, `/clients/:id`**):** title falls back to `` `${firm.name} · Practice Intelligence` `` — *"SPACE ESSE · Practice Intelligence"*.

Because the matcher only knows the static nav items, detail routes resolve no item and therefore always use the fallback title. **[IMPLEMENTED]**

| Route | Resulting title |
|---|---|
| `/` | Dashboard · SPACE ESSE |
| `/delivery` | Delivery & Ops · SPACE ESSE |
| `/approvals` | Authority Approvals · SPACE ESSE |
| `/reports` | AI Reports · SPACE ESSE |
| `/settings` | Settings · SPACE ESSE |
| `/projects/p2` (detail) | SPACE ESSE · Practice Intelligence (fallback) |
| `/clients/c1` (detail) | SPACE ESSE · Practice Intelligence (fallback) |

**[RECOMMENDED]** — detail routes could resolve their record (project/client name) into the title for better browser-tab and history legibility; today they do not.

---

## 8. Favicon and brand identity

The only brand asset present in the shell code is the `Mark` SVG (`brand.tsx`) used in the sidebar tile — a static, two-frame inline SVG drawn with `stroke="currentColor"`, taking only a `className`. There is **no favicon definition, no app-icon, and no document-level brand metadata** described in the inventoried shell files. The firm identity ("SPACE ESSE", tagline "Architecture · Interior · Urban — Dhaka", office "Banani, Dhaka") comes from the `firm` mock object. **[PLANNED]** — a proper favicon / PWA icon set and head metadata are not present and would be a future addition.

---

## 9. Loading, empty, and error states across the shell

| State type | Where present | Status |
|---|---|---|
| **Loading** | Route-level `Loader` (three pulsing dots) during lazy import; palette/assistant "thinking" dot animations | [IMPLEMENTED] |
| **Empty** | Command palette "No matches for…"; AI assistant rich empty state | [IMPLEMENTED] |
| **Insufficient data** | AI assistant (the refusal answer + the generic fallback); `ConfidenceBadge` "No data" | [IMPLEMENTED] (as a designed state over mock data) |
| **Error / error boundary** | **None** in any shell file | [BACKEND] / [RECOMMENDED] |

There is **no error-boundary or error-state UI** anywhere in the shell. The notifications popover also lacks an empty state. These are acceptable in a mock (failures cannot occur against in-memory data), but a production build with a real network layer would need them. **[RECOMMENDED]**

---

## 10. Keyboard shortcuts summary

| Shortcut | Action | Status |
|---|---|---|
| **Ctrl/Cmd + K** | Open Command Palette | [IMPLEMENTED] |
| **Ctrl/Cmd + J** | Open AI Assistant | [IMPLEMENTED] |
| **Esc** | Close palette / assistant / any open dialog | [IMPLEMENTED] (handled by Radix Dialog) |
| **Arrow ↑ / ↓**, **Enter** | Navigate / run command palette rows | [IMPLEMENTED] |

There is no dedicated *close* shortcut for the palette or assistant beyond Esc — closing is handled by Radix's built-in dialog dismissal.

---

## 11. Cross-cutting honesty notes (what is *not* working)

To keep this prototype's claims honest, the following navigation-shell elements are explicitly **not functional** despite appearing in the UI:

| Element | Reality | Honest tag |
|---|---|---|
| Sidebar "Firm data health" 68% | Hardcoded literal + fixed bar width | [BACKEND] |
| Language toggle (EN ↔ বাংলা) | Flips the label only; no translation | [PLANNED] |
| User menu: Profile, Switch role, Sign out | No click handlers; identity hardcoded | [BACKEND] (needs auth) |
| Notifications acknowledge/dismiss | `acknowledged` is a data field; no control mutates it | [BACKEND] |
| AI assistant answers | Canned map + 650ms fake delay; no model | [MOCK] → [BACKEND] for real |
| Data-source status / notification counts | Computed from mock catalogs, not live connections | [MOCK] → [INTEGRATION] for real |
| Numeric nav badges | Rendering branch exists; no data drives it | [PLANNED] |
| Favicon / head metadata | Not present in shell | [PLANNED] |
| Per-route title on detail routes | Falls back to generic firm title | [RECOMMENDED] |

Everything else in the navigation shell — routing, lazy-loading, the redirect, sidebar collapse/auto-expand/alert-dots, both keyboard-summoned overlays, the command palette's search and navigation, the assistant's interaction flow, and per-route titles for menu routes — is genuinely **[IMPLEMENTED]** as client-side behavior that resets on refresh.
