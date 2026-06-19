# JobClock Chrome Extension Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare the existing JobClock Manifest V3 extension for a public Chrome Web Store release, including durable same-URL extraction state, production-only configuration, responsive JobClock styling, trust pages, store assets, and a validated upload ZIP.

**Architecture:** Keep page extraction and API calls in the existing extension service worker, but move state matching into a small shared script used by both the service worker and popup. Store the token in `chrome.storage.local`, store the current operation state durably, and let reopened popups subscribe to state changes instead of starting duplicate extraction. Add static App Router pages for privacy/support, generate listing artwork from local HTML fixtures that reuse the extension CSS/assets, and package only an explicit production allowlist.

**Tech Stack:** Manifest V3, vanilla JavaScript/CSS, Chrome extension APIs, Next.js 16.2 App Router, React 19, TypeScript, Vitest/jsdom, Playwright, ImageMagick, Node.js packaging scripts.

---

## File Structure

### Extension runtime

- Create `extension/config.js`: production base URL and extension-wide constants.
- Create `extension/runtime-state.js`: pure same-tab/same-URL restoration decisions.
- Modify `extension/background.js`: persistent operation state, active-operation reconciliation, production API calls.
- Modify `extension/popup.js`: token-only setup, restoration, storage subscription, awaited manual resets.
- Modify `extension/popup.html`: JobClock copy, real logo, disclosure text, shared scripts.
- Modify `extension/popup.css`: packaged IBM Plex fonts, 440 px responsive layout, JobClock tokens.
- Modify `extension/manifest.json`: version `0.2.0`, exact production host permission, JobClock metadata.
- Add `extension/fonts/`: packaged IBM Plex Sans and Serif font files.

### Tests

- Create `src/lib/jobs/extension-runtime-state.test.ts`: pure restoration contract.
- Create `src/lib/jobs/extension-background-state.test.ts`: service-worker request coalescing and persisted transitions.
- Create `src/lib/jobs/extension-popup-state.test.ts`: popup restore and `storage.onChanged` behavior.
- Create `src/lib/jobs/extension-release-config.test.ts`: manifest, production URL, and responsive-source assertions.
- Create `src/app/extension/extension-pages.test.tsx`: privacy/support route content.
- Create `src/app/sitemap.test.ts`: public trust-page discovery.
- Create `src/lib/jobs/extension-package.test.ts`: package validation.

### Public web pages

- Create `src/components/extension/public-extension-page.tsx`: shared JobClock public information shell.
- Create `src/app/extension/privacy/page.tsx`: extension privacy policy.
- Create `src/app/extension/support/page.tsx`: setup and troubleshooting.
- Modify `src/app/sitemap.ts`: include both public extension routes.
- Modify `src/app/(dashboard)/settings/extension-settings-card.tsx`: production token-only setup instructions.

### Store release

- Create `extension/store/listing.md`: listing copy, single purpose, permissions, release notes.
- Create `extension/store/submission-checklist.md`: dashboard fields and manual review checklist.
- Create `extension/store/render.html`: deterministic artwork fixture using shipped CSS/assets.
- Create `scripts/render-extension-store-assets.mjs`: render screenshots and promo tiles.
- Create `scripts/package-extension.mjs`: validate and produce versioned ZIP.
- Modify `package.json`: extension test/render/package scripts and font dev dependencies.
- Modify `.gitignore`: ignore generated release ZIPs while keeping store artwork tracked.

---

### Task 1: Define The Same-URL Runtime State Contract

**Files:**
- Create: `extension/runtime-state.js`
- Create: `src/lib/jobs/extension-runtime-state.test.ts`

- [ ] **Step 1: Write the failing restoration tests**

Create a loader that evaluates the browser script and returns
`globalThis.JobClockRuntimeState`, then define these cases:

```ts
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"

function loadRuntimeState() {
  const source = readFileSync(resolve(process.cwd(), "extension/runtime-state.js"), "utf8")
  const runtime = new Function(`${source}; return globalThis.JobClockRuntimeState;`)()
  if (!runtime) throw new Error("JobClockRuntimeState was not registered")
  return runtime
}

afterEach(() => {
  delete (globalThis as typeof globalThis & { JobClockRuntimeState?: unknown })
    .JobClockRuntimeState
})

describe("extension runtime state", () => {
  const tab = { id: 42, url: "https://jobs.example.com/roles/123", title: "New title" }

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
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/lib/jobs/extension-runtime-state.test.ts
```

