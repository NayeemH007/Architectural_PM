# Industry Findings: How Architecture Firms Operate

> **Purpose of this section.** PracticeLens is an AI reporting and analytics *layer*, not a replacement ERP/PM tool. To design that layer we must first understand, ruthlessly and specifically, **how the work actually happens, how (if at all) it is tracked, and where the data physically lives** — across small, medium, and large firms, with the lens fixed on the Dhaka small-firm reality of our pilot. The recurring finding is blunt: **the highest-value operational data is uncaptured.** It lives in the principal's head, in WhatsApp threads, in printed registers, and in filenames. Our job is not to integrate APIs that do not exist; it is to *manufacture the firm's first real dataset* from the places work already happens, with provenance and anti-hallucination guardrails on every record.

This section walks all 16 operational areas. For each: how small / medium / large firms manage it, how it is tracked, where it is stored, and the **analytics blind spots**. We map everything to our canonical phase model and then close with the Dhaka-specific reality and a capture-strategy table for PracticeLens.

**Phase model (canonical):**
`Concept → Schematic → Design Development → Authority Approval → Construction Documents → Tender/Procurement → Construction Administration → Handover/Closeout`
(with `BD/Pursuit` and `Pre-contract/Proposal` as pre-project stages feeding `Opportunity` → `Proposal` → `Contract` → `Project`).

**A note on confidence.** Items marked **[CONFIRMED]** are corroborated by industry sources in the research base; **[ASSUMED]** are analyst inferences about typical small/medium and specifically Dhaka SME behaviour — well-established patterns, but **must be confirmed in pilot-firm field interviews before we hard-code workflow assumptions.**

---

## 1. Business Development & Lead Management
*Phase: BD/Pursuit (pre-project). Canonical entities: `Opportunity`, `Client`, `Contact`. KPIs: `Pipeline Value`, `Weighted Pipeline`, `Proposal Win Rate`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Principal-driven, **referral/relationship-based** — landowner and developer contacts, IAB network, repeat clients. No pipeline process. [ASSUMED] | Studio leads + principal; loose pipeline; informal go/no-go. [ASSUMED] | Dedicated BD/marketing team; formal go/no-go scoring, win-rate targets, CRM nurture. [CONFIRMED] |
| **Tracked** | Effectively not tracked — status lives in the principal's memory and phone. | Opportunities spreadsheet. | CRM stages, weighted pipeline, win rate, source attribution. |
| **Stored** | **Phone contacts, WhatsApp, principal's head, business cards.** | Excel / Google Sheets, email folders. | Cosential/Unanet, HubSpot, Salesforce, Deltek. [CONFIRMED] |
| **Blind spots** | **Total.** No win/loss rate, no cost-of-pursuit, no lead-source ROI. Cannot answer "how much unpaid effort chases work that never closes." | Pipeline exists but pursuit cost not linked to timesheets. | BD effort vs. win economics still weakly linked to delivery cost. |

This is the lightest priority for us (Pipeline = priority 4), but note: even at large firms the **cost of pursuit is rarely linked to delivery effort**. For the pilot, the realistic ask is a single `Opportunity` capture form, not a CRM.

---

## 2. Proposals, Fees & Contracts
*Phase: Pre-contract. Entities: `Proposal`, `Fee`, `Contract`, `Service`, `Budget`. KPIs: `Forecast Project Margin`, `Fee Burn Rate`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Fee set "by feel" as **% of construction cost or per-sft rate**; proposal is a short letter/quotation. Contracts often informal — many small Dhaka jobs run on a letter of engagement or verbal/trust terms with developers. [ASSUMED] | Templated proposals; fee from rough effort estimate; short-form agreement. [ASSUMED] | Fee built bottom-up from staffing/hours by phase; formal contracts (AIA B-series / IAB conditions); legal review. [CONFIRMED] |
| **Tracked** | Fee figure exists; **basis-of-fee and assumptions undocumented.** Scope creep not logged. | Proposal log; fee vs. estimated hours sometimes captured. | Contract register, fee-vs-cost model, scope baseline for `Change` tracking. |
| **Stored** | Word/PDF on principal's laptop, email, **printed signed copy in a folder.** | Shared drive + spreadsheet. | DMS + ERP contract module (Deltek, BQE Core). [CONFIRMED] |
| **Blind spots** | **Critical.** No link between fee and the effort it implies — the root cause of small-firm unprofitability. No scope baseline, so scope creep is invisible and unbilled. | Fee basis captured but rarely reconciled to actual hours post-project. | Strong; weak point is mid-project scope-baseline discipline. |

