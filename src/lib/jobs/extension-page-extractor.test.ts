import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

function loadCollector() {
  const source = readFileSync(resolve(process.cwd(), "extension/page-extractor.js"), "utf8")
  const script = new Function(`${source}; return globalThis.collectJobAssistantPageData;`)
  const collector = script()

  if (typeof collector !== "function") {
    throw new Error("collectJobAssistantPageData was not registered")
  }

  return collector as () => {
    pageTitle: string
    pageText: string
    pageHints: {
      title: string
      company: string
      location: string
      description: string
      salaryText: string
      metadata: string[]
    }
  }
}

describe("extension page extractor", () => {
  it("extracts Glassdoor job details from visible page sections", async () => {
    document.title = "Junior Application Software Engineer - One Big Circle | Glassdoor"
    document.body.innerHTML = `
      <main>
        <h1 data-test="job-title">Junior Application Software Engineer</h1>
        <div data-test="employer-name">One Big Circle</div>
        <div data-test="location">Bristol, England</div>
        <section>
          <h2>Salary</h2>
          <div>£30K - £40K (Employer Est.)</div>
        </section>
        <article id="JobDescriptionContainer">
          <p>We are looking for a junior application software engineer to build web applications. You will work closely with our experienced engineers to design, develop, test and ship features end-to-end. We use TypeScript, React and Postgres. Comfortable working in a small team, learning quickly, and shipping value to customers every week.</p>
        </article>
      </main>
    `

    const result = await loadCollector()()
    expect(result.pageHints).toEqual(
      expect.objectContaining({
        title: "Junior Application Software Engineer",
        company: "One Big Circle",
        location: "Bristol, England",
        salaryText: "£30K - £40K (Employer Est.)",
        description: expect.stringContaining("junior application software engineer"),
      })
    )
  })

  it("builds a compact generic snapshot for company job pages", async () => {
    document.title = "Senior Platform Engineer | Acme Careers"
    document.head.innerHTML = `<meta property="og:site_name" content="Acme">`
    document.body.innerHTML = `
      <header>
        <nav>${Array.from({ length: 50 }, (_, index) => `<a>Navigation item ${index}</a>`).join("")}</nav>
      </header>
      <main>
        <article class="career-posting">
          <h1>Senior Platform Engineer</h1>
          <p>London, United Kingdom</p>
          <section>
            <h2>About the role</h2>
            <p>We are hiring a senior platform engineer to build reliable developer infrastructure for our product teams. You will own deployment pipelines, improve observability, reduce build times, and work closely with engineers across the company.</p>
          </section>
          <section>
            <h2>What you will do</h2>
            <ul>
              <li>Design and operate production services with TypeScript, Postgres, and cloud infrastructure.</li>
              <li>Improve CI performance and make local development fast and predictable.</li>
              <li>Partner with product engineers to remove operational bottlenecks.</li>
            </ul>
          </section>
        </article>
        <aside class="related-jobs">
          ${Array.from({ length: 250 }, (_, index) => `<article><h2>Marketing Manager ${index}</h2><p>Unrelated recommended role for another team.</p></article>`).join("")}
        </aside>
        <form>
          ${Array.from({ length: 100 }, (_, index) => `<label>Application question ${index}<input value=""/></label>`).join("")}
        </form>
      </main>
    `

    const result = await loadCollector()()

    expect(result.pageHints).toEqual(
      expect.objectContaining({
        title: "Senior Platform Engineer",
        company: "Acme",
        description: expect.stringContaining("senior platform engineer"),
      })
    )
    expect(result.pageText).toContain("build reliable developer infrastructure")
    expect(result.pageText).toContain("Improve CI performance")
    expect(result.pageText).not.toContain("Marketing Manager 249")
    expect(result.pageText).not.toContain("Application question 99")
    expect(result.pageText.length).toBeLessThan(12_000)
  })
})
