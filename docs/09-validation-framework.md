# Validation Framework

## Purpose & honest starting point

This document specifies the **target validation framework** for SPACE ESSE · Practice Intelligence. It is written for developers building the backend, QA designing test plans, and partners/investors who need to know exactly what protects data integrity today versus what is still a design intention.

The single most important fact to state plainly: **the current product is a frontend-only, high-fidelity interactive prototype, and it enforces almost no validation.** All data is mock data served through `src/lib/api.ts` `resolve()` (a deep-clone with ~280 ms simulated latency). There is no backend, no database, no persistence, no authentication, and no write path of any kind — there are no `useMutation` hooks anywhere in the codebase. Capture forms accept input and render an inline success message, but **nothing is saved** and **nothing is validated beyond a single "required fields present" gate**.

Therefore:

- Validation that genuinely runs in the browser today is marked **[IMPLEMENTED]** — and there is very little of it (essentially the Capture `ready` gate, the Settings health-weight sum check, and React/TypeScript-level type coercion on inputs).
- The overwhelming majority of rules below are **[BACKEND]** (need an API, database, and persistence to function) or **[RECOMMENDED]** (a future enhancement not yet designed in the UI).
- Rules that depend on an external system to even have data to validate against are **[INTEGRATION]**.

Nothing in this document should be read as "already working." Where a control looks functional in the UI but has no effect, it is called out as **visual-only**.

---

## How to read this document

Every validation type follows the same structure:

- **Rule** — what must be true.
- **Where it applies** — the page/form/field/module from the code inventory.
- **Status** — one of the legend tags below.
- **Severity** — **Blocking** (rejects the action) or **Warning** (allows it but flags low confidence / needs review).

### Status legend

| Tag | Meaning |
|---|---|
| **[IMPLEMENTED]** | Interactive and working in the frontend, client-side only. |
| **[MOCK]** | Renders from mock data; the underlying check is simulated, not live. |
| **[BACKEND]** | Designed (or intended) in the UI but needs an API / database / persistence to function. |
| **[INTEGRATION]** | Needs a third-party connector (accounting, Drive, email, authority portal) to function. |
| **[RECOMMENDED]** / **[PLANNED]** | Not built; a future enhancement. |

### Blocking vs. warning — the SPACE ESSE philosophy

The product's design ethos is **"we refuse to fabricate."** That ethos should shape the validation model:

- **Blocking errors** stop a write. They protect referential integrity and legal/financial correctness (e.g., an invoice cannot reference a non-existent project; a negative fee is rejected). These almost all require the backend that does not yet exist.
- **Warning errors** never block; they **lower confidence** and route the record into the **Review Queue** (maker–checker). This matches existing UI vocabulary: `Confidence` levels (`high`/`medium`/`low`/`insufficient`), `DataCompleteness`, `ConfidenceBadge`, and the "Insufficient data" refusal state. A warning is the system saying "recorded, but unverified" — exactly what the Capture success panel already shows cosmetically (badges "Captured" + "Unverified").

A practical rule of thumb for backend work: **structural/financial/legal correctness → blocking; completeness/provenance/plausibility → warning.**

---

## What actually exists today (the honest [IMPLEMENTED] list)

These are the only validation-adjacent guards that run in the browser. Everything else in this document is target spec.

| Guard | Location (inventory) | What it does | Status |
|---|---|---|---|
| Capture submit gate (`ready`) | `Capture.tsx` | Disables the **Capture** button until required fields per variant are present (see below). No per-field messages, no format checks, no persistence. | **[IMPLEMENTED]** (client-only) |
| WhatsApp paste presence | `Capture.tsx` | "Extracted draft" preview only renders when `paste.trim().length > 0`; it slices the last line to 120 chars — **no real extraction**. | **[IMPLEMENTED]** (cosmetic) |
| Health-score weight sum | `Settings.tsx → KpisTab` | Live `sum = Σ weights`; `balanced = |sum − 1| < 0.001`. Disables both **Save** buttons when unbalanced. The disabled state is real; the save action is **visual-only**. | **[IMPLEMENTED]** (gate only) |
| Input type coercion | numeric `Input` fields (`inputMode`, `type=number`, `step`/`min`/`max`) across Capture & Settings | Browser-level numeric/decimal hints and HTML min/max attributes. Not enforced on submit; no JS validation. | **[IMPLEMENTED]** (browser default, weak) |
| Search/URL state | `Search.tsx` | `?q=` round-trips through `useSearchParams`; empty query clears params. Not data validation. | **[IMPLEMENTED]** (state only) |

