# Security & Governance Plan

> **Scope.** PracticeLens is a read-only-first, AI-powered reporting & analytics layer over a small Dhaka architecture practice's existing (mostly informal) tools. This section specifies the security and data-governance posture for a small team building a **single-tenant pilot that is multi-tenant-ready from the first line of code**. It covers all 15 governance areas, gives a concrete RBAC matrix, and makes opinionated, implementable calls sized to a funded startup with a small engineering team — not a SOC-2-on-day-one fantasy.
>
> **Two threats define everything below.** (1) **Finance leakage inside a tiny firm** — in a 5-30 person practice the Owner's spouse does the books, a Project Architect is the Owner's cousin, and "everyone sees everything" is the cultural default. Restricting Fee/Invoice/Payment data to Owner + Finance/Admin is the single most sensitive control we ship, and it must hold even though the same people sit in the same room. (2) **PII + cross-border transfer under PDPO 2025** — Bangladesh's Personal Data Protection Ordinance is now *enacted* (Nov 2025) and *amended* (Feb 2026), with enforcement ~May 2027. Sensitive identifiers (NID, TIN, passport, biometric) carry a hard cross-border-transfer-approval requirement. Our defense is **data minimization** — we mostly never need those fields — plus region-selectable hosting and a local-mirror option for the narrow restricted subset.
>
> **Design principle carried from the rest of the blueprint:** original tools stay the system of record; we are read-only-first; every record carries provenance; the LLM never sees raw SQL or sensitive identifiers (see §9, §10). Security is therefore mostly about *protecting a derived analytics copy*, not a transactional ERP — which lowers the blast radius but does not lower the trust bar.

---

## 1. Role-Based Access Control (RBAC)

We ship **four MVP seats** (Company Owner, Project Director/Manager, Project Architect, Finance/Admin) and model the other nine canonical roles as **role capabilities** that collapse onto those four now and split out during productization (consistent with the Users section).

The permission model is **Role × Resource × Action**, scoped by **tenant** and then by **project membership**, with **two orthogonal data-sensitivity bands** layered on top:

- **Band F (Finance)** — Budget, Fee, Expense, Invoice, Payment, and any margin/WIP/collection KPI. Visible only to `Company Owner` and `Finance/Admin`.
- **Band P (PII-sensitive)** — Client/Contact NID, TIN, passport, bank details, personal phone/email beyond business contact. Minimized at source (§10); where stored, visible only to `Company Owner`, `Finance/Admin`, and the assigned `Project Director` for that record.

Everything else is **operational data** (Project, Phase, Milestone, Deliverable, Task, Decision, Approval, etc.), governed by project membership only.

Implementation: roles are **not hard-coded in application logic**. A role is a named bundle of **permission grants** (`resource:action:scope`) stored in the database, evaluated by a single central authorization function. This is what lets us split a collapsed role (e.g. peel `Finance Team` off the Owner) at productization without touching feature code — we re-map grants, not rewrite checks.

---

## 2. Project-Level Permissions

Operational data is gated by **ResourceAssignment / project membership**, not by global role alone. A `Project Architect` sees only the Projects they are assigned to; a `Project Director` sees their portfolio; the `Owner` sees all Projects in the tenant.

| Concept | Rule |
|---|---|
| **Membership** | A user is a member of a Project via `ResourceAssignment` (canonical entity). Membership grants read on operational data for that Project. |
| **Default deny** | No membership ⇒ no access to that Project's records, even for operational data. The Owner is the only role with an implicit all-Projects grant. |
| **Cross-project KPIs** | Firm-wide rollups (portfolio Project Health Score, backlog) are gated by role, not membership — only Owner/Director see cross-project aggregates. |
| **Manual-capture writes** | A member can write captured records (Decision, SiteReport, Change, Timesheet) only to Projects they belong to. |
| **Enforcement layer** | Project scoping is enforced in the **same authorization function** as RBAC and (for multi-tenant) injected as a row filter at the data layer — never trusted to the UI or to the LLM (§9, §16). |

---

