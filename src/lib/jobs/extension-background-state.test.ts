import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const STATE_KEY = "jobAssistantRuntimeState"

type Tab = {
  id: number
  url: string
  title?: string
}

type RuntimeMessage = {
  type: string
  payload?: Record<string, unknown>
}

type RuntimeResponse = {
  ok: boolean
  error?: string
  preview?: Record<string, unknown>
  result?: Record<string, unknown>
  state?: Record<string, unknown> | null
}

type StoredState = Record<string, unknown> & {
  view?: string
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve
  })

  return { promise, resolve: resolvePromise }
}

function jsonResponse(body: Record<string, unknown>) {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  }
}

async function loadBackgroundHarness({
  initialState,
  extractedPage = {
    pageTitle: "Engineer",
    pageText: "A readable role description",
    pageHints: {
      title: "Engineer",
      company: "Acme",
      location: "Remote",
      description: "A readable role description",
      salaryText: null,
      metadata: [],
    },
  },
}: {
  initialState?: StoredState
  extractedPage?: Record<string, unknown>
} = {}) {
  const backgroundSource = readFileSync(
    resolve(process.cwd(), "extension/background.js"),
    "utf8"
  )
  const runtimeStateSource = readFileSync(
    resolve(process.cwd(), "extension/runtime-state.js"),
    "utf8"
  )
  const storage = new Map<string, unknown>()
  const previewResponse = deferred<ReturnType<typeof jsonResponse>>()
  const saveResponse = deferred<ReturnType<typeof jsonResponse>>()
  const importScriptCalls: string[] = []
  const scriptCalls: Array<Record<string, unknown>> = []
  const fetchModes: string[] = []
  let messageListener:
    | ((
        message: RuntimeMessage,
        sender: unknown,
        sendResponse: (response: RuntimeResponse) => void
      ) => boolean | undefined)
    | undefined

  if (initialState) {
    storage.set(STATE_KEY, structuredClone(initialState))
  }

  const chromeApi = {
    storage: {
      local: {
        async get(keys: string[]) {
          return Object.fromEntries(
            keys
              .filter((key) => storage.has(key))
              .map((key) => [key, structuredClone(storage.get(key))])
          )
        },
        async set(values: Record<string, unknown>) {
          for (const [key, value] of Object.entries(values)) {
            storage.set(key, structuredClone(value))
          }
        },
        async remove(key: string) {
          storage.delete(key)
        },
      },
    },
    scripting: {
      async executeScript(options: Record<string, unknown>) {
        scriptCalls.push(options)
        if ("files" in options) return []
        return [{ result: structuredClone(extractedPage) }]
      },
    },
    runtime: {
      onMessage: {
        addListener(listener: typeof messageListener) {
          messageListener = listener
        },
      },
    },
  }

  const fetchMock = async (_url: string, init?: RequestInit) => {
    const payload =
      typeof init?.body === "string"
        ? (JSON.parse(init.body) as { mode?: string })
        : {}
    const mode = payload.mode || init?.method || "GET"
    fetchModes.push(mode)

    if (mode === "save") return saveResponse.promise
    return previewResponse.promise
  }

  const importScriptsMock = (...files: string[]) => {
    importScriptCalls.push(...files)
    for (const file of files) {
      if (file !== "runtime-state.js") {
        throw new Error(`Unexpected imported script: ${file}`)
      }
      new Function(runtimeStateSource)()
    }
  }

  new Function("chrome", "fetch", "importScripts", backgroundSource)(
    chromeApi,
    fetchMock,
    importScriptsMock
  )

  if (!messageListener) {
    throw new Error("Background message listener was not registered")
  }

  async function send(message: RuntimeMessage) {
    return new Promise<RuntimeResponse>((resolveResponse, reject) => {
      const keptOpen = messageListener?.(message, {}, resolveResponse)
      if (keptOpen !== true) {
        reject(new Error(`Message channel was not kept open for ${message.type}`))
      }
    })
  }

  async function storedState() {
    const value = storage.get(STATE_KEY)
    return value ? (structuredClone(value) as StoredState) : null
  }

  async function waitForStoredView(view: string) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const state = await storedState()
      if (state?.view === view) return state
      await new Promise((resolveTick) => setTimeout(resolveTick, 0))
    }

    throw new Error(`Timed out waiting for stored view "${view}"`)
  }

  return {
    executeScriptCalls: () => scriptCalls.length,
    fetchCalls: () => fetchModes.length,
    fetchModes: () => [...fetchModes],
    importedScripts: () => [...importScriptCalls],
    resolvePreview(body: Record<string, unknown>) {
      previewResponse.resolve(jsonResponse(body))
    },
    resolveSave(body: Record<string, unknown>) {
      saveResponse.resolve(jsonResponse(body))
    },
    send,
    storedState,
    waitForStoredView,
  }
}

afterEach(() => {
  delete (
    globalThis as typeof globalThis & { JobClockRuntimeState?: unknown }
  ).JobClockRuntimeState
})

