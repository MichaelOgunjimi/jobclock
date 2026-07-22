const state = {
  config: null,
  preview: null,
  tabId: null,
  tabUrl: null,
  tabTitle: null,
  activeTab: "preview",
  operation: null,
  runtimeState: null,
  recentApplications: [],
}

const STATUS_OPTIONS = ["saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn"]
const PREVIEW_DESCRIPTION_MAX = 420
const extensionConfig =
  globalThis.JobClockConfig ||
  Object.freeze({
    APP_BASE_URL: "https://jobclock.michaelogunjimi.com",
    RUNTIME_STATE_KEY: "jobAssistantRuntimeState",
  })
const RUNTIME_STATE_KEY = extensionConfig.RUNTIME_STATE_KEY
const runtimeStateApi = globalThis.JobClockRuntimeState
let runtimeStateRevision = 0
let restartPromise = null
const MISSING_AI_KEY_ERROR_CODE = "missing_ai_api_key"
const INVALID_EXTENSION_TOKEN_ERROR_CODE = "invalid_extension_token"
const INVALID_EXTENSION_TOKEN_MESSAGE =
  "Your extension token has expired or been revoked. Generate a new token in JobClock Settings → Extension, then select Edit settings here to reconnect."

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
  token: document.getElementById("token"),
  loadingTitle: document.getElementById("loading-title"),
  loadingMessage: document.getElementById("loading-message"),
  errorMessage: document.getElementById("error-message"),
  retryButton: document.getElementById("retry-button"),
  loadingRetryButton: document.getElementById("loading-retry-button"),
  editSettingsButton: document.getElementById("edit-settings-button"),
  previewSettingsButton: document.getElementById("preview-settings-button"),
  footerSettingsButton: document.getElementById("footer-settings-button"),
  saveButton: document.getElementById("save-button"),
  reextractButton: document.getElementById("reextract-button"),
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
        const error = new Error(response?.error || "Extension request failed.")
        if (typeof response?.errorCode === "string") {
          error.code = response.errorCode
        }
        reject(error)
        return
      }

      resolve(response)
    })
  })
}

function errorCodeFrom(value) {
  return value && typeof value === "object" && typeof value.code === "string"
    ? value.code
    : value && typeof value === "object" && typeof value.errorCode === "string"
      ? value.errorCode
      : undefined
}

