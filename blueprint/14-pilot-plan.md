# Pilot Implementation Plan

> **Scope.** How PracticeLens actually lands inside the first Dhaka firm. This section turns the architecture into an executable onboarding sequence: a 13-step plan (each with activities, owner, duration, output), a precise "what we must request from the firm" checklist, a pilot RACI, a ~10-week timeline, quantified success metrics, and a change-management plan that confronts the two hardest human realities — staff resistance and the fact that **Timesheets do not exist yet**.
>
> **The framing constraint.** This is a single-tenant pilot inside a 5–30 person practice where, per the research, the data ladder is `principal's head > WhatsApp > email > Excel > paper > ECPS portal` and *almost nothing sits in a queryable database*. The pilot is therefore not "connect the systems." It is **"create the firm's first real dataset"** — and the riskiest line items are not API scopes but human habit. We sequence accordingly: **Money first** (where the pain and the existing-ish data both are), then **Delivery** (approvals/milestones), with **People** (utilization) seeded by bootstrapping the first effort data the firm has ever captured. Pipeline is out of pilot scope.
>
> **Cast (consistent with §04 personas).** Firm side: **Company Owner** (also MD/BD/Design Lead), **Project Director/Manager**, **Project Architect**, **Finance/Admin** (often a part-time bookkeeper or the owner's admin), and the firm's **liaison/agent** for RAJUK. PracticeLens side: **Implementation Lead** (the embedded consultant, on the ground in Dhaka), **Data Engineer**, **Product/AI Engineer**, **Founder/CTO** (sponsor escalation).

---

## 0. Pilot operating assumptions

- **Single firm, single tenant, multi-tenant-ready schema.** Every record still carries `Company`/tenant scoping and provenance (`DataSource`, `IntegrationRecord`, observed-at, confidence) from day one — we do not retrofit this.
- **~10 working weeks of intensive onboarding** sit inside the broader ~6-month pilot. Weeks 1–10 get the firm to "live and trusted on Money + Delivery." Months 3–6 are stabilisation, the People/Timesheet ramp, and productization learning — not covered minute-by-minute here.
- **Connector phasing inherited from §08:** P1 = Manual Capture Layer (smart forms + templated Excel/CSV + forward/screenshot capture) + finance-via-export. P2 = Google **or** Microsoft cloud connector (whichever the firm actually runs) + email/calendar + file-presence. WhatsApp Cloud API, Tally XML/live, QBO/Xero, PM tools, APS/Procore/Deltek = **Later**.
- **Read-only-first.** PracticeLens never writes to a source system in the pilot. The originals stay the system of record.
- **Data residency.** Default host **ap-south-1 (Mumbai)** for lowest RTT to Dhaka; PDPO 2025 (enacted Nov 2025, amended Feb 2026) localization is risk-based — ordinary project/finance data may sit abroad, but we **minimise and segregate sensitive identifiers** (NID, TIN, passport) and avoid ingesting them at all in the pilot.

---

## 1. The 13 onboarding steps

> Durations are working-day estimates for the embedded team. Many steps overlap (see timeline §4). "Output" is the concrete artifact that must exist before the next dependent step starts.

### Step 1 — Stakeholder interviews
| | |
|---|---|
| **Activities** | Structured 45–60 min interviews with Company Owner, each Project Director/Manager, one or two Project Architects, and Finance/Admin. Map how each of the 16 operational areas (BD → closeout) *actually* runs today; locate every blind spot; capture the owner's top 5 questions they "can't answer today" (these become the pilot's first AI prompts and acceptance tests). Confirm priority order (Money → Delivery → People). Identify the firm's **internal Champion** and any likely resistors. |
| **Owner** | Implementation Lead (lead); Founder/CTO joins the Owner interview. |
| **Duration** | 4–5 days (incl. scheduling slack around site visits). |
| **Output** | **Current-state map** (per-area: how-managed / where-data-lives / blind-spots), prioritised pain list, named Champion, a "Top 10 questions the Owner wants answered" doc that seeds UAT acceptance criteria. |

### Step 2 — Existing software inventory
| | |
|---|---|
| **Activities** | Enumerate every tool in use and its *real* role: design/BIM (AutoCAD/SketchUp/some Revit/D5 — file-presence only); cloud suite (Google Workspace vs Microsoft 365 vs both vs local file server — **decide which single cloud connector the pilot builds**); accounting (Excel registers vs Tally/TallyPrime vs QuickBooks/Xero — almost certainly export-based, not live API); comms (WhatsApp is primary; email; phone); any PM tool (Trello/Asana/etc., usually none or abandoned). Record versions (Tally version matters), license seats, who administers each. |
| **Owner** | Data Engineer (lead); Finance/Admin and the Owner supply credentials-context. |
| **Duration** | 2–3 days (runs parallel with Step 1). |
| **Output** | **Tool inventory matrix** (tool, version, role, owner, admin contact, connector decision: P1/P2/Later/none), and a one-line verdict: *"Cloud connector = Google"* (or Microsoft), *"Finance = Tally export weekly"*. |

### Step 3 — Data access assessment
| | |
|---|---|
| **Activities** | For each P1/P2 source, confirm we can actually get the data: who owns the Google/Microsoft tenant admin; whether OAuth admin-consent is achievable; whether Tally export config is consistent; whether finance Excel is one file or fifteen; whether files are bilingual/Bijoy-encoded; whether anything contains sensitive identifiers we must refuse to ingest. Flag blockers early (e.g., "no one has Workspace super-admin," "Tally is on one machine that is off most evenings"). |
| **Owner** | Data Engineer + Implementation Lead. |
| **Duration** | 2–3 days (parallel with Steps 1–2). |
| **Output** | **Access & risk register**: per-source access path, owner, blocker/no-blocker, Bijoy/Unicode flag, residency/sensitivity flag, and a remediation action per blocker. |

### Step 4 — Project naming & identity audit
| | |
|---|---|
| **Activities** | Pull the firm's project list from wherever it lives (Owner's head, a master Excel, folder names like `Gulshan_Apt_Mr_Karim_final2`). Reconcile the **many names one project has** — folder name vs invoice client name vs WhatsApp shorthand vs RAJUK file number. Establish a **canonical `Project` record** per real project and seed `ProjectCrossReference` (alias/matching) rows so the file-presence, finance, and manual-capture data later resolve to the same project. Define a go-forward naming convention (project code + human label, bilingual-safe). |
| **Owner** | Implementation Lead + Project Director/Manager (who know the aliases). |
| **Duration** | 3–4 days. |
| **Output** | **Canonical project register** (active + recently-closed), populated `ProjectCrossReference` alias table, a one-page **naming convention** the firm agrees to use going forward. *This is the spine everything else hangs on — skipping it guarantees mismatched data later.* |

