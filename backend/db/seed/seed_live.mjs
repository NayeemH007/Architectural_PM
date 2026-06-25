// ============================================================
// seed_live.mjs — seeds canonical from the LIVE ArchIntel arrays
// (app/src/lib/archintel/data.ts is ground truth).
//
// default export: `export default async function seed(db) { … }`
// called by backend/test/harness.mjs after migrations apply.
//
// pglite HARD RULES honoured:
//   * ALL uuids minted in JS (crypto.randomUUID()) and passed in.
//   * provenance minted at seed (live facts have no refs):
//       source_system   = 'tallyprime'
//       source_record_ref = 'tally:' + <milestone id>     (e.g. 'tally:pm10')
//       observed_at      = deterministic ISO from received_date (or due_date
//                          when unreceived) — NO wall clock.
//       source_id        = one minted uuid per (company, source_system),
//                          so mart.kpi_lineage.source_id is NOT NULL.
//   * DEFERRED tax columns (net_receivable/vat/vds_withheld/ait_withheld)
//     left NULL (lock ⑤).
//
// Firm A (company_id 0000-…-aaaa) = the REAL live entities (m1..m6, a1..a8,
//   payments incl pm10, c1..c6).
// Firm B (company_id 0000-…-bbbb) = synthetic isolation proof (1 project,
//   2 milestones with DISTINCT refs).
// ============================================================
import { randomUUID } from "node:crypto";

const FIRM_A = "00000000-0000-0000-0000-00000000aaaa";
const FIRM_B = "00000000-0000-0000-0000-00000000bbbb";

// ─── LIVE Firm-A data (verbatim from app/src/lib/archintel/data.ts) ───
const membersA = [
  { id: "m1", name: "Sharif Raiana Mahmud", role: "founder",      title: "Chief Interior Architect & Founder", is_approver: true,  email: "raiana@spaceesse.com", can_check: true  },
  { id: "m2", name: "Fariha Karim",         role: "principal",    title: "Principal Architect & Co-Founder",   is_approver: false, email: "fariha@spaceesse.com", can_check: false },
  { id: "m3", name: "Tasnia Rahman",        role: "project_lead", title: "Project Lead",                       is_approver: false, email: "tasnia@spaceesse.com", can_check: false },
  { id: "m4", name: "Imran Kabir",          role: "project_lead", title: "Project Lead",                       is_approver: false, email: "imran@spaceesse.com",  can_check: false },
  { id: "m5", name: "Nabila Hasan",         role: "designer",     title: "3D & Visualization Designer",        is_approver: false, email: "nabila@spaceesse.com", can_check: false },
  { id: "m6", name: "Rifat Ahmed",          role: "designer",     title: "Junior Designer (Technical)",        is_approver: false, email: "rifat@spaceesse.com",  can_check: false },
];

const clientsAData = [
  { id: "c1", name: "Mr. Rahim (Gulshan)",        contact_name: "Mr. Abdur Rahim",      phone: "+8801711000101", email: "rahim@gmail.com",        whatsapp_group: "Gulshan Apt · Space Esse",   type: "residential" },
  { id: "c2", name: "Lumen Hospitality",          contact_name: "Sadia Islam",          phone: "+8801711000102", email: "sadia@lumen.com.bd",     whatsapp_group: "Lumen Café · Space Esse",    type: "hospitality" },
  { id: "c3", name: "MediCare Ltd.",              contact_name: "Dr. Anwar",            phone: "+8801711000103", email: "anwar@medicare.com.bd",  whatsapp_group: "MediCare Clinic · Space Esse", type: "healthcare" },
  { id: "c4", name: "Mrs. Anika (Bashundhara)",   contact_name: "Mrs. Anika Chowdhury", phone: "+8801711000104", email: "anika@gmail.com",        whatsapp_group: "Penthouse · Space Esse",     type: "residential" },
  { id: "c5", name: "Bashati Group",              contact_name: "Sohel Bashati",        phone: "+8801711000105", email: "sohel@bashati.com",      whatsapp_group: "Tejgaon Office · Space Esse", type: "corporate" },
  { id: "c6", name: "Aura Boutique",              contact_name: "Farzana Aura",         phone: "+8801711000106", email: "farzana@aura.com.bd",    whatsapp_group: "Aura Uttara · Space Esse",   type: "retail" },
];

