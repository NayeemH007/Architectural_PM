# Users & Stakeholder Analysis

> **Scope.** PracticeLens is a read-only-first, AI-powered reporting & analytics layer for a small Dhaka architecture practice (5-30 staff), built single-tenant for the pilot but multi-tenant-ready. This section profiles all 13 canonical user roles. For each: the decisions they own, the information they cannot currently reach, the dashboards they need, the reports they should receive, the alerts that matter, and 4-6 questions they must be able to ask the AI.
>
> **The hat-stacking reality.** In a firm this size, one person wears 3-6 hats. The Company Owner is usually also the Managing Director, the lead Business Development person, and frequently the senior Design Lead. A single Project Director may also be the Project Manager and BIM Manager. There is almost never a dedicated HR/Resource Manager, Construction Administration lead, or Department Head — those are functions, not seats. The MVP therefore ships **four real personas** (Owner, Project Director/Manager, Project Architect, Finance/Admin) and models the other nine as *role capabilities* that collapse onto those four seats now and split out during productization for medium/large firms.
>
> **Anti-hallucination contract (applies to every AI answer below).** Every figure the AI returns must cite the source records (entity + DataSource + IntegrationRecord), the dates, the calculation logic, and a confidence band. When the underlying data does not exist — the dominant case in a small Dhaka firm, where labour cost, approval cycle-time, and verbal client approvals are uncaptured — the AI must *refuse and name the gap* ("I cannot compute Forecast Project Margin because no Timesheet data exists for this Project; the last Fee record is dated 2026-03-11"), never fabricate. The honest "we don't know yet, here's how to start capturing it" answer is a feature, not a failure.

---

## MVP roles vs. later roles — at a glance

