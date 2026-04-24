const state = {
  config: null,
  preview: null,
  tabId: null,
  tabUrl: null,
  tabTitle: null,
  activeTab: "preview",
  recentApplications: [],
}

const STATUS_OPTIONS = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]
const PREVIEW_DESCRIPTION_MAX = 420
const RESTORE_STATE_MAX_AGE_MS = 10 * 60 * 1000

const nodes = {
  setupState: document.getElementById("setup-state"),
  loadingState: document.getElementById("loading-state"),
  errorState: document.getElementById("error-state"),
  previewState: document.getElementById("preview-state"),
  successState: document.getElementById("success-state"),
  recentState: document.getElementById("recent-state"),
  previewTab: document.getElementById("preview-tab"),
  recentTab: document.getElementById("recent-tab"),
  setupForm: document.getElementById("setup-form"),
  appUrl: document.getElementById("app-url"),
  token: document.getElementById("token"),
  loadingTitle: document.getElementById("loading-title"),
  loadingMessage: document.getElementById("loading-message"),
  errorMessage: document.getElementById("error-message"),
  retryButton: document.getElementById("retry-button"),
  editSettingsButton: document.getElementById("edit-settings-button"),
  previewSettingsButton: document.getElementById("preview-settings-button"),
  footerSettingsButton: document.getElementById("footer-settings-button"),
  saveButton: document.getElementById("save-button"),
  viewLink: document.getElementById("view-link"),
  successMessage: document.getElementById("success-message"),
  saveAnotherButton: document.getElementById("save-another-button"),
  previewStatus: document.getElementById("preview-status"),
  successStatus: document.getElementById("success-status"),
  previewSource: document.getElementById("preview-source"),
  previewTitle: document.getElementById("preview-title"),
  previewCompany: document.getElementById("preview-company"),
  previewLocation: document.getElementById("preview-location"),
  previewSalary: document.getElementById("preview-salary"),
  previewEasyApply: document.getElementById("preview-easy-apply"),
  previewDescription: document.getElementById("preview-description"),
  recentList: document.getElementById("recent-list"),
  recentEmpty: document.getElementById("recent-empty"),
}

function titleCase(value) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function truncateText(value, maxLength = PREVIEW_DESCRIPTION_MAX) {
  if (!value) return ""
  if (value.length <= maxLength) return value

  const truncated = value.slice(0, maxLength)
  const lastBoundary = truncated.lastIndexOf(" ")
  return `${(lastBoundary > 80 ? truncated.slice(0, lastBoundary) : truncated).trimEnd()}…`
}

function sendMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }

      if (!response?.ok) {
        reject(new Error(response?.error || "Extension request failed."))
        return
      }

      resolve(response)
    })
  })
}

function setActiveTab(tabName) {
  state.activeTab = tabName
  nodes.previewTab.classList.toggle("active", tabName === "preview")
  nodes.recentTab.classList.toggle("active", tabName === "recent")
}

function show(view) {
  const all = [
    nodes.setupState,
    nodes.loadingState,
    nodes.errorState,
    nodes.previewState,
    nodes.successState,
    nodes.recentState,
  ]
  for (const node of all) {
    node.classList.toggle("hidden", node !== view)
  }
}

function showError(message) {
  nodes.errorMessage.textContent = message
  show(nodes.errorState)
}

function normalizeBaseUrl(value) {
  return value.replace(/\/+$/, "")
}

function formatSalary(preview) {
  if (preview.salaryMin == null && preview.salaryMax == null) return "Not listed"
  const currency = preview.salaryCurrency || "GBP"
  const formatter = new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  })

  if (preview.salaryMin != null && preview.salaryMax != null) {
    return `${formatter.format(preview.salaryMin)} – ${formatter.format(preview.salaryMax)}`
  }

  return formatter.format(preview.salaryMin ?? preview.salaryMax)
}

async function loadConfig() {
  const stored = await chrome.storage.local.get(["appBaseUrl", "token"])
  if (!stored.appBaseUrl || !stored.token) return null
  return {
    appBaseUrl: normalizeBaseUrl(stored.appBaseUrl),
    token: stored.token,
  }
}

async function saveConfig(appBaseUrl, token) {
  const normalized = {
    appBaseUrl: normalizeBaseUrl(appBaseUrl),
    token: token.trim(),
  }
  await chrome.storage.local.set(normalized)
  state.config = normalized
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) {
    throw new Error("Open a job page first, then click the extension again.")
  }

  if (!/^https?:/i.test(tab.url)) {
    throw new Error("This extension only works on normal http/https job pages.")
  }

  state.tabId = tab.id
  state.tabUrl = tab.url
  state.tabTitle = tab.title || ""
  return tab
}

