import { spawnSync } from "node:child_process"

const shouldInstall =
  process.env.PLAYWRIGHT_INSTALL_BROWSER === "1" ||
  process.env.VERCEL === "1" ||
  process.env.CI === "true"

if (!shouldInstall) {
  process.exit(0)
}

const result = spawnSync(
  "npx",
  ["playwright", "install", "chromium", "--only-shell"],
  {
    env: {
      ...process.env,
      PLAYWRIGHT_BROWSERS_PATH: "0",
    },
    stdio: "inherit",
  },
)

process.exit(result.status ?? 1)