const projectsAData = [
  { id: "a1", code: "SE-101", name: "Gulshan Apartment",            client_id: "c1", lead_id: "m3", type: "residential", status: "active",   current_phase: 3, contract_value: 2_800_000, health: "on_track", blocker: null },
  { id: "a2", code: "SE-104", name: "Banani Café — Lumen",          client_id: "c2", lead_id: "m4", type: "hospitality", status: "active",   current_phase: 2, contract_value: 1_900_000, health: "watch",    blocker: null },
  { id: "a3", code: "SE-098", name: "Dhanmondi Clinic — MediCare",  client_id: "c3", lead_id: "m3", type: "healthcare",  status: "active",   current_phase: 4, contract_value: 3_400_000, health: "on_track", blocker: null },
  { id: "a4", code: "SE-106", name: "Bashundhara Penthouse",        client_id: "c4", lead_id: "m4", type: "residential", status: "active",   current_phase: 1, contract_value: 4_600_000, health: "on_track", blocker: null },
  { id: "a5", code: "SE-103", name: "Tejgaon Office — Bashati",     client_id: "c5", lead_id: "m3", type: "corporate",   status: "active",   current_phase: 2, contract_value: 3_100_000, health: "at_risk",  blocker: "Layout freeze waiting on Raiana's approval · Phase-2 payment 18 days overdue" },
  { id: "a6", code: "SE-100", name: "Uttara Boutique — Aura",       client_id: "c6", lead_id: "m4", type: "retail",      status: "active",   current_phase: 3, contract_value: 1_500_000, health: "on_track", blocker: null },
  { id: "a7", code: "SE-088", name: "Mirpur Restaurant — Spice Garden", client_id: "c2", lead_id: "m4", type: "hospitality", status: "archived", current_phase: 4, contract_value: 2_200_000, health: "on_track", blocker: null },
  { id: "a8", code: "SE-091", name: "Gulshan Salon — Glow",         client_id: "c6", lead_id: "m3", type: "retail",      status: "archived", current_phase: 4, contract_value: 1_300_000, health: "on_track", blocker: null },
];

// live `amount` -> gross_amount. linked_phase null becomes 0 to satisfy the
// (company,project,label,linked_phase) idempotency key (NULL would skip it).
const paymentsAData = [
  { id: "pm1",  project_id: "a1", label: "Mobilisation (10%)",        linked_phase: 1,    type: "phased",  gross_amount: 280_000,   due_date: "2026-02-15", received_amount: 280_000,   received_date: "2026-02-14", status: "paid"    },
  { id: "pm2",  project_id: "a1", label: "Concept sign-off (30%)",    linked_phase: 2,    type: "phased",  gross_amount: 840_000,   due_date: "2026-04-25", received_amount: 840_000,   received_date: "2026-04-26", status: "paid"    },
  { id: "pm3",  project_id: "a1", label: "Design development (30%)",  linked_phase: 3,    type: "phased",  gross_amount: 840_000,   due_date: "2026-06-25", received_amount: 0,         received_date: null,         status: "pending" },
  { id: "pm4",  project_id: "a1", label: "Construction docs (30%)",   linked_phase: 4,    type: "phased",  gross_amount: 840_000,   due_date: "2026-08-20", received_amount: 0,         received_date: null,         status: "pending" },
  { id: "pm5",  project_id: "a2", label: "Full payment (upfront)",    linked_phase: null, type: "upfront", gross_amount: 1_900_000, due_date: "2026-04-05", received_amount: 1_900_000, received_date: "2026-04-04", status: "paid"    },
  { id: "pm6",  project_id: "a3", label: "Mobilisation (20%)",        linked_phase: 1,    type: "phased",  gross_amount: 680_000,   due_date: "2025-11-25", received_amount: 680_000,   received_date: "2025-11-24", status: "paid"    },
  { id: "pm7",  project_id: "a3", label: "Design development (40%)",  linked_phase: 3,    type: "phased",  gross_amount: 1_360_000, due_date: "2026-04-10", received_amount: 1_360_000, received_date: "2026-04-12", status: "paid"    },
  { id: "pm8",  project_id: "a3", label: "Construction docs (40%)",   linked_phase: 4,    type: "phased",  gross_amount: 1_360_000, due_date: "2026-06-30", received_amount: 600_000,   received_date: "2026-06-18", status: "partial" },
  { id: "pm9",  project_id: "a5", label: "Mobilisation (20%)",        linked_phase: 1,    type: "phased",  gross_amount: 620_000,   due_date: "2026-03-20", received_amount: 620_000,   received_date: "2026-03-19", status: "paid"    },
  { id: "pm10", project_id: "a5", label: "Concept sign-off (30%)",    linked_phase: 2,    type: "phased",  gross_amount: 930_000,   due_date: "2026-06-04", received_amount: 0,         received_date: null,         status: "overdue" },
  { id: "pm11", project_id: "a4", label: "Mobilisation (15%)",        linked_phase: 1,    type: "phased",  gross_amount: 690_000,   due_date: "2026-05-30", received_amount: 690_000,   received_date: "2026-05-29", status: "paid"    },
  { id: "pm12", project_id: "a6", label: "Full payment (upfront)",    linked_phase: null, type: "upfront", gross_amount: 1_500_000, due_date: "2026-01-15", received_amount: 1_500_000, received_date: "2026-01-14", status: "paid"    },
];