### Step 5 — KPI workshop
| | |
|---|---|
| **Activities** | Half-day workshop with Owner + Finance/Admin + a Project Director. Walk the canonical KPI list and **mark each as: computable now / computable after bootstrap / not yet (data absent)**. Be ruthlessly honest: `Forecast Project Margin`, `Utilization Rate`, `Billable Utilization`, `Planned vs Actual Hours`, `EAC` are **not computable** until Timesheets exist — say so. `Invoice Aging`, `Collection Rate`, `WIP`, `Unbilled Revenue`, `Fee Burn Rate (fee-only)`, `Milestone Completion Rate`, `Client Approval Time`, `Data Completeness Score` **can** be computed from P1 data. Agree the **Data Completeness Score** as the headline "how much can you trust this yet" metric. |
| **Owner** | Implementation Lead (facilitates); Product/AI Engineer (records calc logic + anti-hallucination refusal rules). |
| **Duration** | 1 day (0.5 day workshop + 0.5 day write-up). |
| **Output** | **KPI status sheet**: per-KPI {definition, source entities, computable-now? Y/N, what-unblocks-it}, plus the agreed anti-hallucination refusal language for the not-yet KPIs. |

### Step 6 — Dashboard prioritization
| | |
|---|---|
| **Activities** | Translate the KPI status sheet into the dashboards we ship in the pilot, sequenced. **Money first**: Owner "Firm Cockpit" (cash, Invoice Aging BDT/USD, Collection Rate, WIP, Unbilled Revenue, per-project Fee Burn with Data Completeness badge). **Delivery second**: Approvals/Milestone board (RAJUK LUC/CP, FSCD NOC, CAAB, DoE, utilities) + deliverable/drawing status from file-presence. **People third (seeded, not full)**: a Utilization placeholder that visibly says "needs Timesheet data — start here." Each tile shows provenance + confidence. |
| **Owner** | Product/AI Engineer + Implementation Lead; Owner signs off priority. |
| **Duration** | 2 days. |
| **Output** | **Dashboard backlog** (ordered), wireframe sign-off for the Money cockpit and the Approvals board, explicit "deferred to People ramp" list. |