Expected: FAIL because `extension/runtime-state.js` does not exist.

- [ ] **Step 3: Implement the minimal shared state resolver**

Create an IIFE that registers a browser-compatible global:

```js
;(function registerRuntimeState(root) {
  const INTERRUPTED_MESSAGE =
    "The previous extraction was interrupted. Select Try again to restart it."

  function operationKey(tab) {
    return `${tab.id}::${tab.url}`
  }

  function matchesTabAndUrl(storedState, tab) {
    return Boolean(
      storedState &&
        storedState.tabId === tab.id &&
        storedState.tabUrl === tab.url
    )
  }

  function resolveStoredState({ storedState, tab, activeOperationKeys }) {
    if (!matchesTabAndUrl(storedState, tab)) {
      return { action: "start" }
    }

    if (
      storedState.view === "loading" &&
      !activeOperationKeys.includes(storedState.operationKey)
    ) {
      return {
        action: "replace",
        state: {
          ...storedState,
          view: "error",
          operation: null,
          message: INTERRUPTED_MESSAGE,
          updatedAt: Date.now(),
        },
      }
    }

    return { action: "restore", state: storedState }
  }

  root.JobClockRuntimeState = {
    INTERRUPTED_MESSAGE,
    operationKey,
    matchesTabAndUrl,
    resolveStoredState,
  }
})(globalThis)
```

- [ ] **Step 4: Run the test and verify GREEN**

Run:

```bash
npx vitest run src/lib/jobs/extension-runtime-state.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add extension/runtime-state.js src/lib/jobs/extension-runtime-state.test.ts
git commit -m "test(extension): define durable runtime state"
```

---

### Task 2: Keep Extraction Alive Across Popup Closure

**Files:**
- Modify: `extension/background.js`
- Create: `src/lib/jobs/extension-background-state.test.ts`

- [ ] **Step 1: Write the failing service-worker test**

Build a small Chrome API harness that captures the `runtime.onMessage` listener,
uses a deferred fetch response, and verifies:

```ts
it("returns the existing loading operation without starting a second extraction", async () => {
  const harness = await loadBackgroundHarness()
  const tab = {
    id: 9,
    url: "https://jobs.example.com/roles/9",
    title: "Engineer",
  }

  const firstPreview = harness.send({
    type: "preview-job",
    payload: { config: { token: "ja_ext_test" }, tab },
  })

  await harness.waitForStoredView("loading")

  const restored = await harness.send({
    type: "get-state",
    payload: { tab },
  })

  expect(restored.state.view).toBe("loading")
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
  await firstPreview

  expect(await harness.storedState()).toEqual(
    expect.objectContaining({ view: "preview", tabUrl: tab.url })
  )
})
```

Add a second test that seeds a loading state with no in-memory operation and
expects `get-state` to persist and return the interrupted error.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/lib/jobs/extension-background-state.test.ts
```

Expected: FAIL because `get-state` ignores the requested tab and cannot
reconcile orphaned loading.

- [ ] **Step 3: Load the shared resolver in the service worker**

At the beginning of `extension/background.js`:

```js
importScripts("runtime-state.js")

const runtimeState = globalThis.JobClockRuntimeState
```

When writing loading states, add `operation` and `operationKey`:

```js
const key = runtimeState.operationKey(tab)

await setRuntimeState({
  view: "loading",
  operation: "preview",
  operationKey: key,
  tabId: tab.id,
  tabUrl: tab.url,
  loadingTitle: "Extracting job details",
  loadingMessage: "Reading the current page and asking JobClock for a preview.",
})
```

Use the same pattern with `operation: "save"` for saves. Clear `operation` in
preview, success, and error terminal states.

- [ ] **Step 4: Reconcile state in `get-state`**

Add:

```js
function activeOperationKeys() {
  return [...inflightPreviews.keys(), ...inflightSaves.keys()]
}