The **Capture `ready` gate** is the closest thing to real validation:

- All variants: `projectId` must be set.
- `timesheet`: also requires `employeeId` **and** `hours`.
- `whatsapp`: also requires non-empty `paste`.
- all other variants (`decision`, `approval`, `scope`, `site`): also require non-empty `note`.

That is the entire enforced validation surface of the product. There are no required-field asterisks, no inline error text, no format checks, no range checks, no duplicate checks, and the "Date" field is defaulted to `2026-06-17` but never enforced.

---

## Master validation matrix

The table below is the full target spec across every required validation type. Most rows are **[BACKEND]** or **[RECOMMENDED]** by necessity — there is no write path to enforce them against.

| # | Validation type | Rule (target) | Where it applies | Severity | Status |
|---|---|---|---|---|---|
| 1 | Required-field | Mandatory fields must be present before a record is accepted | Capture (all variants); Settings forms; any future create form | Blocking | Capture gate **[IMPLEMENTED]** (client); full enforcement **[BACKEND]** |
| 2 | Format | Email RFC-valid, phone E.164/local BD, dates ISO-8601, invoice/project codes match a pattern | Capture; Client/Contact records; Invoice numbers; Settings (legal entity, office) | Blocking (hard formats) / Warning (soft) | **[BACKEND]** / **[RECOMMENDED]** |
| 3 | Date | No invalid dates; due ≥ issue; submitted ≤ expected ≤ approved; not absurdly future/past | Invoices, Approvals, Milestones, Decisions, Capture "Date" | Blocking (ordering) / Warning (plausibility) | **[BACKEND]** |
| 4 | Number / currency | No negatives where nonsensical; BDT/USD respected; tax math reconciles (VAT 15%, VDS = 60% of VAT, AIT ~10%) | Invoices, Payments, fees, `costImpact`, `hours`, budget/cost | Blocking (sign/currency) / Warning (reconciliation) | **[BACKEND]** |
| 5 | Project-code | `code` unique, matches firm convention, immutable once issued | Projects; Capture project select; cross-ref aliases | Blocking | **[BACKEND]** |
| 6 | Client / contact | One primary contact per client; valid email/phone; client referenced by name resolves to a real client id | Clients, Contacts, Invoice `client` linkage | Blocking (linkage) / Warning (primary) | **[BACKEND]** |
| 7 | Budget / cost | `costToDate` ≤ budget triggers overrun flag, not rejection; cost requires timesheet provenance | Projects, Profitability, Financials | Warning | **[BACKEND]** + **[INTEGRATION]** (timesheets) |
| 8 | Timeline | `targetHandover` ≥ `startDate`; schedule variance derived, not hand-set; statutory windows tracked | Projects, Milestones, Approvals, Calendar | Blocking (ordering) / Warning (slip) | **[BACKEND]** |
| 9 | Dependency | A milestone/phase cannot complete while a blocking approval is open; deliverable cannot be "issued" without a file | Delivery, Approvals, Deliverables, phase stepper | Warning → escalate | **[BACKEND]** + **[INTEGRATION]** (Drive file presence) |
| 10 | Document | Deliverable marked issued/approved must have a detected `fileRef`; revision count monotonic | Deliverables / Document Control | Warning | **[INTEGRATION]** (Google Drive presence) |
| 11 | Status-transition | Only legal state moves allowed (e.g. approval `in_review → query_raised/approved/rejected`, not `→ not_started`) | Approvals, Deliverables, Invoices, Tasks, Opportunities, Review items | Blocking | **[BACKEND]** |
| 12 | Approval | Client-facing AI reports require human sign-off before "send"; authority approvals tracked vs statutory window | Review Queue, AI Reports, Approvals | Blocking (send gate) / Warning (overdue) | Local-state toggle **[IMPLEMENTED]**; real gate **[BACKEND]** |
| 13 | Duplicate-prevention | No two open invoices with same number; no duplicate decision/approval capture; idempotent sync | Capture, Invoices, Approvals, sync jobs | Blocking (hard dupes) / Warning (likely dupes) | **[BACKEND]** + **[INTEGRATION]** |
| 14 | Cross-module consistency | Payments reconcile to invoice `amountReceived`; portfolio totals = Σ project fees; alias matched both ways | Financials, Portfolio, Data Quality matching, KPI computation | Warning → Discrepancy in Review Queue | **[BACKEND]** |
| 15 | Role-based | Finance fields visible/writable only to Owner & Finance/Admin; checker ≠ maker on approval | Settings (Users & roles), Review Queue, all finance pages | Blocking | **[BACKEND]** (no auth exists) |