### Step 7 — Connector setup
| | |
|---|---|
| **Activities** | Stand up P1 first: deploy the **Manual Capture Layer** (smart forms for `Approval`, `Decision`, `Change`, `SiteReport`, bootstrap `Timesheet`), build/issue the **templated Excel/CSV importers** (project register, fee schedule, invoice/payment ledger, expense, drawing index), and the **forward/screenshot capture** path. Configure the **finance export pipeline** (Tally → weekly XLSX/CSV → importer, or Excel registers directly). Then P2: OAuth + admin-consent the chosen **cloud connector** (Google *or* Microsoft) read-only scopes, wire **file-presence** delta + **email/calendar** read. Verify rate-limit/throttle handling and idempotent re-import. |
| **Owner** | Data Engineer (lead); Product/AI Engineer (forms/UI); firm's tenant admin grants consent. |
| **Duration** | 5–7 days (P1 ~3–4d, P2 ~2–3d), overlapping import work. |
| **Output** | **Working P1 connectors + chosen P2 cloud connector**, each emitting `IntegrationRecord`s with provenance; a connector-health view; documented OAuth scopes + Tally export config. |

### Step 8 — Historical data import
| | |
|---|---|
| **Activities** | Backfill the spine: load the canonical `Project`/`ProjectCrossReference`; import **12–24 months** of `Invoice`/`Payment`/`Fee`/`Expense` from finance exports (enough to compute aging and collection trends); import the `Drawing`/sheet index; ingest a window of file-presence metadata; capture a starter set of open `Approval`/`Milestone` records (RAJUK/FSCD status per active project) via smart forms with the liaison. **Normalise Bijoy/ANSI → Unicode on ingest**; store bilingual name fields (Bengali + Latin). Capture FX rate at invoice date for any USD invoices. *We do not attempt WhatsApp history — no backfill path exists; capture is forward-only.* |
| **Owner** | Data Engineer (lead); Finance/Admin validates finance figures; liaison supplies approval status. |
| **Duration** | 4–6 days. |
| **Output** | **Loaded historical dataset** with provenance, Bijoy-converted text, FX-stamped USD invoices, and a documented "what we could NOT backfill" list (esp. WhatsApp, verbal approvals, labour cost). |

### Step 9 — Data validation
| | |
|---|---|
| **Activities** | Reconcile against the firm's own truth: do PracticeLens AR totals match the Finance/Admin's receivables figure? Do active-project counts match the Owner's mental list? Spot-check 10–15 invoices end-to-end (gross fee, VAT 15%, AIT/VDS withheld, net cash). Validate alias matching (no project double-counted, none missing). Sanity-check the **Data Completeness Score** per project. Run the anti-hallucination refusal tests: ask the AI a margin question on a project with no Timesheet data and confirm it **refuses and names the gap** rather than guessing. |
| **Owner** | Data Engineer + Implementation Lead; Finance/Admin + Owner are the human ground-truth. |
| **Duration** | 3–4 days. |
| **Output** | **Validation report**: reconciliation deltas (target: AR within tolerance, project list 100% matched), corrected records, signed-off "numbers we trust" baseline, confirmed refusal behaviour. |

