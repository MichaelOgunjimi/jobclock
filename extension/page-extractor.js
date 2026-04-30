;(function () {
  function text(selector) {
    const node = document.querySelector(selector)
    return node instanceof HTMLElement ? (node.innerText || node.textContent || "").trim() : ""
  }

  function attr(selector, name) {
    return document.querySelector(selector)?.getAttribute(name) || ""
  }

  function firstText(selectors) {
    for (const selector of selectors) {
      const value = text(selector)
      if (value) return value
    }

    return ""
  }

  function collectJsonLd() {
    const nodes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
    return nodes
      .map((node) => node.textContent || "")
      .filter(Boolean)
      .slice(0, 5)
  }

  function textNearHeading(headingPattern) {
    const headings = Array.from(document.querySelectorAll("h1,h2,h3,h4,dt,strong,b,span,div"))
    const heading = headings.find((node) => headingPattern.test(node.textContent || ""))
    if (!(heading instanceof HTMLElement)) return ""

    const candidates = [
      heading.nextElementSibling,
      heading.parentElement,
      heading.parentElement?.nextElementSibling,
      heading.closest("section,li,div"),
    ]

    for (const candidate of candidates) {
      if (candidate instanceof HTMLElement) {
        const value = (candidate.innerText || candidate.textContent || "").replace(/\s+/g, " ").trim()
        if (value && !headingPattern.test(value)) return value
        const withoutHeading = value.replace(headingPattern, "").trim()
        if (withoutHeading) return withoutHeading
      }
    }

    return ""
  }

  function looksLikeSalary(value) {
    return /(?:£|\$|€|gbp|usd|eur)\s*\d[\d,.]*(?:\s*[kK])?/i.test(value)
  }

  function findSalaryText() {
    const direct = firstText([
      '[data-test="salary"]',
      '[data-test="detailSalary"]',
      '[data-test*="salary" i]',
      '[data-test-id*="salary" i]',
      '[class*="salary" i]',
      '[aria-label*="salary" i]',
    ])
    if (looksLikeSalary(direct)) return direct

    const nearHeading = textNearHeading(/\bsalar(?:y|ies)\b/i)
    if (looksLikeSalary(nearHeading)) return nearHeading

    const bodyMatch = (document.body?.innerText || document.body?.textContent || "").match(
      /(?:£|\$|€|gbp|usd|eur)\s*\d[\d,.]*(?:\s*[kK])?(?:\s*(?:-|–|—|to)\s*(?:£|\$|€|gbp|usd|eur)?\s*\d[\d,.]*(?:\s*[kK])?)?(?:\s*\([^)]*\))?/i
    )

    return bodyMatch?.[0] || ""
  }

  function relevantPageText(description) {
    const containers = Array.from(
      document.querySelectorAll(
        [
          "main",
          "article",
          '[role="main"]',
          '[data-test*="job" i]',
          '[id*="job" i]',
          '[class*="job" i]',
          '[class*="description" i]',
          '[id*="description" i]',
        ].join(",")
      )
    )

    const parts = []
    for (const container of containers) {
      if (container instanceof HTMLElement) {
        const value = (container.innerText || container.textContent || "").replace(/\s+/g, " ").trim()
        if (value && !parts.includes(value)) parts.push(value)
      }
    }

    if (description) parts.unshift(description)

    const text = parts.join("\n\n").trim()
    if (text) return text.slice(0, 50000)

    return (document.body?.innerText || document.body?.textContent || "").slice(0, 50000)
  }

  globalThis.collectJobAssistantPageData = function collectJobAssistantPageData() {
    const linkedinTitle =
      firstText([
        ".job-details-jobs-unified-top-card__job-title",
        ".jobs-unified-top-card__job-title",
        ".top-card-layout__title",
        ".topcard__title",
      ])

    const linkedinCompany =
      firstText([
        ".job-details-jobs-unified-top-card__company-name",
        ".jobs-unified-top-card__company-name",
        ".topcard__org-name-link",
        ".topcard__flavor",
      ])

    const linkedinLocation =
      firstText([
        ".job-details-jobs-unified-top-card__primary-description-container",
        ".jobs-unified-top-card__bullet",
        ".topcard__flavor--bullet",
      ])

    const linkedinDescription =
      firstText([
        ".jobs-description__content",
        ".jobs-box__html-content",
        ".show-more-less-html__markup",
        ".description__text",
      ])

    const glassdoorTitle = firstText([
      '[data-test="job-title"]',
      '[data-test="jobTitle"]',
      '[data-test*="job-title" i]',
      '[data-test*="jobTitle" i]',
      '[data-test-id*="job-title" i]',
      '[data-test-id*="jobTitle" i]',
      '[class*="job-title" i]',
      '[class*="jobTitle" i]',
    ])

    const glassdoorCompany = firstText([
      '[data-test="employer-name"]',
      '[data-test="employerName"]',
      '[data-test*="employer" i]',
      '[data-test*="company" i]',
      '[data-test-id*="employer" i]',
      '[data-test-id*="company" i]',
      '[class*="employer" i]',
      '[class*="company" i]',
    ])

    const glassdoorLocation = firstText([
      '[data-test="location"]',
      '[data-test="job-location"]',
      '[data-test*="location" i]',
      '[data-test-id*="location" i]',
      '[class*="location" i]',
    ])

    const glassdoorDescription = firstText([
      "#JobDescriptionContainer",
      '[data-test="jobDescription"]',
      '[data-test*="description" i]',
      '[data-test-id*="description" i]',
      '[class*="jobDescription" i]',
      '[class*="description" i]',
    ])

    const metaBits = [
      attr('meta[property="og:title"]', "content"),
      attr('meta[property="og:description"]', "content"),
      attr('meta[name="description"]', "content"),
    ].filter(Boolean)

    const description =
      linkedinDescription ||
      glassdoorDescription ||
      attr('meta[property="og:description"]', "content") ||
      attr('meta[name="description"]', "content") ||
      ""

    return {
      pageTitle: document.title || "",
      pageText: relevantPageText(description),
      pageHints: {
        title:
          linkedinTitle ||
          glassdoorTitle ||
          text("h1") ||
          attr('meta[property="og:title"]', "content") ||
          "",
        company:
          linkedinCompany ||
          glassdoorCompany ||
          attr('meta[property="og:site_name"]', "content") ||
          "",
        location: linkedinLocation || glassdoorLocation || "",
        description,
        salaryText: findSalaryText(),
        metadata: [
          ...metaBits,
          ...collectJsonLd(),
        ],
      },
    }
  }
})()
