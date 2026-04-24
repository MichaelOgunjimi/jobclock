# Legacy Supabase Migrations

These SQL files predate the Drizzle migration workflow and are not the active
source of truth for database changes.

Use `drizzle/migrations` for new schema changes. Do not apply these files as a
fresh migration chain without reviewing them first; they contain historical
numbering collisions and policies that may not match the current schema.