| # | Canonical Role | MVP? | Collapses onto (small firm) | Primary priority lane |
|---|---|---|---|---|
| 1 | Company Owner | **IN MVP** | self (also MD, BD, Design Lead) | Money |
| 2 | Managing Director | Later (own seat at medium+) | Company Owner | Money / Delivery |
| 3 | Project Director | **IN MVP** (as Project Director/Manager) | self (also PM, sometimes BIM Mgr) | Delivery |
| 4 | Project Manager | **IN MVP** (merged with Director) | Project Director | Delivery |
| 5 | Design Lead | Later | Company Owner / Project Director | Delivery |
| 6 | Project Architect | **IN MVP** | self (also drafter, coordinator) | Delivery / People |
| 7 | BIM Manager | Later | Project Architect / Project Director | Delivery |
| 8 | Finance Team | **IN MVP** (as Finance/Admin) | self (often a part-time bookkeeper or the Owner's spouse/admin) | Money |
| 9 | Business Development | Later | Company Owner | Pipeline |
| 10 | HR/Resource Manager | Later | Company Owner / Project Director | People |
| 11 | Construction Administration | Later | Project Architect / Project Director | Delivery |
| 12 | Department Head | Later | Project Director | Delivery / People |

The MVP four (#1, #3+#4, #6, #8) cover the **Money** and **Delivery** lanes end-to-end and seed the **People** lane (by bootstrapping the first Timesheet data the firm has ever had). **Pipeline** roles (#9) and reporting-only executive roles (#2) are deliberately deferred.

---

## 1. Company Owner — **IN MVP** (highest priority persona)

> In the pilot firm this person also signs every Contract, sets every Fee "by feel," runs Business Development from their phone contacts, and is often the senior Design Lead. They *are* the firm's current dashboard — running everything from memory, the bank app, and a few Excel sheets.

| Aspect | Detail |
|---|---|
| **Decisions they own** | Which Opportunities to pursue; what Fee to quote and on what basis; which Projects to staff and whom to assign; when to push a Client for Payment; whether the firm can take on more work; whether a Project is profitable enough to continue; hiring/firing; cash-runway calls. |
| **Information they struggle to access** | True per-Project profitability (no labour cost exists → no Forecast Project Margin); whether the Fee covers the effort it implied; total cash tied up in Work in Progress (WIP) and Unbilled Revenue; aged receivables across BDT and occasional USD invoices; which Projects are silently slipping on RAJUK/FSCD approvals; firm-wide capacity. All of this lives in their head, WhatsApp, or scattered Excel. |
| **Dashboards** | **Firm Cockpit**: cash position + Collection Rate + Invoice Aging (BDT/USD), Forecast Project Margin per active Project (with Data Completeness Score badge), WIP & Unbilled Revenue, Project Health Score grid, upcoming Milestones/Approvals (RAJUK LUC/CP, FSCD NOC, CAAB) at risk, Weighted Pipeline. One screen, owner-only finance visibility. |
| **Reports received** | Weekly "Money Monday" digest (collections, overdue invoices, WIP); monthly firm P&L-style rollup with per-Project margin where computable; monthly portfolio health & approvals status. |
| **Alerts** | Invoice crossing 60/90 days overdue; a Project's Forecast Project Margin turning negative; a major Approval Milestone (RAJUK CP, FSCD design NOC) overdue or query-stalled; Fee Burn Rate exceeding fee on any Project; cash-in below a threshold for the month. |
| **Example AI questions** | 1. "Which three Projects are losing me money right now, and what's the evidence?" 2. "How much cash is stuck in unpaid invoices over 60 days, in BDT and USD separately?" 3. "Can we take on the new Gulshan apartment job, or are my project leads already over capacity?" 4. "Which RAJUK or Fire Service approvals are overdue and on which Projects?" 5. "What did we quote vs. what have we actually spent on the Banani fit-out?" 6. "Show me every Project where I'm missing the data to even judge profitability." |

---

## 2. Managing Director — *Later (own seat at medium+ firms)*

> In the pilot, indistinguishable from the Company Owner. Splits out when a firm hires professional management above project leads. Productization role.

| Aspect | Detail |
|---|---|
| **Decisions they own** | Operational targets (utilization, backlog months); resourcing across studios/Offices; go/no-go on large pursuits; process & policy. |
| **Information they struggle to access** | Leading vs. lagging indicators; Resource Capacity vs. committed backlog; cross-Office utilization; realistic delivery forecasts. |
| **Dashboards** | Operations cockpit: Utilization Rate & Billable Utilization (firm/team), Resource Capacity heatmap, backlog-in-months, Schedule Variance across portfolio, Milestone Completion Rate. |
| **Reports received** | Monthly management pack (utilization, backlog, WIP, AR aging, win rate, profit/Project); quarterly trend review. |
| **Alerts** | Firm utilization drifting below the 75% healthy floor or above 90% (burnout/overcommit); backlog falling below N months; portfolio Schedule Variance worsening. |
| **Example AI questions** | 1. "What's our firm-wide Billable Utilization this quarter vs. the 75-85% healthy band?" 2. "How many months of backlog do we have at current burn?" 3. "Which teams are over- or under-loaded next month?" 4. "Which service type — residential, fit-out, institutional — gives us the best margin per hour?" |

---

## 3 & 4. Project Director / Project Manager — **IN MVP** (merged persona, second-highest priority)

> The pilot treats Director and Manager as one seat: the person accountable for delivering a set of Projects on time, on fee, and through the authorities. Often also acts as BIM Manager and Design Lead. This is the **Delivery** lane owner.

| Aspect | Detail |
|---|---|
| **Decisions they own** | Phase sequencing (Concept → Schematic → DD → Authority Approval → CD → Tender → CA → Handover); who works on what this week (ResourceAssignment); when a Deliverable/Drawing set is ready to issue; when to escalate a stalled Approval or a slow Consultant; when to flag scope creep to the Owner for a Change/variation. |
| **Information they struggle to access** | Real % complete per ProjectPhase (today it's gut feel); planned vs. actual hours (no Timesheet baseline); where exactly a RAJUK/FSCD submission is stuck and for how long; Client Approval Time and Consultant Response Time (buried in WhatsApp); current Drawing Revision status (tracked by filename `_final_v3`); whether scope has crept beyond the Contract. |
| **Dashboards** | **Delivery board** per Project: ProjectPhase progress with Schedule Variance, Milestone/Approval tracker (RAJUK LUC/CP dates, FSCD, CAAB, DoE, utility connections), Deliverable Completion Rate, Drawing Revision Rate, Task Overdue Rate, Consultant Response Time, Client Approval Time, Planned vs. Actual Hours where available. |
| **Reports received** | Weekly delivery status per Project (phase, milestones at risk, overdue tasks, pending client/consultant responses); approvals cycle-time report; pre-deadline checklist for upcoming issues. |
| **Alerts** | Milestone/Approval due within 7 days or overdue; a Drawing issued at an unverified revision; Client Approval pending > X days on a gating decision; Consultant non-response > X days; Fee Burn Rate outpacing % complete; an uncaptured scope Change detected from a manual-capture form or WhatsApp prompt. |
| **Example AI questions** | 1. "What's blocking the Mirpur project, and how long has it been blocked?" 2. "Which deliverables are due in the next two weeks and which are at risk?" 3. "How long is the structural consultant taking to respond on average this month?" 4. "Is the Dhanmondi project's effort tracking ahead of or behind its fee?" 5. "When did the client last approve anything on this project, and what was it?" 6. "Which RAJUK submission rounds got queried, and what caused the resubmission?" |

---

## 5. Design Lead — *Later (collapses onto Owner / Project Director in pilot)*

| Aspect | Detail |
|---|---|
| **Decisions they own** | Design direction and quality gates between SD/DD/CD; iteration cut-offs; design-review sign-offs. |
| **Information they struggle to access** | Rework/iteration volume per phase (invisible today); effort burned on design vs. fee allocated to design phases; which Decisions were made and by whom. |
| **Dashboards** | Design-phase burn: Planned vs. Actual Hours by phase, iteration/Revision count, Decision log per Project, Deliverable Completion Rate for design sets. |
| **Reports received** | Per-Project design-phase review; rework summary at phase gates. |
| **Alerts** | Design phase exceeding its hour budget; Revision Rate spiking (churn); a design Decision recorded without client sign-off. |
| **Example AI questions** | 1. "How many design iterations did this project go through before DD sign-off?" 2. "Are we over-spending design hours relative to the design portion of the fee?" 3. "What client decisions are still open that block design progress?" 4. "Which project types generate the most rework?" |

---

## 6. Project Architect — **IN MVP** (third priority persona; also the People-lane seed)

> The doer: drafts in AutoCAD, models in SketchUp/Revit, coordinates Consultants over WhatsApp, assembles RAJUK drawing sets, runs site visits. In the pilot this person also generates most of the **manual-capture** data — they are the front line of turning verbal/WhatsApp reality into records, and the first source of Timesheet/effort data the firm will have.

| Aspect | Detail |
|---|---|
| **Decisions they own** | Day-to-day task ordering; which Drawing/Deliverable to produce next; logging Decisions, Approvals, RFIs, SiteReports, and Changes via lightweight forms; flagging when scope or instructions changed on site or in chat. |
| **Information they struggle to access** | Their own task list across multiple Projects in one place; the *current* approved revision of consultant files (latest-file ambiguity); what the client actually approved vs. what they remember; their own logged hours vs. assignment. |
| **Dashboards** | **My Work**: assigned Tasks across Projects with due dates, Deliverable/Drawing checklist per active ProjectPhase, quick-capture buttons (log a Decision, Approval, SiteReport, Change, Timesheet entry), pending Consultant items, latest-revision indicator. Mobile-friendly for site use. |
| **Reports received** | Personal weekly task & deliverable digest; "what I logged this week" effort summary (builds the timesheet habit gently). |
| **Alerts** | Task due today/overdue; a Drawing about to be issued that has an unresolved Revision conflict; a captured WhatsApp/site item awaiting their confirmation; missing Timesheet entries for the week (nudge, not nag). |
| **Example AI questions** | 1. "What are my tasks and deadlines across all my projects this week?" 2. "What's the latest approved version of the structural drawing for this project?" 3. "Did the client approve the kitchen layout change, and where's the record?" 4. "What did I log against the Uttara project last week?" 5. "Which deliverables in the RAJUK set are still incomplete?" 6. "Show me the site instructions I captured on WhatsApp that aren't yet recorded as Changes." |

---

## 7. BIM Manager — *Later (collapses onto Project Architect / Project Director)*

| Aspect | Detail |
|---|---|
| **Decisions they own** | CAD/BIM standards, naming, family/layer conventions; model coordination cadence; what counts as a controlled issue. |
| **Information they struggle to access** | Model/Drawing version history and health (filename-based versioning today); who-drew-what and time-per-sheet; file-presence signals as a proxy for production progress. |
| **Dashboards** | Model/Drawing control: Revision Rate, file-presence/last-modified signals from Drive/SharePoint/OneDrive (AutoCAD/SketchUp/D5 expose no data API — file presence only), issue/version status, sheet-index completeness. |
| **Reports received** | Drawing register status; revision-churn report; (productization) APS/Revit model health when richer connectors come online. |
| **Alerts** | Two "final" versions of the same file detected; a sheet in the index with no corresponding file; stale file on a phase that should be active. |
| **Example AI questions** | 1. "Which drawings have the most revisions this month?" 2. "Are there conflicting 'final' versions of any sheet?" 3. "Which deliverable files haven't been touched since the phase started?" 4. "Is the sheet index complete for the RAJUK construction-permit set?" |

---

## 8. Finance Team / Finance-Admin — **IN MVP** (top-priority persona alongside Owner; **Money** lane co-owner)

> In the pilot this is rarely a "team" — it's a part-time bookkeeper, an admin, or the Owner. They keep invoices and receipts in Excel + bank statements, sometimes Tally/QuickBooks. Finance data is restricted to this role + Owner via RBAC. They must handle the Bangladesh withholding reality: 15% VAT, ~10% AIT/TDS withheld by corporate clients reducing actual cash collected, VDS, and occasional USD export invoices.

| Aspect | Detail |
|---|---|
| **Decisions they own** | When and what to invoice (phase/milestone-triggered Fee billing, % of construction cost, reimbursables as separate lines); recording Payments and reconciling against bank; computing VAT/VDS/AIT withholding and net cash; chasing overdue Clients; FX-rate capture at invoice and at settlement for USD clients. |
| **Information they struggle to access** | A single AR view across Excel/Tally/QuickBooks/bank; net collectible after AIT withholding (gross fee ≠ cash received); which milestones are billable-now but un-invoiced (Unbilled Revenue); Collection Rate trend; matching informal payments to the right Project. |
| **Dashboards** | **Money board**: Invoice Aging buckets (BDT and USD), Collection Rate, Unbilled Revenue & billable-milestone queue, WIP, withholding ledger (VAT collected, VDS, AIT withheld, net cash), per-Client receivables, FX exposure on USD invoices. |
| **Reports received** | Weekly receivables & collections report; monthly billing vs. plan; withholding/tax summary for NBR filing support; reimbursables-pending report. |
| **Alerts** | A milestone became billable but no Invoice raised (revenue leak); Invoice overdue at 30/60/90; a Payment received that can't be matched to a Project/Invoice; AIT-withheld amount needs a certificate from the client; USD invoice settled at an FX rate materially different from invoice date. |
| **Example AI questions** | 1. "Which milestones are billable now but haven't been invoiced?" 2. "What's my total receivable over 60 days, split BDT vs. USD?" 3. "After AIT withholding, how much cash did we actually collect on the Banani contract vs. the gross fee?" 4. "Which payments in the bank statement aren't yet matched to an invoice?" 5. "How much VAT and VDS do I need to account for this month?" 6. "Which clients are consistently the slowest to pay?" |

---

## 9. Business Development — *Later (collapses onto Owner; **Pipeline** lane, lightest, last)*

| Aspect | Detail |
|---|---|
| **Decisions they own** | Which Opportunities to pursue and at what priority; go/no-go; Proposal positioning and Fee strategy; lead-source focus. |
| **Information they struggle to access** | Any pipeline at all (today it's in the principal's head and phone contacts); Proposal Win Rate; cost-of-pursuit (unpaid effort chasing work that never closes); lead-source ROI. |
| **Dashboards** | Pipeline board: Pipeline Value & Weighted Pipeline by stage, Proposal Win Rate, Opportunity aging, source attribution, pursuit-effort vs. win economics (once Timesheets exist). |
| **Reports received** | Pipeline snapshot; win/loss summary; proposal-conversion trend. |
| **Alerts** | An Opportunity stalled in a stage too long; a Proposal awaiting client response past follow-up window; weighted pipeline dropping below backlog-replacement need. |
| **Example AI questions** | 1. "What's our weighted pipeline value right now?" 2. "What's our win rate on residential vs. commercial proposals?" 3. "Which proposals are awaiting a client decision and for how long?" 4. "How much unpaid effort did we spend on opportunities we lost last quarter?" |

---

## 10. HR / Resource Manager — *Later (collapses onto Owner / Project Director; **People** lane)*

> This role barely exists in the pilot firm; the People lane is constrained because **Timesheets do not yet exist** — the platform must help create them before utilization analytics are meaningful.

| Aspect | Detail |
|---|---|
| **Decisions they own** | Staffing and ResourceAssignment across Projects; hiring need; leave/capacity; addressing over- and under-utilization. |
| **Information they struggle to access** | Utilization Rate / Billable Utilization (no labour data); Resource Capacity vs. demand; who is overloaded (overtime is invisible and unpaid today); skills-to-demand matching. |
| **Dashboards** | People board: Utilization Rate & Billable Utilization per Employee/Team vs. the ~75-90% healthy band, Resource Capacity heatmap, assignment load vs. availability, Data Completeness Score for timesheet coverage. |
| **Reports received** | Weekly capacity & utilization; timesheet-compliance report; over/under-allocation summary. |
| **Alerts** | An Employee over 90% sustained (burnout) or under 60% (idle); timesheet compliance below threshold (data trustworthiness); an unstaffed phase starting soon. |
| **Example AI questions** | 1. "Who is overloaded next month and who has spare capacity?" 2. "What's each project lead's utilization this quarter — and how complete is the timesheet data behind it?" 3. "Do we need to hire, given committed backlog?" 4. "Which skills are we short on relative to the pipeline?" |

---

## 11. Construction Administration — *Later (collapses onto Project Architect / Project Director)*

| Aspect | Detail |
|---|---|
| **Decisions they own** | Site-visit cadence; responses to RFIs/Submittals; site instructions and their capture as Changes; payment-certificate recommendations; Defect tracking. |
| **Information they struggle to access** | Any structured CA record (today it's WhatsApp photos and verbal instructions); RFI Aging / Submittal Aging; Change Exposure (uncaptured changes = unbilled work, a prime margin leak); Defect recurrence; whether CA is running at a loss against its fee. |
| **Dashboards** | CA board: RFI Aging, Submittal Aging, open Site Instructions/Changes, Change Exposure (value of pending variations), Defect list with status, SiteReport log, CA Fee Burn Rate vs. CA fee. |
| **Reports received** | Weekly CA log (RFIs, submittals, instructions, defects); change-order register; site-visit summary. |
| **Alerts** | RFI open past response SLA; a site instruction not yet recorded as a Change (unbilled-work risk); Defect unresolved past target; CA effort exceeding CA fee. |
| **Example AI questions** | 1. "Which RFIs and submittals are overdue for response?" 2. "What's the total value of site changes we haven't billed yet?" 3. "What site instructions from WhatsApp this week need to become formal Changes?" 4. "Is construction administration on this project running at a loss?" |

---

## 12. Department Head — *Later (collapses onto Project Director; medium/large firms)*

| Aspect | Detail |
|---|---|
| **Decisions they own** | Department/studio-level resourcing and quality; cross-Project priorities within their domain (e.g., residential vs. commercial studio). |
| **Information they struggle to access** | Department-level rollups of Project Health Score, utilization, margin, and backlog; comparison across the Projects they own. |
| **Dashboards** | Department rollup: portfolio Project Health Score, Schedule Variance, Forecast Project Margin, Utilization Rate, backlog for their department. |
| **Reports received** | Monthly department performance pack; exception list of at-risk Projects. |
| **Alerts** | Any Project in their department turning red on health or margin; department utilization out of band. |
| **Example AI questions** | 1. "How healthy are the projects in my studio overall?" 2. "Which of my projects are at risk on schedule or margin?" 3. "How is my team's utilization trending?" 4. "Which project type in my department is most profitable?" |

---

## Persona-priority matrix — mapped to Money → Delivery → People → Pipeline

> Build sequence follows the owner's pain order. The four MVP personas (bold) are sequenced so the firm gets **Money** visibility first (the strongest small-firm pain and the data that is partially capturable from Excel/Tally/QuickBooks today), then **Delivery** (milestones/approvals + deliverable status), while the MVP simultaneously *seeds* the **People** lane by bootstrapping the firm's first Timesheet data. **Pipeline** is intentionally last and lightest.

| Priority lane | Sequence | Primary persona(s) | MVP status | Why here / data reality |
|---|---|---|---|---|
| **MONEY** | 1 | **Company Owner**, **Finance/Admin** | **IN MVP** | Strongest pain; receivables/fees/WIP partially exist in Excel/Tally/QuickBooks + bank statements, so analytics are achievable early. AIT/VDS withholding and BDT/USD handling baked in. |
| **DELIVERY** | 2 | **Project Director/Manager**, **Project Architect** | **IN MVP** | Deadlines, RAJUK/FSCD/CAAB Approvals as first-class Milestones, Deliverable/Drawing status. Heavy reliance on manual-capture + file-presence signals since CAD/BIM tools expose no data API. |
| **PEOPLE** | 3 | HR/Resource Manager (function); seeded by Project Architect + Project Director | **Seeded in MVP, full role later** | Utilization depends on Timesheets that **do not exist yet** — MVP must *create* the timesheet habit before utilization KPIs are trustworthy. Data Completeness Score gates every People metric. |
| **PIPELINE** | 4 | Business Development | **Later** | Lightest, fewest users; pipeline lives in the Owner's head today. Win-rate/cost-of-pursuit analytics only become meaningful once effort data (Timesheets) exists. |

**Reading the matrix:** the MVP ships four seats covering lanes 1-2 fully and bootstrapping lane 3; the remaining nine canonical roles are role *capabilities* that ride on those seats now and split into dedicated personas during productization for medium and large firms. Across every persona, the binding constraint is the same: in a small Dhaka practice the highest-value data is uncaptured (verbal approvals, WhatsApp decisions, absent timesheets, filename-versioned drawings), so each persona's dashboards carry a visible **Data Completeness Score**, and the AI refuses-with-explanation rather than guesses whenever the records aren't there.