### Step 10 — UAT (User Acceptance Testing)
| | |
|---|---|
| **Activities** | Owner and at least one Project Director/Manager + Finance/Admin run the system against the **"Top 10 questions"** from Step 1 and the prioritised dashboards. Each acceptance test = a real question with a known-or-verifiable answer, checked for *correctness + cited provenance + honest refusal where data is absent*. Log defects; triage fix-now vs post-pilot. |
| **Owner** | Implementation Lead (drives); firm users (test); Product/AI Engineer (fixes). |
| **Duration** | 3–4 days (incl. fix turnaround). |
| **Output** | **Signed UAT results** mapped to the Top-10 questions, defect log with disposition, Owner go/no-go for "daily use." |

### Step 11 — Staff training
| | |
|---|---|
| **Activities** | Role-tailored, short, hands-on. **Owner/Finance** (60–90 min): read the Money cockpit, trust the provenance badges, weekly digest. **Project Director/Architect** (60 min): log Approvals/Decisions/Changes via smart forms, the 60-second-a-day capture habit, reading the Approvals board. **Liaison** (30 min): updating RAJUK/FSCD status. Provide a one-page bilingual quick-reference + a 3-min screen-capture video. Emphasise *why* (the data becomes their first real profitability picture), not just *how*. |
| **Owner** | Implementation Lead; Champion co-presents to build internal ownership. |
| **Duration** | 2 days. |
| **Output** | **Trained users**, bilingual quick-ref card, short how-to videos, the capture habit defined as a daily/weekly ritual with named owners. |

### Step 12 — Pilot monitoring
| | |
|---|---|
| **Activities** | Run the firm live for the remainder of the pilot. Weekly cadence: connector-health check, **Data Completeness Score trend** per project, capture-habit adherence (are Approvals/Decisions/Timesheets actually being logged?), and a standing 30-min check-in with the Champion + Owner. Watch the Timesheet bootstrap adoption curve closely (see §6). Triage incoming defects/requests; tune AI calc logic and refusals from real usage. |
| **Owner** | Implementation Lead (lead); Data Engineer (health); Product/AI Engineer (tuning). |
| **Duration** | Ongoing through pilot months ~2.5–6 (weeks 7–10 in the intensive window, then steady-state). |
| **Output** | **Weekly pilot health report** (adoption, completeness trend, defects, wins), running issue log, accumulating productization learnings. |

### Step 13 — Success evaluation
| | |
|---|---|
| **Activities** | At the end of the intensive window (week 10) and again at pilot close, score against the quantified success metrics (§5). Re-interview Owner + leads: which decisions did PracticeLens change? Did it surface a losing project / overdue approval / stuck collection they'd have missed? Compute ROI proxy (recovered collections, unbilled scope now visible, hours saved). Decide: continue, expand (People/Timesheet full rollout), or pivot. Capture multi-tenant productization backlog. |
| **Owner** | Founder/CTO + Implementation Lead; Owner is the verdict-giver. |
| **Duration** | 2–3 days. |
| **Output** | **Pilot evaluation report**: metric scorecard, qualitative decision-impact evidence, go/expand/pivot recommendation, productization backlog. |

---

## 2. What we must request from the pilot company — checklist

> Hand this to the Owner/Finance/Admin at kickoff. Group it so it's not overwhelming. Mark each item **[blocks Step]** so the firm understands urgency. We request **read-only / least-privilege** everywhere and refuse anything carrying sensitive identifiers we don't need.

