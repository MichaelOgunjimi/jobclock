if (typeof chrome.runtime.getManifest === "function") {
  importScripts("config.js")
} else {
  globalThis.JobClockConfig = Object.freeze({
    APP_BASE_URL: "https://jobclock.michaelogunjimi.com",
    RUNTIME_STATE_KEY: "jobAssistantRuntimeState",
  })
}
importScripts("runtime-state.js")

const extensionConfig = globalThis.JobClockConfig
const runtimeState = globalThis.JobClockRuntimeState
const STATE_KEY = extensionConfig.RUNTIME_STATE_KEY
const STATUS_OPTIONS = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]

function formatNetworkError(action) {
  return `Could not reach JobClock while trying to ${action}. Check your connection and try again.`
}

function apiErrorFromBody(body, fallbackMessage) {
  const error = new Error(body?.error || fallbackMessage)
  if (typeof body?.code === "string") {
    error.code = body.code
  }
  return error
}

async function getRuntimeState() {
  const stored = await chrome.storage.local.get([STATE_KEY])
  return stored[STATE_KEY] || null
}

async function setRuntimeState(value) {
  await chrome.storage.local.set({
    [STATE_KEY]: {
      updatedAt: Date.now(),
      ...value,
    },
  })
}

function cleanText(value, maxLength = 4000) {
  if (!value) return null
  const cleaned = String(value).replace(/\s+/g, " ").trim()
  return cleaned ? cleaned.slice(0, maxLength) : null
}

async function extractCurrentPage(tabId) {
  const t0 = Date.now()
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["page-extractor.js"],
  })

  // collectJobAssistantPageData is async (it polls for LinkedIn's lazy-
  // loaded description). chrome.scripting.executeScript awaits a Promise
  // returned from the injected function in MV3 ≥ Chrome 100.
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: async () => await globalThis.collectJobAssistantPageData(),
  })
  console.info(`[jobclock] DOM extract took ${Date.now() - t0}ms`)

  return {
    pageTitle: result?.pageTitle || "",
    pageText: result?.pageText || "",
    pageHints: {
      title: cleanText(result?.pageHints?.title, 240),
      company: cleanText(result?.pageHints?.company, 240),
      location: cleanText(result?.pageHints?.location, 240),
      description: cleanText(result?.pageHints?.description, 20000),
      salaryText: cleanText(result?.pageHints?.salaryText, 240),
      metadata: Array.isArray(result?.pageHints?.metadata)
        ? result.pageHints.metadata.map((entry) => cleanText(entry, 2000)).filter(Boolean)
        : [],
    },
  }
}

// Preview can include a slow AI call; save is a quick DB write. Bound
// both so the popup can never hang indefinitely on a stalled request.
const PREVIEW_TIMEOUT_MS = 90_000
const SAVE_TIMEOUT_MS = 15_000

async function callImportApi(config, payload) {
  const timeoutMs = payload.mode === "save" ? SAVE_TIMEOUT_MS : PREVIEW_TIMEOUT_MS
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
  const t0 = Date.now()

  let response
  try {
    response = await fetch(`${extensionConfig.APP_BASE_URL}/api/jobs/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    console.info(`[jobclock] ${payload.mode} fetch took ${Date.now() - t0}ms (status ${response.status})`)
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new Error(
        payload.mode === "save"
          ? "Saving timed out. Please try again."
          : "Extraction timed out. Please try again."
      )
    }
    throw new Error(
      formatNetworkError(payload.mode === "save" ? "save the job" : "extract a preview")
    )
  } finally {
    clearTimeout(timeoutId)
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw apiErrorFromBody(body, "The app rejected the import request.")
  }

  return body
}

async function fetchRecentApplications(config, limit = 5) {
  let response
  try {
    response = await fetch(
      `${extensionConfig.APP_BASE_URL}/api/jobs/import?limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      }
    )
  } catch {
    throw new Error(formatNetworkError("load recent applications"))
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw apiErrorFromBody(body, "The app rejected the recent applications request.")
  }

  return body.recentApplications || []
}

async function updateRecentStatus(config, applicationId, status) {
  if (!STATUS_OPTIONS.includes(status)) {
    throw new Error("Invalid stage value.")
  }

  let response
  try {
    response = await fetch(`${extensionConfig.APP_BASE_URL}/api/jobs/import`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ applicationId, status }),
    })
  } catch {
    throw new Error(formatNetworkError("update the application stage"))
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw apiErrorFromBody(body, "The app rejected the stage update.")
  }

  return body.recentApplications || []
}

// Coalesce concurrent preview requests for the same page so a second
// click on the extension while extraction is in flight piggybacks on
// the existing promise instead of starting a duplicate extraction.
const inflightPreviews = new Map()

