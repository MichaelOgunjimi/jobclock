/**
 * Programmatic migration runner.
 * Usage: npm run db:migrate [-- --sync-history]
 *
 * Compared with `drizzle-kit migrate`:
 * - Refuses to touch production unless ALLOW_PRODUCTION=<project ref> is set (src/lib/env-guard.ts)
 * - Refuses when an unapplied migration is older than the last applied one (Drizzle would skip it silently)
 * - Suppresses noisy NOTICE logs
 * - "already exists" errors fail the run. Only with --sync-history are the objects assumed to have been
 *   applied by hand (e.g. in the Supabase SQL editor) and the whole journal recorded as applied.
 */

import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import path from "path"
import crypto from "crypto"
import fs from "fs"
import { fileURLToPath } from "url"
import { assertNotProduction } from "../src/lib/env-guard"
import { outOfOrderMigrations } from "../src/lib/migration-order"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_FOLDER = path.join(__dirname, "../drizzle/migrations")

type JournalEntry = { tag: string; when: number }

function readJournal() {
  const journalPath = path.join(MIGRATIONS_FOLDER, "meta/_journal.json")
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as { entries: JournalEntry[] }
  return journal.entries.map((entry) => ({
    ...entry,
    hash: crypto.createHash("sha256").update(fs.readFileSync(path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`), "utf8")).digest("hex"),
  }))
}

/** Insert any migration not yet tracked into __drizzle_migrations (no duplicates) */
async function syncMigrationHistory(client: ReturnType<typeof postgres>) {
  const existing = await client<{ hash: string }[]>`
    SELECT DISTINCT hash FROM drizzle.__drizzle_migrations
  `
  const trackedHashes = new Set(existing.map((r) => r.hash))

  for (const entry of readJournal()) {
    if (!trackedHashes.has(entry.hash)) {
      await client`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${entry.hash}, ${entry.when})
      `
    }
  }
}

async function main() {
  const url = process.env.DATABASE_DIRECT_URL ?? process.env.DATABASE_URL
  if (!url) {
    console.error("❌  DATABASE_DIRECT_URL / DATABASE_URL is not set")
    process.exit(1)
  }

  try {
    assertNotProduction("db:migrate", process.env.DATABASE_DIRECT_URL, process.env.DATABASE_URL)
  } catch (err) {
    console.error(`❌  ${(err as Error).message}`)
    process.exit(1)
  }

  const target = new URL(url)
  console.log(`🔄  Running migrations on ${target.username}@${target.hostname}:${target.port}…`)

  const client = postgres(url, {
    max: 1,
    onnotice: () => {}, // suppress NOTICE-level messages
  })
  const db = drizzle(client)

  try {
    // The tracking table does not exist on a fresh database, which is fine: nothing is applied yet.
    const applied = await client<{ hash: string; created_at: string }[]>`
      SELECT hash, created_at FROM drizzle.__drizzle_migrations
    `.catch(() => [])
    const skipped = outOfOrderMigrations(
      readJournal(),
      new Set(applied.map((row) => row.hash)),
      Math.max(0, ...applied.map((row) => Number(row.created_at)))
    )
    if (skipped.length > 0) {
      console.error(`❌  Unapplied migrations older than the last applied one would be skipped silently: ${skipped.join(", ")}`)
      console.error("    Give them a newer timestamp (regenerate them on top of the current journal).")
      process.exit(1)
    }

    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    console.log("✅  All migrations applied successfully")
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause
    // 42710 = constraint already exists, 42P07 = relation already exists
    const alreadyExists = cause?.code === "42710" || cause?.code === "42P07"
    if (alreadyExists && process.argv.includes("--sync-history")) {
      console.warn("⚠️  Some objects already exist (applied manually). Syncing migration history…")
      await syncMigrationHistory(client)
      console.log("✅  Migration history synced — database is up to date")
    } else {
      console.error("❌  Migration failed:", err)
      if (alreadyExists) {
        console.error("    Objects already exist. If they were applied by hand and you are sure the schema matches, rerun with --sync-history.")
      }
      await client.end()
      process.exit(1)
    }
  } finally {
    await client.end()
  }
}

void main()