function renderPreview(data, restored = false) {
  state.preview = data.preview
  nodes.previewSource.textContent = data.preview.source
  nodes.previewTitle.textContent = data.preview.title
  nodes.previewCompany.textContent = data.preview.company
  nodes.previewLocation.textContent = data.preview.location || "Not listed"
  nodes.previewSalary.textContent = formatSalary(data.preview)
  nodes.previewEasyApply.textContent = data.preview.isEasyApply ? "Easy apply" : "Standard apply"
  const fullDescription = data.preview.description || "No description was extracted from this page."
  nodes.previewDescription.textContent = truncateText(fullDescription)
  nodes.previewDescription.title = fullDescription
  nodes.saveButton.textContent = "Save to applications"
  nodes.previewStatus.textContent = restored ? "Restored the last extracted preview for this page." : ""
  nodes.previewStatus.classList.toggle("hidden", !restored)
  setActiveTab("preview")
  show(nodes.previewState)
}

function renderSuccess(result, restored = false) {
  nodes.viewLink.href = result.applicationUrl
  nodes.successMessage.textContent = result.alreadySaved
    ? "The existing application was refreshed with the latest job data."
    : "The job was added to your applications."
  nodes.successStatus.textContent = restored ? "Restored the last saved state for this page." : ""
  nodes.successStatus.classList.toggle("hidden", !restored)
  setActiveTab("preview")
  show(nodes.successState)
}

function renderLoading(message, title = "Extracting job details") {
  setActiveTab("preview")
  show(nodes.loadingState)
  nodes.loadingTitle.textContent = title
  nodes.loadingMessage.textContent = message
}

function createRecentCard(item) {
  const card = document.createElement("article")
  card.className = "recent-card"

  const head = document.createElement("div")
  head.className = "recent-head"

  const meta = document.createElement("div")
  meta.className = "recent-meta"

  const title = document.createElement("h3")
  title.textContent = item.title

  const company = document.createElement("p")
  company.className = "recent-company"
  company.textContent = item.company

  meta.append(title, company)

  const openLink = document.createElement("a")
  openLink.className = "button secondary"
  openLink.href = item.applicationUrl
  openLink.target = "_blank"
  openLink.rel = "noreferrer"
  openLink.textContent = "Open application"

  head.append(meta, openLink)

  const row = document.createElement("div")
  row.className = "recent-row"

  const location = document.createElement("span")
  location.className = "recent-pill"
  location.textContent = item.location || "Location not listed"

  const savedDate = document.createElement("span")
  savedDate.className = "recent-pill"
  savedDate.textContent = `Saved ${new Date(item.createdAt).toLocaleDateString()}`

  row.append(location, savedDate)

  const actions = document.createElement("div")
  actions.className = "recent-actions"

  const select = document.createElement("select")
  select.className = "status-select"

  for (const status of STATUS_OPTIONS) {
    const option = document.createElement("option")
    option.value = status
    option.textContent = status.charAt(0).toUpperCase() + status.slice(1)
    option.selected = status === item.status
    select.append(option)
  }

  const button = document.createElement("button")
  button.type = "button"
  button.className = "button primary"
  button.textContent = "Update stage"
  button.addEventListener("click", async () => {
    try {
      button.disabled = true
      const response = await sendMessage({
        type: "update-recent-status",
        payload: {
          config: state.config,
          applicationId: item.applicationId,
          status: select.value,
        },
      })
      state.recentApplications = response.recentApplications || []
      renderRecentApplications()
    } catch (error) {
      showError(error instanceof Error ? error.message : "Stage update failed.")
      setActiveTab("recent")
    } finally {
      button.disabled = false
    }
  })

  actions.append(select, button)
  card.append(head, row, actions)
  return card
}

function renderRecentApplications() {
  nodes.recentList.innerHTML = ""
  nodes.recentEmpty.classList.toggle("hidden", state.recentApplications.length > 0)
  for (const item of state.recentApplications) {
    nodes.recentList.append(createRecentCard(item))
  }
}

async function loadRecentApplications() {
  const response = await sendMessage({
    type: "get-recent-applications",
    payload: {
      config: state.config,
      limit: 5,
    },
  })
  state.recentApplications = response.recentApplications || []
  renderRecentApplications()
}

async function previewCurrentTab() {
  state.existingApplication = null
  renderLoading("Reading the current page and asking the app for a preview.", "Extracting job details")
  const tab = await getActiveTab()
  const response = await sendMessage({
    type: "preview-job",
    payload: {
      config: state.config,
      tab,
    },
  })

  renderPreview(response.preview)
}

