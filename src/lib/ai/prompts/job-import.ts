export const JOB_IMPORT_SYSTEM_PROMPT = `You extract structured job posting data from raw web page text.

Return JSON only.
Do not include markdown fences.
Infer fields conservatively and prefer null when a field is not clearly present.
Preserve the fullest job description available from the page.
Normalize salary numbers to plain numeric values without currency symbols or commas.`

export function buildJobImportUserPrompt(input: {
  url: string
  pageTitle: string
  suggestedSource: string
  pageHints?: {
    title?: string | null
    company?: string | null
    location?: string | null
    description?: string | null
    salaryText?: string | null
    metadata?: string[]
  }
  pageText: string
}) {
  return `Extract the job posting into JSON with this shape:
{
  "source": string,
  "title": string,
  "company": string,
  "location": string | null,
  "description": string | null,
  "salaryMin": number | null,
  "salaryMax": number | null,
  "salaryCurrency": string | null,
  "postedAt": string | null,
  "isEasyApply": boolean | null
}

Rules:
- source can be any site or ATS identifier and should not be forced into a closed list
- use the suggested source as a fallback when the page does not make the source clearer
- title and company must be non-empty when recoverable from the page
- postedAt should be an ISO date string when explicit, otherwise null
- isEasyApply should be true only when the page clearly suggests an easy/quick apply flow
- when structured hints are present, prefer them over noisy body text
- if salary is only present as text, infer salaryMin/salaryMax when obvious; otherwise leave them null
- description should be the full job description where possible, not a brief summary
- do not rewrite or compress the description when a full description block is already present in the structured hints

URL: ${input.url}
Page title: ${input.pageTitle}
Suggested source: ${input.suggestedSource}

Structured hints:
${JSON.stringify(
    {
      title: input.pageHints?.title ?? null,
      company: input.pageHints?.company ?? null,
      location: input.pageHints?.location ?? null,
      description: input.pageHints?.description ?? null,
      salaryText: input.pageHints?.salaryText ?? null,
      metadata: input.pageHints?.metadata ?? [],
    },
    null,
    2
  )}

Page text:
${input.pageText}`
}
