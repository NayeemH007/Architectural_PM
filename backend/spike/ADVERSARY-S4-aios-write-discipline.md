# ADVERSARY REVIEW — S4 AIOS write-discipline (proposal-only, maker-checker, tamper-evident audit)

**Reviewer:** independent adversary (did NOT build S4).
**Contract:** `backend/spike/CONTRACT-aios-write-discipline.md`
**Ledger:** `backend/test/aios-write-discipline.design.test.mjs`
**Implementation under test:** `backend/db/migrations/0006_aios.{sql,down.sql,supabase.sql}`,
`backend/semantic/serialize_aios.mjs`, `backend/db/seed/seed_live.mjs`,
`app/src/lib/archintel/aios.ts`.

---

## VERDICT: HOLDS (with one reviewer-owned ledger defect, not an implementation gap)

The shipped S4 implementation satisfies the contract and the acceptance ledger's
**intent** on all nine items. **8/9 ledger tests pass.** The single red test
**au-1** fails **inside the ledger itself** because of a malformed SQL statement
in the RED test (`UPDATE … ORDER BY … LIMIT`, which Postgres rejects at PARSE
time). The builder's diagnosis is **honest and independently reproduced**. No
agent_action / audit / migration change can make au-1 green; the fix is
reviewer-owned (edit the ledger's tamper statement). The shipped schema already
satisfies BOTH branches au-1 means to exercise (verified manually).

Builder's report is **honest**: every claimed PASS reproduced, the regression
sweep reproduced 0-fail, the au-1 stop-cause reproduced exactly.

---

## BASELINE RE-RUN (reproduced independently)

| Suite | Result |
|---|---|
| `aios-write-discipline.design` (S4 ledger) | **8 pass / 1 fail** (au-1 only; cause below) |
| schema-rls-auth-seed + derived-endpoints + adversary.slice2b + adversary.spike + slice2b.{http,parity,serializer} + spike.acceptance + ingestion-reconciliation | **65 pass / 0 fail** (69 tests total across the sweep) |
| Frontend `pnpm --dir app test` | **57 pass / 57** |
| Frontend `pnpm --dir app build` | **exit 0** |

---

## au-1 — CONFIRMED LEDGER DEFECT (reviewer-owned), NOT an implementation gap

The ledger's tamper mutation (lines 206–211) is:

```sql
update audit.event set payload = '{"tampered":true}'::jsonb
  where company_id = $1::uuid order by seq desc limit 1
```

Postgres `UPDATE` does **not** accept `ORDER BY`/`LIMIT`. This raises
`syntax error at or near "order"` at parse time — before any trigger or table
logic runs. The test's catch branch (line 215) then asserts the message matches
`/append|immutable|update|delete|revoke/i`; a bare syntax-error string matches
none of those, so the assertion fails **regardless of schema**.

**Independently reproduced** (adversary probe): the same `UPDATE … ORDER BY …
LIMIT` raises `syntax error at or near "order"` against a trivial 2-row table
with no triggers — proving it never reaches the DB execution layer.

**Shipped schema already satisfies au-1's intent** (verified manually with the
corrected statement `… where company_id=$1 and seq=(select max(seq) …)`):
- untouched chain → `mart.verify_audit_chain` = **TRUE** (Firm A has 3 chained rows);
- a valid `UPDATE` on `audit.event` is **blocked by the append-only trigger**
  with message `audit.event is append-only (immutable); UPDATE rejected …`
  (matches the regex — branch (i));
- if the trigger is bypassed (privileged tamper), `verify_audit_chain` returns
  **FALSE** (branch (ii)).

**FIX (reviewer-owned — do NOT have the builder touch the ledger):** replace the
tamper statement with valid single-row SQL, e.g.
`update audit.event set payload='{"tampered":true}'::jsonb
where company_id=$1::uuid and seq=(select max(seq) from audit.event where company_id=$1::uuid)`.
With that, au-1 passes against the shipped schema unchanged.

---

## ADVERSARIAL ATTACK RESULTS

