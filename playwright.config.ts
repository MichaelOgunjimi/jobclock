import { defineConfig } from "@playwright/test"
import { existsSync, readFileSync } from "node:fs"

const worktreePort = existsSync(".worktree.env")
  ? readFileSync(".worktree.env", "utf8").match(/^PORT=(\d+)$/m)?.[1]
  : undefined
const port = Number(process.env.PORT ?? worktreePort ?? 3000)

export default defineConfig({
  testDir: "./tests",
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${port}`,
    env: { PLAYWRIGHT_GLOBAL_SEARCH_FIXTURE: "1" },
    reuseExistingServer: !process.env.CI,
    url: `http://127.0.0.1:${port}`,
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
      },
    },
  ],
})
