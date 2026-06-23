# ArchIntel as an AIOS — architecture note (Space Esse)

**Purpose:** align the team and future developers on *what ArchIntel becomes* — not another project-management tool, but an **AI Operating System** for a design studio: the connective tissue that coordinates the studio's data, logic and AI agents so the work largely **runs itself**, and the principals get their time back for design, clients and growth.

**Method (from the AIOS framework):** *built in layers, not leaps.* We **evolve** the ArchIntel we already have — we do not rebuild. Each layer is shippable on its own.

---

## 1. The shift we're making

| | Project-control tool (today) | AIOS (where we're going) |
|---|---|---|
| Role of the software | Organises information | **Runs the operation** |
| Role of AI | A feature (Risk Radar page) | The **operating layer** across everything |
| Role of the human | Does the coordination + the design | Does the **design + the decisions**; AI does the coordination |
| The win | Less lost information | **Flip the 80/20** — less time working *in* the studio, more *on* it |

**The studio's 80/20 problem (the meeting confirmed it):** Fariha and the leads spend most of their day chasing client approvals on WhatsApp, nudging Raiana, chasing payments, hunting for the latest file, and sitting in status meetings. That is the 80% an AIOS removes.

**The guardrail that protects quality:** AI **proposes and prepares; a human approves; then AI executes.** Raiana's design/material gate is never bypassed. Speed comes from removing *coordination and production overhead* — never from skipping judgement. That is how the studio goes **faster + more organised + same quality.**

---

## 2. The five layers, mapped to Space Esse

| Layer | What it does | For Space Esse | Status in ArchIntel |
|---|---|---|---|
| **1 · Context** | Teaches the AI *your* studio | The 4-phase workflow, gate rules, **Raiana = final approver**, quality standards, project types, fee/payment patterns, tone of client messages | **Seeded** (phase templates, roles, settings) → needs an AI-readable "studio brain" — *backend* |
| **2 · Data** | Feeds it real operational state | Projects, files, approvals, payments, client threads — kept current from Drive, WhatsApp, email, Tally | **Substrate built** (mock) → needs real ingestion — *integration* |
| **3 · Intelligence** | Synthesises it into a **daily brief** | "What needs you today, what's at risk, what I've already handled" — the dashboard + Risk Radar | **Built (seed)** — the closest layer to done |
| **4 · Automation** | A **Task Audit** → automate recurring work | Chase approvals, nudge Raiana, chase payments, version files, draft client messages/BOQs — one agent action at a time | **Missing — this is the leap from tool → AIOS** |
| **5 · Build** | Reinvest the recovered time in growth | Take on more projects, lift quality, add services; later: ArchIntel as the AIOS for *other* studios | The outcome we measure |

**Bottom line:** ArchIntel today is **Layers 1–3** (data + a seed of intelligence). The AIOS upgrade is **Layer 4 (Automation)** — which is also exactly the "help them execute their creative work, faster" goal.

---

## 3. The Task Audit (Layer 4 — the heart of it)

Every recurring, human-not-required task at Space Esse becomes a row, scored, and automated **one at a time**. This is the scoreboard.

| # | Recurring task | Owns it now | Cadence | Automatable | Human gate? | ArchIntel agent behaviour |
|---|---|---|---|---|---|---|
| 1 | Chase client for approval on WhatsApp + log the reply | Project Lead | per submission | High | No | Sends the reminder, captures the reply into the client-approval record, advances status |
| 2 | Nudge Raiana's pending queue + assemble the approval package | Fariha / Lead | daily | High | **Yes** (Raiana decides) | Compiles design/material package, queues it, nudges; never decides |
| 3 | Chase overdue payments + flag "progressing without payment" | Fariha / Finance | weekly | High | No | Detects, drafts a polite reminder, flags the project gate |
| 4 | Keep the file register current + version + move finished files central | Everyone | continuous | High | No | Watches Drive, versions, registers, flags local-only/single-person files |
| 5 | Phase-gate checklist nudges to the owner | Lead | per phase | High | No | Nudges on incomplete gate items; blocks advance until the gate clears |
| 6 | Draft the weekly client update / status | Lead | weekly | High | **Yes** (send approval) | Drafts from the week's activity; human sends |
| 7 | Compile requirement doc / finish schedule / BOQ draft | Lead / Fariha | per project | Medium | **Yes** (refine) | Drafts the first version; human refines — *creative execution, accelerated* |
| 8 | Capture decisions / scope changes from WhatsApp & calls | Lead | continuous | High | **Yes** (confirm) | Extracts → structured Decision / Change record; human confirms |
| 9 | Status meetings just to stay informed | All | weekly | High | No | **Replaced by the Daily Brief** (Layer 3) |
| 10 | New-assignment + due-date notifications | Lead | per task | High | No | Auto-notifies the assignee |

**Scoring rule:** prioritise by *frequency × time saved × automatability*, automate top-down, and **never remove a human gate** (columns marked "Yes"). Items 1–5, 9, 10 are pure automation; 6–8 are *assisted* (AI drafts, human approves) — the creative-quality safeguard.

---

## 4. The 3 KPIs (reframed for a design studio)

Put these on the dashboard — they're how we (and an investor) know the AIOS is working.

| AIOS KPI | Space Esse version | How we measure it |
|---|---|---|
| **Away-from-desk autonomy** | **Studio autonomy** | % of phase-gates, approvals and payment follow-ups that progress **without a principal manually intervening** |
| **Task-automation %** | **Coordination automated** | automated tasks ÷ total audited recurring tasks (the Task Audit completion) |
| **Revenue per employee** | **Output per designer** | active/delivered projects per head — rises as overhead falls |

---

## 5. Build order (layers, not leaps)

**Pass A — Frontend simulation (now, this repo, no backend).** Demo the AIOS experience, clearly labelled as a preview:
1. Turn the dashboard into a true **AI Daily Brief** (what needs you / at risk / *what I handled*).
2. Add the **Task Audit / Automation board** (the table above, with on/off + "automated N of M").
3. Thread **"✓ AI handled" / "needs your approval"** chips through Projects, Approvals, Files, Finance.
4. Surface the **3 KPI strip**.

**Pass B — Backend (separate repo, on your green-light).** Make it real:
1. **Context pack** — the studio brain (workflow, standards, gates, tone).
2. **Data ingestion** — Drive, WhatsApp (forward/capture), email, Tally.
3. **Agents** — the automations, executed via the **propose → approve → execute** gate.
4. **Memory/learning** — the Risk Radar and patterns sharpen over time.

**Pass C — Build layer.** Growth: capacity to take more work; then **multi-tenant ArchIntel** as the AIOS for other design studios.

> Backend work lives in a **separate repository** so it can never affect this live demo.

---

## 6. What we already have (so we evolve, not rebuild)

ArchIntel today gives us Layers 1–3: the **structured substrate** (projects · 4 phases & gates · files · approvals · payments · clients · decisions · archive) plus a **seed of intelligence** (management dashboard + Risk Radar) over a **swappable mock API** ready for the backend. The AIOS is built **on top of** this — nothing is thrown away.

## 7. What we need from Space Esse (feeds the Context layer + automation templates)

From the meeting's "next info" list: standard roles & responsibilities, typical phase timelines, sample requirement docs / presentations / material sheets / BOQs / drawing sets, payment-milestone structures, existing folder structures, and the weekly/monthly reports they want. These become the templates the agents draft from and the standards they enforce.

## North-star

**The principals spend the majority of their time on design, clients and winning work — not coordination — and the studio can take on more without losing the Space Esse quality bar.** Measured by the three KPIs above.