| # | Attack | Outcome |
|---|---|---|
| 1 | checker=maker REJECTED; m2 CAN check a founder(m1)-submitted item | **HOLDS** — `m1` self-approve REJECTED (`design_approval_checker_ne_maker`); `m2` (can_check=true) deciding an `m1`-submitted row ACCEPTED. members: m1=true m2=true m3..m6=false (PD-A confirmed). |
| 2 | `executed` w/o receipt REJECTED; human-gated `executed` w/o approver REJECTED | **HOLDS** — both CHECKs fire (`agent_action_executed_needs_receipt`, `agent_action_gated_executed_needs_approver`). |
| 3 | app role cannot reach `executed`/write receipt (PD-D); bypass attempts | **HOLDS** at the contract boundary — `promote_agent_action` refuses `→executed` and `→executing` ("executor owns executed"). In the **supabase-faithful** variant `authenticated` has ONLY `SELECT` on `agent_action` (no INSERT/UPDATE), so the production app role genuinely cannot reach `executed`. See **residual gap R1** re: the pglite-only `app_writer` INSERT grant. |
| 4 | hash-chain tamper detectable; UPDATE/DELETE REVOKEd | **HOLDS** — UPDATE & DELETE on `audit.event` both raise (append-only trigger); privileged-bypass tamper → `verify_audit_chain` FALSE; app roles carry no UPDATE/DELETE grant on `audit.event` (only SELECT + INSERT for app_writer). |
| 5 | exactly ONE audit row per promotion, in-txn; actions stay `proposed` | **HOLDS** — promotion emits exactly 1 `audit.event` for the entity; chain still verifies TRUE; all 8 seeded actions `proposed` + NULL receipt. |
| 6 | cross-company audit isolation | **HOLDS** — Firm-B chain independent (1 row) and verifies TRUE; per-company `seq`/`prev_hash`. |
| 7 | stale `lock_version` REJECTED | **HOLDS** — `serialization_failure` on version mismatch. |
| 8 | read layer: handled iff `delivery_receipt != null` | **HOLDS** — all 8 seeded actions `handled=false`; brief.handled length 0, needsYou 8; a row with a receipt → `handled=true`. |
| 9 | frontend t1/t3/t4/t5 `humanGate:true`; build+tests green | **HOLDS** — t1,t3,t4,t5 all `humanGate:true` (aios.ts:60,62,63,64); 57/57 tests; build exit 0. |

---

## RESIDUAL GAPS (ranked)

- **R1 (LOW / reviewer-owned — NOT a contract violation). pglite `app_writer`
  has `INSERT` on `mart.agent_action`, so under that role a fabricated
  `executed` row (with a made-up `delivery_receipt` + approver) passes the
  CHECKs and inserts directly, skipping `promote_agent_action`.** Proven: a
  direct `INSERT … state='executed', delivery_receipt='wamid.FAKE', approved_by='m1'`
  is ACCEPTED. The CHECKs validate *shape* (executed⇒receipt, gated-executed⇒
  approver), not *provenance* (that the receipt is real / the inserter is the
  external executor). This is **mitigated in production**: the supabase variant
  grants `authenticated` only `SELECT` on `agent_action` (no INSERT/UPDATE), so
  the real app role cannot do this — only the external executor's own narrow
  role can. The gap is a **faithfulness asymmetry between the two migration
  variants** (pglite app_writer is more permissive than supabase authenticated),
  visible only under a non-superuser app_writer that the test harness never
  assumes. Owner: reviewer/architect — decide whether to tighten the pglite
  `app_writer` grant to `SELECT, INSERT` only on `state='proposed'` (column/row
  grants or a BEFORE-INSERT guard) for variant parity. Does not block S4.

- **R2 (LOW — ledger). au-1 cannot pass until the malformed tamper statement is
  corrected** (see above). Owner: reviewer (ledger author). The contract's au-1
  intent is already met by the shipped schema.

- **R3 (INFORMATIONAL — out of declared scope). `aios.ts` `useAgentActions` /
  `useDailyBrief` are still on the mock seam; the contract §5 integration note
  asks the builder to re-thread them to `serializeAiosActions`/`serializeDailyBrief`
  under `USE_BACKEND_AIOS`.** The builder restricted the frontend edit to the W8
  humanGate flips per the scope line and left the hooks on the mock. The
  serializer surface itself is shipped and unit-green (w-4). Owner: a later
  frontend-integration slice. Not a write-discipline defect.

- **R4 (INFORMATIONAL). `aios.ts` live `AgentAction.status` union stays
  `'done'|'needs_approval'`** (unchanged, out of S4 edit scope beyond the four
  humanGate flips). No behavioral effect on write-discipline.

---

## SIGN-OFF

S4 AIOS write-discipline **HOLDS**. The proposal-only ledger, checker≠maker +
can_check eligibility, executed⇒receipt / gated⇒approver CHECKs, append-only
tamper-evident hash-chain, exactly-one-audit-row-per-promotion, optimistic
concurrency, and handled-iff-receipt read semantics all enforce as specified and
survived every adversarial probe. The lone red test (au-1) is a **reviewer-owned
ledger SQL defect**, not an implementation gap — the shipped schema satisfies
au-1's intent on both branches. All existing suites remain green; frontend builds
and tests pass with the W8 humanGate re-tag. Recommend: (1) fix the au-1 ledger
statement, (2) decide on R1 variant-parity tightening; neither blocks S4 from
being accepted.