async function getRuntimeStateForTab(tab) {
  const storedState = await getRuntimeState()
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
```

Update the message handler:

```js
if (message.type === "get-state") {
  sendResponse({
    ok: true,
    state: await getRuntimeStateForTab(message.payload.tab),
  })
  return
}
```

Keep the existing in-flight maps so repeated `preview-job` or `save-preview`
messages for the same key share one promise.

- [ ] **Step 5: Run focused tests**

Run:

```bash
npx vitest run \
  src/lib/jobs/extension-runtime-state.test.ts \
  src/lib/jobs/extension-background-state.test.ts
```

Expected: all runtime and service-worker tests pass.

- [ ] **Step 6: Commit**

```bash
git add extension/background.js src/lib/jobs/extension-background-state.test.ts
git commit -m "fix(extension): preserve background extraction state"
```

---

### Task 3: Restore And Follow State In Reopened Popups

**Files:**
- Modify: `extension/popup.html`
- Modify: `extension/popup.js`
- Create: `src/lib/jobs/extension-popup-state.test.ts`

- [ ] **Step 1: Write the failing popup tests**

Load `extension/popup.html` into jsdom, mock `chrome.tabs.query`,
`chrome.runtime.sendMessage`, and `chrome.storage.onChanged`, then evaluate
`runtime-state.js` and `popup.js`.

Cover:

```ts
it("restores same-URL preview without comparing title or age", async () => {
  const harness = await loadPopupHarness({
    activeTab: {
      id: 7,
      url: "https://jobs.example.com/roles/7",
      title: "Title changed after hydration",
    },
    runtimeState: {
      view: "preview",
      tabId: 7,
      tabUrl: "https://jobs.example.com/roles/7",
      tabTitle: "Old title",
      updatedAt: 1,
      preview: previewFixture,
    },
  })

  await harness.ready()
  expect(harness.previewTitle()).toBe(previewFixture.title)
  expect(harness.messagesOfType("preview-job")).toHaveLength(0)
})

it("updates a reopened loading popup when storage changes to preview", async () => {
  const harness = await loadPopupHarness({
    runtimeState: loadingFixture,
  })

  await harness.ready()
  expect(harness.visibleState()).toBe("loading-state")

  harness.emitRuntimeState({ ...previewStateFixture })

  expect(harness.visibleState()).toBe("preview-state")
  expect(harness.previewTitle()).toBe(previewFixture.title)
  expect(harness.messagesOfType("preview-job")).toHaveLength(0)
})

it("awaits manual reset before starting re-extraction", async () => {
  const harness = await loadPopupHarness({ runtimeState: previewStateFixture })
  await harness.click("reextract-button")
  expect(harness.messageTypes()).toEqual([
    "get-state",
    "clear-state",
    "get-state",
    "preview-job",
  ])
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/lib/jobs/extension-popup-state.test.ts
```

Expected: FAIL because the popup still applies title/age invalidation, does not
subscribe to stored state, and clears state without awaiting.

- [ ] **Step 3: Load the shared state script before the popup**

In `extension/popup.html`:

```html
<script src="runtime-state.js" defer></script>
<script src="popup.js" defer></script>
```

- [ ] **Step 4: Replace time/title restoration with exact tab/URL restoration**

Remove `RESTORE_STATE_MAX_AGE_MS`. Request tab-specific state:

```js
async function restoreRuntimeState(tab) {
  const response = await sendMessage({
    type: "get-state",
    payload: { tab },
  })
  if (!response.state) return false
  return renderRuntimeState(response.state, true)
}
```

Create one renderer for stored states:

```js
function renderRuntimeState(runtimeState, restored = false) {
  if (runtimeState.view === "loading") {
    renderLoading(runtimeState.loadingMessage, runtimeState.loadingTitle)
    return true
  }
  if (runtimeState.view === "preview" && runtimeState.preview) {
    renderPreview({ preview: runtimeState.preview }, restored)
    return true
  }
  if (runtimeState.view === "success" && runtimeState.result) {
    renderSuccess(runtimeState.result, restored)
    return true
  }
  if (runtimeState.view === "error" && runtimeState.message) {
    showError(runtimeState.message)
    return true
  }
  return false
}
```

- [ ] **Step 5: Subscribe reopened popups to terminal state changes**

Register once:

```js
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return
  const stateKey = globalThis.JobClockConfig.RUNTIME_STATE_KEY
  const nextState = changes[stateKey]?.newValue
  if (!nextState) return
  if (
    nextState.tabId !== state.tabId ||
    nextState.tabUrl !== state.tabUrl
  ) {
    return
  }
  renderRuntimeState(nextState, true)
})
```

- [ ] **Step 6: Await explicit reset actions**

Use one helper:

```js
async function restartCurrentPage() {
  state.preview = null
  await sendMessage({ type: "clear-state" })
  await initialize()
}
```

Attach it to **Try again**, **Re-extract**, and **Save again**. When the token is
replaced, save it, clear stale state, and then initialize.

- [ ] **Step 7: Run focused tests**

Run:

```bash
npx vitest run \
  src/lib/jobs/extension-runtime-state.test.ts \
  src/lib/jobs/extension-background-state.test.ts \
  src/lib/jobs/extension-popup-state.test.ts
```

Expected: all popup-lifecycle tests pass.

- [ ] **Step 8: Commit**

```bash
git add extension/popup.html extension/popup.js src/lib/jobs/extension-popup-state.test.ts
git commit -m "fix(extension): restore popup state without reextracting"
```

---

### Task 4: Productionize And Restyle The Existing Popup

**Files:**
- Create: `extension/config.js`
- Create: `extension/fonts/ibm-plex-sans-400.woff2`
- Create: `extension/fonts/ibm-plex-sans-500.woff2`
- Create: `extension/fonts/ibm-plex-sans-600.woff2`
- Create: `extension/fonts/ibm-plex-serif-400.woff2`
- Create: `extension/fonts/ibm-plex-serif-500.woff2`
- Modify: `extension/manifest.json`
- Modify: `extension/background.js`
- Modify: `extension/popup.html`
- Modify: `extension/popup.js`
- Modify: `extension/popup.css`
- Modify: `extension/README.md`
- Modify: `src/app/(dashboard)/settings/extension-settings-card.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/lib/jobs/extension-release-config.test.ts`

- [ ] **Step 1: Write failing production-release assertions**

Test the manifest/config/source:

```ts
it("ships only the production JobClock host", () => {
  expect(manifest.name).toBe("JobClock: Job Application Tracker")
  expect(manifest.version).toBe("0.2.0")
  expect(manifest.host_permissions).toEqual([
    "https://jobclock.michaelogunjimi.com/*",
  ])
  expect(manifest.permissions).toEqual(["activeTab", "scripting", "storage"])
})

it("does not expose an editable app URL", () => {
  expect(popupHtml).not.toContain('id="app-url"')
  expect(popupSource).not.toContain("appBaseUrl")
  expect(configSource).toContain(
    'APP_BASE_URL: "https://jobclock.michaelogunjimi.com"'
  )
})

it("defines responsive JobClock popup bounds", () => {
  expect(popupCss).toContain("width: 440px")
  expect(popupCss).toContain("max-width: 100vw")
  expect(popupCss).toContain("@media (max-width: 399px)")
  expect(popupCss).toContain("overflow-x: hidden")
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/lib/jobs/extension-release-config.test.ts
```

Expected: FAIL on old name/version, broad hosts, editable URL, and 360 px width.

- [ ] **Step 3: Add packaged IBM Plex fonts**

Install source packages:

```bash
npm install --save-dev \
  @fontsource/ibm-plex-sans@5.2.8 \
  @fontsource/ibm-plex-serif@5.2.7
```

Copy the required Latin WOFF2 files from each package's `files/` directory into
`extension/fonts/`. Do not load Google Fonts or any other remote font URL from
the extension.

- [ ] **Step 4: Add production configuration**

Create:

```js
;(function registerConfig(root) {
  root.JobClockConfig = Object.freeze({
    APP_BASE_URL: "https://jobclock.michaelogunjimi.com",
    RUNTIME_STATE_KEY: "jobAssistantRuntimeState",
  })
})(globalThis)
```

Load `config.js` before `runtime-state.js` in both the service worker and popup.
Replace all `config.appBaseUrl` reads with `JobClockConfig.APP_BASE_URL`. Keep
only `{ token }` in popup state and storage.

- [ ] **Step 5: Update manifest metadata and permissions**

Use:

```json
{
  "manifest_version": 3,
  "name": "JobClock: Job Application Tracker",
  "short_name": "JobClock",
  "description": "Preview and save job listings from any website directly into your JobClock pipeline.",
  "version": "0.2.0",
  "permissions": ["activeTab", "scripting", "storage"],
  "host_permissions": ["https://jobclock.michaelogunjimi.com/*"]
}
```

Preserve the existing action, background worker, and icon declarations.

- [ ] **Step 6: Apply the JobClock design system and responsive width**

Define local fonts and tokens:

```css
@font-face {
  font-family: "IBM Plex Sans";
  src: url("fonts/ibm-plex-sans-400.woff2") format("woff2");
  font-weight: 400;
}

@font-face {
  font-family: "IBM Plex Serif";
  src: url("fonts/ibm-plex-serif-400.woff2") format("woff2");
  font-weight: 400;
}

:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --secondary: #fafafa;
  --muted: #f5f5f5;
  --muted-foreground: #777777;
  --accent: #6b2d3c;
  --border: #e5e5e5;
  font-family: "IBM Plex Sans", Arial, sans-serif;
}

html,
body {
  overflow-x: hidden;
}

.shell {
  width: 440px;
  max-width: 100vw;
  min-height: 420px;
}

@media (max-width: 399px) {
  .details {
    grid-template-columns: 1fr;
  }

  .recent-head,
  .recent-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .button,
  .status-select {
    width: 100%;
  }
}
```

Use the existing real logo asset in the popup header, square corners, one-pixel
borders, serif headings, and burgundy only for focused/accented states.

- [ ] **Step 7: Update setup and settings copy**

Remove the app URL field. The setup form contains only the token and explains
the production connection, local token storage, revocation, and user-triggered
page access.

Update the web settings card to say:

```tsx
<CardDescription>
  Generate a personal token for the JobClock Chrome extension. The extension
  connects to the production JobClock site automatically.
</CardDescription>
```

Replace its numbered steps with token-only setup and Chrome Web Store/unpacked
development guidance.

- [ ] **Step 8: Run tests and lint**

Run:

```bash
npx vitest run \
  src/lib/jobs/extension-runtime-state.test.ts \
  src/lib/jobs/extension-background-state.test.ts \
  src/lib/jobs/extension-popup-state.test.ts \
  src/lib/jobs/extension-release-config.test.ts \
  src/lib/jobs/extension-page-extractor.test.ts
npm run lint
```

Expected: focused tests pass and ESLint exits 0.

- [ ] **Step 9: Commit**

```bash
git add \
  extension \
  src/app/'(dashboard)'/settings/extension-settings-card.tsx \
  src/lib/jobs/extension-release-config.test.ts \
  package.json \
  package-lock.json
git commit -m "feat(extension): prepare production JobClock popup"
```

---

### Task 5: Add Public Privacy And Support Pages

**Files:**
- Create: `src/components/extension/public-extension-page.tsx`
- Create: `src/app/extension/privacy/page.tsx`
- Create: `src/app/extension/support/page.tsx`
- Create: `src/app/extension/extension-pages.test.tsx`
- Create: `src/app/sitemap.test.ts`
- Modify: `src/app/sitemap.ts`

- [ ] **Step 1: Confirm the local Next.js 16 conventions**

Read:

```bash
sed -n '1,220p' node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md
sed -n '1,220p' node_modules/next/dist/docs/01-app/01-getting-started/14-metadata-and-og-images.md
sed -n '1,180p' node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/page.md
sed -n '1,180p' node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/sitemap.md
```

Expected: pages are Server Components by default, static `metadata` exports are
supported, and `sitemap.ts` returns `MetadataRoute.Sitemap`.

- [ ] **Step 2: Write failing page tests**

Render the synchronous pages and assert the required disclosures:

```tsx
it("explains extension data access and transfer", () => {
  render(<ExtensionPrivacyPage />)
  expect(
    screen.getByRole("heading", { level: 1, name: "JobClock extension privacy" })
  ).toBeInTheDocument()
  expect(screen.getByText(/only when you open the extension/i)).toBeInTheDocument()
  expect(screen.getByText(/stored locally in Chrome/i)).toBeInTheDocument()
  expect(screen.getByText(/not sold or used for advertising/i)).toBeInTheDocument()
})

it("documents token setup, revocation, and extraction recovery", () => {
  render(<ExtensionSupportPage />)
  expect(screen.getByText(/Generate Token/i)).toBeInTheDocument()
  expect(screen.getByText(/Revoke Token/i)).toBeInTheDocument()
  expect(screen.getByText(/LinkedIn/i)).toBeInTheDocument()
  expect(screen.getByText(/Try again/i)).toBeInTheDocument()
})
```

Test that `sitemap()` includes:

```ts
expect(urls).toContain("https://jobclock.michaelogunjimi.com/extension/privacy")
expect(urls).toContain("https://jobclock.michaelogunjimi.com/extension/support")
```

- [ ] **Step 3: Run the tests and verify RED**

Run:

```bash
npx vitest run \
  src/app/extension/extension-pages.test.tsx \
  src/app/sitemap.test.ts
```

Expected: FAIL because the routes and sitemap entries do not exist.

- [ ] **Step 4: Build the shared public page shell**

Use the existing `Card`, `Button`, logo, `page-kicker`, serif headings, borders,
and sidebar footer. Keep it a synchronous Server Component with props:

```ts
interface PublicExtensionPageProps {
  kicker: string
  title: string
  lede: string
  updatedAt: string
  children: React.ReactNode
}
```

Include links to the home page, support, privacy, and `/auth`.

- [ ] **Step 5: Implement the privacy and support pages**

Export static metadata:

```ts
export const metadata: Metadata = {
  title: "Extension Privacy",
  description:
    "How the JobClock Chrome extension accesses, uses, stores, and transfers data.",
}
```

The privacy page must cover active-page content, URL/title, local token storage,
HTTPS transfer, user-configured AI providers, account persistence after Save,
revocation/deletion, no advertising/sale, and publisher contact.

The support page must cover install, generate token, connect, preview/save,
recent stage updates, LinkedIn lazy loading, unauthorized errors, interrupted
extraction, manual retry, and token revocation.

- [ ] **Step 6: Add sitemap entries**

Append:

```ts
{
  url: `${siteUrl}/extension/privacy`,
  lastModified: new Date(),
  changeFrequency: "yearly",
  priority: 0.4,
},
{
  url: `${siteUrl}/extension/support`,
  lastModified: new Date(),
  changeFrequency: "monthly",
  priority: 0.5,
},
```

- [ ] **Step 7: Run tests and build**

Run:

```bash
npx vitest run \
  src/app/extension/extension-pages.test.tsx \
  src/app/sitemap.test.ts
npm run build
```

Expected: route tests pass and Next.js production build exits 0.

- [ ] **Step 8: Commit**

```bash
git add \
  src/components/extension/public-extension-page.tsx \
  src/app/extension \
  src/app/sitemap.ts \
  src/app/sitemap.test.ts
git commit -m "feat(extension): add public privacy and support pages"
```

---

### Task 6: Write Chrome Web Store Listing And Review Materials

**Files:**
- Create: `extension/store/listing.md`
- Create: `extension/store/submission-checklist.md`

- [ ] **Step 1: Write `listing.md`**

Include these exact sections:

```md
# JobClock: Job Application Tracker

## Short Description
Preview and save job listings from any website directly into your JobClock pipeline.

## Single Purpose
JobClock lets a user preview the active job listing, save it to their JobClock
application pipeline, and update stages for recent applications.

## Prominent Data Disclosure
JobClock reads the active job page only when you open the extension. The page
URL, title, and extracted job details are sent securely to your JobClock account
to create a preview. Job details are saved only when you select Save to JobClock.

## Permission Justifications
...

## Detailed Description
...

## Release Notes — 0.2.0
...
```

Explain `activeTab`, `scripting`, `storage`, and the exact JobClock host.

- [ ] **Step 2: Write `submission-checklist.md`**

Include:

- publisher identity and verified production domain;
- privacy URL:
  `https://jobclock.michaelogunjimi.com/extension/privacy`;
- support URL:
  `https://jobclock.michaelogunjimi.com/extension/support`;
- category: Productivity;
- language: English (UK);
- single-purpose text;
- permission justification text;
- authentication information disclosure;
- website content disclosure;
- active-page URL/browsing-activity classification check;
- limited-use certifications;
- no in-app purchases;
- public distribution;
- required artwork dimensions;
- package smoke test;
- final manual review before **Submit for review**.

- [ ] **Step 3: Verify against official requirements**

Cross-check:

```text
https://developer.chrome.com/docs/webstore/cws-dashboard-listing
https://developer.chrome.com/docs/webstore/images
https://developer.chrome.com/docs/webstore/cws-dashboard-privacy
https://developer.chrome.com/docs/webstore/program-policies/privacy
https://developer.chrome.com/docs/webstore/program-policies/limited-use
```

Expected: no unsupported claims, missing data transfer, or permission ambiguity.

- [ ] **Step 4: Commit**

```bash
git add extension/store/listing.md extension/store/submission-checklist.md
git commit -m "docs(extension): add web store submission copy"
```

---

### Task 7: Generate Store Artwork From The Shipped Design

**Files:**
- Create: `extension/store/render.html`
- Create: `scripts/render-extension-store-assets.mjs`
- Create: `extension/store/assets/icon-128.png`
- Create: `extension/store/assets/screenshot-connect-1280x800.png`
- Create: `extension/store/assets/screenshot-preview-1280x800.png`
- Create: `extension/store/assets/screenshot-saved-1280x800.png`
- Create: `extension/store/assets/small-promo-440x280.png`
- Create: `extension/store/assets/marquee-1400x560.png`
- Modify: `package.json`

- [ ] **Step 1: Create the deterministic render fixture**

Build a local HTML page that imports `../popup.css`, uses the real logo and
extension icons, and selects one of these states from `?state=`:

```js
const states = {
  connect: renderConnectState,
  preview: renderPreviewState,
  saved: renderSavedState,
  promo: renderPromoState,
  marquee: renderMarqueeState,
}
```

The screenshot states must show the actual token-only setup, real preview fields,
successful save, and recent application stage controls. No fake rounded branding
or non-shipping controls.

- [ ] **Step 2: Create the Playwright render script**

Use a temporary local HTTP server and Chromium:

```js
const captures = [
  ["connect", "screenshot-connect-1280x800.png", 1280, 800],
  ["preview", "screenshot-preview-1280x800.png", 1280, 800],
  ["saved", "screenshot-saved-1280x800.png", 1280, 800],
  ["promo", "small-promo-440x280.png", 440, 280],
  ["marquee", "marquee-1400x560.png", 1400, 560],
]
```

For each capture, set the exact viewport, navigate to the state URL, wait for
fonts, and take a full-viewport PNG.

- [ ] **Step 3: Produce the 128 px store icon**

Use ImageMagick against the existing real 128 px extension icon:

```bash
magick extension/icons/icon-128.png \
  -resize 128x128 \
  extension/store/assets/icon-128.png
```

- [ ] **Step 4: Add and run the asset script**

Add:

```json
"extension:assets": "node scripts/render-extension-store-assets.mjs"
```

Run:

```bash
npm run extension:assets
identify extension/store/assets/*.png
```

Expected dimensions: one 128 x 128 icon, three 1280 x 800 screenshots, one
440 x 280 tile, and one 1400 x 560 marquee.

- [ ] **Step 5: Inspect the artwork**

Open all generated assets and verify:

- text remains readable at 640 x 400 downscaling;
- popup matches the shipped CSS;
- all corners are square;
- logo and accent match JobClock;
- no secrets or real personal data appear; and
- screenshots are full bleed.

- [ ] **Step 6: Commit**

```bash
git add \
  extension/store/render.html \
  extension/store/assets \
  scripts/render-extension-store-assets.mjs \
  package.json
git commit -m "feat(extension): add chrome web store artwork"
```

---

### Task 8: Validate And Package The Production Extension

**Files:**
- Create: `scripts/package-extension.mjs`
- Create: `src/lib/jobs/extension-package.test.ts`
- Modify: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Write failing package validation tests**

Export `validateManifest`, `validateSource`, and `packageEntries` from the
script. Test:

```ts
it("accepts the production extension manifest", () => {
  expect(() => validateManifest(manifest)).not.toThrow()
})

it("rejects broad host access", () => {
  expect(() =>
    validateManifest({ ...manifest, host_permissions: ["https://*/*"] })
  ).toThrow(/broad host permission/i)
})

it("rejects localhost and editable app URL source", () => {
  expect(() => validateSource("http://localhost:3000")).toThrow(/localhost/i)
  expect(() => validateSource("appBaseUrl")).toThrow(/editable app URL/i)
})

it("packages only the production allowlist", () => {
  expect(packageEntries).toEqual([
    "manifest.json",
    "config.js",
    "runtime-state.js",
    "background.js",
    "page-extractor.js",
    "popup.html",
    "popup.js",
    "popup.css",
    "icons",
    "fonts",
  ])
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
npx vitest run src/lib/jobs/extension-package.test.ts
```

Expected: FAIL because the packaging module does not exist.

- [ ] **Step 3: Implement validation**

Validate:

- manifest version 3;
- extension version `0.2.0`;
- exact permissions and host permission;
- required files/directories;
- no `localhost`, broad match pattern, source map, `.DS_Store`, or editable
  `appBaseUrl`;
- no remote `<script>` or remote executable JavaScript; and
- ZIP root contains `manifest.json`.

- [ ] **Step 4: Implement clean ZIP creation**

Copy only `packageEntries` to a temporary directory, then invoke:

```js
spawnSync("zip", ["-X", "-r", outputPath, "."], {
  cwd: stagingDirectory,
  stdio: "inherit",
})
```

Write the artifact to:

`release/jobclock-extension-0.2.0.zip`

Always remove the temporary directory in `finally`.

- [ ] **Step 5: Add scripts and ignore generated ZIPs**

Add:

```json
"extension:validate": "node scripts/package-extension.mjs --validate-only",
"extension:package": "node scripts/package-extension.mjs"
```

Add `/release/` to `.gitignore`.

- [ ] **Step 6: Run test, validation, and package**

Run:

```bash
npx vitest run src/lib/jobs/extension-package.test.ts
npm run extension:validate
npm run extension:package
unzip -l release/jobclock-extension-0.2.0.zip
```

Expected: tests pass; validation exits 0; ZIP listing has `manifest.json` at the
root and no store artwork, docs, tests, localhost references, or source maps.

- [ ] **Step 7: Commit**

```bash
git add \
  scripts/package-extension.mjs \
  src/lib/jobs/extension-package.test.ts \
  package.json \
  .gitignore
git commit -m "build(extension): add validated store package"
```

---

### Task 9: Full Verification And Chrome Smoke Test

**Files:**
- Modify if required by verification findings only.

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
npm run test
npm run lint
npm run build
npm run extension:validate
npm run extension:assets
npm run extension:package
```

Expected:

- Vitest reports zero failed tests;
- ESLint exits 0;
- Next.js production build exits 0;
- extension validation exits 0;
- artwork is regenerated at exact dimensions; and
- versioned ZIP is recreated successfully.

- [ ] **Step 2: Load the packaged extension unpacked**

Unzip to a temporary directory:

```bash
rm -rf /tmp/jobclock-extension-0.2.0
mkdir -p /tmp/jobclock-extension-0.2.0
unzip -q release/jobclock-extension-0.2.0.zip \
  -d /tmp/jobclock-extension-0.2.0
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and
select `/tmp/jobclock-extension-0.2.0`.

- [ ] **Step 3: Verify popup persistence manually**

1. Open a supported job URL.
2. Open JobClock and begin extraction.
3. Close the popup before extraction completes.
4. Reopen it on the same tab and URL.
5. Confirm the existing loading state appears and no second API request starts.
6. Leave it open and confirm it changes to preview when extraction completes.
7. Close/reopen and confirm the completed preview remains.
8. Change only the document title and confirm the preview remains.
9. Select **Re-extract** and confirm exactly one new request begins.
10. Navigate to a different URL and confirm a fresh extraction begins.

- [ ] **Step 4: Verify all user flows**

Check token setup, invalid token, generic extraction, LinkedIn lazy-loading
guidance, save, recent applications, stage update, interrupted retry, token
replacement, token revocation, privacy page, and support page.

- [ ] **Step 5: Verify responsive layout**

Inspect the popup at approximately 440 px and constrained 360 px widths. Confirm
no horizontal scrolling, clipped text, overflowing buttons, or broken recent
application controls.

- [ ] **Step 6: Review the final Chrome Web Store package**

Compare:

- `extension/store/listing.md`;
- `extension/store/submission-checklist.md`;
- generated artwork;
- public privacy/support URLs; and
- `release/jobclock-extension-0.2.0.zip`.

Do not press **Submit for review** without the user's explicit authorization at
the moment of submission.

- [ ] **Step 7: Commit any verification-only corrections**

If verification required changes:

```bash
git add <corrected-files>
git commit -m "fix(extension): address release verification"
```

If no changes were required, do not create an empty commit.