**Dhaka specifics that PracticeLens must model:** IAB publishes a *Scale of Minimum Fees (2018)* — percentage-of-construction-cost, banded by building type, staged against phases — but the exact tables are only obtainable on payment from IAB and are **[VERIFY]** items. The typical staged-invoicing pattern (Concept ~15–20%, DD ~20%, CD/Tender docs ~25–30%, Tender ~5%, CA ~25–35%, balance at handover) is the working default **[ASSUMED]** until confirmed against the signed `Contract`. Crucially, the `Fee` engine must support (i) %-of-construction-cost computation, (ii) phase/milestone-triggered billing, (iii) **separate reimbursable line items** (printing, RAJUK submission costs, model-making), and (iv) re-basing when construction cost is re-estimated.

---

## 3. Project Setup
*Phase: Mobilization (start of Concept). Entities: `Project`, `ProjectPhase`, `Budget`, `ResourceAssignment`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Ad hoc — create a folder on the shared PC, assign whoever is free, start drawing. **Often no formal kickoff, no budget breakdown, no project number.** [ASSUMED] | Project number, folder template, basic phase budget, kickoff. [ASSUMED] | Formal initiation: project code, WBS, phase budgets, staffing plan, billing terms in ERP. [CONFIRMED] |
| **Tracked** | Project existence tracked informally; **no baseline budget or schedule to track against.** | Phase budget + target dates. | Baseline budget, planned hours, schedule, roles. |
| **Stored** | Folder naming on shared drive; details in principal's head. | Drive + Excel/Monograph. | ERP / PM platform. [CONFIRMED] |
| **Blind spots** | **No baseline = nothing to measure variance against later.** This is the single upstream cause of every downstream blind spot. | Baseline exists but rarely re-baselined on scope change. | Generally robust. |

**Design consequence:** PracticeLens must make `Project` + `ProjectPhase` + a minimal `Budget`/planned-hours baseline a *near-zero-friction* setup step, because without a baseline, `Schedule Variance`, `Fee Burn Rate`, `EAC`, and `Forecast Project Margin` are all computationally undefined. This is where we earn or lose adoption.

---

## 4. Design Phases (Concept / Schematic / DD / CD)
*Phase: Concept → Schematic → Design Development → Construction Documents. Entities: `ProjectPhase`, `Task`, `Revision`. KPIs: `Milestone Completion Rate`, `Planned vs Actual Hours`, `Deliverable Completion Rate`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Phases blur; principal designs, juniors detail. **Iteration driven by client reactions, not a gated process.** Frequent rework. [ASSUMED] | Recognizable SD→DD→CD gates; internal reviews. [ASSUMED] | Formal phase gates, milestone sign-offs, QA reviews. [CONFIRMED] |
| **Tracked** | "Where are we" known only by looking at the drawings. **% complete is gut feel.** Rework not logged. | Milestone dates + rough % complete. | Earned-value % complete, phase burn, design-review actions. [CONFIRMED] |
| **Stored** | The drawings; principal's head. | PM tool + drive. | PM/BIM platform, ERP. |
| **Blind spots** | **Rework volume and iteration count — invisible.** Effort per phase vs. fee per phase — invisible. No early warning on overrun. | % complete subjective; rework under-captured. | Iteration/rework cost hard to attribute even at scale. |

A blended local + RIBA/AIA model is correct: Bangladeshi practice splits broadly into **(1) design + tender-document preparation and (2) construction supervision** [CONFIRMED via IAB standard contracts], and RAJUK permit drawings often coincide with CD, so "permit submission" is frequently a distinct milestone between DD and CD [ASSUMED]. PracticeLens should let firms treat `Authority Approval` as a first-class phase that *overlaps* CD rather than strictly following it.

---

