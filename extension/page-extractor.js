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
      '[data-automation-id="jobPostingPage"]', // Workday ATS (*.myworkdayjobs.com)
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
          "On LinkedIn this limits pageText to the description hint; on other " +
          "hosts the full page is scanned normally.",
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
    "[aria-modal='true']",
    "[role='banner']",
    "[role='navigation']",
    "[role='contentinfo']",
    "[role='dialog']",
    "[class*='alert' i]",
    "[class*='banner' i]",
    "[class*='breadcrumb' i]",
    "[class*='cookie' i]",
    "[class*='drawer' i]",
    "[class*='modal' i]",
    "[class*='popup' i]",
    "[class*='recommended' i]",
    "[class*='related' i]",
    "[class*='search-results' i]",
    "[class*='similar' i]",
    "[id*='cookie' i]",
    "[id*='modal' i]",
    "[id*='recommended' i]",
    "[id*='related' i]",
    "[id*='search-results' i]",
    "[id*='similar' i]",
    "aside",
    "form",
    "nav",
    "header",
    "footer",
  ]

  const MAX_RELEVANT_PAGE_TEXT_CHARS = 20_000
  const MAX_DESCRIPTION_HINT_CHARS = 20_000
  const MAX_READABLE_BLOCK_CHARS = 4_000

  function isInsideExcluded(node) {
    if (!(node instanceof HTMLElement)) return false
    for (const selector of EXCLUDED_CONTAINER_SELECTORS) {
      if (node.closest(selector)) return true
    }
    return false
  }

  function normalizeText(value) {
    return (value || "")
      .replace(/\u0000/g, " ")
      .replace(/\u00a0/g, " ")
      .replace(/[ \t\r\f\v]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  }

  function rootElement() {
    if (scope instanceof HTMLElement) return scope
    return document.body || document.documentElement
  }

  function readableText(node) {
    if (!(node instanceof HTMLElement)) return ""
    return normalizeText(node.innerText || node.textContent || "")
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
    return readableText(rootElement())
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
      const t = collectReadableText(el, maxChars)
      if (t.length > bestLen && t.length >= minChars && t.length <= maxChars) {
        bestLen = t.length
        best = t
      }
    }
    return best
  }

  function textScore(value) {
    const textValue = normalizeText(value).toLowerCase()
    if (!textValue) return 0

    const keywordMatches = textValue.match(
      /\b(about the role|about this role|responsibilities|requirements|qualifications|what you'?ll do|what you will do|skills|benefits|salary|location|job description|position|role|team)\b/g
    ) || []
    const lengthScore = Math.min(textValue.length, 6000) / 80
    const tooLongPenalty = Math.max(0, textValue.length - 30_000) / 200

    return lengthScore + keywordMatches.length * 18 - tooLongPenalty
  }

  function nodeBonus(node) {
    const tag = node.tagName.toLowerCase()
    const marker = `${node.id || ""} ${node.className || ""} ${node.getAttribute("role") || ""} ${node.getAttribute("itemtype") || ""}`.toLowerCase()

    let bonus = 0
    if (tag === "main") bonus += 35
    if (tag === "article") bonus += 45
    if (node.getAttribute("role") === "main") bonus += 35
    if (/job|career|posting|position|description|vacanc|opening/.test(marker)) bonus += 35
    if (/main|content/.test(marker)) bonus += 15
    return bonus
  }

  function findContentRoots() {
    const root = rootElement()
    if (!(root instanceof HTMLElement)) return []

    const selector = [
      "main",
      "article",
      "[role='main']",
      "[itemtype*='JobPosting' i]",
      "[itemprop='description']",
      "[data-automation-id*='job' i]",
      "[data-testid*='job' i]",
      "[data-test*='job' i]",
      "[data-test-id*='job' i]",
      "[class*='career' i]",
      "[class*='description' i]",
      "[class*='job' i]",
      "[class*='opening' i]",
      "[class*='posting' i]",
      "[class*='position' i]",
      "[id*='career' i]",
      "[id*='description' i]",
      "[id*='job' i]",
      "[id*='opening' i]",
      "[id*='posting' i]",
      "[id*='position' i]",
    ].join(",")

    const candidates = Array.from(root.querySelectorAll(selector))
      .filter((node) => node instanceof HTMLElement && !isInsideExcluded(node))
      .map((node) => {
        const textValue = readableText(node)
        return {
          node,
          textLength: textValue.length,
          score: textScore(textValue) + nodeBonus(node),
        }
      })
      .filter((candidate) => candidate.textLength >= 120)
      .sort((a, b) => b.score - a.score)

    const roots = []
    for (const candidate of candidates) {
      if (roots.some((existing) => existing.contains(candidate.node))) continue
      roots.push(candidate.node)
      if (roots.length >= 3) break
    }

    return roots.length ? roots : [root]
  }

  function collectReadableText(root, maxChars = MAX_RELEVANT_PAGE_TEXT_CHARS) {
    if (!(root instanceof HTMLElement)) return ""

    const blockSelector = [
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "li",
      "dt",
      "dd",
      "[role='listitem']",
      "[itemprop='title']",
      "[itemprop='description']",
    ].join(",")
    const blocks = Array.from(root.querySelectorAll(blockSelector))
    const seen = new Set()
    const parts = []

    for (const block of blocks) {
      if (!(block instanceof HTMLElement)) continue
      if (isInsideExcluded(block)) continue

      const value = readableText(block).slice(0, MAX_READABLE_BLOCK_CHARS)
      if (!value || value.length < 2) continue

      const key = value.toLowerCase()
      if (seen.has(key)) continue
      if (parts.some((part) => part.includes(value) || value.includes(part))) continue

      seen.add(key)
      parts.push(value)
      if (parts.join("\n").length >= maxChars) break
    }

    const text = parts.join("\n").trim()
    if (text.length >= 250 || blocks.length > 0) return text.slice(0, maxChars)

    return readableText(root).slice(0, maxChars)
  }

  function genericDescriptionText() {
    for (const root of findContentRoots()) {
      const textValue = collectReadableText(root, MAX_DESCRIPTION_HINT_CHARS)
      if (textValue.length >= 300) return textValue
    }

    return largestTextBlockIn(rootElement(), 300, MAX_DESCRIPTION_HINT_CHARS)
  }

  function relevantPageText(description) {
    // The sidebar-flood problem only exists on LinkedIn: when scope falls
    // back to document there, the [class*="job" i] sweep matches hundreds
    // of feed items and dumps the entire recommendation list into pageText.
    // On external ATS pages (Workday, Greenhouse, etc.) the whole page IS
    // the job posting, so let the normal container scan run.
    if (scopeIsDocument && /(?:^|\.)linkedin\.com$/i.test(location.hostname)) {
      return (description || "").slice(0, MAX_RELEVANT_PAGE_TEXT_CHARS)
    }

    const parts = []
    if (description) parts.unshift(description)

    for (const contentRoot of findContentRoots()) {
      const value = collectReadableText(contentRoot, MAX_RELEVANT_PAGE_TEXT_CHARS)
      if (value && !parts.some((part) => part.includes(value) || value.includes(part))) {
        parts.push(value)
      }
      if (parts.join("\n\n").length >= MAX_RELEVANT_PAGE_TEXT_CHARS) break
    }

    const text = parts.join("\n\n").trim()
    if (text) return text.slice(0, MAX_RELEVANT_PAGE_TEXT_CHARS)

    return collectReadableText(rootElement(), MAX_RELEVANT_PAGE_TEXT_CHARS)
  }

  // LinkedIn lazy-renders the description block ~200-1500ms after a job
  // is clicked in the right pane. If the user hits the extension button
  // before that finishes, every description selector returns "" and the
  // server falls back to the noisy pageText path. Poll for ANY known
  // description selector to have meaningful content before extracting.
  const DESCRIPTION_POLL_TIMEOUT_MS = 6000
  const DESCRIPTION_POLL_INTERVAL_MS = 100
  // Wait threshold is intentionally lower than the server's hint-trust
  // threshold (400 chars) — the wait only asks "has LinkedIn rendered
  // SOMETHING into the description block yet?". A 400-char stub still
  // indicates the block is populated and not mid-load. We previously
  // tripped at 200 chars which sometimes caught a half-rendered title
  // block — bump to 400 so partial extractions get one more poll cycle.
  const DESCRIPTION_READY_MIN_CHARS = 400

  const DESCRIPTION_SELECTORS = [
    ".job-details-about-the-job-module__description",
    ".job-details-module",
    ".jobs-description__content",
    ".jobs-box__html-content",
    ".show-more-less-html__markup",
    ".description__text",
  ]

  function descriptionReadyText() {
    for (const sel of DESCRIPTION_SELECTORS) {
      const n = scope.querySelector ? scope.querySelector(sel) : document.querySelector(sel)
      if (n instanceof HTMLElement) {
        const t = (n.innerText || n.textContent || "").trim()
        if (t.length >= DESCRIPTION_READY_MIN_CHARS) return t
      }
    }
    return ""
  }

  function waitForDescription() {
    // The lazy-load problem is LinkedIn-specific. Glassdoor, Indeed and
    // company ATS pages all server-render the description, so polling
    // wastes 2.5s for nothing — short-circuit on non-LinkedIn hosts.
    if (!/(^|\.)linkedin\.com$/i.test(location.hostname)) {
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      const start = Date.now()
      const first = descriptionReadyText()
      if (first) {
        if (typeof console !== "undefined" && console.info) {
          console.info("[jobclock] description ready immediately")
        }
        return resolve()
      }
      const tick = () => {
        if (descriptionReadyText()) {
          if (typeof console !== "undefined" && console.info) {
            console.info(`[jobclock] description ready after ${Date.now() - start}ms`)
          }
          return resolve()
        }
        if (Date.now() - start >= DESCRIPTION_POLL_TIMEOUT_MS) {
          if (typeof console !== "undefined" && console.warn) {
            console.warn(
              `[jobclock] description did not reach ${DESCRIPTION_READY_MIN_CHARS} chars within ${DESCRIPTION_POLL_TIMEOUT_MS}ms — extracting whatever's present`,
            )
          }
          return resolve()
        }
        setTimeout(tick, DESCRIPTION_POLL_INTERVAL_MS)
      }
      setTimeout(tick, DESCRIPTION_POLL_INTERVAL_MS)
    })
  }

  globalThis.collectJobAssistantPageData = async function collectJobAssistantPageData() {
    await waitForDescription()
    return collectJobAssistantPageDataSync()
  }

  function collectJobAssistantPageDataSync() {
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

    const workdayTitle = firstText([
      '[data-automation-id="jobPostingHeader"]',
    ])

    const workdayDescription = firstText([
      '[data-automation-id="jobPostingDescription"]',
    ])

    const workdayLocation = (() => {
      const raw = text('[data-automation-id="locations"]')
      // Strip the "locations" label Workday prepends to the location values
      return raw.replace(/^locations?\s*/i, "").trim()
    })()

    const genericLocation =
      firstText([
        '[itemprop="jobLocation"]',
        '[itemprop="addressLocality"]',
        '[data-test*="location" i]',
        '[data-testid*="location" i]',
        '[data-test-id*="location" i]',
        '[class*="location" i]',
        '[id*="location" i]',
      ]) || textNearHeading(/\blocation\b/i)

    const metaBits = [
      attr('meta[property="og:title"]', "content"),
      attr('meta[property="og:description"]', "content"),
      attr('meta[name="description"]', "content"),
    ].filter(Boolean)

    const description = normalizeText(
      linkedinDescription ||
        glassdoorDescription ||
        workdayDescription ||
        genericDescriptionText() ||
        attr('meta[property="og:description"]', "content") ||
        attr('meta[name="description"]', "content") ||
        ""
    ).slice(0, MAX_DESCRIPTION_HINT_CHARS)

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
          workdayTitle ||
          text("h1") ||
          attr('meta[property="og:title"]', "content") ||
          "",
        company:
          linkedinCompany ||
          glassdoorCompany ||
          attr('meta[property="og:site_name"]', "content") ||
          "",
        location: linkedinLocation || glassdoorLocation || workdayLocation || genericLocation || "",
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
