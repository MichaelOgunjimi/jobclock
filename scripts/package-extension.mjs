import { spawnSync } from "node:child_process"
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { basename, extname, join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

const productionHost = "https://jobclock.michaelogunjimi.com/*"
const requiredPermissions = ["activeTab", "scripting", "storage"]

export const packageEntries = Object.freeze([
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

export function validateManifest(manifest) {
  if (manifest.manifest_version !== 3) {
    throw new Error("The extension must use Manifest V3.")
  }
  if (manifest.version !== "0.2.0") {
    throw new Error("The extension package version must be 0.2.0.")
  }
  if (
    !Array.isArray(manifest.permissions) ||
    manifest.permissions.join(",") !== requiredPermissions.join(",")
  ) {
    throw new Error("Extension permissions must match the production allowlist.")
  }

  const hosts = Array.isArray(manifest.host_permissions)
    ? manifest.host_permissions
    : []
  if (
    hosts.some((host) => host.includes("*://") || host.includes("://*"))
  ) {
    throw new Error("Broad host permission is not allowed.")
  }
  if (hosts.length !== 1 || hosts[0] !== productionHost) {
    throw new Error(`Host permission must be exactly ${productionHost}.`)
  }
}

export function validateSource(source) {
  if (/\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0)\b/i.test(source)) {
    throw new Error("Packaged source must not contain localhost references.")
  }
  if (/\bappBaseUrl\b/.test(source)) {
    throw new Error("Packaged source must not contain an editable app URL.")
  }
  if (/<script\b[^>]*\bsrc\s*=\s*["']https?:\/\//i.test(source)) {
    throw new Error("Packaged source must not load a remote script.")
  }
  if (/\b(?:importScripts|import)\s*\(\s*["']https?:\/\//i.test(source)) {
    throw new Error("Packaged source must not execute remote JavaScript.")
  }
  if (/sourceMappingURL\s*=/.test(source)) {
    throw new Error("Packaged source must not reference source maps.")
  }
}

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? walk(path) : [path]
  })
}

function validatePackageFiles(extensionDirectory) {
  for (const entry of packageEntries) {
    if (!existsSync(join(extensionDirectory, entry))) {
      throw new Error(`Required extension entry is missing: ${entry}`)
    }
  }

  const files = packageEntries.flatMap((entry) => {
    const path = join(extensionDirectory, entry)
    return extname(path) ? [path] : walk(path)
  })

  for (const file of files) {
    const name = basename(file)
    if (name === ".DS_Store" || extname(file) === ".map") {
      throw new Error(`Development file is not allowed in the package: ${name}`)
    }
    if ([".css", ".html", ".js", ".json"].includes(extname(file))) {
      validateSource(readFileSync(file, "utf8"))
    }
  }
}

export function validateExtension(extensionDirectory) {
  const manifest = JSON.parse(
    readFileSync(join(extensionDirectory, "manifest.json"), "utf8")
  )
  validateManifest(manifest)
  validatePackageFiles(extensionDirectory)
  return manifest
}

export function packageExtension({
  extensionDirectory = resolve(process.cwd(), "extension"),
  releaseDirectory = resolve(process.cwd(), "release"),
} = {}) {
  const manifest = validateExtension(extensionDirectory)
  mkdirSync(releaseDirectory, { recursive: true })

  const outputPath = join(
    releaseDirectory,
    `jobclock-extension-${manifest.version}.zip`
  )
  const stagingDirectory = mkdtempSync(
    join(tmpdir(), "jobclock-extension-release-")
  )

  try {
    rmSync(outputPath, { force: true })
    for (const entry of packageEntries) {
      cpSync(join(extensionDirectory, entry), join(stagingDirectory, entry), {
        recursive: true,
      })
    }

    const result = spawnSync("zip", ["-X", "-r", outputPath, "."], {
      cwd: stagingDirectory,
      stdio: "inherit",
    })
    if (result.status !== 0) {
      throw new Error("The extension ZIP command failed.")
    }
  } finally {
    rmSync(stagingDirectory, { recursive: true, force: true })
  }

  return outputPath
}

async function main() {
  const extensionDirectory = resolve(process.cwd(), "extension")
  validateExtension(extensionDirectory)

  if (process.argv.includes("--validate-only")) {
    console.log("JobClock extension validation passed.")
    return
  }

  const outputPath = packageExtension({ extensionDirectory })
  console.log(`Created ${outputPath}`)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main()
}
