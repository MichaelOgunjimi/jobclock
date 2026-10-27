import { defineConfig } from "drizzle-kit"
import { assertNotProduction } from "./src/lib/env-guard"

// drizzle-kit (generate, studio) must never be pointed at production by accident.
assertNotProduction("drizzle-kit", process.env.DATABASE_URL, process.env.DATABASE_DIRECT_URL)

export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
