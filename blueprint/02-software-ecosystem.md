# Current Software Ecosystem & Capability Assessment

> **Scope of this section.** A connector-level inventory of every tool a Dhaka architecture practice (5–30 staff) actually touches, plus the productization-tier platforms PracticeLens will integrate later. For each platform: what data it holds, whether we can pull it, how, and whether it earns a place in the 6-month pilot MVP. PracticeLens is a **read-only-first analytics layer** — original tools stay the system of record, every ingested record carries provenance, and the integration surface is deliberately small for the pilot. Currency is **BDT** unless a foreign-client/USD case applies.

**Column legend (used in every table):**

- **Stored** — the practice/project data the tool holds that is relevant to our canonical entities.
- **API** — Y/N + type.
- **WH** — webhooks available (Y/N).
- **CSV/XL** — native CSV/Excel export (Y/N).
- **DB** — read-only DB / ODBC access (Y/N).
- **Auth** — authentication method.
- **Diff** — integration difficulty to build a read pipeline (Low / Med / High).
- **MVP** — include in the 6-month pilot (Y / N / Later).

**Confidence:** capabilities are marked **[C]onfirmed** (vendor docs) or **[A]ssumed** (inference — verify before build) inline. Difficulty and MVP calls are PracticeLens engineering judgments, not vendor facts.

---

## The framing decision that drives this whole section

The brief lists ~22 platforms across 13 categories. **For the Dhaka pilot, only six connectors matter**, and the single most important one is not an API at all — it is the **Manual Capture Layer** (smart forms + templated Excel/CSV import). The research is unambiguous on why: in a small Dhaka practice the highest-value data — Decisions, Approvals, progress %, scope Changes, Client Approval Time — lives in *the principal's head > WhatsApp > email > Excel > paper > the ECPS portal*, and **almost nothing sits in a queryable database**. You cannot integrate your way to data that was never recorded. So PracticeLens treats manual capture as a **first-class connector, ranked equal to any API**, and treats the design/BIM tools as nothing more than file-presence sensors.

The categories below are ordered by MVP relevance, not by the brief's listing order.

---

## CATEGORY A — Manual Capture Layer (the #1 MVP connector)

This is PracticeLens-native (we build it), so the "API/webhook/auth" columns describe *our own* surface, not a third party. It is the only way to populate the entities the firm never digitized: **Decision, Approval, Milestone status, Change, SiteReport, Timesheet (bootstrapped), Client Approval Time, progress %**.

| Connector | Stored / captures | API | WH | CSV/XL | DB | Auth | Diff | MVP |
|---|---|---|---|---|---|---|---|---|
| **Smart web/mobile forms** | Decision, Approval (incl. RAJUK/FSCD/DoE/CAAB submission + status), Milestone updates, Change/scope-creep prompts, SiteReport, lightweight Timesheet | N/A (ours) | N/A | Y (we emit) | Y (our DB) | App SSO + RBAC | Med | **Y** |
| **Templated Excel/CSV import** | Project register, Fee schedule, Invoice/Payment ledger, Drawing/sheet index, Consultant list, BD/Opportunity log | N/A (ours) | N/A | Y (round-trip) | Y | App SSO | Med | **Y** |
| **WhatsApp-screenshot / forward-to-capture** | Approvals & Decisions pasted/forwarded from chats, turned into structured records by the user-in-the-loop | N/A (ours) | N/A | — | Y | App SSO | Med | **Y** |

**Engineering notes.** Forms must be bilingual (Bangla/English), store **both scripts** for names/addresses (no deterministic transliteration), render with a bundled Unicode Bengali font (Nikosh) on any PDF/report export, and **normalize all input to UTF-8** — if a user pastes legacy Bijoy/ANSI text from a DTP'd document it must be detected and converted, or it will store as garbled Latin. Excel templates are the adoption wedge: the firm already lives in Excel, so we meet them there with locked, validated columns that map 1:1 to canonical entities and feed **Data Completeness Score** per project. Every captured record is a provenance source on equal footing with an API record.

---

## CATEGORY B — Accounting / Finance (drives Priority #1: MONEY)

The firm has **no single source of financial truth** — a mix of Excel/manual registers, Tally/TallyPrime, occasionally QuickBooks/Xero, and bank statements. For the pilot we assume **Excel/Tally**, and the MONEY KPIs (Fee Burn Rate, WIP, Unbilled Revenue, Invoice Aging, Collection Rate) are bootstrapped primarily from **templated import**, not a live finance API.

