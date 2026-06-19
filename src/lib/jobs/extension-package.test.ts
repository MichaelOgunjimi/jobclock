import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import {
  packageEntries,
  validateManifest,
  validateSource,
} from "../../../scripts/package-extension.mjs"

const manifest = JSON.parse(
  readFileSync(resolve(process.cwd(), "extension/manifest.json"), "utf8")
)

describe("extension release package", () => {
  it("accepts the production extension manifest", () => {
    expect(() => validateManifest(manifest)).not.toThrow()
  })

  it("rejects broad host access", () => {
    expect(() =>
      validateManifest({
        ...manifest,
        host_permissions: ["https://*/*"],
      })
    ).toThrow(/broad host permission/i)
  })

  it("rejects localhost and editable app URL source", () => {
    expect(() => validateSource("http://localhost:3000")).toThrow(/localhost/i)
    expect(() => validateSource("const appBaseUrl = input.value")).toThrow(
      /editable app URL/i
    )
  })

  it("rejects remote executable scripts", () => {
    expect(() =>
      validateSource('<script src="https://cdn.example.com/app.js"></script>')
    ).toThrow(/remote script/i)
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
})