### A. Accounts, credentials & scopes (read-only, least-privilege)
| Item | Why / scope | Blocks |
|---|---|---|
| **Cloud suite admin contact + consent** — Google Workspace super-admin *or* Microsoft 365 Entra global admin (whichever the firm runs) | OAuth admin-consent for **read-only** scopes: Drive/SharePoint+OneDrive file *metadata* (presence), Gmail/Outlook mail+calendar read. Service account + domain-wide delegation (Google) or app registration (MS). **No write scopes.** | Step 7 (P2) |
| **Tally / TallyPrime** version + which machine + export access | We use **export only** in the pilot (no live XML). Need someone who can run a consistent weekly export. | Steps 2, 7, 8 |
| **(If used) QuickBooks Online / Xero** company + OAuth | Only if the firm genuinely runs one; otherwise skipped (Later). | (Later) |
| **PracticeLens app accounts** for the 4 MVP personas + liaison | RBAC: finance data restricted to Owner + Finance/Admin; project-level access for leads/architects. | Steps 10–12 |
| **NOT requested:** any source-system *write* access; bank login; client NID/TIN/passport | Read-only-first; data minimisation under PDPO. | — |

### B. Data exports
| Item | Format | Blocks |
|---|---|---|
| **12–24 months** of finance data: invoices, payments/receipts, expenses, ledger/AR | Tally export (XLSX/CSV) or the Excel registers as-is | Step 8 |
| **Fee schedule / basis-of-fee** per active project (% of construction cost or per-sft, staged milestones) | Excel / PDF of proposals | Steps 5, 8 |
| **Drawing / sheet index** if one exists | Excel / titleblock list | Step 8 |
| **Any existing tracker spreadsheets** (project list, approval status, BD list) | Excel / Google Sheets | Steps 4, 8 |

### C. Sample files (for connector + parser design)
| Item | Why | Blocks |
|---|---|---|
| 3–5 **real invoices** (incl. one with VAT + AIT/VDS withholding; one USD invoice if any) | Validate VAT 15% / AIT ~10% / net-cash modelling + FX capture | Steps 7, 9 |
| 3–5 **finance register rows** in their actual messy format | Importer/parser hardening, dirty-cell handling | Step 7 |
| 2–3 **documents/titleblocks containing Bengali (esp. Bijoy/SutonnyMJ) text** | Build & test Bijoy→Unicode normalisation | Steps 7, 8 |
| A typical **WhatsApp approval thread screenshot** (anonymised) | Design the forward/screenshot capture form | Step 7 |

### D. Project list + naming conventions
| Item | Blocks |
|---|---|
| Master **project list** (active + recently closed): real name, client, type (residential/commercial/fit-out/institutional), current phase, RAJUK file no. if any | Step 4 |
| All known **aliases** per project (folder names, WhatsApp shorthand, invoice client names) | Step 4 (`ProjectCrossReference`) |
| Existing **folder/file naming** patterns on Drive/server | Steps 4, 7 |

### E. Org chart & roles
| Item | Blocks |
|---|---|
| Who's who: Owner, project leads/directors, architects, Finance/Admin, the **RAJUK liaison/agent** | Steps 1, 11 |
| Which person wears which hats (hat-stacking is the norm) → maps to the 4 MVP personas + RBAC | Step 11 |
| Who may see **finance** (Owner + Finance/Admin only) vs project-level | RBAC config |

### F. Fee / invoice / payment history
| Item | Blocks |
|---|---|
| Per active project: contracted **Fee**, staged billing milestones, what's been **invoiced** vs **collected** | Steps 8, 9 |
| **Reimbursables** treatment (RAJUK submission costs, printing, model-making — billed separately) | Steps 5, 8 |
| Any **foreign-client / USD** engagements + how FX is handled | Steps 8, 9 |

### G. Current registers / spreadsheets / informal records
| Item | Blocks |
|---|---|
| Any **approval-status register** (RAJUK/FSCD/CAAB/DoE/utilities) — even a WhatsApp note or paper list | Steps 4, 8 |
| Any **decision / client-approval** notes (the verbal-approval reality — whatever exists) | Step 8 (seed only; forward-capture thereafter) |
| Confirmation of **what genuinely does NOT exist** (almost certainly: Timesheets, scope baselines, change log, closeout reviews) | Sets honest expectations + the People ramp |

---

## 3. Pilot RACI