// ─── Firm B synthetic isolation proof (distinct refs) ───
const projectsBData = [
  { id: "b1", code: "BB-001", name: "Firm-B Demo Project", client_id: null, lead_id: null, type: "corporate", status: "active", current_phase: 2, contract_value: 1_000_000, health: "at_risk", blocker: null },
];
const paymentsBData = [
  { id: "bpm1", project_id: "b1", label: "Firm-B milestone one", linked_phase: 1, type: "phased", gross_amount: 500_000, due_date: "2026-05-01", received_amount: 0, received_date: null, status: "overdue" },
  { id: "bpm2", project_id: "b1", label: "Firm-B milestone two", linked_phase: 2, type: "phased", gross_amount: 500_000, due_date: "2026-06-01", received_amount: 0, received_date: null, status: "overdue" },
];

// observed_at: deterministic ISO from received_date (or due_date if unreceived).
function observedAt(pm) {
  const d = pm.received_date ?? pm.due_date;
  return `${d}T00:00:00Z`;
}
// linked_phase 0 stand-in for NULL so the idempotency unique key never sees NULL.
const phaseKey = (lp) => (lp == null ? 0 : lp);

export default async function seed(db) {
  // one source per (company, source_system) — minted uuid keeps lineage.source_id NOT NULL.
  const srcA = randomUUID();
  const srcB = randomUUID();

  await db.query(
    `insert into canonical.source (id, company_id, source_system, display_name)
     values ($1,$2,'tallyprime','TallyPrime (Firm A)'), ($3,$4,'tallyprime','TallyPrime (Firm B)')
     on conflict (id) do nothing`,
    [srcA, FIRM_A, srcB, FIRM_B],
  );

  // members (Firm A)
  for (const m of membersA) {
    await db.query(
      `insert into canonical.member (id, company_id, name, role, title, is_approver, email, can_check)
       values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
      [m.id, FIRM_A, m.name, m.role, m.title, m.is_approver, m.email, m.can_check],
    );
  }

  // clients (Firm A)
  for (const c of clientsAData) {
    await db.query(
      `insert into canonical.client (id, company_id, name, contact_name, phone, email, whatsapp_group, type)
       values ($1,$2,$3,$4,$5,$6,$7,$8) on conflict (id) do nothing`,
      [c.id, FIRM_A, c.name, c.contact_name, c.phone, c.email, c.whatsapp_group, c.type],
    );
  }

  // projects (Firm A + Firm B)
  for (const p of [...projectsAData.map((p) => ({ ...p, company_id: FIRM_A })),
                   ...projectsBData.map((p) => ({ ...p, company_id: FIRM_B }))]) {
    await db.query(
      `insert into canonical.project
         (id, company_id, code, name, client_id, lead_id, type, status, current_phase, contract_value, health, blocker, completeness)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,100) on conflict (id) do nothing`,
      [p.id, p.company_id, p.code, p.name, p.client_id, p.lead_id, p.type, p.status, p.current_phase, p.contract_value, p.health, p.blocker],
    );
  }

  // payment_milestones (Firm A + Firm B); tax columns left NULL (lock ⑤).
  const allPayments = [
    ...paymentsAData.map((pm) => ({ ...pm, company_id: FIRM_A })),
    ...paymentsBData.map((pm) => ({ ...pm, company_id: FIRM_B })),
  ];
  for (const pm of allPayments) {
    await db.query(
      `insert into canonical.payment_milestone
         (id, company_id, project_id, label, linked_phase, type,
          gross_amount, received_amount, due_date, received_date, status,
          net_receivable, vat, vds_withheld, ait_withheld,
          source_system, source_record_ref, observed_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
               null,null,null,null,
               'tallyprime', $12, $13)
       on conflict (company_id, project_id, label, linked_phase) do nothing`,
      [pm.id, pm.company_id, pm.project_id, pm.label, phaseKey(pm.linked_phase), pm.type,
       pm.gross_amount, pm.received_amount, pm.due_date, pm.received_date, pm.status,
       "tally:" + pm.id, observedAt(pm)],
    );
  }
}