---

## Detailed rules by type

### 1. Required-field validation

**Today:** the Capture `ready` gate (above) is the only enforced required-field check, and it is client-side and non-persisting. Settings forms use uncontrolled `defaultValue` inputs that are never validated and never saved.

**Target:** every create/update endpoint validates a mandatory-field set server-side and rejects (HTTP 422) with per-field errors. The frontend should mirror this with inline messages and required markers — neither exists today.

| Record | Required (target) | Status |
|---|---|---|
| Decision | `projectId`, `summary`, `decidedBy`, `date`, `channel` | gate covers `projectId`+`summary` **[IMPLEMENTED]**; rest **[BACKEND]** |
| Approval update | `projectId`, `authority`, `status`, change note | gate covers `projectId`+note **[IMPLEMENTED]**; rest **[BACKEND]** |
| Timesheet | `projectId`, `employeeId`, `hours`, `date` | gate covers `projectId`+`employeeId`+`hours` **[IMPLEMENTED]**; **[BACKEND]** for persistence |
| Invoice | `number`, `projectId`, `client`, `issueDate`, `dueDate`, `grossFee` | **[BACKEND]** (no invoice create form exists) |
| Client / Contact | client `name`, `type`; contact `name`, one `primary` | **[BACKEND]** |

### 2. Format validation

No format validation exists anywhere. Numeric inputs use `inputMode`/`type=number` browser hints only — these soften the keyboard but do not reject bad input on submit.

**Target patterns** (all **[BACKEND]**, frontend mirror **[RECOMMENDED]**):

- **Email** — RFC 5322 practical subset; applied to Contact emails (currently rendered as raw `mailto:` links with no validation in `ClientDetail.tsx`).
- **Phone** — Bangladesh local + E.164; applied to Contact phones (`tel:` links).
- **Dates** — ISO-8601 `YYYY-MM-DD`; the codebase already standardizes on ISO strings and `date-fns parseISO`, so this is enforceable.
- **Project code** — firm convention (e.g., `^[A-Z]{2,4}-\d{2,4}$`); applied to `Project.code`.
- **Invoice number** — pattern like `INV-YYYY-NNN` (matches mock `INV-2026-019`).
- **Currency** — `BDT` | `USD` only.

### 3. Date validation

`format.ts` anchors "today" to `2026-06-17`; `daysFromNow`, `agingDays`, and statutory-overrun math all derive from dates. None of this is validated on input — the Capture "Date" field defaults to today and accepts anything.

