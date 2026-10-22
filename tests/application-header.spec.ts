import { expect, test } from "@playwright/test"

const fixturePath = "/global-search-test-harness?view=application"

for (const viewport of [
  { name: "small mobile", width: 320, height: 568 },
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 900 },
  { name: "small laptop", width: 1024, height: 900 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`keeps the application header readable on ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto(fixturePath)

    const title = page.getByRole("button", {
      name: /Edit role: Principal Frontend Platform Engineer/,
    })
    await expect(title).toBeVisible()

    const layout = await title.locator("span").evaluate((titleText) => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      titleClientWidth: titleText.clientWidth,
      titleScrollWidth: titleText.scrollWidth,
      titleWhiteSpace: getComputedStyle(titleText).whiteSpace,
    }))

    expect(layout.documentWidth).toBeLessThanOrEqual(layout.viewportWidth)
    expect(layout.titleWhiteSpace).not.toBe("nowrap")
    expect(layout.titleScrollWidth).toBeLessThanOrEqual(layout.titleClientWidth)
  })
}

test("uses two action columns at tablet width", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 900 })
  await page.goto(fixturePath)

  const back = await page.getByRole("link", { name: "Back to pipeline" }).boundingBox()
  const interview = await page.getByRole("link", { name: "Interview Prep" }).boundingBox()

  expect(back).not.toBeNull()
  expect(interview).not.toBeNull()
  expect(Math.abs(back!.y - interview!.y)).toBeLessThan(2)
})

for (const viewport of [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 768, height: 900 },
  { width: 1024, height: 900 },
  { width: 1440, height: 900 },
]) {
  test(`keeps application controls inside their cards at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto(fixturePath)

    const coverLetterCard = page
      .locator('[data-slot="card"]')
      .filter({ has: page.getByText("Cover Letter", { exact: true }) })
    const cardBox = await coverLetterCard.boundingBox()
    const previewBox = await page
      .getByRole("link", { name: "Preview & Download Cover Letter" })
      .boundingBox()

    expect(cardBox).not.toBeNull()
    expect(previewBox).not.toBeNull()
    expect(previewBox!.x).toBeGreaterThanOrEqual(cardBox!.x)
    expect(previewBox!.x + previewBox!.width).toBeLessThanOrEqual(
      cardBox!.x + cardBox!.width,
    )
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      viewport.width,
    )
  })
}

test("stacks document cards through small laptop widths", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 })
  await page.goto(fixturePath)

  const baseCv = await page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Base CV", { exact: true }) })
    .boundingBox()
  const coverLetter = await page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Cover Letter", { exact: true }) })
    .boundingBox()

  expect(baseCv).not.toBeNull()
  expect(coverLetter).not.toBeNull()
  expect(Math.abs(baseCv!.x - coverLetter!.x)).toBeLessThan(2)
  expect(coverLetter!.y).toBeGreaterThan(baseCv!.y + baseCv!.height)
})

test("aligns paired document card headers and controls on desktop", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(fixturePath)

  const cards = page.locator('[data-slot="card"]')
  const baseCv = cards.filter({ has: page.getByText("Base CV", { exact: true }) })
  const coverLetter = cards.filter({ has: page.getByText("Cover Letter", { exact: true }) })

  const measurements = await Promise.all(
    [
      { card: baseCv, actionName: "Save" },
      { card: coverLetter, actionName: "Professional" },
    ].map(async ({ card, actionName }) => {
      const header = await card.locator('[data-slot="card-header"]').boundingBox()
      const label = await card.locator("label").first().boundingBox()
      const select = await card.locator('[data-slot="select-trigger"]').first().boundingBox()
      const action = await card.getByRole("button", { name: actionName }).boundingBox()
      return { header, label, select, action }
    })
  )

  const [cv, letter] = measurements
  for (const measurement of measurements) {
    expect(measurement.header).not.toBeNull()
    expect(measurement.label).not.toBeNull()
    expect(measurement.select).not.toBeNull()
    expect(measurement.action).not.toBeNull()
    expect(Math.abs(measurement.select!.y - measurement.action!.y)).toBeLessThan(2)
    expect(Math.abs(measurement.select!.height - measurement.action!.height)).toBeLessThan(2)
  }
  expect(Math.abs(cv.header!.height - letter.header!.height)).toBeLessThan(2)
  expect(Math.abs(cv.label!.y - letter.label!.y)).toBeLessThan(2)
  expect(Math.abs(cv.select!.y - letter.select!.y)).toBeLessThan(2)
})

test("stacks the writing-style controls and shortens chat on small phones", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto(fixturePath)

  const writingStyle = await page.getByRole("combobox", { name: "Writing Style" }).boundingBox()
  const tone = await page.getByRole("button", { name: "Professional" }).boundingBox()
  const chatCard = await page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText("Ask AI", { exact: true }) })
    .boundingBox()

  expect(writingStyle).not.toBeNull()
  expect(tone).not.toBeNull()
  expect(tone!.y).toBeGreaterThanOrEqual(writingStyle!.y + writingStyle!.height)
  expect(chatCard).not.toBeNull()
  expect(chatCard!.height).toBeLessThan(700)
})

test("fits expanded chat within a small phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto(fixturePath)
  await page.getByRole("button", { name: "Open expanded chat" }).click()

  const dialog = await page.getByRole("dialog", { name: "Expanded application chat" }).boundingBox()
  expect(dialog).not.toBeNull()
  expect(dialog!.x).toBeGreaterThanOrEqual(0)
  expect(dialog!.y).toBeGreaterThanOrEqual(0)
  expect(dialog!.x + dialog!.width).toBeLessThanOrEqual(320)
  expect(dialog!.y + dialog!.height).toBeLessThanOrEqual(568)
})
