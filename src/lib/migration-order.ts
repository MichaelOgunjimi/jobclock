export type JournalMigration = { tag: string; when: number; hash: string }

/**
 * Drizzle only applies migrations newer than the last applied `created_at`, so a migration merged
 * from a parallel branch with an older timestamp is skipped without any error. Returns those tags.
 */
export function outOfOrderMigrations(journal: JournalMigration[], appliedHashes: Set<string>, lastAppliedAt: number): string[] {
  return journal.filter((m) => !appliedHashes.has(m.hash) && m.when <= lastAppliedAt).map((m) => m.tag)
}
