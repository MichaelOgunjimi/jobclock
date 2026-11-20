import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import * as schema from "@/lib/db/schema"

const MIGRATIONS = ["0035_mcp_api_tokens", "0036_mcp_oauth", "0037_mcp_access_controls"]

export async function applyMigrations(client: PGlite, names: string[] = MIGRATIONS) {
  for (const name of names) {
    const migration = readFileSync(resolve(process.cwd(), `drizzle/migrations/${name}.sql`), "utf8")
    for (const statement of migration.split("--> statement-breakpoint")) await client.exec(statement)
  }
}

/**
 * A real in-process Postgres (PGlite) with only what the MCP tables need: a stub `profiles` table plus the actual
 * migration files (api_tokens, the OAuth tables and the access controls), so the tests also prove that the migration SQL
 * runs and that the atomic single-use claims behave the way the real database does.
 */
export async function createOAuthTestDb() {
  const client = new PGlite()
  await client.exec("CREATE TABLE profiles (id uuid PRIMARY KEY)")
  await applyMigrations(client)
  return drizzle(client, { schema })
}