describe("extension background runtime state", () => {
  const config = {
    token: "ja_ext_test",
    appBaseUrl: "https://jobclock.example",
  }

  it("restores and coalesces the active preview operation", async () => {
    const harness = await loadBackgroundHarness()
    const tab = {
      id: 9,
      url: "https://jobs.example.com/roles/9",
      title: "Engineer",
    }
    const message = {
      type: "preview-job",
      payload: { config, tab },
    }

    const firstPreview = harness.send(message)
    const loading = await harness.waitForStoredView("loading")
    const secondPreview = harness.send(message)
    const restored = await harness.send({
      type: "get-state",
      payload: { tab },
    })

    expect(harness.importedScripts()).toEqual(["runtime-state.js"])
    expect(loading).toEqual(
      expect.objectContaining({
        operation: "preview",
        operationKey: `${tab.id}::${tab.url}`,
        tabId: tab.id,
        tabUrl: tab.url,
      })
    )
    expect(restored.state).toEqual(
      expect.objectContaining({
        view: "loading",
        operation: "preview",
        operationKey: `${tab.id}::${tab.url}`,
      })
    )
    expect(harness.executeScriptCalls()).toBe(2)
    expect(harness.fetchCalls()).toBe(1)

    harness.resolvePreview({
      preview: {
        title: "Engineer",
        company: "Acme",
        source: "generic",
        url: tab.url,
        description: "Role description",
      },
    })
    await Promise.all([firstPreview, secondPreview])

    expect(await harness.storedState()).toEqual(
      expect.objectContaining({
        view: "preview",
        operation: null,
        tabId: tab.id,
        tabUrl: tab.url,
      })
    )
  })

  it("persists an interrupted error for matching orphaned loading", async () => {
    const tab = {
      id: 12,
      url: "https://jobs.example.com/roles/12",
      title: "Platform Engineer",
    }
    const harness = await loadBackgroundHarness({
      initialState: {
        view: "loading",
        operation: "preview",
        operationKey: `${tab.id}::${tab.url}`,
        tabId: tab.id,
        tabUrl: tab.url,
      },
    })

    const response = await harness.send({
      type: "get-state",
      payload: { tab },
    })

    expect(response).toEqual({
      ok: true,
      state: expect.objectContaining({
        view: "error",
        operation: null,
        tabId: tab.id,
        tabUrl: tab.url,
        message: expect.stringContaining("interrupted"),
      }),
    })
    expect(await harness.storedState()).toEqual(response.state)
  })

  it("returns null when the exact tab URL does not match stored state", async () => {
    const harness = await loadBackgroundHarness({
      initialState: {
        view: "preview",
        operation: null,
        tabId: 15,
        tabUrl: "https://jobs.example.com/roles/old",
      },
    })

    const response = await harness.send({
      type: "get-state",
      payload: {
        tab: {
          id: 15,
          url: "https://jobs.example.com/roles/new",
          title: "Same tab, new job",
        },
      },
    })

    expect(response).toEqual({ ok: true, state: null })
  })

  it("persists failures with the exact tab payload, including tab id zero", async () => {
    const tab = {
      id: 0,
      url: "https://jobs.example.com/roles/zero",
      title: "Unreadable job",
    }
    const harness = await loadBackgroundHarness({
      extractedPage: {
        pageTitle: "",
        pageText: "",
        pageHints: {
          title: null,
          company: null,
          location: null,
          description: null,
          salaryText: null,
          metadata: [],
        },
      },
    })

    const response = await harness.send({
      type: "preview-job",
      payload: { config, tab },
    })

    expect(response).toEqual({
      ok: false,
      error: "This page did not expose readable text for extraction.",
    })
    expect(await harness.storedState()).toEqual(
      expect.objectContaining({
        view: "error",
        operation: null,
        tabId: 0,
        tabUrl: tab.url,
        tabTitle: tab.title,
      })
    )
  })

  it("coalesces saves and clears the operation on success", async () => {
    const harness = await loadBackgroundHarness()
    const tab: Tab = {
      id: 21,
      url: "https://jobs.example.com/roles/21",
      title: "Staff Engineer",
    }
    const preview = {
      title: "Staff Engineer",
      company: "Acme",
      url: tab.url,
    }
    const message = {
      type: "save-preview",
      payload: { config, preview, tab },
    }

    const firstSave = harness.send(message)
    const loading = await harness.waitForStoredView("loading")
    const secondSave = harness.send(message)

    expect(loading).toEqual(
      expect.objectContaining({
        operation: "save",
        operationKey: `${tab.id}::${tab.url}`,
        tabId: tab.id,
        tabUrl: tab.url,
      })
    )
    expect(harness.fetchCalls()).toBe(1)
    expect(harness.fetchModes()).toEqual(["save"])

    harness.resolveSave({ application: { id: "application-21" } })
    await Promise.all([firstSave, secondSave])

    expect(await harness.storedState()).toEqual(
      expect.objectContaining({
        view: "success",
        operation: null,
        tabId: tab.id,
        tabUrl: tab.url,
      })
    )
  })
})
