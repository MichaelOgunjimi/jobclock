import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

type RuntimeStateApi = {
  operationKey(tab: { id: number; url: string }): string
  resolveStoredState(input: {
    storedState: Record<string, unknown> | null
    tab: { id: number; url: string; title?: string }
    activeOperationKeys: string[]
  }): {
    action: "restore" | "replace" | "start"
    state?: Record<string, unknown>
  }
}

function loadRuntimeState() {
  const source = readFileSync(
    resolve(process.cwd(), "extension/runtime-state.js"),
    "utf8"
  )
  const runtime = new Function(
    `${source}; return globalThis.JobClockRuntimeState;`
  )() as RuntimeStateApi | undefined

  if (!runtime) {
    throw new Error("JobClockRuntimeState was not registered")
  }

  return runtime
}

afterEach(() => {
  delete (
    globalThis as typeof globalThis & { JobClockRuntimeState?: unknown }
  ).JobClockRuntimeState
})

describe("extension runtime state", () => {
  const tab = {
    id: 42,
    url: "https://jobs.example.com/roles/123",
    title: "New title",
  }

  it("builds an operation key from the tab id and exact URL", () => {
    const runtime = loadRuntimeState()

    expect(runtime.operationKey(tab)).toBe(
      "42::https://jobs.example.com/roles/123"
    )
  })

  it("restores same-tab same-URL preview despite title and age changes", () => {
    const runtime = loadRuntimeState()
    const decision = runtime.resolveStoredState({
      storedState: {
        view: "preview",
        tabId: 42,
        tabUrl: tab.url,
        tabTitle: "Old title",
        updatedAt: 1,
        preview: { title: "Engineer" },
      },
      tab,
      activeOperationKeys: [],
    })

    expect(decision.action).toBe("restore")
  })

  it("restores loading while the matching operation is active", () => {
    const runtime = loadRuntimeState()
    const key = runtime.operationKey(tab)
    const decision = runtime.resolveStoredState({
      storedState: {
        view: "loading",
        operation: "preview",
        operationKey: key,
        tabId: tab.id,
        tabUrl: tab.url,
      },
      tab,
      activeOperationKeys: [key],
    })

    expect(decision.action).toBe("restore")
  })

  it("turns orphaned loading into a retryable interrupted error", () => {
    const runtime = loadRuntimeState()
    const decision = runtime.resolveStoredState({
      storedState: {
        view: "loading",
        operation: "preview",
        operationKey: runtime.operationKey(tab),
        tabId: tab.id,
        tabUrl: tab.url,
      },
      tab,
      activeOperationKeys: [],
    })

    expect(decision).toEqual({
      action: "replace",
      state: expect.objectContaining({
        view: "error",
        operation: null,
        tabId: tab.id,
        tabUrl: tab.url,
        message: expect.stringContaining("interrupted"),
      }),
    })
  })

  it("starts fresh for a different URL", () => {
    const runtime = loadRuntimeState()
    const decision = runtime.resolveStoredState({
      storedState: {
        view: "preview",
        tabId: 42,
        tabUrl: "https://jobs.example.com/roles/old",
      },
      tab,
      activeOperationKeys: [],
    })

    expect(decision.action).toBe("start")
  })
})