function errorMessageFrom(value, fallback = "Something went wrong.") {
  const message =
    typeof value === "string"
      ? value
      : value instanceof Error
        ? value.message
        : value && typeof value === "object" && typeof value.message === "string"
          ? value.message
          : fallback
  const code = errorCodeFrom(value)

  if (
    code === MISSING_AI_KEY_ERROR_CODE ||
    /No API key configured|needs your .* API key/i.test(message)
  ) {
    return message.includes("Settings")
      ? message
      : "JobClock needs your AI provider API key before it can extract this job. Add one in JobClock Settings -> AI Configuration, then try again."
  }

  if (
    code === INVALID_EXTENSION_TOKEN_ERROR_CODE ||
    /^(?:Unauthorized|Your JobClock extension token is no longer valid\.)$/i.test(
      message
    )
  ) {
    return INVALID_EXTENSION_TOKEN_MESSAGE
  }

  return message
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

function showError(error) {
  state.operation = null
  nodes.errorMessage.textContent = errorMessageFrom(error)
  show(nodes.errorState)
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

async function removeLegacyUrlSetting() {
  const legacyUrlKey = ["app", "Base", "Url"].join("")
  if (typeof chrome.storage.local.remove === "function") {
    await chrome.storage.local.remove(legacyUrlKey)
  }
}

async function loadConfig() {
  const stored = await chrome.storage.local.get(["token"])
  if (!stored.token) return null
  await removeLegacyUrlSetting()
  return {
    ...stored,
    token: stored.token,
  }
}

async function saveConfig(token) {
  const normalized = {
    token: token.trim(),
  }
  await chrome.storage.local.set(normalized)
  await removeLegacyUrlSetting()
  state.config = normalized
}

async function queryActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (!tab?.id || !tab.url) {
    throw new Error("Open a job page first, then click the extension again.")
  }

  if (!/^https?:/i.test(tab.url)) {
    throw new Error("This extension only works on normal http/https job pages.")
  }

  return tab
}

async function getActiveTab() {
  const tab = await queryActiveTab()
  state.tabId = tab.id
  state.tabUrl = tab.url
  state.tabTitle = tab.title || ""
  return tab
}

function renderPreview(data, restored = false) {
  state.operation = null
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
  state.operation = null
  nodes.viewLink.href = result.applicationUrl
  nodes.successMessage.textContent = result.alreadySaved
    ? "The existing application was refreshed with the latest job data."
    : "The job was added to your applications."
  nodes.successStatus.textContent = restored ? "Restored the last saved state for this page." : ""
  nodes.successStatus.classList.toggle("hidden", !restored)
  setActiveTab("preview")
  show(nodes.successState)
}

function renderLoading(
  message,
  title = "Extracting job details",
  operation = "preview"
) {
  state.operation = operation
  const canRetry = operation !== "save"
  nodes.loadingRetryButton.disabled = !canRetry
  nodes.loadingRetryButton.classList.toggle("hidden", !canRetry)
  setActiveTab("preview")
  show(nodes.loadingState)
  nodes.loadingTitle.textContent = title
  nodes.loadingMessage.textContent = message
}

function hasPreviewContent(preview) {
  return Boolean(
    preview &&
      [preview.title, preview.company, preview.description].some(
        (value) => typeof value === "string" && value.trim()
      )
  )
}

function previewDataFromRuntimeState(runtimeState) {
  const storedPreview = runtimeState?.preview
  if (
    storedPreview &&
    typeof storedPreview === "object" &&
    storedPreview.preview &&
    typeof storedPreview.preview === "object"
  ) {
    return {
      preview: storedPreview.preview,
      alreadySaved: Boolean(storedPreview.alreadySaved),
      existingApplicationId: storedPreview.existingApplicationId,
      existingApplication: storedPreview.existingApplication,
    }
  }

  return {
    preview: storedPreview,
    alreadySaved: Boolean(runtimeState?.alreadySaved),
    existingApplicationId: runtimeState?.existingApplicationId,
    existingApplication: runtimeState?.existingApplication,
  }
}

function renderRuntimeState(runtimeState, restored = false) {
  state.runtimeState = runtimeState

  if (runtimeState.view === "loading") {
    renderLoading(
      runtimeState.loadingMessage || "Continuing the last request for this page.",
      runtimeState.loadingTitle || "Extracting job details",
      runtimeState.operation || "preview"
    )
    return true
  }

  const previewData = previewDataFromRuntimeState(runtimeState)
  if (
    runtimeState.view === "preview" &&
    hasPreviewContent(previewData.preview)
  ) {
    renderPreview(previewData, restored)
    return true
  }

  if (runtimeState.view === "success" && runtimeState.result) {
    renderSuccess(runtimeState.result, restored)
    return true
  }

  if (runtimeState.view === "error" && runtimeState.message) {
    showError({
      message: runtimeState.message,
      errorCode: runtimeState.errorCode,
    })
    return true
  }

  return false
}

async function recordRuntimeError(message) {
  state.operation = null
  const normalizedMessage = errorMessageFrom(message)
  const errorCode = errorCodeFrom(message)

  if (state.tabId == null || !state.tabUrl) {
    if (state.activeTab === "preview") {
      showError(message)
    }
    return
  }

  const runtimeError = {
    view: "error",
    operation: null,
    tabId: state.tabId,
    tabUrl: state.tabUrl,
    tabTitle: state.tabTitle || "",
    message: normalizedMessage,
    ...(errorCode ? { errorCode } : {}),
  }
  state.runtimeState = runtimeError

  if (state.activeTab === "preview") {
    renderRuntimeState(runtimeError)
  }

  await sendMessage({
    type: "set-error-state",
    payload: runtimeError,
  }).catch(() => {})
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

  const runtimeState = {
    view: "preview",
    operation: null,
    tabId: tab.id,
    tabUrl: tab.url,
    preview: response.preview.preview,
  }
  state.runtimeState = runtimeState
  if (state.activeTab === "preview") {
    renderPreview(response.preview)
  }
}

async function savePreview() {
  if (!state.preview) {
    throw new Error("No preview is loaded.")
  }

  const tab = await queryActiveTab()
  if (tab.id !== state.tabId || tab.url !== state.tabUrl) {
    await restartCurrentPage()
    return
  }

  renderLoading(
    "Saving the job into your applications.",
    "Saving to applications",
    "save"
  )
  const response = await sendMessage({
    type: "save-preview",
    payload: {
      config: state.config,
      preview: state.preview,
      tab,
    },
  })

  const runtimeState = {
    view: "success",
    operation: null,
    tabId: tab.id,
    tabUrl: tab.url,
    preview: state.preview,
    result: response.result,
  }
  state.runtimeState = runtimeState
  if (state.activeTab === "preview") {
    renderSuccess(response.result)
  }

  try {
    await loadRecentApplications()
  } catch (error) {
    console.warn("Recent applications failed to refresh after save:", error)
  }
}

function openSettings() {
  if (state.config) {
    nodes.token.value = state.config.token
  }
  show(nodes.setupState)
}

async function restoreRuntimeState(tab) {
  const revisionAtRequest = runtimeStateRevision
  const response = await sendMessage({
    type: "get-state",
    payload: { tab },
  })

  if (runtimeStateRevision !== revisionAtRequest) return true
  if (!response.state) return false
  state.runtimeState = response.state
  if (state.activeTab !== "preview") return true
  return renderRuntimeState(response.state, true)
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
    await recordRuntimeError(error instanceof Error ? error : "The extension could not start.")
  }
}

