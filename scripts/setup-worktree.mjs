#!/usr/bin/env node
/**
 * Prepares a linked git worktree: links the primary checkout's .env.local and
 * assigns a stable free dev-server port (written to the git-ignored .worktree.env).
 * Re-running keeps the existing port. Does nothing in the primary checkout.
 */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { createServer } from "node:net"
import { basename, dirname, resolve } from "node:path"

const root = resolve(import.meta.dirname, "..")
const git = (...args) => execFileSync("git", ["rev-parse", "--path-format=absolute", ...args], { cwd: root, encoding: "utf8" }).trim()

function isFree(port) {
  return new Promise((done) => {
    const server = createServer().once("error", () => done(false)).once("listening", () => server.close(() => done(true)))
    server.listen(port)
  })
}

/** First free port in 4000-4999, starting from a hash of the worktree name so it is stable. */
async function allocatePort(name) {
  let start = 0
  for (const char of name) start = (start * 31 + char.charCodeAt(0)) % 1000
  for (let offset = 0; offset < 1000; offset += 1) {
    const port = 4000 + ((start + offset) % 1000)
    if (await isFree(port)) return port
  }
  throw new Error("No free port found in 4000-4999")
}

if (git("--git-dir") === git("--git-common-dir")) {
  console.log("Primary checkout detected; nothing to do (dev server stays on port 3000).")
  process.exit(0)
}

const envFile = resolve(root, ".worktree.env")
const existing = existsSync(envFile) ? readFileSync(envFile, "utf8").match(/^PORT=(\d+)$/m)?.[1] : null
const branch = execFileSync("git", ["branch", "--show-current"], { cwd: root, encoding: "utf8" }).trim()
const port = existing ?? String(await allocatePort(branch || basename(dirname(root))))
writeFileSync(envFile, `PORT=${port}\n`)

const primaryEnv = resolve(dirname(git("--git-common-dir")), ".env.local")
const localEnv = resolve(root, ".env.local")
let linked = false
if (!existsSync(localEnv) && existsSync(primaryEnv)) {
  symlinkSync(primaryEnv, localEnv)
  linked = true
}

console.log(`Port: ${port}${existing ? " (kept)" : ""}`)
console.log(linked ? `Linked: .env.local -> ${primaryEnv}` : existsSync(localEnv) ? ".env.local already present" : "No primary .env.local found; create one.")
console.log(`\nStart: make dev   (http://localhost:${port})`)