## 3. Financial-Data Restrictions (Band F)

This is the highest-stakes access control in the product and deserves its own paragraph because the social reality fights it.

- **Who can read Band F:** `Company Owner` and `Finance/Admin` only. `Project Director`, `Project Manager`, and `Project Architect` get **operational data with finance redacted** — they see schedule, deliverables, approvals, and effort, but **not Fee, Invoice, Payment, Expense, margin, WIP, or collection figures**, including in AI answers.
- **Redaction is positive, not silent:** where a Director would otherwise see a margin tile, they see a "restricted — finance" placeholder, so the boundary is legible and not mistaken for missing data.
- **Derived-metric leakage is the trap:** `Forecast Project Margin`, `Fee Burn Rate`, `EAC`, `Collection Rate`, `Invoice Aging`, `WIP`, `Unbilled Revenue` are all Band F and must be blocked for non-finance roles even though they are "just KPIs." The semantic layer tags every metric with its band; the authorization function checks the band before any tool returns a value to the UI or the LLM.
- **AI inherits the band:** the NL analytics surface and every report respect Band F per the **requesting user's** grants. A Director asking "is the Banani project profitable?" gets "you don't have access to financial data on this project," not a number. Enforced at the tool layer (§9), logged in AuditLog (§6).

---

## 4. Client & Consultant Access

**MVP decision: no external (Client/Consultant) logins.** This is deliberate and defensible.

- Clients and Consultants in the pilot interact through WhatsApp/email/phone as they always have. PracticeLens does **not** expose a client portal in the MVP — adding external auth, external-facing data correctness guarantees, and the support burden is out of scope for a 6-month single-firm pilot, and the firm's clients would not adopt a portal anyway.
- Client/Consultant are **data subjects and entities**, not users. Their data (Client Approval Time, Consultant Response Time) is captured *about* them, not *by* them.
- **The only external-facing surface is the human-approved report** (§9.6 of the AI section): a weekly project report or monthly performance report a partner/Owner chooses to send out. These leave the system as a generated PDF/file through the Owner/Finance approval gate — never via a live external login.
- **Productization hook:** when a client portal is built later, it gets its own role band (`External-Client`, `External-Consultant`) with read access scoped to a single Project and **never** to Band F or any other Client's data. Designing the RBAC as grant-bundles now means this is an additive change.

---

## 5. Encryption