| Rule | Severity | Status |
|---|---|---|
| Date parses to a valid calendar date | Blocking | **[BACKEND]** |
| `Invoice.dueDate ≥ Invoice.issueDate` | Blocking | **[BACKEND]** |
| Approval `submittedDate ≤ expectedDate ≤ approvedDate` (when present) | Blocking | **[BACKEND]** |
| `Project.targetHandover ≥ Project.startDate` | Blocking | **[BACKEND]** |
| Captured date not implausibly future / far past | Warning | **[RECOMMENDED]** |
| Statutory overrun (`daysInStage > statutoryDays`) flags overdue | Warning (already displayed) | computation **[MOCK]**; live tracking **[BACKEND]** + **[INTEGRATION]** |

### 4. Number / currency validation

The invoice tax model is well-defined in `data.ts` `inv()`: `vat = round(gross × 0.15)`, `vdsWithheld = round(vat × 0.6)`, `aitWithheld = round(gross × 0.1)`, `netReceivable = gross + vat − vds − ait`. This is **computation, not validation** — and the inventory flags that standalone `payments` amounts are hand-authored and **not reconciled** against invoice `amountReceived`.

| Rule | Severity | Status |
|---|---|---|
| Fees, hours, costs ≥ 0 where nonsensical negative | Blocking | **[BACKEND]** |
| Currency ∈ {BDT, USD}; no mixed-currency arithmetic | Blocking | **[BACKEND]** |
| `netReceivable` recomputes consistently from gross + tax components | Blocking | **[BACKEND]** |
| `amountReceived ≤ netReceivable` | Blocking | **[BACKEND]** |
| Σ payments per invoice == invoice `amountReceived` | Warning → Discrepancy | **[BACKEND]** (currently unreconciled) |
| `hours` within a plausible weekly cap | Warning | **[RECOMMENDED]** |

### 5. Project-code validation

`Project.code` is the canonical anchor that every cross-reference, alias, and deep-link relies on. There is no create form, so no validation exists.

| Rule | Severity | Status |
|---|---|---|
| `code` unique across all projects | Blocking | **[BACKEND]** |
| `code` matches firm naming convention | Blocking | **[BACKEND]** |
| `code` immutable after issue (aliases change, canonical id does not) | Blocking | **[BACKEND]** |
| Every captured record resolves to an existing `projectId` | Blocking | **[BACKEND]** |

### 6. Client / contact validation

`ClientDetail.tsx` matches invoices by `i.client === client.name` (a name-string join). This is fragile and is a prime cross-module-consistency hazard.

| Rule | Severity | Status |
|---|---|---|
| Exactly one `primary` contact per client | Warning (or Blocking) | **[BACKEND]** |
| Contact email/phone format-valid | Blocking | **[BACKEND]** |
| Invoice→client linkage by stable id, not name string | Blocking | **[BACKEND]** (current join is by name) |
| Client `type` and `relationship` within enum | Blocking | **[BACKEND]** |

### 7. Budget / cost validation

The product is deliberately honest that labour cost is under-captured (timesheet coverage ~64%). The correct behaviour is **warn, never block** — and surface low confidence, exactly as Profitability already does cosmetically.

| Rule | Severity | Status |
|---|---|---|
| `costToDate > budgetCost` raises an overrun warning (not rejection) | Warning | **[BACKEND]** |
| Cost figures require timesheet provenance; low coverage → low confidence | Warning | **[BACKEND]** + **[INTEGRATION]** |
| Margin shown as "fee-based / indicative" until coverage clears threshold | Warning (already in copy) | display **[MOCK]**; gating logic **[BACKEND]** |

### 8. Timeline validation

Schedule variance (`scheduleVarianceDays`) and statutory windows are currently mock fields, not computed from validated milestone/approval dates.

| Rule | Severity | Status |
|---|---|---|
| Handover ≥ start; milestone dates within project span | Blocking | **[BACKEND]** |
| `scheduleVarianceDays` derived from milestone actuals vs plan | Warning | **[BACKEND]** (currently hand-set) |
| Approval past statutory window flags + escalates | Warning → banner | display **[MOCK]**; live **[BACKEND]** + **[INTEGRATION]** (RAJUK ECPS has no API) |

### 9. Dependency validation