async function savePreview() {
  if (!state.preview) {
    throw new Error("No preview is loaded.")
  }

  renderLoading(
    "Saving the job into your applications.",
    "Saving to applications"
  )
  const tab = await getActiveTab()
  const response = await sendMessage({
    type: "save-preview",
    payload: {
      config: state.config,
      preview: state.preview,
      tab,
    },
  })

  await loadRecentApplications()
  renderSuccess(response.result)
}

function openSettings() {
  if (state.config) {
    nodes.appUrl.value = state.config.appBaseUrl
    nodes.token.value = state.config.token
  }
  show(nodes.setupState)
}

async function restoreRuntimeState(tab) {
  const response = await sendMessage({ type: "get-state" })
  const runtimeState = response.state
  if (!runtimeState) return false

  const isFresh =
    typeof runtimeState.updatedAt === "number" &&
    Date.now() - runtimeState.updatedAt <= RESTORE_STATE_MAX_AGE_MS
  const sameUrl = runtimeState.tabUrl === tab.url
  const sameTitle =
    !runtimeState.tabTitle || !tab.title || runtimeState.tabTitle.trim() === tab.title.trim()

  if (!isFresh || !sameUrl || !sameTitle) {
    await sendMessage({ type: "clear-state" }).catch(() => {})
    return false
  }

  if (runtimeState.view === "loading") {
    renderLoading(
      runtimeState.loadingMessage || "Continuing the last request for this page.",
      runtimeState.loadingTitle || "Extracting job details"
    )
    return true
  }

  if (runtimeState.view === "success" && runtimeState.result) {
    renderSuccess(runtimeState.result, true)
    return true
  }

  if (runtimeState.view === "error" && runtimeState.message) {
    showError(runtimeState.message)
    return true
  }

  return false
}

async function initialize() {
  try {
    state.config = await loadConfig()
    if (!state.config) {
      openSettings()
      return
    }

    const tab = await getActiveTab()
    const restored = await restoreRuntimeState(tab)
    if (restored) return

    loadRecentApplications().catch((error) => {
      console.warn("Recent applications failed to load:", error)
    })
    await previewCurrentTab()
  } catch (error) {
    const message = error instanceof Error ? error.message : "The extension could not start."
    if (state.tabId && state.tabUrl) {
      await sendMessage({
        type: "set-error-state",
        payload: {
          view: "error",
          tabId: state.tabId,
          tabUrl: state.tabUrl,
          tabTitle: state.tabTitle || "",
          message,
        },
      }).catch(() => {})
    }
    showError(message)
  }
}

nodes.setupForm.addEventListener("submit", async (event) => {
  event.preventDefault()

  const appBaseUrl = nodes.appUrl.value.trim()
  const token = nodes.token.value.trim()

  if (!appBaseUrl || !token) {
    showError("Both app URL and token are required.")
    return
  }

  try {
    new URL(appBaseUrl)
  } catch {
    showError("Enter a valid app URL, including http:// or https://.")
    return
  }

  await saveConfig(appBaseUrl, token)
  await initialize()
})

nodes.retryButton.addEventListener("click", () => {
  sendMessage({ type: "clear-state" }).catch(() => {})
  initialize()
})

nodes.saveButton.addEventListener("click", async () => {
  try {
    await savePreview()
  } catch (error) {
    showError(error instanceof Error ? error.message : "The save request failed.")
  }
})

nodes.saveAnotherButton.addEventListener("click", () => {
  sendMessage({ type: "clear-state" }).catch(() => {})
  initialize()
})

nodes.previewTab.addEventListener("click", async () => {
  setActiveTab("preview")
  if (state.preview) {
    renderPreview(
      {
        preview: state.preview,
        alreadySaved: !!state.existingApplication,
        existingApplicationId: state.existingApplication?.applicationId,
        existingApplication: state.existingApplication,
      },
      true
    )
    return
  }

  await initialize()
})

nodes.recentTab.addEventListener("click", async () => {
  setActiveTab("recent")
  if (!state.config) {
    openSettings()
    return
  }

  try {
    await loadRecentApplications()
    show(nodes.recentState)
  } catch (error) {
    showError(error instanceof Error ? error.message : "Recent applications failed to load.")
    setActiveTab("recent")
  }
})

for (const button of [
  nodes.editSettingsButton,
  nodes.previewSettingsButton,
  nodes.footerSettingsButton,
]) {
  button.addEventListener("click", openSettings)
}

initialize()
