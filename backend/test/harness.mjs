// ============================================================
// Test harness — boots pglite, applies migrations in filename
// order, runs the live seed, returns a seeded PGlite instance.
//
// Reviewer-authored (acceptance ledger). This file does NOT
// implement schema/seed/semantic logic — it only WIRES the
// builder's deliverables together. When backend/db/** is absent
// it fails CLEANLY with a message naming what is missing; that
// clean failure IS the expected RED state for the spike.
//
// Constraints (per backend/CONTEXT.md):
//   - pglite is real Postgres 16 in-process; core-PG only.
//   - UUIDs are app/seed-minted (no gen_random_uuid in migrations).
//   - Migrations applied: backend/db/migrations/NNNN_*.sql
//     EXCLUDING *.supabase.sql and *.down.sql.
//   - Seed: backend/db/seed/seed_live.mjs default export, called
//     with the live db: `await seed(db)`.
// ============================================================
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = resolve(__dirname, "..");
const MIGRATIONS_DIR = join(BACKEND_DIR, "db", "migrations");
const SEED_FILE = join(BACKEND_DIR, "db", "seed", "seed_live.mjs");

// Fixed company ids — the contract of record (BUILD-CONTRACT.md §Seed).
export const FIRM_A = "00000000-0000-0000-0000-00000000aaaa";
export const FIRM_B = "00000000-0000-0000-0000-00000000bbbb";

// Pinned clock oracle (CONTEXT.md locked decision). Never read wall clock.
export const AS_OF_PINNED = "2026-06-22";
export const AS_OF_ADVANCED = "2026-06-24";

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Discover the up-migrations to apply, in filename (lexical) order.
 * Includes NNNN_*.sql; EXCLUDES *.down.sql and *.supabase.sql.
 * Throws a clear RED-state error if the directory or any migration is absent.
 */
export async function migrationFiles() {
  if (!(await exists(MIGRATIONS_DIR))) {
    throw new Error(
      `[harness] RED: migrations directory missing: ${MIGRATIONS_DIR}\n` +
        `  The builder must create backend/db/migrations/NNNN_*.sql ` +
        `(up-only; matching *.down.sql + *.supabase.sql variants per CONTEXT.md).`,
    );
  }
  const all = await readdir(MIGRATIONS_DIR);
  const ups = all
    .filter((f) => f.endsWith(".sql"))
    .filter((f) => !f.endsWith(".down.sql"))
    .filter((f) => !f.endsWith(".supabase.sql"))
    .filter((f) => /^\d{4}_/.test(f)) // NNNN_ prefix
    .sort(); // filename order
  if (ups.length === 0) {
    throw new Error(
      `[harness] RED: no NNNN_*.sql up-migrations found in ${MIGRATIONS_DIR}\n` +
        `  Expected files like 0001_canonical.sql, 0002_mart.sql, etc.`,
    );
  }
  return ups.map((f) => join(MIGRATIONS_DIR, f));
}

/** Apply every up-migration, in order, against the given db. */
export async function applyMigrations(db) {
  const files = await migrationFiles();
  for (const file of files) {
    const sql = await readFile(file, "utf8");
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(
        `[harness] RED: migration failed to apply: ${file}\n  ${err?.message ?? err}`,
      );
    }
  }
  return files;
}

/** Load + run the live seed (default export), passing the db. */
export async function runSeed(db) {
  if (!(await exists(SEED_FILE))) {
    throw new Error(
      `[harness] RED: seed file missing: ${SEED_FILE}\n` +
        `  The builder must create backend/db/seed/seed_live.mjs with a default ` +
        `export 'export default async function seed(db) {...}' that seeds Firm A ` +
        `(live m1..m6, a1..a8, payments incl pm10, minted provenance) and Firm B ` +
        `(synthetic 1 project / 2 milestones) per BUILD-CONTRACT.md.`,
    );
  }
  let mod;
  try {
    mod = await import(pathToFileURL(SEED_FILE));
  } catch (err) {
    throw new Error(
      `[harness] RED: failed to import seed: ${SEED_FILE}\n  ${err?.message ?? err}`,
    );
  }
  const seed = mod?.default;
  if (typeof seed !== "function") {
    throw new Error(
      `[harness] RED: seed_live.mjs has no default-exported function (got ${typeof seed}).`,
    );
  }
  await seed(db);
}

// node: file URL helper without pulling extra deps
function pathToFileURL(p) {
  const u = new URL("file://");
  // resolve absolute, normalise backslashes for win32
  u.pathname = encodeURI(resolve(p).replace(/\\/g, "/"));
  return u;
}

/**
 * Boot a fresh pglite, apply all up-migrations, run the live seed.
 * Returns the seeded PGlite instance.
 * Fails CLEANLY (clear message) when migrations/seed are absent — the RED state.
 */
export async function freshDb() {
  const db = new PGlite();
  await applyMigrations(db);
  await runSeed(db);
  return db;
}