| Layer | Control | Notes |
|---|---|---|
| **In transit** | TLS 1.2+ (prefer 1.3) on every hop: client↔app, app↔DB, app↔integration APIs, app↔model endpoint. HSTS on. No plaintext internal traffic. | Managed certs (provider ACM / Let's Encrypt). Reject downgrade. |
| **At rest (storage)** | Full-disk / volume encryption (AES-256) on DB, object store, backups, and search index — provider-managed KMS keys. | Baseline; covers stolen-disk / snapshot-leak. |
| **At rest (field-level)** | **Application-layer field encryption** for Band F financial detail and Band P sensitive identifiers, using envelope encryption (data key per tenant, wrapped by a KMS master key). | This is *above* disk encryption: a DB dump or a misconfigured read still yields ciphertext for NID/TIN/bank/Payment detail. Keep aggregate KPIs computable without decrypting raw PII by storing the analytic value separately from the identifier. |
| **Key management** | Master keys in cloud KMS (Singapore/Mumbai region, §12). Per-tenant data keys enable per-tenant crypto-shredding (delete the tenant key ⇒ that tenant's field-encrypted data is unrecoverable — a clean offboarding + erasure mechanism for PDPO right-to-erasure). | Document key rotation cadence (annual master, on-demand data-key rotation). |
| **Search/embeddings** | Only **approved, normalized documents** are embedded (per AI §2.1). Sensitive identifiers are stripped before embedding so no NID/TIN ever lands in a vector index. | Vector store inherits at-rest encryption + tenant filter (§16). |

Field-level encryption is the one piece worth the extra engineering: it is the difference between "we had a data exposure" and "ciphertext leaked, no PII disclosed" under PDPO breach-notification scrutiny.

---

## 6. Data Retention

Because we are an **analytics copy** and not the system of record, our retention philosophy is **minimize and expire**, with the original tools holding the durable truth.

| Data class | Default retention | Rationale |
|---|---|---|
| **Canonical analytic records** (Project, Milestone, Invoice mirror, Timesheet, etc.) | Life of the engagement + 12 months, then archive/anonymize | Long enough for trend KPIs and the closeout/lessons-learned loop the firm has never had; expires when the relationship ends. |
| **Raw ingested payloads** (e.g. persisted WhatsApp webhooks if/when built, raw email metadata, import files) | 90 days then purge once promoted to typed records | We keep raw only long enough to reprocess; the typed record is the durable artifact. WhatsApp raw must be persisted *before* processing (no backfill from Meta) but does not need to live forever. |
| **AuditLog** | Minimum 24 months, immutable (§7) | Dispute defense, security forensics, and the firm's first real audit trail of approvals/decisions. |
| **AI fact bundles & generated drafts** | 12 months | Reproducibility/eval and "why did the AI say that" investigations. |
| **Backups** | 35-day rolling (§13) | DR window; expires automatically. |
| **Sensitive identifiers (Band P)** | Store only if a workflow requires; else **do not ingest** | Data minimization is the primary PDPO control (§10). |

Retention is **per-tenant configurable** within legal floors, and erasure is implemented via crypto-shredding (§5) plus hard-delete jobs, satisfying PDPO data-subject erasure expectations ahead of May 2027 enforcement.

---

## 7. Audit History (Immutable AuditLog)

`AuditLog` is a **canonical entity** and a first-class feature, not a debug log. In a firm where approvals and decisions were historically verbal/WhatsApp, the audit trail is partly the *product value* (defensible "who approved what, when").

- **What is logged:** every write to a canonical record; every permission-sensitive read (Band F / Band P access, cross-project rollups); every login/auth event; every integration sync; every AI tool call and report generation (with the requesting user, the fact-bundle hash, and `calc_version`); every approval-gate decision.
- **Each entry carries:** actor (user or system/integration identity), tenant, action, target entity + id, timestamp (UTC + Asia/Dhaka rendered), source DataSource/IntegrationRecord where relevant, and before/after for mutations.
- **Immutability (pragmatic, small-team version):** AuditLog is **append-only at the application layer** — no update/delete endpoints exist, DB grants for the app role are INSERT/SELECT only on that table. For tamper-evidence we add a **hash chain** (each row stores a hash of `(prev_hash + row)`), so any retroactive edit breaks the chain and is detectable. We do **not** over-engineer with a WORM/blockchain store for the pilot; the hash chain + locked grants + write-once backup is proportionate. Periodic export of the chain head to an independent location gives external anchoring if needed later.
- **Visibility:** Owner can view the full tenant AuditLog; other roles see audit entries only for records they can already access.

---

## 8. Source Traceability (Provenance)

Provenance is mandated everywhere else in the blueprint; here we state the security guarantee it provides. Every canonical record links to its **DataSource** and **IntegrationRecord** (origin system, sync time, transform/`calc_version`, and for manual capture the capturing user + method — form, Excel import, WhatsApp-screenshot promotion). This means:

- Every figure in every dashboard tile and AI answer is **drillable to its origin record(s)** (the source-chip pattern from the AI section), so a disputed number is investigable, not arguable.
- Provenance + AuditLog together let us answer "where did this value come from and who touched it" — the governance backbone for both anti-hallucination and breach forensics.
- Manual-capture provenance distinguishes **API-confirmed > validated-import > human-confirmed > OCR-extracted** confidence tiers, which the AI confidence band consumes directly.

---

## 9. AI Approval Controls

The anti-hallucination architecture (AI section §2) is also a governance control. Security-relevant guarantees:

- **The LLM has no direct data access** — no raw SQL, no open file scan, no internet. It calls **typed, read-only semantic-layer tools** that return pre-computed numbers + provenance. It cannot exfiltrate beyond what those tools expose.
- **RBAC + Band F/P enforced at the tool layer, per requesting user** — the model never receives data the user is not entitled to (a Director's NL query physically cannot return finance figures). The tenant row filter and the band check are injected by the tool, **never trusted to the model**.
- **Human approval gate for external-facing output** — anything flagged `audience: external` (client/partner/bank-facing report, consultant scorecard sent outward) is generated as a **draft** and routed to an Owner/Finance approval queue; approval/edit/reject is logged in AuditLog. Internal decision-support output (briefings, alerts, NL answers) publishes automatically.
- **PII never enters prompts** — NID/TIN/passport/biometric are excluded from fact bundles and prompts by construction (§10), so a prompt-log leak cannot disclose sensitive identifiers, and no sensitive data crosses a border into the model endpoint beyond the chosen region.
- **Post-generation validator** rejects any number not traceable to the fact bundle (anti-fabrication), which is also an integrity control on outbound reports.

---

## 10. PII Handling & Data Minimization

PDPO 2025 (+2026 amendment) makes **minimization the cheapest compliance strategy** — the data you never collect needs no localization, no transfer approval, and cannot leak.

- **Sensitive identifiers (NID, TIN, passport, biometric, bank account, criminal records):** **default = do not ingest.** PracticeLens is an analytics layer; it needs *that there is a Client* and a business contact, not the Client's NID. Where a finance workflow genuinely needs a TIN (e.g. AIT/VDS certificate support), it is stored **field-encrypted (§5), Band P, segregated**, never embedded, never in prompts, and flagged as cross-border-restricted.
- **Business-contact PII** (name, business phone/email, company) is ordinary operational data — needed to function, kept under standard controls, bilingual dual-script per the region rules.
- **Cross-border-transfer control:** Band P sensitive data is **tagged at ingest** with a `cross_border_restricted` flag; the pipeline refuses to replicate it to any region outside the chosen residency without an explicit, logged approval — implementing the PDPO sensitive-data-transfer rule rather than discovering it at enforcement time.
- **Data-subject rights readiness:** minimization + per-tenant crypto-shredding + hard-delete jobs (§5, §6) give us erasure and a path to access/correction before the ~May 2027 enforcement window.

---

## 11. Email Privacy (Gmail / Microsoft Graph Scopes)

Email/calendar is in the MVP integration surface, but it is the most privacy-charged connector — a partner's and clients' correspondence. We are deliberately conservative.

| Question | Decision |
|---|---|
| **Metadata vs body** | **Metadata-first.** For the MVP we ingest **headers/metadata only** — from/to, timestamps, subject, thread id, has-attachment, calendar event times/attendee counts. We use this for *signals*: Client Approval Time, Consultant Response Time, meeting load. We do **not** ingest message bodies by default. |
| **Body access** | Only on **explicit per-thread user action** (e.g. "promote this email into a Decision/Approval record"), and only that thread. No background body crawl, no bulk body storage. |
| **Least-privilege scopes** | Google: `gmail.metadata` + `gmail.readonly` *only on demand*; Calendar `calendar.readonly`; Drive `drive.metadata.readonly` / `drive.readonly` scoped where possible. Microsoft Graph: `Mail.Read`/`Calendars.Read` (read-only), `Files.Read.All` metadata-first, delegated where the firm prefers per-user consent over app-wide. **No `send`, no write scopes** — read-only-first means literally no mutate permission requested. |
| **Consent** | Tenant-admin or per-user OAuth consent with a plain-language explanation of exactly what is read (metadata) and what is not (bodies). Consent and granted scopes recorded in AuditLog. |
| **What we do NOT store** | Full message bodies (except a user-promoted thread), attachments (we read file-presence metadata from the file store, not email attachments), contact lists wholesale, anything outside the consented scopes, personal/non-work mailboxes. |
| **Provider compliance** | Read-only metadata scopes keep us clear of Google's restricted-scope CASA assessment burden where possible — another reason metadata-first is the right MVP call, not just a privacy nicety. |

---

## 12. Data Residency (PDPO + Region-Selectable Hosting)

**Correction to the brief's assumption:** PDPO is **no longer draft** — enacted Nov 2025, amended Feb 2026 to a **risk-based** (not blanket) localization model, enforcement ~May 2027.

- **No in-country hyperscaler region.** Nearest are **Mumbai (ap-south-1 / asia-south1 / Central India)** — lowest RTT to Dhaka — and **Singapore**. **Recommendation: deploy the pilot in Singapore or Mumbai** (Mumbai for latency; Singapore for service breadth/maturity), and make the region a **deploy-time, per-tenant configuration value** so productization can place a tenant by jurisdiction.
- **Localization is targeted, not total.** Under the 2026 amendment, only **"restricted" personal data** or data handled by **Critical Information Infrastructure** must keep a real-time synchronized copy inside Bangladesh. Ordinary architecture-firm project/operational data is almost certainly **not** restricted/CII ⇒ may be hosted abroad.
- **Design the local-mirror option now, build it when triggered.** The narrow Band P sensitive subset gets a `requires_local_mirror` capability: if a tenant's data is later classed restricted/CII, we can stand up a synchronized copy in a **named Bangladesh data center (VERIFY: select a specific Tier-III/IV provider before any restricted-data tenant onboards)**. Because we minimize Band P aggressively (§10), this subset is tiny.
- **Region-selectable hosting** also covers the model endpoint (§9): inference runs in the same region family so sensitive references don't cross an unintended border.

---

## 13. Backup & Disaster Recovery

Sized to a small team — automated, managed, tested, not a bespoke DR site.

| Target | Value | How |
|---|---|---|
| **RPO (data loss tolerance)** | **≤ 1 hour** for the canonical database | Managed Postgres with point-in-time recovery (continuous WAL archiving) + automated daily snapshots. For an analytics copy, ≤1h is comfortably safe because source tools retain the truth and we can re-sync. |
| **RTO (time to restore service)** | **≤ 4 hours** | Restore DB from PITR/snapshot + redeploy stateless app from infrastructure-as-code. App is stateless ⇒ recovery is dominated by DB restore time. |
| **Backup retention** | 35-day rolling, encrypted (§5), stored in-region | Cross-AZ within the chosen region; cross-region copy only if it stays within the tenant's allowed jurisdictions. |
| **Backup immutability** | Object-lock / write-once on backup bucket | Ransomware/tamper resistance; pairs with AuditLog hash chain. |
| **Re-sync as DR** | Documented re-ingest from source connectors | Because original tools are the system of record, a worst-case rebuild is re-running connectors + re-importing the Excel templates — a genuine safety net no transactional ERP has. |
| **DR testing** | Quarterly restore drill (restore to scratch env, verify integrity, time it) | A backup never restored is not a backup. |

---

## 14. Integration Credential Security

Connectors hold OAuth tokens to the firm's most sensitive systems (email, files, accounting later) — these are crown-jewel credentials.

| Control | Decision |
|---|---|
| **Secrets vault** | All integration secrets (OAuth client secrets, API keys, KMS refs, DB creds) live in a **managed secrets manager** (cloud Secrets Manager / Vault) — **never** in code, env files committed to git, or the application DB in plaintext. App fetches at runtime with a scoped IAM identity. |
| **OAuth token storage** | Per-tenant **access + refresh tokens stored field-encrypted** (envelope encryption, per-tenant key) in a dedicated credentials table, segregated from analytic data. Tokens are Band-F-equivalent in sensitivity. |
| **Rotation** | Refresh tokens rotated per provider lifecycle (e.g. QBO's 2025 ~24-26h refresh rotation, Xero/Graph refresh flows) handled automatically by the connector; KMS master key rotated annually, data keys on-demand; app/service credentials rotated on a schedule and on staff offboarding. |
| **Least privilege** | Read-only scopes only (§11); no write/send scopes requested anywhere in the MVP. Each connector runs with the minimum scope set its KPIs require. |
| **Revocation & offboarding** | One action revokes a tenant's tokens at the provider and crypto-shreds the stored copy. Per-firm credentials are isolated so revoking one firm never affects another. |
| **WhatsApp-specific** | System-user token in the vault; if/when WhatsApp capture is built, raw webhooks are persisted to durable storage **before** processing (no Meta backfill) and the webhook endpoint validates the Meta signature to reject forged payloads. |

---

## 15. Multi-Tenant Data Isolation

The pilot is single-tenant but the architecture must be multi-tenant-ready. We evaluated the three standard isolation models against a small team's operational reality and a sensitivity profile dominated by finance + PII.

| Model | Isolation strength | Ops cost / small-team fit | Cost at N tenants | Verdict |
|---|---|---|---|---|
| **DB-per-tenant** | Strongest (physical separation) | Heaviest — N databases to migrate, back up, monitor, connect-pool; painful for a small team at scale | High (per-DB overhead) | **Overkill for MVP**; reserve as a premium/regulated-tenant option |
| **Schema-per-tenant** | Strong (logical separation per schema) | Medium — migrations must fan out across schemas; connection routing per tenant; gets unwieldy past dozens-to-hundreds | Medium | Middle path; migration fan-out is the pain point |
| **Shared schema + Row-Level Security (RLS)** | Good if RLS is enforced in the DB engine (not just app filters) | Lightest — one schema, one migration path, one backup; ideal for a small team | Lowest | **Recommended for MVP and the SME tier** |

**Recommendation: shared-schema with database-enforced Row-Level Security**, with `tenant_id` on every table and an RLS policy that filters on a session-scoped tenant context set per request. Rationale:

- **The isolation must live in the database, not the application.** Every query — including ones a future bug forgets to filter, and including the AI tool layer — is constrained by the RLS policy. This is materially safer than app-level `WHERE tenant_id = ?` which a single missed filter defeats (the classic multi-tenant leak). The tenant context is set from the authenticated session and is **never** accepted from client input or the LLM.
- **Right-sized for a small team.** One schema, one migration pipeline, one backup target — the operational surface a funded startup can actually run reliably.
- **Defense in depth:** RLS (DB) + the central authorization function (app) + per-tenant field-encryption keys (§5). Even a worst-case RLS bypass yields ciphertext for the most sensitive Band F/P fields, and crypto-shredding gives clean per-tenant erasure.
- **Productization escape hatch:** offer **DB-per-tenant as a premium isolation tier** for a tenant that is classed restricted/CII or contractually demands physical separation — the grant-bundle RBAC and tenant-scoped data layer make this an additive deployment option, not a rewrite.

For the **single-firm pilot**, ship RLS from day one (single live tenant) so the multi-tenant path is exercised and tested, not bolted on at productization.

---

## 16. RBAC Matrix (MVP)

**Roles (MVP seats):** `OWN` = Company Owner · `PDM` = Project Director/Manager · `ARC` = Project Architect · `FIN` = Finance/Admin.
**Actions:** `R` = read, `W` = create/update, `–` = no access. Scope qualifiers: **(all)** = all projects in tenant · **(member)** = only assigned projects · **(own)** = only the user's own records.
**Bands:** rows marked **[F]** = Band F financial (Owner + Finance only); **[P]** = Band P PII-sensitive.

| Resource (canonical entity / KPI) | OWN | PDM | ARC | FIN |
|---|---|---|---|---|
| Company, Office | R/W | R | R | R |
| Client, Contact (business) | R/W (all) | R/W (member) | R (member) | R/W (all) |
| Client/Contact **NID/TIN/passport/bank** **[P]** | R | R (member) | – | R/W |
| Opportunity, Proposal *(Pipeline; mostly Later)* | R/W | R | – | R |
| Contract | R/W | R (member) | R (member) | R |
| Project, ProjectPhase | R/W (all) | R/W (member) | R (member) | R (all) |
| Service | R/W | R | R | R |
| Milestone, **Approval** (RAJUK/FSCD/DoE/CAAB/utility) | R/W (all) | R/W (member) | R/W (member) | R (all) |
| Task | R/W (all) | R/W (member) | R/W (member, own) | R |
| Deliverable, Document, Drawing, Model, Revision | R (all) | R/W (member) | R/W (member) | R |
| Meeting, **Decision** (manual capture) | R/W (all) | R/W (member) | R/W (member) | R |
| Risk, Issue, Change *(scope creep)* | R/W (all) | R/W (member) | W (member) / R | R (Change value **[F]**) |
| RFI, Submittal, SiteReport, Defect | R (all) | R/W (member) | R/W (member) | R |
| Consultant, Contractor | R/W | R/W (member) | R (member) | R |
| Employee, Role, Team | R/W | R (team) | R (own) | R |
| ResourceAssignment | R/W (all) | R/W (member) | R (own) | R |
| **Timesheet** (bootstrapped) | R (all) | R (member) | R/W (own) | R (all) |
| **Budget** **[F]** | R/W | – | – | R/W |
| **Fee** **[F]** | R/W | – | – | R/W |
| **Expense** **[F]** | R/W | – | – | R/W |
| **Invoice** **[F]** | R/W | – | – | R/W |
| **Payment** **[F]** | R/W | – | – | R/W |
| **DataSource, IntegrationRecord** | R/W | R (member) | R (member) | R |
| **AuditLog** | R (all) | R (own-access scope) | R (own-access scope) | R (finance + own scope) |
| ProjectCrossReference (alias/matching) | R/W | R (member) | R (member) | R |

### KPI access (derived — band inherited from inputs)

| KPI group | Visible to |
|---|---|
| **Money [F]:** Fee Burn Rate, Planned vs Actual Hours (cost view), EAC, Forecast Project Margin, WIP, Unbilled Revenue, Invoice Aging, Collection Rate, Change Exposure (value) | **OWN, FIN only** |
| **Delivery:** Project Health Score*, Schedule Variance, Milestone Completion Rate, Task Overdue Rate, Deliverable Completion Rate, Drawing Revision Rate, Consultant Response Time, Client Approval Time, RFI/Submittal Aging | OWN, PDM (member), ARC (member, read), FIN (read) |
| **People:** Utilization Rate, Billable Utilization, Resource Capacity, Planned vs Actual Hours (effort view) | OWN, PDM (member); ARC (own only); FIN (read) |
| **Pipeline:** Pipeline Value, Weighted Pipeline, Proposal Win Rate | OWN (FIN read) — Later |
| **Data Completeness Score** | All roles (within their data scope) — visible as adoption/coverage signal |

\* `Project Health Score` is shown to non-finance roles **with its finance-derived component suppressed**, so a Director sees a schedule/delivery-weighted health indicator, not one that back-doors margin.

### Permission model summary (MVP)

1. **Default deny.** No grant, no access. Owner alone has implicit all-projects scope.
2. **Two gates, both in the DB-backed authorization function:** (a) RLS `tenant_id` isolation; (b) role-grant + band (F/P) + project-membership check. The UI and the LLM are *never* the enforcement point.
3. **Band F is hard:** finance data and all finance-derived KPIs are Owner+Finance only, redacted-positively for everyone else, including in AI answers — the controlling control for the in-firm-leakage threat.
4. **Band P is minimized first, restricted second:** mostly not collected; where collected, field-encrypted, cross-border-tagged, never in prompts/embeddings.
5. **Read-only-first everywhere:** the only writes most users make are **manual-capture** records (Decision, SiteReport, Change, Timesheet) to their own projects — the deliberate exception that turns the firm's verbal/WhatsApp reality into its first real dataset.
6. **Auditable and reversible:** every sensitive read/write and every AI/report action lands in the immutable, hash-chained AuditLog; offboarding is a token-revoke + crypto-shred.

This model is implementable by a small team in the pilot timeframe, holds the two threats that actually matter for a Dhaka practice (in-firm finance leakage and PDPO sensitive-data exposure), and scales cleanly into the multi-tenant SaaS without a security rewrite.
