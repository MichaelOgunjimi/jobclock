import { registerHandler } from "./handlers"
import { coverLetterHandler } from "./handlers/cover-letter"
import { companyResearchHandler } from "./handlers/company-research"

registerHandler("cover_letter", coverLetterHandler)
registerHandler("company_research", companyResearchHandler)
