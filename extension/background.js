const STATE_KEY = "jobAssistantRuntimeState"
const STATUS_OPTIONS = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "")
}

function formatNetworkError(config, action) {
  const baseUrl = normalizeBaseUrl(config.appBaseUrl)
  return `Could not reach ${baseUrl} while trying to ${action}. Check that the app URL is correct and the app is running.`
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

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => globalThis.collectJobAssistantPageData(),
  })
  console.info(`[jobclock] DOM extract took ${Date.now() - t0}ms`)

  return {
    pageTitle: result?.pageTitle || "",
    pageText: result?.pageText || "",
    pageHints: {
      title: cleanText(result?.pageHints?.title, 240),
      company: cleanText(result?.pageHints?.company, 240),
      location: cleanText(result?.pageHints?.location, 240),
      description: cleanText(result?.pageHints?.description, 60000),
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
    response = await fetch(`${normalizeBaseUrl(config.appBaseUrl)}/api/jobs/import`, {
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
      formatNetworkError(
        config,
        payload.mode === "save" ? "save the job" : "extract a preview"
      )
    )
  } finally {
    clearTimeout(timeoutId)
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || "The app rejected the import request.")
  }

  return body
}

async function fetchRecentApplications(config, limit = 5) {
  let response
  try {
    response = await fetch(
      `${normalizeBaseUrl(config.appBaseUrl)}/api/jobs/import?limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.token}`,
        },
      }
    )
  } catch {
    throw new Error(formatNetworkError(config, "load recent applications"))
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || "The app rejected the recent applications request.")
  }

  return body.recentApplications || []
}

async function updateRecentStatus(config, applicationId, status) {
  if (!STATUS_OPTIONS.includes(status)) {
    throw new Error("Invalid stage value.")
  }

  let response
  try {
    response = await fetch(`${normalizeBaseUrl(config.appBaseUrl)}/api/jobs/import`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ applicationId, status }),
    })
  } catch {
    throw new Error(formatNetworkError(config, "update the application stage"))
  }

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || "The app rejected the stage update.")
  }

  return body.recentApplications || []
}

async function previewJob({ config, tab }) {
  await setRuntimeState({
    view: "loading",
    tabId: tab.id,
    tabUrl: tab.url,
    tabTitle: tab.title || "",
    loadingTitle: "Extracting job details",
    loadingMessage: "Reading the current page and asking the app for a preview.",
  })

  const extracted = await extractCurrentPage(tab.id)
  if (!extracted.pageText.trim()) {
    throw new Error("This page did not expose readable text for extraction.")
  }

  const preview = await callImportApi(config, {
    mode: "preview",
    url: tab.url,
    pageTitle: extracted.pageTitle || tab.title || "",
    pageHints: extracted.pageHints,
    pageText: extracted.pageText,
  })

  await setRuntimeState({
    view: "preview",
    tabId: tab.id,
    tabUrl: tab.url,
    tabTitle: tab.title || extracted.pageTitle || "",
    preview,
  })

  return preview
}

async function savePreview({ config, preview, tab }) {
  await setRuntimeState({
    view: "loading",
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
    tabId: tab.id,
    tabUrl: tab.url,
    tabTitle: tab.title || preview.title || "",
    preview,
    result,
  })

  return result
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || typeof message !== "object") return

  ;(async () => {
    try {
      if (message.type === "get-state") {
        sendResponse({ ok: true, state: await getRuntimeState() })
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
        await setRuntimeState(message.payload)
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
      if (message?.payload?.tab?.id && message?.payload?.tab?.url) {
        await setRuntimeState({
          view: "error",
          tabId: message.payload.tab.id,
          tabUrl: message.payload.tab.url,
          tabTitle: message.payload.tab.title || "",
          message: messageText,
        })
      }
      sendResponse({ ok: false, error: messageText })
    }
  })()

  return true
})
