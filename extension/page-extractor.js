;(function () {
  // On LinkedIn's collections / search list views (e.g.
  // `/jobs/collections/recommended/?currentJobId=…`), the page has both a
  // recommendations sidebar AND a right-side pane showing the selected job.
  // `document.querySelector` happily matches sidebar items first, which
  // mashes other jobs' titles into the description and bloats `pageText`
  // with the entire feed. Find the selected-job pane and run all extraction
  // scoped to it; fall back to `document` so canonical job pages and
  // non-LinkedIn sites are unchanged.
  function findSelectedJobScope() {
    const candidates = [
      ".jobs-search-two-pane__details-wrapper", // current LinkedIn two-pane (collections, search)
      ".jobs-search__job-details",
      ".jobs-search__job-details--wrapper",
      ".jobs-search__job-details--container",
      ".jobs-details",
      ".jobs-details__main-content",
      ".job-view-layout",
      ".jobs-view-layout",
      ".scaffold-layout__detail",
      "[data-job-id]", // wrapper around the selected job on some LinkedIn views
    ]
    for (const selector of candidates) {
      const node = document.querySelector(selector)
      if (node instanceof HTMLElement) {
        if (typeof console !== "undefined" && console.info) {
          console.info("[jobclock] scope matched:", selector)
        }
        return node
      }
    }
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        "[jobclock] no scope candidate matched — falling back to document. " +
          "pageText will be limited to the description hint to avoid sending " +
          "the whole page to the AI.",
      )
    }
    return document
  }

  const scope = findSelectedJobScope()
  const scopeIsDocument = !(scope instanceof HTMLElement)

  // Things we never want to read from, even when scope = document on
  // a flat list view where the pane finder didn't match.
  const EXCLUDED_CONTAINER_SELECTORS = [
    ".jobs-search-results-list",
    ".scaffold-layout__list",
    ".jobs-search-results__list",
    ".jobs-recommended-jobs",
    "nav",
    "header",
    "footer",
  ]

  function isInsideExcluded(node) {
    if (!(node instanceof HTMLElement)) return false
    for (const selector of EXCLUDED_CONTAINER_SELECTORS) {
      if (node.closest(selector)) return true
    }
    return false
  }

  function text(selector) {
    const nodes = scope.querySelectorAll(selector)
    for (const node of nodes) {
      if (node instanceof HTMLElement && !isInsideExcluded(node)) {
        return (node.innerText || node.textContent || "").trim()
      }
    }
    return ""
  }

  function attr(selector, name) {
    // Meta tags etc. live in <head>, so attribute lookups stay document-wide.
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

  function scopeInnerText() {
    if (scope instanceof HTMLElement) return scope.innerText || scope.textContent || ""
    return document.body?.innerText || document.body?.textContent || ""
  }

  function textNearHeading(headingPattern) {
    const root = scope instanceof HTMLElement ? scope : document
    const headings = Array.from(root.querySelectorAll("h1,h2,h3,h4,dt,strong,b,span,div"))
    const heading = headings.find(
      (node) =>
        !isInsideExcluded(node) && headingPattern.test(node.textContent || ""),
    )
    if (!(heading instanceof HTMLElement)) return ""

    const candidates = [
      heading.nextElementSibling,
      heading.parentElement,
      heading.parentElement?.nextElementSibling,
      heading.closest("section,li,div"),
    ]

    for (const candidate of candidates) {
      if (candidate instanceof HTMLElement && !isInsideExcluded(candidate)) {
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

    const bodyMatch = scopeInnerText().match(
      /(?:£|\$|€|gbp|usd|eur)\s*\d[\d,.]*(?:\s*[kK])?(?:\s*(?:-|–|—|to)\s*(?:£|\$|€|gbp|usd|eur)?\s*\d[\d,.]*(?:\s*[kK])?)?(?:\s*\([^)]*\))?/i
    )

    return bodyMatch?.[0] || ""
  }

  // Safety net for when LinkedIn renames the description block again:
  // pick the single largest text block inside scope whose length falls
  // in the description-shaped window. Excludes anything sitting inside
  // sidebar/nav containers via the same filter the rest of the file uses.
  function largestTextBlockIn(root, minChars, maxChars) {
    if (!(root instanceof HTMLElement)) return ""
    let best = ""
    let bestLen = 0
    for (const el of root.querySelectorAll("div, article, section")) {
      if (!(el instanceof HTMLElement)) continue
      if (isInsideExcluded(el)) continue
      const t = (el.innerText || el.textContent || "").trim()
      if (t.length > bestLen && t.length >= minChars && t.length <= maxChars) {
        bestLen = t.length
        best = t
      }
    }
    return best
  }

  function relevantPageText(description) {
    // When scope is the whole document (we couldn't pin down a job pane),
    // the [class*="job" i] / [class*="description" i] sweep matches
    // hundreds of nodes across LinkedIn's feed and dumps the entire
    // recommendation list into pageText. Refuse to do that — just return
    // the description hint so the AI receives a small, on-topic prompt.
    if (scopeIsDocument) {
      return (description || "").slice(0, 50000)
    }

    const root = scope
    const containers = Array.from(
      root.querySelectorAll(
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
    ).filter((node) => !isInsideExcluded(node))

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

    return scopeInnerText().slice(0, 50000)
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
        // Current LinkedIn logged-in DOM (verified live via Playwright on
        // /jobs/collections/recommended/?currentJobId=…): the description
        // block was renamed away from `.jobs-description__content`.
        ".job-details-about-the-job-module__description",
        ".job-details-module",
        ".jobs-description__content",
        ".jobs-box__html-content",
        // Public guest view (works without login on /jobs/view/<id>/).
        ".show-more-less-html__markup",
        ".description__text",
      ]) || largestTextBlockIn(scope, 800, 20000)

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

    const pageText = relevantPageText(description)

    if (typeof console !== "undefined" && console.info) {
      console.info("[jobclock] extraction summary:", {
        url: location.href,
        scopeIsDocument,
        descriptionChars: description.length,
        pageTextChars: pageText.length,
        linkedinTitle: linkedinTitle.slice(0, 80),
        linkedinCompany: linkedinCompany.slice(0, 80),
      })
    }

    return {
      pageTitle: document.title || "",
      pageText,
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
