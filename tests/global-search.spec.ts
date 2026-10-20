import { expect, test } from "@playwright/test"

const fixturePath = "/global-search-test-harness"
const recentsKey = "jobclock:global-search:recent:playwright-user"

test.beforeEach(async ({ page }) => {
  await page.goto(fixturePath)
  await page.evaluate((key) => localStorage.removeItem(key), recentsKey)
})

test("supports shortcut, fuzzy search, keyboard selection, and recents", async ({ page }) => {
  await page.keyboard.press("ControlOrMeta+K")

  const input = page.getByRole("combobox", { name: "Global search" })
  await expect(input).toBeFocused()
  await input.fill("pltfm eng")

  const result = page.getByRole("option", { name: /Platform Engineer/ })
  await expect(result).toBeVisible()
  await expect(page.getByRole("option", { name: /Backend CV/ })).toHaveCount(0)
  await input.press("Enter")

  await expect(page).toHaveURL(/\/#platform-engineer$/)
  await page.goto(fixturePath)
  await page.keyboard.press("ControlOrMeta+K")
  await expect(page.getByRole("button", { name: "pltfm eng" })).toBeVisible()

  await page.getByRole("button", { name: "Clear" }).click()
  await expect(page.getByRole("button", { name: "pltfm eng" })).toHaveCount(0)
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), recentsKey)).toBeNull()
})

test("closes from the keyboard and restores trigger focus", async ({ page }) => {
  const trigger = page.getByRole("button", { name: "Search or run a command" })
  await trigger.focus()
  await page.keyboard.press("ControlOrMeta+K")
  await expect(page.getByRole("dialog", { name: "Global search" })).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(page.getByRole("dialog", { name: "Global search" })).toHaveCount(0)
  await expect(trigger).toBeFocused()
})

test("fits the search dialog within a mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.getByRole("button", { name: "Search or run a command" }).click()
  await page.getByRole("combobox", { name: "Global search" }).fill("configure")

  const dialog = page.getByRole("dialog", { name: "Global search" })
  await expect(dialog).toBeVisible()
  const box = await dialog.boundingBox()
  expect(box).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(320)
})

test("uses document scrolling for long dashboard pages", async ({ page }) => {
  const layout = await page.evaluate(() => {
    const main = document.querySelector("main")
    if (!main) throw new Error("Dashboard main region was not rendered")

    return {
      documentScrollable: document.documentElement.scrollHeight > window.innerHeight,
      nestedMainScroll:
        main.scrollHeight > main.clientHeight &&
        ["auto", "scroll"].includes(getComputedStyle(main).overflowY),
    }
  })

  expect(layout.documentScrollable).toBe(true)
  expect(layout.nestedMainScroll).toBe(false)
})

test("keeps the shared select chevron away from the border", async ({ page }) => {
  const styles = await page.getByRole("combobox", { name: "Fixture select" }).evaluate((select) => {
    const computed = getComputedStyle(select)
    return {
      appearance: computed.appearance,
      backgroundPosition: computed.backgroundPosition,
      paddingRight: Number.parseFloat(computed.paddingRight),
    }
  })

  expect(styles.appearance).toBe("none")
  expect(styles.backgroundPosition).toContain("24px")
  expect(styles.paddingRight).toBeGreaterThanOrEqual(64)
})