| Tool | Stored | API | WH | CSV/XL | DB | Auth | Diff | MVP |
|---|---|---|---|---|---|---|---|---|
| **Excel / manual registers** | Fee schedules, Invoice & Payment ledgers, expense lists, VAT/AIT figures | N/A | N/A | **Y [C]** | N/A | file/app | Low–Med | **Y** |
| **Tally / TallyPrime** | Ledgers, vouchers, P&L, receivables/payables, GST/VAT returns [C] | **Y — XML over HTTP + TDL [C]** | **N [C]** | **Y** (xlsx/CSV/PDF/JSON) [C] | ODBC, **deprecated ≥4.0 [C]** | Network-level, **no OAuth [C]** | **Med–High** | **N (pilot: use CSV/XL export)** |
| **QuickBooks Online** | Invoices, bills, payments, customers, COA, reports [C] | Y — REST/JSON [C] | Y (thin payload) [C] | Partial (Excel; CSV awkward) [C] | N | OAuth 2.0 [C] | Low–Med | **Later** |
| **Xero** | COA, invoices, bills, contacts, bank txns [C] | Y — REST [C] | Y (limited resources) [C] | UI yes / API JSON | N | OAuth 2.0 + PKCE [C] | Low–Med | **Later** |

**The Tally reality check.** Tally has an API on paper, but it is the *wrong* shape for a cloud analytics layer: it is **XML/TDL** (idiosyncratic), **desktop-bound** (the firm's PC must run an HTTP server reachable on port 9000), has **no webhooks**, **no OAuth** (security is network-level only), and ODBC for BI was **deprecated from TallyPrime 4.0**. Building a live Tally pull for a single pilot firm is a high-effort, brittle investment. **Decision: in the pilot, ingest Tally via its excellent CSV/XLSX export through our templated importer.** A real Tally XML/TDL connector is a *pluggable, post-MVP* item, justified only when several firms share the same Tally setup. QuickBooks/Xero are the clean OAuth REST options but are rare in this market, so they are **Later** (build opportunistically for richer-market productization). When we do build either, mind the 2025–26 commercial shifts: QBO's new read-quota tiers (free to 500k reads/mo then blocked) and token rotation, and Xero's hard **5,000 req/day per org** cap (forces delta sync).

**Finance modeling requirement (all sources).** Whatever the source, invoices must separate **gross Fee, 15% NBR VAT, VDS withheld, ~10% AIT/TDS withheld (resident; ~20% non-resident), and net cash received** — because AIT withholding directly suppresses **Collection Rate**. Support **% -of-construction-cost** fee computation, **phase/milestone-triggered billing**, separate **reimbursables**, and fee-base re-estimation. Multi-currency (BDT default, USD for foreign clients) with FX capture at invoice and at settlement.

---

## CATEGORY C — Cloud Productivity, File Storage & Email/Meetings (the realistic API wedge)

These are the only **rich, well-documented APIs** the firm plausibly already uses, and they double as the **file-presence sensor** for the design/BIM tools (see Category G). Files are split across Google Workspace **and** Microsoft 365 **and** local servers — so both connectors are pluggable, and the pilot lights up whichever the firm actually uses.

| Tool | Stored | API | WH | CSV/XL | DB | Auth | Diff | MVP |
|---|---|---|---|---|---|---|---|---|
| **Google Workspace** (Drive/Gmail/Calendar/Sheets) | Drive files+metadata, Gmail msgs/threads, Calendar events, Sheets cells [C] | Y — REST per-service [C] | Y — Drive `changes.watch`, Gmail via Pub/Sub [C] | **Y — `files.export` CSV/XLSX [C]** | N [C] | OAuth 2.0 / service acct + DWD [C] | Med | **Y (if firm is Google)** |
| **Microsoft 365** (SharePoint/OneDrive/Outlook/Teams) | driveItems, Outlook mail/calendar/contacts, Teams chat [C] | Y — unified Graph REST + delta [C] | Y — change-notification subs [C] | Indirect (Excel Graph API) [A] | N [C] | OAuth 2.0 (Entra ID) [C] | Med | **Y (if firm is Microsoft)** |
| **Dropbox** | Files + metadata, folder structure, sharing [C] | Y — REST v2 [C] | Y (user-level, "who changed") [C] | N/A (file store) [A] | N [A] | OAuth 2.0 [C] | Low–Med | **Later** |
| **Local file servers / individual PCs** | DWG/SKP/PDF deliverables, Drawing files, accounting Excel | **N** | N | N | N | N/A | — (manual) | **Y (via manual capture / agent later)** |

**Notes.** Use **delta/change queries** (Graph) and **`changes.watch`** (Drive) for incremental sync — full crawls are wasteful and Google enforces per-project/per-user/per-minute + daily quotas. Watch the throttling changes: Microsoft halved the per-app/per-user/per-tenant limit on **30 Sep 2025**; Google Calendar quota changes hit new projects **1 May 2026**; Gmail push needs Pub/Sub plumbing. **Local file servers have no API** — this is exactly why the Manual Capture Layer and (post-MVP) a lightweight local **file-watch agent** matter. For MVP we extract only **file-presence telemetry** from cloud stores: filename, size, last-modified, folder path — used as a proxy for Drawing/Deliverable activity, never as authoritative deliverable status.

---

## CATEGORY D — Messaging (WhatsApp — the primary channel, the hardest capture)

WhatsApp is the firm's **primary** channel for client + team comms and **informal approvals**. It is also the most painful analytics source in the entire stack, and the brief must not assume it can be backfilled.

| Tool | Stored | API | WH | CSV/XL | DB | Auth | Diff | MVP |
|---|---|---|---|---|---|---|---|---|
| **WhatsApp Business / Cloud API** | Meta keeps **no queryable conversation store** for you [C]; only number assets, templates, transient routing | Y — REST send [C] | **Y — inbound + status ONLY, via webhook [C]** | N [C] | N [C] | OAuth / system-user token [C] | **Med–High** | **N (MVP) / partial Later** |

**The constraint that reshapes the design.** There is **no message-history / replay API, no event log, no dead-letter queue**. You **cannot** retrieve any message sent before your number onboarded onto the Cloud API, and chats in the consumer/Business *app* are not exposed. If you want WhatsApp analytics, **you must persist every raw webhook payload to durable storage the moment it arrives** — Meta will never let you re-fetch it. Webhooks must return 200 in <5s or the number gets throttled/disabled after 5 consecutive failures.

**Decision for the pilot.** A full WhatsApp Cloud API onboarding (migrating the firm's number, template approval, building a persistence pipeline, going forward-only) is **too heavy for the 6-month single-firm pilot** and captures *zero history*. Instead, the MVP captures WhatsApp's high-value content through the **Manual Capture Layer** — a "forward/screenshot this approval into PracticeLens" flow that turns a chat message into a structured **Decision/Approval** record with provenance (who, when, source = WhatsApp). A real Cloud API webhook-persistence connector is a **Later** item once a firm commits to routing client comms through a PracticeLens-connected number. This is the honest path: it admits that the valuable data is unstructured and human-judgment-bound, and routes it through the capture layer rather than pretending an API solves it.

---

## CATEGORY E — Task / Project Management (only if the firm already uses one)

Trello/Asana/ClickUp/monday appear "sometimes." We will **not** push the firm onto a PM tool (that violates the "don't add another heavy platform" principle). If one is already in use, it is a low-cost source for Task, Milestone, and Task Overdue Rate signals.

| Tool | Stored | API | WH | CSV/XL | DB | Auth | Diff | MVP |
|---|---|---|---|---|---|---|---|---|
| **Trello** | Boards, lists, cards, checklists, activity [C] | Y — REST [C] | Y [C] | CSV (paid tier) [A] | N [A] | API key+token / OAuth1 [A] | **Low** | **Later (opportunistic)** |
| **Asana** | Projects, tasks, subtasks, custom fields, portfolios [C] | Y — REST [C] | Y (1k/resource, 10k/app) [C] | UI CSV [C] | N | OAuth 2.0 / PAT [C] | Low–Med | **Later** |
| **ClickUp** | Spaces, lists, tasks, custom fields, time tracking [C] | Y — REST v2 [C] | Y (workspace events) [C] | UI export [C] | N | OAuth 2.0 / token [C] | Low–Med | **Later** |
| **monday.com** | Boards, items, columns, updates [C] | Y — **GraphQL** [C] | Y (board events) [C] | UI Excel [C] | N | OAuth 2.0 / token [C] | Med | **Later** |

**Notes.** All four are read-pipeline-friendly. Watch the tight rate ceilings (ClickUp 100 req/min/token across all tiers; Trello 300/10s key; monday's 10M-complexity/min budget). ClickUp's native **time tracking** is the most interesting — if a firm already uses it, it is a free head-start on Timesheets/Planned vs Actual Hours/Utilization. None is MVP because adoption is too inconsistent to build against for a single pilot; all are **pluggable connectors** for productization.

---

## CATEGORY F — Practice Management / ERP & Construction Admin (productization tier — NOT Dhaka pilot)

These are the brief's "Western stack." They are **rich, well-modeled, API-first** sources — and **almost certainly absent from the pilot firm**. They earn connectors only when PracticeLens sells into richer markets. Listed for the pluggable-connector roadmap.

| Tool | Stored | API | WH | CSV/XL | DB | Auth | Diff | MVP |
|---|---|---|---|---|---|---|---|---|
| **Deltek Vantagepoint** | Project ERP: projects, employees, financials, billing, time/expense, GL [C] | Y — REST, versioned [C] | N [A] | UI Excel [A] | On-prem SQL only [A] | OAuth 2.0 multi-grant + Azure AD [C] | Med–High | **Later** |
| **BQE Core** | Projects, time & expense, billing, project accounting, GL [C] | Y — REST [C] | Unclear [A] | UI export [A] | N [A] | OAuth 2.0 [A] | Med | **Later** |
| **Monograph** | Projects, phases, budgets, forecasts, time, invoices [C] | **No public API** [C/A] | N [A] | **Y (report export) [C]** | N | QBO connector only [A] | Med–High (CSV/QBO bridge) | **Later** |
| **Procore** | Projects, RFIs, submittals, drawings, daily logs, budgets, change orders [C] | Y — REST, versioned [C] | Y (per-company) [C] | UI export [A] | N (separate paid analytics) [A] | OAuth 2.0 [C] | Med | **Later** |
| **Newforma Konekt** | Conversations, files, tasks, issues, decisions, transmittals, RFIs [C] | Y — REST v3 + MCP [C] | Unclear [A] | N (API) [A] | OAuth 2.0 / token [C] | Med | **Later** |
| **Bluebeam Studio** | PDF markups + markup status, Sessions, collaborators [C] | Y — REST (Studio + Markups) [C] | Y [C] | CSV (markup summary) [C] | N [A] | OAuth 2.0 (Client ID) [C] | Med | **Later** |
| **Smartsheet** | Sheets, rows, cells, attachments, reports [C] | Y — REST [C] | Y (skinny payload) [C] | Y (CSV/Excel/PDF) [C] | N | OAuth 2.0 / token [C] | Low–Med | **Later** |

**Notes.** Deltek/BQE/Procore/Newforma would each deliver several canonical KPIs (Forecast Project Margin, EAC, WIP, Utilization, RFI/Submittal Aging, Consultant Response Time) almost for free — which is precisely why they are the *productization* prize and why the pilot's job is to **synthesize those same KPIs from primitives we capture manually**. Monograph is the cautionary tale: **no public API**, so any "integration" is scheduled CSV export or a QuickBooks mirror — exactly the manual/export posture the pilot relies on anyway.

---

## CATEGORY G — Design / BIM / CAD / Render (file-presence signals only)

The central constraint: the firm's design tools (AutoCAD 2D DWG dominant, SketchUp, some Revit, D5 Render) **expose no practice/project data via any queryable service API**. AutoCAD's AutoLISP/.NET and SketchUp's Ruby API operate *inside the desktop app on an open file*; D5 has **no public API** (only a SketchUp LiveSync plugin, no AutoCAD plugin as of 2025).

| Tool | Stored | API | WH | CSV/XL | DB | Auth | Diff | MVP |
|---|---|---|---|---|---|---|---|---|
| **AutoCAD (DWG)** | Geometry in `.dwg` files; no PM data [C/A] | In-app scripting only [C] | N | N | N | N/A | Low (as files) | **Y — file-presence only** |
| **SketchUp** | `.skp` model files [C/A] | In-app Ruby only [C] | N | N | N | N/A | Low (as files) | **Y — file-presence only** |
| **D5 Render** | D5 scene files; **no data API** [C] | Plugin only (SketchUp) [C] | N | N | N | N/A | N/A | **Y — file-presence only** |
| **Autodesk Platform Services (APS)** — Revit/ACC/BIM 360 | Hubs/projects/folders/items, model derivatives, properties, ACC issues/RFIs [C] | Y — REST (multi, async) [C] | Y [C] | N (JSON props) [A] | N [A] | OAuth 2.0 (2/3-leg) [C] | **High** | **Later** |
| **Archicad / BIMcloud** | Model elements/properties; BIMcloud files/projects [C] | Archicad Python/C++ (local); BIMcloud REST [C] | N [A] | UI schedules [A] | N [A] | Token (BIMcloud) / local (Archicad) [A] | High | **Later** |

**How we treat design tools in the MVP.** We do **not** read the CAD/render apps. We read **file-presence telemetry** (name, size, last-modified, folder path) from the underlying cloud store (Google Drive / OneDrive-SharePoint / Dropbox APIs) and use it as a **proxy** for Drawing/Deliverable activity and Drawing Revision Rate — with explicit low confidence, since `_final_v3_REV2.dwg` filename versioning is the firm's actual reality. Authoritative Drawing/Revision/Deliverable status comes from the **manual Drawing/sheet index import**. Real BIM model data (APS, Archicad/BIMcloud) is **High** difficulty (async translation jobs, chained APIs, new APS consumption pricing from **8 Dec 2025**) and is strictly **post-MVP productization** for the minority of firms on Revit.

---

## The gap: brief's assumed Western stack vs. the Dhaka reality

The canonical KPI list and the Category-F/G tools implicitly assume an A&E firm running **ACC/BIM 360, Deltek or BQE, Procore, Newforma, Bluebeam** — an ecosystem where profitability, utilization, RFI cycle-time, WIP and EAC are *already digital* and an analytics layer merely reads and visualizes them. **That world does not exist in a 5–30-person Dhaka practice.** The actual stack is **AutoCAD 2D + SketchUp + WhatsApp + Excel + Tally + Gmail/Outlook + paper + the principal's memory**, with the ECPS portal for RAJUK. The mismatch is not cosmetic; it inverts the build:

| Dimension | Brief's assumed stack | Dhaka pilot reality | Consequence for PracticeLens |
|---|---|---|---|
| **Source of truth** | ERP/CDE databases | Principal's head, WhatsApp, Excel, paper | Must **create** the dataset, not just read it |
| **Timesheets** | Mandatory, in ERP | **Do not exist** | Utilization/Billable Utilization/labor cost must be **bootstrapped** via capture before they can be reported |
| **Project baseline** | WBS, phase budgets, planned hours at setup | No baseline at all | Schedule Variance / EAC / Fee Burn need a baseline we help the firm establish |
| **Approvals** | Logged in PM platform | Verbal, WhatsApp, liaison's memory; RAJUK on ECPS | Approval entities filled via manual capture; ECPS status entered, not API'd |
| **Profitability** | Per-project margin live in ERP | "Did money come in vs. go out" | Forecast Project Margin is a *derived* number from captured Fee + bootstrapped hours |
| **Integration mode** | API-first, read-only | Export + manual capture-first | Manual Capture = first-class connector; APIs are the exception, not the rule |

**The strategic read.** The KPIs are the right *destination* — but in Dhaka they are **outputs we must manufacture from captured primitives**, not fields we read from somebody's Deltek. The biggest blind spots (no labor cost → no profitability → no utilization; no baseline → invisible overruns; verbal approvals → no cycle-time) are the highest-value targets precisely *because* no incumbent tool captures them. PracticeLens's wedge is to digitize those primitives where the firm already works — Excel and a phone form — turn them into the firm's first real dataset, and only then layer analytics. This is also a clean productization story: the **same KPI engine** that consumes manually-captured primitives in Dhaka will consume Deltek/Procore/QBO API feeds in richer markets, with the connector layer swapped underneath and the canonical entities/KPIs unchanged.

**Anti-hallucination corollary.** Because much MVP data is manual and partial, every PracticeLens claim must cite its source records, dates, and calculation logic, attach a confidence level, and **refuse when data is missing** — surfacing a low **Data Completeness Score** instead of inventing a profitability figure. With this stack, "we don't have enough data to answer that yet" is a feature, not a failure.

---

### MVP integration surface (the decision, restated)

**IN (pilot):** Manual Capture Layer (forms + Excel/CSV import + WhatsApp forward-to-capture) · Google **or** Microsoft connector (whichever the firm uses) · email/calendar via that connector · file-presence telemetry from the cloud store · Tally/QuickBooks ingested via **export**, not live API.

**OUT (pilot) / pluggable Later:** live Tally XML-TDL · QuickBooks/Xero APIs · WhatsApp Cloud API webhook persistence · Trello/Asana/ClickUp/monday · Deltek/BQE/Monograph/Procore/Newforma/Bluebeam/Smartsheet · Autodesk APS / Archicad-BIMcloud · local file-watch agent.
