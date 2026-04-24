# Supabase Migrations

Active database migrations are managed with Drizzle in `drizzle/migrations`.

The old Supabase SQL migrations were moved to `supabase/legacy-migrations` so
they are not accidentally applied by Supabase CLI workflows. They are retained
only as historical reference.