async function previewJob({ config, tab }) {
  const key = runtimeState.operationKey(tab)
  const existing = inflightPreviews.get(key)
  if (existing) return existing

  const job = (async () => {
    await setRuntimeState({
      view: "loading",
      operation: "preview",
      operationKey: key,
      tabId: tab.id,
      tabUrl: tab.url,
      tabTitle: tab.title || "",
      loadingTitle: "Extracting job details",
      loadingMessage: "Reading the current page and asking JobClock for a preview.",
    })

    const extracted = await extractCurrentPage(tab.id)
    const hasReadable =
      extracted.pageText.trim() || extracted.pageHints?.description?.trim()
    if (!hasReadable) {
      throw new Error(
        /linkedin\.com$/i.test(new URL(tab.url).hostname)
          ? "LinkedIn hasn't finished loading the job. Click the job in the list, wait until the description appears, then try again."
          : "This page did not expose readable text for extraction."
      )
    }

    // If the structured pageText path returned nothing but we have a
    // description hint, fall back to that so the AI still gets content.
    const pageText = extracted.pageText.trim()
      ? extracted.pageText
      : extracted.pageHints.description || ""

    const previewResponse = await callImportApi(config, {
      mode: "preview",
      url: tab.url,
      pageTitle: extracted.pageTitle || tab.title || "",
      pageHints: extracted.pageHints,
      pageText,
    })
    const preview = previewResponse?.preview
    if (!preview || typeof preview !== "object") {
      throw new Error("JobClock returned an invalid preview.")
    }

    await setRuntimeState({
      view: "preview",
      operation: null,
      tabId: tab.id,
      tabUrl: tab.url,
      tabTitle: tab.title || extracted.pageTitle || "",
      preview,
      alreadySaved: Boolean(previewResponse.alreadySaved),
      existingApplicationId: previewResponse.existingApplicationId,
      existingApplication: previewResponse.existingApplication,
    })

    return previewResponse
  })()

  inflightPreviews.set(key, job)
  try {
    return await job
  } finally {
    inflightPreviews.delete(key)
  }
}

const inflightSaves = new Map()

async function savePreview({ config, preview, tab }) {
  const key = runtimeState.operationKey(tab)
  const existing = inflightSaves.get(key)
  if (existing) return existing

  const job = (async () => {
    await setRuntimeState({
      view: "loading",
      operation: "save",
      operationKey: key,
      tabId: tab.id,
      tabUrl: tab.url,
      tabTitle: tab.title || "",
      loadingTitle: "Saving to applications",
      loadingMessage: "Saving the job into your applications.",
      preview,
    })

    const result = await callImportApi(config, {
      mode: "save",
      preview,
    })

    await setRuntimeState({
      view: "success",
      operation: null,
      tabId: tab.id,
      tabUrl: tab.url,
      tabTitle: tab.title || preview.title || "",
      preview,
      result,
    })

    return result
  })()

  inflightSaves.set(key, job)
  try {
    return await job
  } finally {
    inflightSaves.delete(key)
  }
}

function activeOperationKeys() {
  return [...inflightPreviews.keys(), ...inflightSaves.keys()]
}

async function reconcileRuntimeStateForTab(storedState, tab) {
  const decision = runtimeState.resolveStoredState({
    storedState,
    tab,
    activeOperationKeys: activeOperationKeys(),
  })

  if (decision.action === "start") return null
  if (decision.action === "replace") {
    await setRuntimeState(decision.state)
    return decision.state
  }
  return decision.state
}

async function getRuntimeStateForTab(tab) {
  return reconcileRuntimeStateForTab(await getRuntimeState(), tab)
}

async function getLegacyRuntimeState() {
  const storedState = await getRuntimeState()
  const hasStoredTab =
    typeof storedState?.tabId === "number" &&
    typeof storedState?.tabUrl === "string"

  if (!hasStoredTab) return storedState

  return reconcileRuntimeStateForTab(storedState, {
    id: storedState.tabId,
    url: storedState.tabUrl,
  })
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return

  ;(async () => {
    try {
      if (message.type === "get-state") {
        const tab = message.payload?.tab
        const hasValidTab =
          typeof tab?.id === "number" && typeof tab?.url === "string"
        sendResponse({
          ok: true,
          state: hasValidTab
            ? await getRuntimeStateForTab(tab)
            : await getLegacyRuntimeState(),
        })
        return
      }

      if (message.type === "preview-job") {
        const preview = await previewJob(message.payload)
        sendResponse({ ok: true, preview })
        return
      }

      if (message.type === "get-recent-applications") {
        const recentApplications = await fetchRecentApplications(
          message.payload.config,
          message.payload.limit
        )
        sendResponse({ ok: true, recentApplications })
        return
      }

      if (message.type === "update-recent-status") {
        const recentApplications = await updateRecentStatus(
          message.payload.config,
          message.payload.applicationId,
          message.payload.status
        )
        sendResponse({ ok: true, recentApplications })
        return
      }

      if (message.type === "save-preview") {
        const result = await savePreview(message.payload)
        sendResponse({ ok: true, result })
        return
      }

      if (message.type === "set-error-state") {
        await setRuntimeState({
          ...message.payload,
          operation: null,
        })
        sendResponse({ ok: true })
        return
      }

      if (message.type === "clear-state") {
        await chrome.storage.local.remove(STATE_KEY)
        sendResponse({ ok: true })
        return
      }

      sendResponse({ ok: false, error: "Unknown message type" })
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Unexpected extension error."
      const errorCode =
        error && typeof error === "object" && typeof error.code === "string"
          ? error.code
          : undefined
      if (
        typeof message?.payload?.tab?.id === "number" &&
        typeof message?.payload?.tab?.url === "string"
      ) {
        await setRuntimeState({
          view: "error",
          operation: null,
          tabId: message.payload.tab.id,
          tabUrl: message.payload.tab.url,
          tabTitle: message.payload.tab.title || "",
          message: messageText,
          ...(errorCode ? { errorCode } : {}),
        })
      }
      sendResponse({ ok: false, error: messageText, ...(errorCode ? { errorCode } : {}) })
    }
  })()

  return true
})
