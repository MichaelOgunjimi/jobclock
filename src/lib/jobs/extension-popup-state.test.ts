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

const recentApplicationFixture = {
  applicationId: "application-123",
  title: "Platform Engineer",
  company: "Acme",
  location: "Remote",
  status: "saved",
  createdAt: "2026-06-11T10:00:00.000Z",
  applicationUrl: "https://jobclock.example/applications/application-123",
}

const saveResultFixture = {
  applicationUrl: recentApplicationFixture.applicationUrl,
  alreadySaved: false,
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
  deferSave = false,
  deferRecent = false,
  initialConfig = {
    appBaseUrl: "https://jobclock.example",
    token: "ja_ext_test",
  },
  configSetError = null,
}: {
  tab?: Tab
  runtimeState?: RuntimeState | null
  deferInitialState?: boolean
  deferClearState?: boolean
  deferSave?: boolean
  deferRecent?: boolean
  initialConfig?: { appBaseUrl: string; token: string } | null
  configSetError?: string | null
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
  const saveResponse = deferred<void>()
  const recentResponse = deferred<void>()
  let currentRuntimeState = runtimeState
  let currentTab = structuredClone(tab)
  let storedConfig = initialConfig ? structuredClone(initialConfig) : null
  let initialStateRequested = false

  document.open()
  document.write(popupHtml)
  document.close()

  function emitRuntimeState(
    nextState: RuntimeState | null,
    areaName = "local"
  ) {
    const oldValue = currentRuntimeState
    currentRuntimeState = nextState
    for (const listener of storageListeners) {
      listener(
        {
          [STATE_KEY]: {
            oldValue,
            newValue: nextState ? structuredClone(nextState) : undefined,
          },
        },
        areaName
      )
    }
  }

  const chromeApi = {
    tabs: {
      async query() {
        return [structuredClone(currentTab)]
      },
    },
    storage: {
      local: {
        async get() {
          return storedConfig ? structuredClone(storedConfig) : {}
        },
        async set(values: { appBaseUrl: string; token: string }) {
          if (configSetError) throw new Error(configSetError)
          storedConfig = structuredClone(values)
        },
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
          const requestedTab = message.payload?.tab
          const matchingState =
            currentRuntimeState &&
            requestedTab &&
            currentRuntimeState.tabId === requestedTab.id &&
            currentRuntimeState.tabUrl === requestedTab.url
              ? currentRuntimeState
              : null
          queueMicrotask(() =>
            callback({
              ok: true,
              state: matchingState ? structuredClone(matchingState) : null,
            })
          )
          return
        }

        if (message.type === "clear-state") {
          const finishClear = () => {
            emitRuntimeState(null)
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
          const previewTab = message.payload?.tab as Tab
          const preview = {
            ...structuredClone(previewFixture),
            url: previewTab.url,
          }
          queueMicrotask(() => {
            emitRuntimeState({
              view: "loading",
              operation: "preview",
              operationKey: `${previewTab.id}::${previewTab.url}`,
              tabId: previewTab.id,
              tabUrl: previewTab.url,
              loadingTitle: "Extracting job details",
              loadingMessage: "Reading the current page.",
            })
            emitRuntimeState({
              view: "preview",
              tabId: previewTab.id,
              tabUrl: previewTab.url,
              preview,
            })
            callback({
              ok: true,
              preview: { preview },
            })
          })
          return
        }

        if (message.type === "save-preview") {
          const saveTab = message.payload?.tab as Tab
          const preview = message.payload?.preview
          const finishSave = () => {
            emitRuntimeState({
              view: "success",
              operation: null,
              tabId: saveTab.id,
              tabUrl: saveTab.url,
              preview,
              result: structuredClone(saveResultFixture),
            })
            callback({
              ok: true,
              result: structuredClone(saveResultFixture),
            })
          }

          queueMicrotask(() => {
            emitRuntimeState({
              view: "loading",
              operation: "save",
              operationKey: `${saveTab.id}::${saveTab.url}`,
              tabId: saveTab.id,
              tabUrl: saveTab.url,
              loadingTitle: "Saving to applications",
              loadingMessage: "Saving the job into your applications.",
              preview,
            })
            if (deferSave) {
              void saveResponse.promise.then(finishSave)
            } else {
              finishSave()
            }
          })
          return
        }

        if (message.type === "get-recent-applications") {
          const finishRecent = () =>
            callback({
              ok: true,
              recentApplications: [
                structuredClone(recentApplicationFixture),
              ],
            })

          if (deferRecent) {
            void recentResponse.promise.then(finishRecent)
          } else {
            queueMicrotask(finishRecent)
          }
          return
        }

        if (message.type === "update-recent-status") {
          queueMicrotask(() =>
            callback({
              ok: true,
              recentApplications: [
                {
                  ...structuredClone(recentApplicationFixture),
                  status: message.payload?.status,
                },
              ],
            })
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
      emitRuntimeState(nextState, areaName)
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
    resolveRecent() {
      recentResponse.resolve()
    },
    resolveSave() {
      saveResponse.resolve()
    },
    setActiveTab(nextTab: Tab) {
      currentTab = structuredClone(nextTab)
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

  it("renders loading to success without starting another preview", async () => {
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
    expect(harness.messagesOfType("preview-job")).toHaveLength(0)
  })

  it("renders loading to error without starting another preview", async () => {
    const harness = await loadPopupHarness({
      runtimeState: loadingFixture,
    })

    await harness.ready()
    expect(harness.visibleState()).toBe("loading-state")

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
    expect(harness.messagesOfType("preview-job")).toHaveLength(0)
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

  it("saves a restored preview without starting another extraction", async () => {
    const harness = await loadPopupHarness({
      runtimeState: previewStateFixture,
      deferSave: true,
    })

    await harness.ready()
    document.getElementById("save-button")?.click()

    await waitFor(() => {
      expect(harness.visibleState()).toBe("loading-state")
    })
    harness.resolveSave()
    await waitFor(() => {
      expect(harness.visibleState()).toBe("success-state")
    })
    expect(document.getElementById("view-link")?.getAttribute("href")).toBe(
      saveResultFixture.applicationUrl
    )

    expect(harness.messagesOfType("save-preview")).toEqual([
      {
        type: "save-preview",
        payload: {
          config: {
            appBaseUrl: "https://jobclock.example",
            token: "ja_ext_test",
          },
          preview: previewFixture,
          tab: activeTab,
        },
      },
    ])
    expect(harness.messagesOfType("preview-job")).toHaveLength(0)
  })

  it("restarts on the current page instead of saving a stale restored preview", async () => {
    const nextTab = {
      id: activeTab.id,
      url: "https://jobs.example.com/roles/8",
      title: "A different role",
    }
    const harness = await loadPopupHarness({
      runtimeState: previewStateFixture,
    })

    await harness.ready()
    harness.setActiveTab(nextTab)
    document.getElementById("save-button")?.click()

    await waitFor(() => {
      expect(harness.messagesOfType("preview-job")).toHaveLength(1)
    })

    expect(harness.messagesOfType("save-preview")).toHaveLength(0)
    expect(harness.messagesOfType("clear-state")).toHaveLength(1)
    expect(harness.messagesOfType("preview-job")[0]?.payload?.tab).toEqual(
      nextTab
    )
  })

  it("does not allow retry to race an active save", async () => {
    const harness = await loadPopupHarness({
      runtimeState: previewStateFixture,
      deferSave: true,
    })

    await harness.ready()
    document.getElementById("save-button")?.click()

    await waitFor(() => {
      expect(harness.visibleState()).toBe("loading-state")
      expect(harness.messagesOfType("save-preview")).toHaveLength(1)
    })

    const retryButton = document.getElementById(
      "loading-retry-button"
    ) as HTMLButtonElement
    expect(retryButton.disabled || retryButton.classList.contains("hidden")).toBe(
      true
    )
    retryButton.click()
    expect(harness.messagesOfType("clear-state")).toHaveLength(0)
    expect(harness.messagesOfType("preview-job")).toHaveLength(0)

    harness.resolveSave()
    await waitFor(() => {
      expect(harness.visibleState()).toBe("success-state")
    })
    expect(harness.messagesOfType("preview-job")).toHaveLength(0)
  })

  it("loads recent applications and updates one stage", async () => {
    const harness = await loadPopupHarness({
      runtimeState: previewStateFixture,
    })

    await harness.ready()
    document.getElementById("recent-tab")?.click()

    await waitFor(() => {
      expect(harness.visibleState()).toBe("recent-state")
      expect(document.querySelector(".recent-card h3")?.textContent).toBe(
        recentApplicationFixture.title
      )
    })

    const statusSelect = document.querySelector<HTMLSelectElement>(
      ".recent-card .status-select"
    )
    const originalCard = document.querySelector(".recent-card")
    statusSelect!.value = "interview"
    document
      .querySelector<HTMLButtonElement>(".recent-card .button.primary")
      ?.click()

    await waitFor(() => {
      expect(document.querySelector(".recent-card")).not.toBe(originalCard)
      expect(
        document.querySelector<HTMLSelectElement>(
          ".recent-card .status-select"
        )?.value
      ).toBe("interview")
    })

    expect(harness.messagesOfType("update-recent-status")).toEqual([
      {
        type: "update-recent-status",
        payload: {
          config: {
            appBaseUrl: "https://jobclock.example",
            token: "ja_ext_test",
          },
          applicationId: recentApplicationFixture.applicationId,
          status: "interview",
        },
      },
    ])
    expect(harness.messagesOfType("get-recent-applications")).toHaveLength(1)
    expect(harness.messagesOfType("preview-job")).toHaveLength(0)
  })

  it.each([
    [
      "preview",
      {
        ...previewStateFixture,
        preview: {
          ...previewFixture,
          title: "Storage preview",
        },
      },
    ],
    [
      "success",
      {
        view: "success",
        tabId: activeTab.id,
        tabUrl: activeTab.url,
        result: saveResultFixture,
      },
    ],
  ])(
    "keeps Recent active when matching storage changes to %s",
    async (_view, nextState) => {
      const harness = await loadPopupHarness({
        runtimeState: previewStateFixture,
        deferRecent: true,
      })

      await harness.ready()
      document.getElementById("recent-tab")?.click()
      harness.emitRuntimeState(nextState as RuntimeState)

      expect(document.getElementById("recent-tab")?.classList).toContain(
        "active"
      )
      expect(document.getElementById("preview-tab")?.classList).not.toContain(
        "active"
      )

      harness.resolveRecent()
      await waitFor(() => {
        expect(harness.visibleState()).toBe("recent-state")
      })
      expect(document.getElementById("recent-tab")?.classList).toContain(
        "active"
      )
    }
  )

  it("re-extracts a matching malformed cached preview", async () => {
    const harness = await loadPopupHarness({
      runtimeState: {
        view: "preview",
        tabId: activeTab.id,
        tabUrl: activeTab.url,
        preview: {},
      },
    })

    await harness.ready()
    await waitFor(() => {
      expect(harness.messagesOfType("preview-job")).toHaveLength(1)
    })

    expect(harness.visibleState()).toBe("preview-state")
    expect(harness.previewTitle()).toBe(previewFixture.title)
  })

  it("shows setup storage failures to the user", async () => {
    const harness = await loadPopupHarness({
      initialConfig: null,
      configSetError: "Token storage is unavailable.",
    })

    await waitFor(() => {
      expect(harness.visibleState()).toBe("setup-state")
    })
    const appUrl = document.getElementById("app-url") as HTMLInputElement
    const token = document.getElementById("token") as HTMLInputElement
    appUrl.value = "https://jobclock.example"
    token.value = "ja_ext_test"
    document
      .getElementById("setup-form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))

    await waitFor(() => {
      expect(harness.visibleState()).toBe("error-state")
    })
    expect(document.getElementById("error-message")?.textContent).toBe(
      "Token storage is unavailable."
    )
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