## 5. BIM & Drawing Production
*Phase: DD, CD (production-heavy). Entities: `Drawing`, `Model`, `Document`, `Revision`. KPIs: `Drawing Revision Rate`, `Deliverable Completion Rate`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Predominantly **AutoCAD 2D**; some SketchUp for visuals; **Revit/BIM adoption low** (cost/skills). File-based, local. [ASSUMED] | Mixed CAD + Revit; emerging standards; central file on server. [ASSUMED] | Revit/BIM-mandated, BIM Manager, shared models (ACC/BIM 360), naming/family standards, coordination. [CONFIRMED] |
| **Tracked** | Drawing list maintained **manually in titleblock / a sheet-index Excel, if at all.** Versions by filename (`_final`, `_final2`, `_rev_latest`). | Sheet index spreadsheet; some revision discipline. | ACC issue/version tracking, model health, sheet sets. [CONFIRMED] |
| **Stored** | **Local PCs + shared network drive / external HDD; pen drives.** Informal backups. | Server / Google Drive / Dropbox + standards folder. | Common Data Environment (ACC, BIM 360, Newforma). [CONFIRMED] |
| **Blind spots** | **Version control is the biggest risk** — wrong-version-issued errors. No record of who drew what or time-per-sheet. Backup/loss risk high. | Better version control; cross-file coordination manual. | Model-authoring effort vs. value still hard to quantify. |

**Hard reality for our integration surface:** AutoCAD, SketchUp, and D5 Render expose **no queryable practice-data API** — their automation runs *inside* the desktop app on a file, and D5 has no public API at all [CONFIRMED]. Therefore PracticeLens treats design tools as **file-presence signals only**: file existence, name, size, last-modified, folder path — harvested from the *underlying cloud store* (Google Drive / OneDrive-SharePoint / Dropbox APIs), **never from the CAD tool**. A `Drawing`/`Model`/`Revision` record is inferred as a proxy for design activity, and we must be honest about that confidence level in every derived KPI. Filename-based versioning means our matching/parsing layer must tolerate `_final2` chaos and surface a `Data Completeness Score` rather than pretend precision.

---

## 6. Consultant Coordination (Structural / MEP / others)
*Phase: DD, CD, into CA. Entities: `Consultant`, `Issue`, `RFI`, `Meeting`, `Decision`. KPIs: `Consultant Response Time`, `RFI Aging`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Coordinated **by phone/WhatsApp and emailed CAD files**; clash detection by eyeballing overlays. Structural/MEP often external freelancers. [ASSUMED] | Email + periodic coordination meetings; some overlay checks. [ASSUMED] | Federated BIM models, clash detection (Navisworks), issue tracking, minuted meetings. [CONFIRMED] |
| **Tracked** | **Not tracked** — issues live in chat threads and verbal agreements. | Action lists / minutes in email or Word. | Clash/issue logs tracked to closure. |
| **Stored** | **WhatsApp, email attachments, verbal.** | Email + shared drive minutes. | ACC Issues, Navisworks, Newforma. |
| **Blind spots** | **Huge.** Coordination errors surface on site as rework; no audit trail of who was told what, when. Latest-file-version uncertainty. | Issue-closure tracking weak. | Clash-to-resolution cycle time sometimes untracked. |

For the pilot, `Consultant Response Time` is realistically derivable only via the **manual-capture layer** (a quick "logged a coordination question / got an answer" form) plus email metadata — not from any consultant-side system.

---

## 7. Deliverables & Document Control
*Phase: All design phases + CA. Entities: `Deliverable`, `Document`, `Submittal`, `Revision`. KPIs: `Deliverable Completion Rate`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Issue PDFs/prints by email or hand; **transmittals informal or absent.** Revisions tracked in titleblock. [ASSUMED] | Transmittal templates; sheet index; revision clouds/tables. [ASSUMED] | Formal transmittals, controlled issue registers, distribution matrices. [CONFIRMED — Newforma core] |
| **Tracked** | "What we issued and when" reconstructed from **sent-email folder.** No transmittal register. | Transmittal log spreadsheet. | Transmittal/issue register with audit trail. [CONFIRMED] |
| **Stored** | Email sent items; occasional printed reception register. | Excel log + drive. | DMS/CDE (Newforma, ACC, SharePoint). |
| **Blind spots** | **No defensible record of what was issued** → "you never sent us that" disputes. Current-revision ambiguity. | Register exists; receipt acknowledgement often missing. | Strong; consultant-side receipt confirmation weak. |

---

## 8. Authority Submissions & Approvals (RAJUK / ECPS — Dhaka)
*Phase: Authority Approval (post-CD, often parallel with CD). Entities: `Approval`, `Milestone`, `Submittal`, `Risk`. KPIs: `Milestone Completion Rate`, `Schedule Variance`.*