> **R** = Responsible (does the work), **A** = Accountable (one owner, signs off), **C** = Consulted, **I** = Informed.
> Roles: **IL** = PracticeLens Implementation Lead · **DE** = Data Engineer · **PE** = Product/AI Engineer · **CTO** = Founder/CTO (sponsor) · **OWN** = Company Owner · **PDM** = Project Director/Manager · **FIN** = Finance/Admin · **LIA** = RAJUK Liaison.

| Step | IL | DE | PE | CTO | OWN | PDM | FIN | LIA |
|---|---|---|---|---|---|---|---|---|
| 1 Stakeholder interviews | **A/R** | I | C | C | C | C | C | I |
| 2 Software inventory | A | **R** | C | I | C | I | C | I |
| 3 Data access assessment | A | **R** | I | I | C | I | C | I |
| 4 Project naming audit | **A/R** | C | I | I | C | **R** | C | C |
| 5 KPI workshop | **A/R** | C | C | I | C | C | C | I |
| 6 Dashboard prioritization | A | I | **R** | C | **A→sign** | C | C | I |
| 7 Connector setup | A | **R** | R | I | I | I | C | I |
| 8 Historical data import | A | **R** | C | I | I | C | **C** | C |
| 9 Data validation | **A** | R | C | I | C | I | **C/verify** | C |
| 10 UAT | **A/R** | C | R | I | **C/sign** | C | C | I |
| 11 Staff training | **A/R** | I | C | I | I | C | C | C |
| 12 Pilot monitoring | **A/R** | R | R | I | C | C | C | C |
| 13 Success evaluation | A | C | C | **A/R** | **C/verdict** | C | C | I |

*Single-accountable rule honoured: each row has exactly one A (Step 6 & 10 split build-A from sign-off-A deliberately — engineering is accountable for delivery, Owner for acceptance).*

---

## 4. ~10-week pilot timeline (intensive onboarding window)

> Inside the broader ~6-month pilot. Weeks run in parallel where dependencies allow. After week 10 the firm is live on **Money + Delivery**; months 3–6 = the **People/Timesheet ramp** + stabilisation + productization learning.

| Week | Primary focus | Steps active | Milestone / gate |
|---|---|---|---|
| **1** | Discovery: interviews + tool inventory + access assessment (all parallel) | 1, 2, 3 | Current-state map + tool verdict + access risk register done |
| **2** | Project naming audit + KPI workshop | 4, 5 | Canonical project register + `ProjectCrossReference` + KPI status sheet locked |
| **3** | Dashboard prioritization + start P1 connector build (forms, importers) | 6, 7 | Money cockpit + Approvals board wireframes signed; P1 forms live in staging |
| **4** | Finish P1 connectors; begin finance + project backfill | 7, 8 | Manual Capture Layer + finance import pipeline working; spine loaded |
| **5** | P2 cloud connector (Google **or** MS) consent + file-presence + email/calendar | 7, 8 | Chosen cloud connector live, read-only, emitting `IntegrationRecord`s |
| **6** | Complete historical import; Bijoy→Unicode; FX stamping | 8, 9 | Historical dataset loaded; backfill-gap list (incl. WhatsApp) documented |
| **7** | Data validation + reconciliation against firm truth; refusal tests | 9 | AR/project-list reconciled within tolerance; anti-hallucination refusals verified |
| **8** | UAT against the Top-10 questions; defect fixes | 10 | Owner go/no-go for daily use |
| **9** | Staff training (role-tailored) + Timesheet bootstrap kickoff | 11, (6→) | Users trained; capture habit + Timesheet pilot group started |
| **10** | Go-live monitoring + first success checkpoint | 12, 13 | Week-10 metric scorecard; continue/expand/pivot read |

**Buffer reality check:** Dhaka-specific slippage risks — tenant admin unreachable, Tally on an off-hours machine, the liaison being the only source of approval status, Bijoy-encoded files multiplying parser work. Hold **3–5 days of float** across weeks 4–7; do not let connector polish block the validation gate.

---

## 5. Quantified success metrics

