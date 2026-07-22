import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { CHROME_WEB_STORE_URL } from "@/lib/extension"

const extensionPath = (...parts: string[]) =>
  resolve(process.cwd(), "extension", ...parts)

const manifest = JSON.parse(
  readFileSync(extensionPath("manifest.json"), "utf8")
) as {
  name: string
  short_name?: string
  description: string
  version: string
  permissions: string[]
  host_permissions: string[]
  action: { default_title: string }
}

const popupHtml = readFileSync(extensionPath("popup.html"), "utf8")
const popupSource = readFileSync(extensionPath("popup.js"), "utf8")
const popupCss = readFileSync(extensionPath("popup.css"), "utf8")
const backgroundSource = readFileSync(extensionPath("background.js"), "utf8")
const settingsSource = readFileSync(
  resolve(
    process.cwd(),
    "src/app/(dashboard)/settings/extension-settings-card.tsx"
  ),
  "utf8"
)

describe("extension production release configuration", () => {
  it("ships only the production JobClock host", () => {
    expect(manifest.name).toBe("JobClock: Job Application Tracker")
    expect(manifest.short_name).toBe("JobClock")
    expect(manifest.description).toBe(
      "Preview and save job listings from any website directly into your JobClock pipeline."
    )
    expect(manifest.version).toBe("0.2.0")
    expect(manifest.action.default_title).toBe("Save job to JobClock")
    expect(manifest.host_permissions).toEqual([
      "https://jobclock.michaelogunjimi.com/*",
    ])
    expect(manifest.permissions).toEqual([
      "activeTab",
      "scripting",
      "storage",
    ])
  })

  it("loads immutable production configuration before runtime consumers", () => {
    const configSource = readFileSync(extensionPath("config.js"), "utf8")

    expect(configSource).toContain(
      'APP_BASE_URL: "https://jobclock.michaelogunjimi.com"'
    )
    expect(configSource).toContain(
      'RUNTIME_STATE_KEY: "jobAssistantRuntimeState"'
    )
    expect(configSource).toContain("Object.freeze")
    expect(backgroundSource).toContain('importScripts("config.js")')
    expect(popupHtml.indexOf('src="config.js"')).toBeGreaterThan(-1)
    expect(popupHtml.indexOf('src="config.js"')).toBeLessThan(
      popupHtml.indexOf('src="runtime-state.js"')
    )
  })

  it("does not expose an editable app URL", () => {
    expect(popupHtml).not.toMatch(/id=["']app-url["']/)
    expect(popupSource).not.toContain("appBaseUrl")
    expect(popupHtml).toContain('id="token"')
  })

  it("links extension setup to the published Chrome Web Store listing", () => {
    expect(CHROME_WEB_STORE_URL).toBe(
      "https://chromewebstore.google.com/detail/jobclock-job-application/albhohoocdlhefihfhiapcmckopbgjhh"
    )
    expect(settingsSource).toContain("published JobClock Chrome extension")
    expect(settingsSource).toContain("CHROME_WEB_STORE_URL")
  })

  it("defines responsive JobClock popup bounds and local design tokens", () => {
    expect(popupCss).toMatch(/body\s*\{[^}]*width:\s*440px/)
    expect(popupCss).toMatch(/\.shell\s*\{[^}]*width:\s*100%/)
    expect(popupCss).not.toMatch(
      /\.shell\s*\{[^}]*width:\s*440px[^}]*max-width:\s*100vw/
    )
    expect(popupCss).toContain("@media (max-width: 399px)")
    expect(popupCss).toContain("overflow-x: hidden")
    expect(popupCss).toContain("--accent: #6b2d3c")
    expect(popupCss).toContain('"IBM Plex Sans"')
    expect(popupCss).toContain('"IBM Plex Serif"')
    expect(popupCss).not.toMatch(/https?:\/\//)
  })

  it("packages the required IBM Plex font files", () => {
    for (const filename of [
      "ibm-plex-sans-400.woff2",
      "ibm-plex-sans-500.woff2",
      "ibm-plex-sans-600.woff2",
      "ibm-plex-serif-400.woff2",
      "ibm-plex-serif-500.woff2",
    ]) {
      expect(existsSync(extensionPath("fonts", filename)), filename).toBe(true)
      expect(popupCss).toContain(`fonts/${filename}`)
    }
  })
})