This is the **#2 priority area (Delivery)** and a top owner concern, so it gets extended treatment.

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | **Two-stage RAJUK process** via the online **ECPS**: (1) Land Use Clearance / Planning Permit (Form 101); (2) Construction Permit (Form 301) needing **5 drawing sets** (Architectural, Structural, Plumbing, Electrical, Fire). Drawings must be **signed by an IAB member**. Small firms often use a **liaison/agent** to shepherd submissions. [CONFIRMED process; liaison ASSUMED] | Same process; in-house staff or dedicated liaison manages follow-ups. [ASSUMED] | Dedicated approvals/liaison team; submission tracking; agency relationships. [ASSUMED] |
| **Tracked** | Status tracked **by phone calls and the liaison's memory**; LUC statutory 30 days (rarely met), CP committee ~45 days, 2–3 months total but variable. [CONFIRMED on timelines] | Spreadsheet of submission dates + status. | Submission register, status dashboard. |
| **Stored** | **ECPS portal + paper receipts + liaison's head + WhatsApp.** | ECPS + spreadsheet + drive. | ECPS + PM register. |
| **Blind spots** | **Where approval is stuck, and for how long, is opaque** — no cycle-time data, no resubmission-cause record. Informal facilitation costs are off-book. Approval delay is the top schedule risk with zero analytics. | Cycle time captured loosely. | Inter-agency dependency tracking still manual. |

**Authority approvals are the dominant schedule milestones in Dhaka.** PracticeLens must model them as first-class `Approval`/`Milestone` records with hard dates, owners, and dependency gating:

| Authority | What | Milestone role |
|---|---|---|
| **RAJUK LUC** ⭐ | Land Use Clearance (Form 101), 24-month validity | Pre-CP gate; project cannot proceed without it |
| **RAJUK CP** ⭐ | Construction Permit (Form 301), 5 drawing sets | The pivotal go-to-construction gate |
| **FSCD design NOC** ⭐ | Fire Service design-stage NOC | Conditional (medium/high-rise, commercial); feeds CP fire set |
| **CAAB height clearance** ⭐ | Within airport OLS zone (much of north/central Dhaka) | Conditional/location; prerequisite to CP for tall buildings |
| **DoE ECC** | Environmental clearance (Green/Orange/Red) | Conditional; mainly large/mixed-use/industrial |
| **Utility connections** ⭐ | DESCO/DPDC, WASA, Titas | Occupancy-stage, tracked near Handover |
| **Land mutation (Namjari)** | e-Namjari pre-condition | Pre-start title gate, blocks submission if unresolved |

Because these run partly in parallel and gate each other, PracticeLens should support **dependency-aware milestones** and a `Risk` flag when an approval exceeds its expected window. This is the single feature most likely to make an owner say "yes."

---

## 9. Resource Planning & Timesheets
*Phase: All phases. Entities: `ResourceAssignment`, `Timesheet`, `Employee`, `Team`. KPIs: `Utilization Rate`, `Billable Utilization`, `Planned vs Actual Hours`, `Resource Capacity`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | **Allocation is verbal** — principal tells staff what to do daily. **Timesheets usually do not exist;** staff are salaried, attendance ≠ project time. [ASSUMED — strong pattern] | Basic resource sheet; timesheets exist but compliance patchy. [ASSUMED] | Formal resource planning + mandatory timesheets feeding utilization. [CONFIRMED] |
| **Tracked** | **Not tracked.** No hours-per-project data exists. | Weekly hours in spreadsheet/Monograph; leakage. | Daily/weekly time entry; utilization computed. Benchmarks: ~81.9% median, 75–90% sweet spot. [CONFIRMED] |
| **Stored** | **Attendance register / nowhere.** Effort in principal's head. | Excel / Monograph / Toggl-type tools. | Deltek, BQE Core, Harvest. [CONFIRMED] |
| **Blind spots** | **The mother of all blind spots:** no timesheets → no actual labour cost → profitability, utilization, fee-adequacy, and capacity are all unknowable. Overtime invisible and unpaid. | Lateness/estimation makes data unreliable → corrupts utilization & billing. [CONFIRMED concern] | Late/padded entry degrades quality. |