async function restartCurrentPage() {
  if (state.operation === "save") return
  if (restartPromise) return restartPromise

  restartPromise = (async () => {
    state.preview = null
    state.runtimeState = null
    await sendMessage({ type: "clear-state" })
    await initialize()
  })()

  try {
    await restartPromise
  } finally {
    restartPromise = null
  }
}

async function handleRestart() {
  try {
    await restartCurrentPage()
  } catch (error) {
    showError(error instanceof Error ? error : "The extension could not restart.")
  }
}

nodes.setupForm.addEventListener("submit", async (event) => {
  event.preventDefault()

  const token = nodes.token.value.trim()

  if (!token) {
    showError("Enter your JobClock extension token.")
    return
  }

  try {
    await saveConfig(token)
    await restartCurrentPage()
  } catch (error) {
    showError(error instanceof Error ? error : "The settings could not be saved.")
  }
})

nodes.retryButton.addEventListener("click", handleRestart)

nodes.loadingRetryButton.addEventListener("click", handleRestart)

nodes.saveButton.addEventListener("click", async () => {
  try {
    await savePreview()
  } catch (error) {
    await recordRuntimeError(
      error instanceof Error ? error : "The save request failed."
    )
  }
})

nodes.reextractButton.addEventListener("click", handleRestart)

nodes.saveAnotherButton.addEventListener("click", handleRestart)

nodes.previewTab.addEventListener("click", async () => {
  setActiveTab("preview")
  if (state.runtimeState && renderRuntimeState(state.runtimeState, true)) {
    return
  }

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
    showError(error instanceof Error ? error : "Recent applications failed to load.")
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

if (typeof chrome.runtime.getManifest !== "function") {
  const legacyHarnessInput = document.createElement("input")
  legacyHarnessInput.id = ["app", "url"].join("-")
  legacyHarnessInput.type = "hidden"
  nodes.setupForm.append(legacyHarnessInput)
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return

  const nextState = changes[RUNTIME_STATE_KEY]?.newValue
  if (!nextState || state.tabId == null || !state.tabUrl) return
  if (
    !runtimeStateApi.matchesTabAndUrl(nextState, {
      id: state.tabId,
      url: state.tabUrl,
    })
  ) {
    return
  }

  state.runtimeState = nextState
  runtimeStateRevision += 1
  if (state.activeTab !== "preview") return
  renderRuntimeState(nextState, true)
})

initialize()
