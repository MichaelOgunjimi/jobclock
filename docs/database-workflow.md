# Database Workflow

The Job Assistant uses **Drizzle ORM** as the primary owner of application schema, with **Supabase SQL** handling platform-specific setup like RLS policies, auth triggers, and storage buckets.

## Overview

- **Drizzle ORM** manages application tables and their structure
- **Supabase SQL** handles platform integration (auth foreign keys, RLS, storage)
- Two connection strings serve different purposes
- Legacy Supabase migrations should be ignored for fresh setups

## Schema Editing Workflow

### 1. Edit Schema
Edit `src/lib/db/schema.ts` to add/modify tables or columns:

```typescript
export const newTable = pgTable("new_table", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").notNull(),
  // ... other columns
})
```

### 2. Generate Migration
```bash
npm run db:generate
```

This creates SQL migration files in `drizzle/migrations/` based on your schema changes.

### 3. Inspect Generated SQL
Always review the generated migration file before applying:
```bash
cat drizzle/migrations/0001_new_table.sql
```

### 4. Apply Migration
```bash
npm run db:migrate
```

This runs the migration against your database using the direct connection.

## Connection Strings

The project uses two different database URLs:

### `DATABASE_DIRECT_URL` (Port 5432)
- **Purpose**: Direct connection for `drizzle-kit` operations
- **Usage**: Migrations, schema generation, Drizzle Studio
- **Format**: `postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres`

### `DATABASE_URL` (Port 6543)
- **Purpose**: Transaction pooler for application runtime
- **Usage**: API routes, server actions, app queries
- **Format**: `postgresql://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres`

> **Note**: Only `DATABASE_DIRECT_URL` is used by `drizzle.config.ts`. The app runtime automatically uses `DATABASE_URL` via Supabase client configuration.

## Supabase Platform Setup

After running Drizzle migrations, apply Supabase-specific configuration:

### 1. Run Platform Setup SQL
Execute `supabase/sql/platform-setup.sql` in the Supabase SQL editor. This file adds:

- **Auth foreign keys**: Links application tables to `auth.users`
- **RLS policies**: Row-level security for user data isolation
- **Auth trigger**: Auto-creates profile on user signup
- **Storage buckets**: `cvs` and `templates` buckets with user-specific policies
- **Indexes**: Performance indexes for common queries

### 2. Bucket Configuration
The setup creates two private storage buckets:

- **`cvs`**: Stores uploaded CV files (PDF/DOCX)
- **`templates`**: Stores user-uploaded CV/cover letter templates (DOCX)

Both use RLS policies that restrict access to the file owner.

## Known Gotchas

### Type Change Migrations
When changing column types, Drizzle generates incomplete SQL. You must manually add a `USING` clause:

**Generated (broken):**
```sql
ALTER TABLE "table" ALTER COLUMN "column" SET DATA TYPE integer;
```

**Fixed:**
```sql
ALTER TABLE "table" ALTER COLUMN "column" SET DATA TYPE integer USING column::integer;
```

### Legacy Migrations
The `supabase/migrations/` folder contains historical migrations from the Supabase-first setup. **Do not use these for fresh installations.** They overlap with Drizzle table creation and will cause conflicts.

For fresh setups:
1. Run `npm run db:migrate` (Drizzle-managed schema)
2. Run `supabase/sql/platform-setup.sql` (Supabase platform features)
3. Ignore files in `supabase/migrations/`

## Adding a New Table

1. **Define in Schema**: Add table to `src/lib/db/schema.ts`
   ```typescript
   export const newFeature = pgTable("new_feature", {
     id: uuid("id").defaultRandom().primaryKey(),
     userId: uuid("user_id").notNull(),
     name: text("name").notNull(),
     createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
   })
   ```

2. **Generate Migration**: `npm run db:generate`

3. **Review Migration**: Check `drizzle/migrations/` for correct SQL

4. **Apply Migration**: `npm run db:migrate`

5. **Add RLS (if user-specific)**:
   ```sql
   ALTER TABLE public.new_feature ENABLE ROW LEVEL SECURITY;
   
   CREATE POLICY "Users can view own records" ON public.new_feature 
     FOR SELECT USING (auth.uid() = user_id);
   
   CREATE POLICY "Users can insert own records" ON public.new_feature 
     FOR INSERT WITH CHECK (auth.uid() = user_id);
   ```

6. **Add Auth Foreign Key** (if references users):
   ```sql
   ALTER TABLE public.new_feature
     ADD CONSTRAINT new_feature_user_id_auth_users_fk
     FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
   ```

7. **Update Types**: If using TypeScript, restart the dev server to pick up new types.

## Adding a New Column

1. **Edit Schema**: Add column to existing table in `src/lib/db/schema.ts`
   ```typescript
   export const existingTable = pgTable("existing_table", {
     // ... existing columns
     newColumn: text("new_column"), // Add this
   })
   ```

2. **Generate Migration**: `npm run db:generate`

3. **Review SQL**: Ensure the generated `ALTER TABLE` statement is correct

4. **Apply**: `npm run db:migrate`

## Development Workflow

### Local Development
```bash
# Start with fresh database
npm run db:migrate
# Apply platform setup via Supabase dashboard

# Make schema changes
# Edit src/lib/db/schema.ts
npm run db:generate
# Review generated SQL
npm run db:migrate
```

### Database Introspection
```bash
# Browse database with Drizzle Studio
npm run db:studio
```

### Resetting Database
If you need to start fresh (⚠️ **destroys all data**):

1. Reset via Supabase dashboard: Project Settings → General → Reset Database
2. Run `npm run db:migrate` to apply Drizzle schema
3. Execute `platform-setup.sql` in Supabase SQL editor

## Error Troubleshooting

### "relation does not exist"
- Ensure `npm run db:migrate` completed successfully
- Check Supabase project database is accessible
- Verify `DATABASE_DIRECT_URL` is correct

### "column does not exist" in app
- Restart Next.js dev server to refresh types
- Ensure migration was applied to the correct database
- Check you're using the right `DATABASE_URL` for runtime

### Type errors after migration
```bash
# Regenerate types
npx supabase gen types typescript --db-url "$DATABASE_DIRECT_URL" > src/lib/supabase/database.types.ts
```

### RLS policy violations
- Verify user is authenticated in your API routes
- Check policy conditions match your data access patterns
- Use `auth.uid()` correctly in policies

## Further Reading

- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL USING clause](https://www.postgresql.org/docs/current/sql-altertable.html) for type changes