> Two tiers: **adoption/data-health** (did the firm actually start capturing?) and **decision-value** (did it change anything?). Targets are for the week-10 checkpoint unless noted "pilot-end."

| # | Metric | Target | How measured |
|---|---|---|---|
| 1 | **Data Completeness Score** (Money lane) for active projects | **≥ 70%** by week 10 | Per-project completeness rollup |
| 2 | **Active projects on the canonical spine** (no aliasing errors) | **100%** matched, **0** double-counts | Step 4/9 reconciliation |
| 3 | **AR reconciliation accuracy** vs Finance/Admin's own figure | **within ±2%** | Step 9 validation |
| 4 | **Approval/Decision capture** via smart forms (Delivery lane) | **≥ 80%** of active projects have current RAJUK/FSCD status logged | Approvals board coverage |
| 5 | **Capture-habit adherence** (Approvals/Decisions/Changes logged weekly) | **≥ 1 entry/active project/week** sustained 3+ weeks | Pilot monitoring log |
| 6 | **Timesheet bootstrap adoption** | **≥ 60%** of the pilot user group logging effort weekly by pilot-end (see §6) | Timesheet capture rate |
| 7 | **Daily/weekly active use** of dashboards | Owner + ≥1 lead + Finance use weekly; **≥ 70% WAU** of provisioned users | App usage telemetry |
| 8 | **UAT acceptance** | **≥ 8 of 10** "Top-10 questions" answered correctly with cited provenance (or honest refusal) | Step 10 |
| 9 | **Anti-hallucination integrity** | **0** fabricated figures in UAT + monitoring; every not-yet KPI refuses + names the gap | Refusal test suite |
| 10 | **Decision-impact (qualitative→counted)** | **≥ 3** concrete actions the Owner attributes to PracticeLens (e.g., chased a 90-day overdue invoice, caught a stalled RAJUK CP, spotted an unbilled scope `Change`) | Step 13 interview |
| 11 | **ROI proxy** (pilot-end) | Surfaced **collections recovered + unbilled scope made visible** ≥ a stated multiple of pilot cost (firm-specific; capture in BDT) | Step 13 |
| 12 | **Connector health** | **≥ 99%** successful scheduled imports; failed imports auto-retried + flagged | Connector-health view |

If metric 6 (Timesheet adoption) underperforms, that is a **finding, not a failure** — it directly informs the People-lane productization design.

---

## 6. Change-management plan

> The architecture is the easy part. The pilot lives or dies on two human problems: **staff don't want another system**, and **Timesheets — the keystone of the entire People/Money story — do not exist and have never existed here.** Both are addressed head-on.

### 6.1 Employee resistance — diagnosis
In a 5–30 person Dhaka practice, staff are salaried, design-focused, WhatsApp-native, and have *never* been asked to log their work. Predictable objections: *"this is surveillance,"* *"I don't have time,"* *"the principal already knows what I'm doing,"* *"we tried Trello and dropped it."* The Owner setting Fees "by feel" has also never needed staff data, so top-down enforcement has no precedent. Forcing a heavyweight system would replay the abandoned-Trello pattern.

### 6.2 Resistance — countermeasures
| Lever | Action |
|---|---|
| **Reduce, don't add** | PracticeLens is a *layer*, not a new place to work. Capture rides on existing habits: forward a WhatsApp message, paste a screenshot, fill a 4-field form. **Target < 60 seconds/day** of new effort per person. The original tools stay the source of truth. |
| **Lead with the win, per persona** | Owner: first-ever per-project money picture. Project leads: stop being blamed for slips they can now *show* were approval-stalled. Architects: a defensible record of what was issued/approved (ends "you never sent us that" disputes). Frame capture as *protecting them*, not watching them. |
| **Champion-led, not vendor-led** | The internal Champion (Step 1) co-runs training and the weekly check-in. Adoption asks come from a colleague, not an outside consultant. |
| **Visible early value (< 2 weeks of go-live)** | Ship the Money cockpit first so the Owner sees overdue collections and stuck approvals immediately — proof the data is worth the keystrokes. |
| **No-blame data culture** | Explicitly state captured data is for *firm profitability and protecting staff from disputes*, **not** individual performance policing in the pilot. The provenance/confidence + honest-refusal design reinforces "we show the truth, including what we don't know." |
| **Make abstention visible, not punished** | The Data Completeness Score makes gaps obvious without naming-and-shaming individuals — the firm self-corrects because incomplete data yields weaker answers. |

