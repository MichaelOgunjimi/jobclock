import { spawnSync } from "node:child_process"
import { createReadStream, existsSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { createServer } from "node:http"
import { extname, join, normalize, resolve } from "node:path"
import { chromium } from "@playwright/test"

const rootDirectory = process.cwd()
const extensionDirectory = resolve(rootDirectory, "extension")
const outputDirectory = resolve(extensionDirectory, "store/assets")

const captures = [
  ["connect", "screenshot-connect-1280x800.png", 1280, 800],
  ["preview", "screenshot-preview-1280x800.png", 1280, 800],
  ["saved", "screenshot-saved-1280x800.png", 1280, 800],
  ["promo", "small-promo-440x280.png", 440, 280],
  ["marquee", "marquee-1400x560.png", 1400, 560],
]

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
}

function createStaticServer() {
  return createServer((request, response) => {
    const requestPath = new URL(request.url || "/", "http://localhost").pathname
    const relativePath = requestPath === "/" ? "store/render.html" : requestPath.slice(1)
    const filePath = normalize(join(extensionDirectory, relativePath))

    if (!filePath.startsWith(extensionDirectory) || !existsSync(filePath)) {
      response.writeHead(404)
      response.end("Not found")
      return
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    })
    createReadStream(filePath).pipe(response)
  })
}

async function listen(server) {
  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen)
    server.listen(0, "127.0.0.1", resolveListen)
  })
  const address = server.address()
  if (!address || typeof address === "string") {
    throw new Error("Could not determine the artwork server port.")
  }
  return address.port
}

function createStoreIcon() {
  const result = spawnSync(
    "magick",
    [
      resolve(extensionDirectory, "icons/icon-128.png"),
      "-resize",
      "128x128",
      resolve(outputDirectory, "icon-128.png"),
    ],
    { stdio: "inherit" }
  )
  if (result.status !== 0) {
    throw new Error("ImageMagick could not create the store icon.")
  }
}

await mkdir(outputDirectory, { recursive: true })
createStoreIcon()

const server = createStaticServer()
const port = await listen(server)
const browser = await chromium.launch({ headless: true })

try {
  for (const [state, filename, width, height] of captures) {
    const page = await browser.newPage({
      viewport: { width, height },
      deviceScaleFactor: 1,
    })
    await page.goto(`http://127.0.0.1:${port}/store/render.html?state=${state}`, {
      waitUntil: "networkidle",
    })
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({
      path: resolve(outputDirectory, filename),
      fullPage: false,
    })
    await page.close()
  }
} finally {
  await browser.close()
  await new Promise((resolveClose) => server.close(resolveClose))
}

console.log(`Rendered ${captures.length + 1} Chrome Web Store assets.`)
