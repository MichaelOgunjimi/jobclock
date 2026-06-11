import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

const STATE_KEY = "jobAssistantRuntimeState"

type Tab = {
  id: number
  url: string
  title?: string
}

type RuntimeState = {
  view: string
  tabId: number
  tabUrl: string
  [key: string]: unknown
}

type RuntimeMessage = {
  type: string
  payload?: {
    tab?: Tab
    [key: string]: unknown
  }
}

type StorageListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: string
) => void

const activeTab = {
  id: 7,
  url: "https://jobs.example.com/roles/7",
  title: "Title changed after hydration",
}

const previewFixture = {
  title: "Platform Engineer",
  company: "Acme",
  location: "Remote",
  source: "generic",
  url: activeTab.url,
  description: "Build a reliable platform.",
  isEasyApply: false,
  salaryMin: null,
  salaryMax: null,
}

const previewStateFixture: RuntimeState = {
  view: "preview",
  tabId: activeTab.id,
  tabUrl: activeTab.url,
  preview: previewFixture,
  updatedAt: Date.now(),
}

const loadingFixture: RuntimeState = {
  view: "loading",
  operation: "preview",
  operationKey: `${activeTab.id}::${activeTab.url}`,
  tabId: activeTab.id,
  tabUrl: activeTab.url,
  loadingTitle: "Extracting job details",
  loadingMessage: "Reading the current page.",
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void
  const promise = new Promise<T>((resolvePromiseValue) => {
    resolvePromise = resolvePromiseValue
  })

  return { promise, resolve: resolvePromise }
}

async function waitFor(assertion: () => void) {
  let lastError: unknown

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await new Promise((resolveTick) => setTimeout(resolveTick, 0))
    }
  }

  throw lastError
}

