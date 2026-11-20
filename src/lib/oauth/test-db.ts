import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import * as schema from "@/lib/db/schema"

/**
 * A real in-process Postgres (PGlite) with only what the OAuth tables need: a stub `profiles` table plus the
 * actual 0036 migration file, so the tests also prove that the migration SQL runs and that the atomic
 * single-use claims behave the way the real database does.
 */
export async function createOAuthTestDb() {
  const client = new PGlite()
  await client.exec("CREATE TABLE profiles (id uuid PRIMARY KEY)")
  const migration = readFileSync(resolve(process.cwd(), "drizzle/migrations/0036_mcp_oauth.sql"), "utf8")
  for (const statement of migration.split("--> statement-breakpoint")) await client.exec(statement)
  return drizzle(client, { schema })
}
