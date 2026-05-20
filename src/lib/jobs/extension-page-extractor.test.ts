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
})