async function loadPopupHarness({
  tab = activeTab,
  runtimeState = null,
  deferInitialState = false,
  deferClearState = false,
}: {
  tab?: Tab
  runtimeState?: RuntimeState | null
  deferInitialState?: boolean
  deferClearState?: boolean
} = {}) {
  const popupHtml = readFileSync(
    resolve(process.cwd(), "extension/popup.html"),
    "utf8"
  )
  const popupSource = readFileSync(
    resolve(process.cwd(), "extension/popup.js"),
    "utf8"
  )
  const runtimeStateSource = readFileSync(
    resolve(process.cwd(), "extension/runtime-state.js"),
    "utf8"
  )
  const messages: RuntimeMessage[] = []
  const storageListeners = new Set<StorageListener>()
  const initialStateResponse = deferred<RuntimeState | null>()
  const clearStateResponse = deferred<void>()
  let currentRuntimeState = runtimeState
  let initialStateRequested = false

  document.open()
  document.write(popupHtml)
  document.close()

  const chromeApi = {
    tabs: {
      async query() {
        return [structuredClone(tab)]
      },
    },
    storage: {
      local: {
        async get() {
          return {
            appBaseUrl: "https://jobclock.example",
            token: "ja_ext_test",
          }
        },
        async set() {},
      },
      onChanged: {
        addListener(listener: StorageListener) {
          storageListeners.add(listener)
        },
        removeListener(listener: StorageListener) {
          storageListeners.delete(listener)
        },
      },
    },
    runtime: {
      lastError: undefined,
      sendMessage(
        message: RuntimeMessage,
        callback: (response: Record<string, unknown>) => void
      ) {
        messages.push(structuredClone(message))

        if (message.type === "get-state") {
          if (!initialStateRequested && deferInitialState) {
            initialStateRequested = true
            void initialStateResponse.promise.then((state) => {
              callback({ ok: true, state })
            })
            return
          }

          initialStateRequested = true
          queueMicrotask(() =>
            callback({
              ok: true,
              state: currentRuntimeState
                ? structuredClone(currentRuntimeState)
                : null,
            })
          )
          return
        }

        if (message.type === "clear-state") {
          const finishClear = () => {
            currentRuntimeState = null
            callback({ ok: true })
          }

          if (deferClearState) {
            void clearStateResponse.promise.then(finishClear)
          } else {
            queueMicrotask(finishClear)
          }
          return
        }

        if (message.type === "preview-job") {
          queueMicrotask(() =>
            callback({
              ok: true,
              preview: { preview: structuredClone(previewFixture) },
            })
          )
          return
        }

        if (message.type === "get-recent-applications") {
          queueMicrotask(() =>
            callback({ ok: true, recentApplications: [] })
          )
          return
        }

        queueMicrotask(() => callback({ ok: true }))
      },
    },
  }

  new Function(runtimeStateSource)()
  new Function("chrome", popupSource)(chromeApi)

  function visibleState() {
    const ids = [
      "setup-state",
      "loading-state",
      "error-state",
      "preview-state",
      "success-state",
      "recent-state",
    ]
    return ids.find(
      (id) => !document.getElementById(id)?.classList.contains("hidden")
    )
  }

  return {
    async ready() {
      await waitFor(() => {
        expect(messages.some((message) => message.type === "get-state")).toBe(
          true
        )
        if (!deferInitialState) {
          expect(visibleState()).toBeTruthy()
        }
      })
    },
    async click(id: string, expectedPreviewRequests = 1) {
      document.getElementById(id)?.click()
      await waitFor(() => {
        expect(
          messages.filter((message) => message.type === "preview-job")
        ).toHaveLength(expectedPreviewRequests)
      })
    },
    emitRuntimeState(nextState: RuntimeState, areaName = "local") {
      const oldValue = currentRuntimeState
      currentRuntimeState = nextState
      for (const listener of storageListeners) {
        listener(
          {
            [STATE_KEY]: {
              oldValue,
              newValue: structuredClone(nextState),
            },
          },
          areaName
        )
      }
    },
    emitUnrelatedStorageChange(nextState: RuntimeState) {
      for (const listener of storageListeners) {
        listener(
          {
            anotherKey: {
              newValue: structuredClone(nextState),
            },
          },
          "local"
        )
      }
    },
    messageTypes() {
      return messages
        .map((message) => message.type)
        .filter((type) => type !== "get-recent-applications")
    },
    messagesOfType(type: string) {
      return messages.filter((message) => message.type === type)
    },
    previewTitle() {
      return document.getElementById("preview-title")?.textContent
    },
    resolveClearState() {
      clearStateResponse.resolve()
    },
    resolveInitialState(state: RuntimeState | null) {
      initialStateResponse.resolve(state)
    },
    storageListenerCount() {
      return storageListeners.size
    },
    visibleState,
  }
}

afterEach(() => {
  delete (
    globalThis as typeof globalThis & { JobClockRuntimeState?: unknown }
  ).JobClockRuntimeState
  document.body.innerHTML = ""
})