The phase stepper, blocking-approval banner, and deliverable statuses imply dependencies that are **rendered but not enforced**.

| Rule | Severity | Status |
|---|---|---|
| Phase cannot advance past `authority_approval` while a blocking approval is open | Warning → escalate | **[BACKEND]** |
| Deliverable cannot be `issued`/`approved` without a detected file | Warning | **[INTEGRATION]** (Drive presence) |
| Milestone cannot complete with open blocking dependencies | Warning | **[BACKEND]** |

### 10. Document validation

Document Control derives file presence from Google Drive only ("manual" chip = no file detected). This is inherently an integration concern.

| Rule | Severity | Status |
|---|---|---|
| Issued/approved deliverable must have `fileRef` | Warning | **[INTEGRATION]** |
| `revisionCount` monotonically increasing; >3 flags high churn | Warning (already shown) | display **[MOCK]**; enforcement **[BACKEND]** |
| Drawing register matched to a project | Warning | **[INTEGRATION]** |

### 11. Status-transition validation

Status enums are richly defined in `types.ts` (`ApprovalStatus`, `DeliverableStatus`, `InvoiceStatus`, `TaskStatus`, `OppStage`, review `status`). The UI lets local state flip (Review approve/reject, Schedules toggle) but enforces **no legal-transition graph**.

**Target transition graphs** (all **[BACKEND]**):

- **Approval:** `not_started → preparing → submitted → in_review → {query_raised → in_review, approved, rejected}`. No skipping back to `not_started`.
- **Deliverable:** `not_started → in_progress → internal_review → {issued → approved, revise → in_progress}`.
- **Invoice:** `draft → sent → {part_paid → paid, overdue → part_paid/paid}`.
- **Review item:** `pending → {approved, rejected}` (terminal). Currently a **[IMPLEMENTED]** local-state change only — refresh resets it, nothing persists.

### 12. Approval validation (maker–checker)

The Review Queue is the product's flagship trust gate. Its approve/reject **does** change local React state (**[IMPLEMENTED]**, client-only) and is therefore the closest thing to a working approval flow — but it is not persisted, and "Approve & send" has **no real send effect**.

| Rule | Severity | Status |
|---|---|---|
| Client-facing report (`audience external` + `needs_review`) cannot send without sign-off | Blocking | local toggle **[IMPLEMENTED]**; real send gate **[BACKEND]** + **[INTEGRATION]** (email/WhatsApp) |
| Authority approval overdue vs statutory window | Warning → critical banner | display **[MOCK]** |
| Maker ≠ checker enforced | Blocking | **[BACKEND]** (no auth) |

### 13. Duplicate-prevention validation

No duplicate detection exists. Capture can be submitted repeatedly with identical content (and nothing is even stored). Sync idempotency is undefined because there is no sync.

| Rule | Severity | Status |
|---|---|---|
| Invoice `number` unique among non-void invoices | Blocking | **[BACKEND]** |
| Near-identical decision/approval capture flagged | Warning → Review Queue | **[BACKEND]** |
| Sync jobs idempotent (re-ingest does not duplicate) | Blocking | **[INTEGRATION]** |
| Same alias not matched to two projects | Blocking | **[BACKEND]** |

### 14. Cross-module consistency validation

This is where SPACE ESSE's "confidence" model earns its keep. Inconsistencies should not block; they should generate a **Discrepancy** item in the Review Queue (a kind that already exists: `discrepancy`).

| Rule | Severity | Status |
|---|---|---|
| Σ payments == invoice `amountReceived` | Warning → Discrepancy | **[BACKEND]** (currently unreconciled) |
| Portfolio totals == Σ active-project fees (KPIs already compute this client-side) | Warning | computation **[MOCK]**; integrity check **[BACKEND]** |
| Cross-ref alias matched both directions before "confident" | Warning | matching UI **[MOCK]**; confirm is **visual-only** |
| Two sources disagree on a value → flag, don't pick silently | Warning → Discrepancy | **[BACKEND]** |