**This is the central productization challenge and the reason People is priority #3, not #1.** `Timesheet` data does not exist at the pilot firm, so PracticeLens must *help create it* — but cannot demand whole-firm daily entry on day one (the brief defers firm-wide timesheets to a later expansion). Our wedge: ultra-light, mobile-first effort capture (a few taps: project, phase, hours bucket) for the ~3–10 MVP users, framed as "where did the week go" rather than surveillance. Until coverage is real, every `Utilization Rate` / `EAC` / `Forecast Project Margin` KPI must carry an explicit `Data Completeness Score` and **refuse to render a confident number when hours are missing** (anti-hallucination principle).

---

## 10. Project Accounting & Profitability
*Phase: All phases + closeout reconciliation. Entities: `Invoice`, `Payment`, `Fee`, `Expense`, `Budget`. KPIs: `EAC`, `Forecast Project Margin`, `WIP`, `Unbilled Revenue`, `Invoice Aging`, `Collection Rate`.*

This is **priority #1 (Money)** — the strongest small-firm pain.

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Cash-basis bookkeeping; invoicing on milestones/mobilization advances; **profit judged by "did money come in vs. go out," not per-project.** [ASSUMED] | Bookkeeper tracks invoices/receivables; rough per-project margin. [ASSUMED] | Full project accounting: WIP, earned value, % complete revenue recognition, per-project/phase margin. [CONFIRMED] |
| **Tracked** | Invoices & payments in a **ledger or Excel**; **cost side (labour) not captured** → no true margin. Aged receivables informal. | Invoices + receivables in QuickBooks/Tally/Excel; labour partially loaded. | Net multiplier, overhead rate, profit/project, WIP, AR aging, EVA. [CONFIRMED] |
| **Stored** | **Excel + bank statements + invoice PDFs + accountant's books.** | QuickBooks/Tally + Excel. | ERP (Deltek, BQE Core). [CONFIRMED] |
| **Blind spots** | **Per-project profitability is unknown** because labour cost is uncaptured (see #9). Can't tell which clients/project-types make money. Decisions are anecdotal. | Margin known late, post-project, not in-flight. | Strong; in-flight forecast accuracy is the refinement edge. |

**Dhaka tax mechanics PracticeLens must model on every `Invoice`:** architectural/consultancy services carry **15% VAT** [CONFIRMED]; corporate clients typically also **withhold ~10% AIT/TDS** for residents (~20% non-resident) [CONFIRMED rates, section-level VERIFY], plus VDS may be deducted at source. So the system must separate **gross fee, VAT, VDS withheld, AIT/TDS withheld, and net cash received** — because the withheld AIT directly reduces `Collection Rate` and cash, even though the firm is profitable on paper. Multi-currency (`BDT` default, `USD` for foreign/export-of-service clients) with FX capture at invoice and at settlement is required. The pragmatic accounting source is the **manual-capture + templated Excel/CSV import** layer first (the firm's ledger), with Tally / QuickBooks / Xero connectors as **pluggable, post-MVP**.

---

## 11. Client Communication & Approvals
*Phase: All design phases + CA. Entities: `Decision`, `Approval`, `Meeting`, `Change`. KPIs: `Client Approval Time`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | **Phone, WhatsApp, in-person**; approvals given **verbally** ("client said yes on the phone"). Relationship-driven. [ASSUMED — dominant pattern] | Email + meetings; some written sign-off on key milestones. [ASSUMED] | Formal approval gates, minutes, decision logs, written sign-offs. [CONFIRMED] |
| **Tracked** | **Not tracked.** Decisions reconstructed from chat scrollback or memory. | Email threads + Word minutes. | `Decision`/`Approval` register, action items in PM platform/portal. |
| **Stored** | **WhatsApp, unrecorded phone calls, principal's head.** | Email + drive. | PM platform / client portal / DMS. |
| **Blind spots** | **No audit trail of approvals** → disputes over "you approved this," scope-change denial, payment disputes. Decision latency (`Client Approval Time`) untracked though it's a major schedule driver. | Verbal approvals still slip through. | Decision-latency analytics often weak. |

This is the clearest case for the **manual-capture layer as a first-class connector**: a one-tap "log a client decision" form (what was decided, by whom, when, with an optional WhatsApp screenshot attached as `Document` provenance) turns ephemeral verbal approvals into queryable `Decision`/`Approval` records and makes `Client Approval Time` computable for the first time.

---

## 12. Tendering & Procurement
*Phase: Tender/Procurement (post-approval). Entities: `Submittal`, `Document`, `Contractor`, `Revision`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Often **client/owner runs tender directly**; architect produces BOQ/tender drawings, sometimes recommends known contractors. May be out of scope for small jobs. [ASSUMED] | Architect prepares tender package, issues to bidders, tabulates. [ASSUMED] | Formal tender management: prequalification, BOQ, addenda control, bid tabulation, recommendation report. [CONFIRMED] |
| **Tracked** | Bidder responses in email/Excel if at all; addenda informal. | Bid comparison spreadsheet; addenda log. | Tender register, addenda log, bid analysis. |
| **Stored** | Email + Excel BOQ. | Drive + Excel. | PM/procurement module, DMS. |
| **Blind spots** | Addenda not version-controlled → bidders pricing different scopes. No record of clarification Q&A. | Addenda acknowledgement weak. | Mostly robust. |

Light-touch for the pilot; capture is opportunistic via templated Excel import of a BOQ/bid-comparison sheet.

---

## 13. Construction Administration (CA)
*Phase: Construction Administration. Entities: `SiteReport`, `RFI`, `Submittal`, `Decision`, `Issue`. KPIs: `RFI Aging`, `Submittal Aging`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | Principal/junior does **periodic site visits**; instructions given **verbally on site or via WhatsApp photos**; supervision often light or via a separate site engineer. [ASSUMED] | Assigned CA staff; site visit reports; some formal instructions. [ASSUMED] | Dedicated CA team; structured RFIs, submittals, site instructions, payment certificates; often Procore↔Newforma integration. [CONFIRMED] |
| **Tracked** | **Site decisions captured as WhatsApp photos** and verbal; rarely a formal `SiteReport`. | Site visit report template; instruction log. | Full CA logs in Newforma/ACC; cycle-time metrics. [CONFIRMED] |
| **Stored** | **WhatsApp media, phone photos, occasional Word report.** | Drive + email + Word. | Newforma / ACC / Procore. |
| **Blind spots** | **Near-total documentation gap** — site instructions, as-built deviations, verbal approvals leave no record → liability and quality risk. CA effort vs. CA fee untracked (CA frequently runs at a loss). | Instruction-to-action closure weak. | RFI/submittal turnaround tracked; effort attribution partial. |

A mobile `SiteReport` capture (photo + note + project + date, auto-stamped with provenance) is a natural, high-value extension of the manual-capture layer — and directly addresses the liability gap owners fear.

---

## 14. RFIs, Submittals, Site Reports, Changes & Defects
*Phase: Tender → CA → Closeout (defects). Entities: `RFI`, `Submittal`, `Change`, `Defect`, `Issue`. KPIs: `RFI Aging`, `Submittal Aging`, `Change Exposure`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | These formal mechanisms **barely exist**; questions answered verbally/by WhatsApp; "change orders" negotiated informally; defects noted on a handwritten snag list at the end. [ASSUMED — strong pattern] | Email-based RFIs/submittals; basic logs; snag list in Excel. [ASSUMED] | Formal RFI & submittal logs, change-order register, structured defect lists; Procore logs full RFI history; Newforma↔Procore cut response times ~50%. [CONFIRMED] |
| **Tracked** | **Not tracked as discrete items.** No RFI log, no `Change` log, no submittal register. Defects on **paper.** | Excel logs. | Logs + turnaround KPIs. |
| **Stored** | **WhatsApp, paper, email.** | Excel + email. | Procore / Newforma / ACC. [CONFIRMED] |
| **Blind spots** | **Everything quantitative is missing:** RFI volume/turnaround, `Change Exposure` (uncaptured changes = unbilled work, the prime cause of fee erosion), defect recurrence. No data to defend claims or price future fees. | Logs exist; response-time + cost-of-change rarely analyzed. | Turnaround tracked; cost-of-RFI/rework attribution still hard. |

**`Change Exposure` is the largest silent margin leak** in small-firm work. A lightweight "log a scope change" prompt — capturing the change, who requested it, and whether it was billed — is among the highest-ROI capture forms PracticeLens can ship.

---

## 15. Handover & Project Closeout
*Phase: Handover/Closeout. Entities: `Deliverable`, `Defect`, `Invoice`, `Payment`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | **As-builts often not produced**; handover = final prints + keys; **no formal closeout, no lessons-learned.** [ASSUMED] | As-built + O&M docs handed over; informal closeout. [ASSUMED] | Formal closeout: as-builts, O&M, warranties, final certificate, lessons-learned, archive, final fee reconciliation. [CONFIRMED] |
| **Tracked** | **Not tracked** — project just "ends." Final profitability never reconciled. | Closeout checklist sometimes. | Checklist + post-project review + archived KPIs. |
| **Stored** | Drive/paper; then forgotten. | Drive + checklist. | DMS archive + ERP reconciliation. |
| **Blind spots** | **No post-mortem = no organizational learning.** Fee-vs-actual never closed out (compounds #9/#10). As-built gaps create future liability. | Lessons-learned inconsistent. | Lessons captured but rarely fed back into fee models. |

PracticeLens can add disproportionate value with a simple **project-closeout reconciliation view**: planned fee vs. actual collected vs. captured effort, producing the firm's first-ever "did this project make money?" answer — the learning loop that resets mis-pricing.

---

## 16. Company Management & Executive Reporting
*Phase: Continuous. Rolls up all entities. KPIs: `Project Health Score`, `WIP`, `Invoice Aging`, `Collection Rate`, `Utilization Rate`, `Weighted Pipeline`, `Data Completeness Score`.*

| | SMALL (Dhaka) | MEDIUM | LARGE |
|---|---|---|---|
| **How managed** | **The principal IS the dashboard** — runs the firm from memory and gut feel; checks bank balance and active projects in their head. No reporting cadence. [ASSUMED] | Periodic owner review of finances + project list; basic KPIs. [ASSUMED] | Monthly management reporting: pipeline, backlog, utilization, WIP, AR, profit/project, headcount, forecast. [CONFIRMED] |
| **Tracked** | **Cash position + "how many projects do we have"** — that's it. | Revenue, receivables, a few project margins in Excel. | Full KPI set with drill-down. [CONFIRMED] |
| **Stored** | **Principal's head + bank app + Excel.** | Excel / QuickBooks + spreadsheets. | BI dashboards on ERP. [CONFIRMED] |
| **Blind spots** | **No firm-level metrics exist.** Cannot answer: are we profitable, over/under-staffed, what's our backlog, which work-type pays best. Strategy is intuition. | KPIs lag (monthly/manual), lack drill-down to cause. | Mature; edge is leading vs. lagging indicators. |

This is exactly the layer PracticeLens replaces — the principal's head — with `Project Health Score` and an owner dashboard. But it is only as good as the primitives beneath it, which is why our build order follows Money → Delivery → People → Pipeline, and why **every executive number must cite its source records, dates, calculation logic, and confidence, and refuse to display when the underlying data is absent.**

---

## The Dhaka Small-Firm Reality (WhatsApp / Excel / Paper / Phone)

For our pilot firm (5–30 staff, residential-dominant, full-service), the operational truth is that **almost nothing lives in a structured, queryable database.** The de facto system-of-record hierarchy is:

> **Principal's head > WhatsApp > Email > Excel > Paper/printed register > ECPS portal.**

Concretely:
- **WhatsApp is the primary channel** for client *and* team communication, informal approvals, site photos, and coordination. It is where `Decision`, `Approval`, `Change`, `SiteReport`, and `RFI` data is born — and dies. Critically, the WhatsApp Cloud API has **no message-history/replay** [CONFIRMED]: you cannot backfill prior chats, and the consumer app's existing conversations are not exposed. So WhatsApp is **not an MVP auto-ingest connector**. We capture its content via the **manual-capture layer** (paste/screenshot/quick-form), and only later, opportunistically, consider Cloud-API persistence going forward.
- **Excel and paper** hold the ledger, the (sometimes) sheet index, the snag list, and the bidder comparison. These are reached via **templated Excel/CSV import** — a first-class connector, not an afterthought.
- **Files** are split across Google Drive/Gmail, Microsoft 365/SharePoint/OneDrive/Outlook, and local PCs. The Google and Microsoft connectors give us file-presence and email/calendar metadata — our proxy for design activity and `Client Approval Time`.
- **Bilingual Bangla/English** names and addresses pervade everything, with the **Bijoy(ANSI)↔Unicode incompatibility** [CONFIRMED] as the single biggest data-engineering hazard: store UTF-8, normalize Bijoy→Unicode on ingest, support dual-script fields, and budget human verification for Bengali OCR. Our `ProjectCrossReference` (alias/matching) entity must tolerate the same project appearing as a Bengali name, an English transliteration, and a folder code.

**Why authority approvals dominate the schedule.** Unlike Western markets where the design-to-construction critical path is mostly internal, in Dhaka the **RAJUK LUC and CP gates — plus conditional FSCD, CAAB, and DoE clearances — are external, opaque, and frequently the longest single-line items on the project timeline** (statutory 30 days routinely becoming weeks-to-months, ~45-day committee, 2–3 months total, highly variable). They gate construction start, they gate fee-milestone billing, and their delay is the owner's recurring nightmare with *zero* analytics today. Modelling these as dependency-aware `Approval`/`Milestone` records with expected-vs-actual durations and `Risk` flags is the most defensible "wow" feature for the pilot — it converts the liaison's memory into a tracked, alertable schedule artifact.

---

## Summary: System of Record vs. PracticeLens Capture Strategy

| Area | Typical system of record (small Dhaka firm) | Capture method for PracticeLens | Data-quality risk |
|---|---|---|---|
| 1. BD & lead management | Principal's head, phone contacts, WhatsApp | Manual `Opportunity` form (light) | High — sparse, subjective, easily abandoned |
| 2. Proposals, fees, contracts | Word/PDF on laptop, printed signed copy | Manual capture + templated proposal/fee import; `Fee` engine (%-of-cost, staged, reimbursables) | High — fee basis undocumented; scope baseline absent |
| 3. Project setup | Shared-drive folder name, principal's head | Mandatory low-friction `Project`/`ProjectPhase`/baseline `Budget` setup | High — no baseline = no variance; setup friction risks skipping |
| 4. Design phases | The drawings; principal's head | Phase % via manual update + file-presence inference | Med-High — % complete is gut feel |
| 5. BIM & drawing production | Local PC / network drive / pen drive; filename versions | File-presence via Google/MS Drive connectors (signal only) | High — filename chaos, no API, backup gaps |
| 6. Consultant coordination | WhatsApp, email attachments, verbal | Manual coordination-log form + email metadata | High — born and lost in chat |
| 7. Deliverables & doc control | Sent-email folder, titleblock | Manual transmittal form + file-presence + email | Med-High — no receipt acknowledgement |
| 8. Authority approvals | ECPS portal, paper receipts, liaison's head, WhatsApp | Manual `Approval`/`Milestone` capture, dependency-gated, with expected windows | Med — status known but unstructured; high schedule impact |
| 9. Resource planning & timesheets | Attendance register / nowhere; principal's head | **New** ultra-light mobile `Timesheet` capture (MVP users only) | Very High — data does not exist; must be created; adoption-fragile |
| 10. Project accounting & profitability | Excel, bank statements, invoice PDFs, accountant's books | Templated Excel/CSV import + manual `Invoice`/`Payment`; Tally/QBO/Xero pluggable later | High — labour cost missing; tax withholding mis-modelled if naive |
| 11. Client communication & approvals | WhatsApp, unrecorded calls, principal's head | One-tap `Decision`/`Approval` capture + screenshot provenance | Very High — verbal, ephemeral, no backfill |
| 12. Tendering & procurement | Email, Excel BOQ | Templated Excel import (opportunistic) | Med — informal, often out of scope |
| 13. Construction administration | WhatsApp photos, occasional Word report | Mobile `SiteReport` capture (photo + note, stamped) | High — near-total documentation gap |
| 14. RFIs / changes / defects | WhatsApp, paper, email | Manual `RFI`/`Change`/`Defect` capture; `Change Exposure` prompt | Very High — unbilled scope is the silent leak |
| 15. Handover & closeout | Drive/paper, then forgotten | Closeout reconciliation view (planned vs. actual fee/effort) | Med-High — never reconciled today |
| 16. Company mgmt & exec reporting | Principal's head + bank app + Excel | Roll-up dashboard with `Data Completeness Score` + source citation | High — quality inherited from all the above |

**The through-line for the build:** PracticeLens does not win by integrating APIs the firm's tools do not expose. It wins by making the **manual-capture layer and templated Excel/CSV import as frictionless and trustworthy as the Google/Microsoft connectors**, turning WhatsApp/phone/paper exhaust into the firm's first real dataset — every record carrying provenance, every KPI carrying a `Data Completeness Score`, and the system honestly refusing to answer when the data simply is not there.