describe("extension popup runtime state", () => {
  it("loads runtime-state.js before popup.js", () => {
    const html = readFileSync(
      resolve(process.cwd(), "extension/popup.html"),
      "utf8"
    )

    expect(html.indexOf('src="runtime-state.js"')).toBeGreaterThan(-1)
    expect(html.indexOf('src="runtime-state.js"')).toBeLessThan(
      html.indexOf('src="popup.js"')
    )
  })

  it("restores same-URL preview without comparing title or age", async () => {
    const harness = await loadPopupHarness({
      runtimeState: {
        ...previewStateFixture,
        tabTitle: "Old title",
        updatedAt: 1,
      },
    })

    await harness.ready()

    expect(harness.previewTitle()).toBe(previewFixture.title)
    expect(harness.messagesOfType("get-state")[0]).toEqual({
      type: "get-state",
      payload: { tab: activeTab },
    })
    expect(harness.messagesOfType("preview-job")).toHaveLength(0)
  })

  it("updates a reopened loading popup when storage changes to preview", async () => {
    const harness = await loadPopupHarness({
      runtimeState: loadingFixture,
    })

    await harness.ready()
    expect(harness.visibleState()).toBe("loading-state")

    harness.emitRuntimeState(previewStateFixture)

    expect(harness.visibleState()).toBe("preview-state")
    expect(harness.previewTitle()).toBe(previewFixture.title)
    expect(harness.messagesOfType("preview-job")).toHaveLength(0)
  })

  it("renders loading, success, and error runtime state transitions", async () => {
    const harness = await loadPopupHarness({
      runtimeState: loadingFixture,
    })

    await harness.ready()
    expect(harness.visibleState()).toBe("loading-state")

    harness.emitRuntimeState({
      view: "success",
      tabId: activeTab.id,
      tabUrl: activeTab.url,
      result: {
        applicationUrl: "https://jobclock.example/applications/123",
        alreadySaved: false,
      },
    })
    expect(harness.visibleState()).toBe("success-state")

    harness.emitRuntimeState({
      view: "error",
      tabId: activeTab.id,
      tabUrl: activeTab.url,
      message: "Extraction failed.",
    })
    expect(harness.visibleState()).toBe("error-state")
    expect(document.getElementById("error-message")?.textContent).toBe(
      "Extraction failed."
    )
  })

  it("ignores storage changes for other tabs, URLs, keys, and areas", async () => {
    const harness = await loadPopupHarness({
      runtimeState: loadingFixture,
    })

    await harness.ready()

    harness.emitRuntimeState(
      {
        ...previewStateFixture,
        tabId: 99,
      },
      "local"
    )
    harness.emitRuntimeState(
      {
        ...previewStateFixture,
        tabUrl: "https://jobs.example.com/roles/other",
      },
      "local"
    )
    harness.emitRuntimeState(previewStateFixture, "sync")
    harness.emitUnrelatedStorageChange(previewStateFixture)

    expect(harness.visibleState()).toBe("loading-state")
    expect(harness.previewTitle()).not.toBe(previewFixture.title)
  })

  it("does not let a stale get-state response replace a newer storage state", async () => {
    const harness = await loadPopupHarness({
      runtimeState: loadingFixture,
      deferInitialState: true,
    })

    await harness.ready()
    harness.emitRuntimeState(previewStateFixture)
    harness.resolveInitialState(loadingFixture)

    await waitFor(() => {
      expect(harness.visibleState()).toBe("preview-state")
    })
    expect(harness.previewTitle()).toBe(previewFixture.title)
    expect(harness.messagesOfType("preview-job")).toHaveLength(0)
  })

  it("awaits manual reset before starting one re-extraction", async () => {
    const harness = await loadPopupHarness({
      runtimeState: previewStateFixture,
      deferClearState: true,
    })

    await harness.ready()
    document.getElementById("reextract-button")?.click()
    document.getElementById("reextract-button")?.click()

    await waitFor(() => {
      expect(harness.messageTypes()).toEqual(["get-state", "clear-state"])
    })

    harness.resolveClearState()
    await waitFor(() => {
      expect(harness.messagesOfType("set-error-state")).toEqual([])
      expect(harness.messageTypes()).toEqual([
        "get-state",
        "clear-state",
        "get-state",
        "preview-job",
      ])
    })

    expect(harness.storageListenerCount()).toBe(1)
    expect(harness.messagesOfType("preview-job")).toHaveLength(1)
  })

  it.each([
    ["retry-button", { ...previewStateFixture, view: "error", message: "Failed" }],
    ["loading-retry-button", loadingFixture],
    [
      "save-another-button",
      {
        ...previewStateFixture,
        view: "success",
        result: {
          applicationUrl: "https://jobclock.example/applications/123",
          alreadySaved: false,
        },
      },
    ],
  ])("awaits clear-state for %s", async (buttonId, runtimeState) => {
    const harness = await loadPopupHarness({
      runtimeState,
      deferClearState: true,
    })

    await harness.ready()
    document.getElementById(buttonId)?.click()

    await waitFor(() => {
      expect(harness.messageTypes()).toEqual(["get-state", "clear-state"])
    })
    harness.resolveClearState()
    await waitFor(() => {
      expect(harness.messagesOfType("preview-job")).toHaveLength(1)
    })
  })
})
