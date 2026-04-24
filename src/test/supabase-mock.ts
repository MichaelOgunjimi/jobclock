import { vi } from "vitest"

export const mockUser = {
  id: "test-user-id",
  email: "test@example.com",
}

type MockResultInput =
  | { data?: unknown; error?: unknown }
  | ((context: MockQueryCall) => { data?: unknown; error?: unknown } | Promise<{ data?: unknown; error?: unknown }>)

interface MockQueryCall {
  table: string
  operation: string | null
  terminal: "single" | "maybeSingle" | null
  payload: unknown
  options: unknown
  filters: Array<{ type: "eq" | "neq"; column: string; value: unknown }>
  orderBy: { column: string; options?: { ascending?: boolean } } | null
  limitValue: number | null
}

interface MockStorageCall {
  bucket: string
  operation: "createSignedUrl" | "remove" | "upload"
  args: unknown[]
}

function normalizeResult(result: { data?: unknown; error?: unknown } | undefined) {
  return {
    data: result?.data ?? null,
    error: result?.error ?? null,
  }
}

export function createMockSupabaseClient(initialResults: Record<string, MockResultInput | MockResultInput[]> = {}) {
  const queryResults = new Map<string, MockResultInput | MockResultInput[]>(
    Object.entries(initialResults)
  )
  const queryCalls: MockQueryCall[] = []
  const storageCalls: MockStorageCall[] = []
  const storageResults = new Map<string, { data?: unknown; error?: unknown } | Array<{ data?: unknown; error?: unknown }>>()
  let currentUser: typeof mockUser | null = { ...mockUser }

  async function resolveKey(
    key: string,
    context: MockQueryCall
  ): Promise<{ data: unknown; error: unknown }> {
    const value = queryResults.get(key)
    if (!value) return { data: null, error: null }

    if (Array.isArray(value)) {
      const next = value.shift()
      if (!value.length) {
        queryResults.delete(key)
      } else {
        queryResults.set(key, value)
      }

      if (!next) return { data: null, error: null }
      if (typeof next === "function") return normalizeResult(await next(context))
      return normalizeResult(next)
    }

    if (typeof value === "function") return normalizeResult(await value(context))
    return normalizeResult(value)
  }

  async function resolveQueryResult(context: MockQueryCall): Promise<{ data: unknown; error: unknown }> {
    const chainKey = context.operation && context.terminal
      ? `${context.table}.${context.operation}.${context.terminal}`
      : null
    const terminalKey = context.terminal ? `${context.table}.${context.terminal}` : null
    const opKey = context.operation ? `${context.table}.${context.operation}` : null
    const globalChainKey = context.operation && context.terminal ? `*.${context.operation}.${context.terminal}` : null
    const globalTerminalKey = context.terminal ? `*.${context.terminal}` : null
    const globalOpKey = context.operation ? `*.${context.operation}` : null
    const fallbacks = [
      chainKey,
      terminalKey,
      opKey,
      `${context.table}.*`,
      globalChainKey,
      globalTerminalKey,
      globalOpKey,
      "*.*",
    ].filter((key): key is string => !!key)

    for (const key of fallbacks) {
      const resolved = await resolveKey(key, context)
      if (resolved.data !== null || resolved.error !== null || queryResults.has(key)) {
        return resolved
      }
    }

    return { data: null, error: null }
  }

  async function resolveStorageResult(bucket: string, operation: MockStorageCall["operation"]) {
    const key = `${bucket}.${operation}`
    const value = storageResults.get(key) ?? storageResults.get(`${bucket}.*`) ?? storageResults.get(`*.${operation}`) ?? storageResults.get("*.*")
    if (!value) return { data: null, error: null }

    if (Array.isArray(value)) {
      const next = value.shift()
      if (!value.length) {
        storageResults.delete(key)
      } else {
        storageResults.set(key, value)
      }
      return normalizeResult(next)
    }

    return normalizeResult(value)
  }

  function createQueryBuilder(table: string) {
    const state: MockQueryCall = {
      table,
      operation: null,
      terminal: null,
      payload: null,
      options: null,
      filters: [],
      orderBy: null,
      limitValue: null,
    }
    let execution: Promise<{ data: unknown; error: unknown }> | null = null

    const execute = () => {
      if (!execution) {
        execution = resolveQueryResult(state)
        queryCalls.push({
          table: state.table,
          operation: state.operation,
          terminal: state.terminal,
          payload: state.payload,
          options: state.options,
          filters: [...state.filters],
          orderBy: state.orderBy ? { ...state.orderBy } : null,
          limitValue: state.limitValue,
        })
      }
      return execution
    }

    const builder = {
      select: (columns?: string) => {
        if (!state.operation) {
          state.operation = "select"
          state.payload = columns ?? null
        }
        // When chained after insert/update/upsert (e.g. .insert({}).select("id")),
        // preserve the original operation and payload
        return builder
      },
      insert: (payload: unknown) => {
        state.operation = "insert"
        state.payload = payload
        return builder
      },
      update: (payload: unknown) => {
        state.operation = "update"
        state.payload = payload
        return builder
      },
      delete: () => {
        state.operation = "delete"
        return builder
      },
      upsert: (payload: unknown, options?: unknown) => {
        state.operation = "upsert"
        state.payload = payload
        state.options = options ?? null
        return builder
      },
      eq: (column: string, value: unknown) => {
        state.filters.push({ type: "eq", column, value })
        return builder
      },
      neq: (column: string, value: unknown) => {
        state.filters.push({ type: "neq", column, value })
        return builder
      },
      order: (column: string, options?: { ascending?: boolean }) => {
        state.orderBy = { column, options }
        return builder
      },
      limit: (value: number) => {
        state.limitValue = value
        return builder
      },
      single: () => {
        state.terminal = "single"
        return execute()
      },
      maybeSingle: () => {
        state.terminal = "maybeSingle"
        return execute()
      },
      then: (
        onFulfilled?: ((value: { data: unknown; error: unknown }) => unknown) | null,
        onRejected?: ((reason: unknown) => unknown) | null
      ) => execute().then(onFulfilled, onRejected),
      catch: (onRejected: (reason: unknown) => unknown) => execute().catch(onRejected),
      finally: (onFinally: () => void) => execute().finally(onFinally),
    }

    return builder
  }

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: currentUser }, error: null })),
    },
    from: vi.fn((table: string) => createQueryBuilder(table)),
    storage: {
      from: vi.fn((bucket: string) => ({
        remove: vi.fn(async (...args: unknown[]) => {
          storageCalls.push({ bucket, operation: "remove", args })
          return resolveStorageResult(bucket, "remove")
        }),
        upload: vi.fn(async (...args: unknown[]) => {
          storageCalls.push({ bucket, operation: "upload", args })
          return resolveStorageResult(bucket, "upload")
        }),
        createSignedUrl: vi.fn(async (...args: unknown[]) => {
          storageCalls.push({ bucket, operation: "createSignedUrl", args })
          return resolveStorageResult(bucket, "createSignedUrl")
        }),
      })),
    },
  }

  return {
    client,
    setUser(user: typeof mockUser | null) {
      currentUser = user
    },
    setQueryResult(key: string, result: MockResultInput | MockResultInput[]) {
      queryResults.set(key, result)
    },
    queueQueryResult(key: string, result: MockResultInput) {
      const current = queryResults.get(key)
      if (!current) {
        queryResults.set(key, [result])
        return
      }
      if (Array.isArray(current)) {
        current.push(result)
        queryResults.set(key, current)
        return
      }
      queryResults.set(key, [current, result])
    },
    setStorageResult(
      key: string,
      result:
        | { data?: unknown; error?: unknown }
        | Array<{ data?: unknown; error?: unknown }>
    ) {
      storageResults.set(key, result)
    },
    getQueryCalls() {
      return queryCalls
    },
    getStorageCalls() {
      return storageCalls
    },
  }
}