### 15. Role-based validation

Settings → Users & roles shows a Role select (**[IMPLEMENTED]** client-state) and a Finance-access switch that is **visual-only** (uncontrolled, and its label does not even react to the switch). There is **no authentication and no authorization** anywhere — the user menu "Sign out" / "Switch role view" buttons have no handlers.

| Rule | Severity | Status |
|---|---|---|
| Finance fields (fees, invoices, payments) visible/writable only to Owner & Finance/Admin | Blocking | **[BACKEND]** (no auth exists) |
| Checker on an approval must differ from the maker | Blocking | **[BACKEND]** |
| Settings changes restricted to Owner/Admin | Blocking | **[BACKEND]** |
| Read-only connectors never gain write scope | Blocking | **[INTEGRATION]** (design intent: least-privilege, read-only) |

---

## Warning vs. blocking — consolidated policy

| Outcome | Trigger classes | Where the user sees it (target) |
|---|---|---|
| **Blocking** (reject write) | required-field, hard format, date ordering, sign/currency, status-transition, duplicate hard, project-code uniqueness, role-based | Inline field errors + 422 from API (neither exists yet) |
| **Warning** (accept, lower confidence, route to review) | completeness gaps, cost/timesheet provenance, plausibility, soft duplicates, cross-module discrepancies, statutory overrun | `ConfidenceBadge`, `DataCompleteness`, "Insufficient data" state, Review Queue `discrepancy` items |

The existing trust vocabulary (`Confidence`, `completeness`, `InsufficientData`, `ConfidenceBadge`, Review Queue) is the **correct presentation layer for warnings** and should be reused as-is when the backend begins emitting validation results. The blocking layer has no presentation yet and must be built alongside the API.

---

## End-to-end record lifecycle (target flow)

This shows where each validation type fires for a captured record. **Every stage past "Input" is [BACKEND]/[INTEGRATION] today** — the prototype stops at Input + a cosmetic success panel.

| Stage | What happens (target) | Validations applied | Status |
|---|---|---|---|
| **Input** | User fills a Capture form | Required-field gate (`ready`) | **[IMPLEMENTED]** (client) |
| **Validation** | API checks format, dates, numbers, codes, duplicates | Types 1–6, 13 (blocking); 7–10 (warning) | **[BACKEND]** |
| **Processing** | Normalize, attach provenance (source, observedAt), compute confidence/completeness | Cross-module reconciliation (14) | **[BACKEND]** |
| **Approval** | Maker–checker for client-facing/ambiguous records | Approval (12), role-based (15) | local toggle **[IMPLEMENTED]**; real gate **[BACKEND]** |
| **Storage** | Persist append-only with audit entry | Idempotency (13), status-transition (11) | **[BACKEND]** |
| **Reporting** | KPIs recompute; AI reports cite stored records | Consistency (14); refuse when insufficient | computation **[MOCK]**; live **[BACKEND]** |
| **Follow-up** | Discrepancies/overruns surface as alerts & review items | Warnings re-evaluated on each sync | **[BACKEND]** + **[INTEGRATION]** |

Currently the chain runs only through **Input**, then jumps straight to a fabricated "Captured" success state with no Validation, Processing, Approval, Storage, Reporting, or Follow-up actually occurring.

---

## Summary for stakeholders

- **For partners/investors:** validation is a **design specification, not a shipped feature**. The prototype proves the UX and the trust model; building real validation requires the backend, database, auth, and connectors that do not yet exist.
- **For developers:** treat this matrix as the acceptance criteria. Start with blocking structural rules (required-field, project-code uniqueness, status-transition, referential integrity) because they protect the data the entire KPI layer depends on. Wire warnings into the existing confidence/Review-Queue UI rather than inventing new surfaces.
- **For QA:** the only assertions that can pass against today's build are the three **[IMPLEMENTED]** client gates (Capture `ready`, weight-sum balance, browser numeric hints). All other validation test cases will fail until the backend is built — by design.
