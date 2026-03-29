import { expect, test } from "@playwright/test"

test("landing page supports anchor navigation and theme persistence", async ({ page }) => {
  await page.goto("/")

  await expect(
    page.getByRole("heading", { level: 1, name: /turn the job hunt into a deliberate system/i })
  ).toBeVisible()

  await page.getByRole("link", { name: /explore the flow/i }).click()

  await expect(page).toHaveURL(/#features$/)
  await expect(page.locator("#features")).toBeInViewport()
})

test("mobile navigation can dismiss and navigate to a section", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("/")

  const menuButton = page.getByRole("button", { name: /open navigation menu/i })
  const headerWorkflowLink = page.locator("header").getByRole("link", { name: "Workflow", exact: true })
  await menuButton.click()

  await expect(headerWorkflowLink).toBeVisible()

  await page.keyboard.press("Escape")
  await expect(headerWorkflowLink).toBeHidden()

  await menuButton.click()
  await headerWorkflowLink.click()

  await expect(page).toHaveURL(/#workflow$/)
  await expect(page.locator("#workflow")).toBeInViewport()
})
