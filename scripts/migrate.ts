/**
 * Programmatic migration runner with proper error handling.
 * Usage: npm run db:migrate
 *
 * Advantages over `drizzle-kit migrate`:
 * - Suppresses noisy NOTICE logs
 * - Handles migrations applied manually (e.g. via Supabase SQL editor)
 *   by recording them in Drizzle's tracking table automatically
 */

import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"
import postgres from "postgres"
import path from "path"
import crypto from "crypto"
import fs from "fs"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_FOLDER = path.join(__dirname, "../drizzle/migrations")

/** Insert any migration not yet tracked into __drizzle_migrations (no duplicates) */
async function syncMigrationHistory(client: ReturnType<typeof postgres>) {
  const journalPath = path.join(MIGRATIONS_FOLDER, "meta/_journal.json")
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: { tag: string; when: number }[]
  }

  // Get already-tracked hashes
  const existing = await client<{ hash: string }[]>`
    SELECT DISTINCT hash FROM drizzle.__drizzle_migrations
  `
  const trackedHashes = new Set(existing.map((r) => r.hash))

  for (const entry of journal.entries) {
    const sqlPath = path.join(MIGRATIONS_FOLDER, `${entry.tag}.sql`)
    const sql = fs.readFileSync(sqlPath, "utf8")
    const hash = crypto.createHash("sha256").update(sql).digest("hex")

    if (!trackedHashes.has(hash)) {
      await client`
        INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
        VALUES (${hash}, ${entry.when})
      `
    }
  }
}

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("❌  DATABASE_URL is not set")
    process.exit(1)
  }

  console.log("🔄  Running migrations…")

  const client = postgres(url, {
    max: 1,
    onnotice: () => {}, // suppress NOTICE-level messages
  })
  const db = drizzle(client)

  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
    console.log("✅  All migrations applied successfully")
  } catch (err) {
    const cause = (err as { cause?: { code?: string } }).cause
    // 42710 = constraint already exists, 42P07 = relation already exists
    if (cause?.code === "42710" || cause?.code === "42P07") {
      console.warn("⚠️  Some objects already exist (applied manually). Syncing migration history…")
      await syncMigrationHistory(client)
      console.log("✅  Migration history synced — database is up to date")
    } else {
      console.error("❌  Migration failed:", err)
      await client.end()
      process.exit(1)
    }
  } finally {
    await client.end()
  }
}

void main()