### 6.3 The "Timesheets do not exist" problem — the central change challenge
Per the research, **no timesheets ⇒ no labour cost ⇒ no `Forecast Project Margin`, `Utilization Rate`, `Billable Utilization`, `Planned vs Actual Hours`, or `EAC`.** This is the single largest blind spot and the upstream cause of small-firm unprofitability. PracticeLens cannot integrate data that was never recorded — it must **help create it**. A frontal "everyone fills detailed timesheets now" mandate will fail. The ramp:

| Stage | What we ask | Why it works |
|---|---|---|
| **0. Honest framing (KPI workshop, Step 5)** | State plainly: People-lane KPIs are *not computable today*; the AI will refuse to fake them. | Sets expectation; the refusal behaviour builds trust rather than overpromising. |
| **1. Ultra-light bootstrap (weeks 9+)** | A daily/end-of-day **smart form**: "what project(s) did you touch today?" — pick from the canonical project list, drag a rough %/hours split. **No task-level granularity.** Optionally a Friday weekly recap instead of daily. | Lowest possible friction; matches the firm's informality; produces the firm's *first ever* effort dataset. |
| **2. Pilot group, not whole firm** | Start with the Project Directors/Managers + 1–2 willing Architects (the MVP user set), **not** all staff. | Whole-firm timesheet entry is an explicit *later* expansion per the brief; a small group proves value first. |
| **3. Show the payoff fast** | As soon as ~2–3 weeks of effort data exists, light up a *provisional* `Forecast Project Margin` / `Planned vs Actual Hours` for one project — with a low Data Completeness badge — so the team **sees their inputs become the answer the Owner always wanted.** | Closes the loop: effort logging visibly produces the profitability picture, converting it from chore to leverage. |
| **4. Owner reinforcement** | Owner publicly uses the new margin view in a team meeting and ties one decision to it. | Signals the data matters at the top; sustains the habit. |
| **5. Ramp granularity later** | Only after the habit holds do we consider phase-level or finer time capture — and only if the firm asks. | Avoids over-engineering the very behaviour we're trying to establish. |

### 6.4 Governance & comms cadence
- **Kickoff**: Owner-sponsored all-hands (15 min) framing *why* — "we're going to find out, for the first time, which work actually makes us money, and protect you from disputes." Sponsorship from the top is non-negotiable.
- **Weekly**: 30-min Champion + Owner check-in (adoption, wins, blockers); one celebrated win per week shared with staff.
- **Defect/request channel**: a single WhatsApp/email line to the Implementation Lead — meet the firm where they already communicate.
- **Exit comms (Step 13)**: share the scorecard *with the staff*, crediting their capture for the insights — reinforcing the loop before any People-lane expansion.

---

## 7. Open dependencies carried into the pilot

- **Cloud connector decision (Google vs Microsoft)** is firm-specific and confirmed only at Step 2 — both connectors are designed pluggable, but the pilot builds **one** first.
- **Tally availability & version** determines whether finance export is smooth or painful; confirm at Step 2/3.
- **Liaison reliance**: RAJUK/FSCD status currently lives with one agent — single point of failure for the Delivery lane until smart-form capture is habitual.
- **IAB fee-scale specifics, exact AIT/TDS sections, CAAB OLS limits** (per research [VERIFY] items) affect Fee/invoice modelling fidelity — obtain primary docs during the pilot, don't hard-code assumptions.
- **PDPO sensitive-identifier handling**: confirm the firm holds no client NID/TIN we'd inadvertently ingest; if it does, segregate or exclude before import.
