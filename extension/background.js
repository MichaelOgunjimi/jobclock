const STATE_KEY = "jobAssistantRuntimeState"
const STATUS_OPTIONS = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "")
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
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      function text(selector) {
        const node = document.querySelector(selector)
        return node instanceof HTMLElement ? node.innerText.trim() : ""
      }

      function attr(selector, name) {
        return document.querySelector(selector)?.getAttribute(name) || ""
      }

      function collectJsonLd() {
        const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
        return nodes
          .map((node) => node.textContent || "")
          .filter(Boolean)
          .slice(0, 5)
      }

      const linkedinTitle =
        text(".job-details-jobs-unified-top-card__job-title") ||
        text(".jobs-unified-top-card__job-title") ||
        text(".top-card-layout__title") ||
        text(".topcard__title")

      const linkedinCompany =
        text(".job-details-jobs-unified-top-card__company-name") ||
        text(".jobs-unified-top-card__company-name") ||
        text(".topcard__org-name-link") ||
        text(".topcard__flavor")

      const linkedinLocation =
        text(".job-details-jobs-unified-top-card__primary-description-container") ||
        text(".jobs-unified-top-card__bullet") ||
        text(".topcard__flavor--bullet")

      const linkedinDescription =
        text(".jobs-description__content") ||
        text(".jobs-box__html-content") ||
        text(".show-more-less-html__markup") ||
        text(".description__text")

      const metaBits = [
        attr('meta[property="og:title"]', "content"),
        attr('meta[property="og:description"]', "content"),
        attr('meta[name="description"]', "content"),
      ].filter(Boolean)

      return {
        pageTitle: document.title || "",
        pageText: (document.body?.innerText || "").slice(0, 180000),
        pageHints: {
          title: linkedinTitle || text("h1") || attr('meta[property="og:title"]', "content") || "",
          company:
            linkedinCompany ||
            attr('meta[property="og:site_name"]', "content") ||
            "",
          location: linkedinLocation || "",
          description:
            linkedinDescription ||
            attr('meta[property="og:description"]', "content") ||
            attr('meta[name="description"]', "content") ||
            "",
          salaryText:
            text('[class*="salary"]') ||
            text('[data-test-id*="salary"]') ||
            "",
          metadata: [
            ...metaBits,
            ...collectJsonLd(),
          ],
        },
      }
    },
  })

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

async function callImportApi(config, payload) {
  const response = await fetch(`${normalizeBaseUrl(config.appBaseUrl)}/api/jobs/import`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify(payload),
  })

  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(body.error || "The app rejected the import request.")
  }

  return body
}

async function fetchRecentApplications(config, limit = 5) {
  const response = await fetch(
    `${normalizeBaseUrl(config.appBaseUrl)}/api/jobs/import?limit=${limit}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.token}`,
      },
    }
  )

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

  const response = await fetch(`${normalizeBaseUrl(config.appBaseUrl)}/api/jobs/import`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({ applicationId, status }),
  })

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
