import { getTableColumns, type Table } from "drizzle-orm"
import { drizzle } from "drizzle-orm/pg-proxy"

/**
 * A real drizzle instance whose driver records each statement (SQL text and bound parameters) instead of
 * hitting a database. Tests assert on the SQL drizzle really generates, e.g. that every query is bound to
 * the token owner's user_id, and script the rows each statement returns. Rows are arrays in select order.
 */
export type RecordedQuery = { sql: string; params: unknown[] }
type Responder = (query: RecordedQuery) => unknown[][]

export const recorded: RecordedQuery[] = []
let responder: Responder = () => []

export function resetFakeDb(next: Responder = () => []) {
  recorded.length = 0
  responder = next
}

export const fakeDb = drizzle(async (sql, params) => {
  const query = { sql, params }
  recorded.push(query)
  return { rows: responder(query) }
})

// The proxy driver has no transactions; run the callback on the same recorder (atomicity is not under test here).
;(fakeDb as unknown as { transaction: unknown }).transaction = (callback: (tx: typeof fakeDb) => unknown) => callback(fakeDb)

/** A full-table row (select() with no columns) in column order. */
export function tableRow(table: Table, values: Record<string, unknown>): unknown[] {
  return Object.keys(getTableColumns(table)).map((key) => values[key] ?? null)
}

export function row(keys: string[], values: Record<string, unknown>): unknown[] {
  return keys.map((key) => values[key] ?? null)
}

/** Every statement that filters rows must be bound to `userId` through a user_id condition, and no other user may appear in a parameter. */
export function expectAllQueriesScopedTo(userId: string, otherUserIds: string[] = []) {
  const statements = recorded.filter((query) => !/^(begin|commit|rollback)/i.test(query.sql))
  if (statements.length === 0) throw new Error("No queries were recorded")
  for (const { sql, params } of statements) {
    if (/^insert/i.test(sql)) {
      if (!params.includes(userId)) throw new Error(`Insert is not owned by the user: ${sql}`)
    } else {
      // profiles is keyed by the user's id itself
      const bound = [...sql.matchAll(/"user_id" = \$(\d+)|"profiles"\."id" = \$(\d+)/g)]
        .map((match) => params[Number(match[1] ?? match[2]) - 1])
      if (bound.length === 0) throw new Error(`Query has no user_id condition: ${sql}`)
      if (bound.some((value) => value !== userId)) throw new Error(`Query is bound to the wrong user: ${sql}`)
    }
    for (const other of otherUserIds) {
      if (params.includes(other)) throw new Error(`Another user's id leaked into a query: ${sql}`)
    }
  }
}
