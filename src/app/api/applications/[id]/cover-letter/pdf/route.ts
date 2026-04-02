import { isCoverLetterTemplateName } from "@/components/cover-letter/templates/cover-letter-template-renderer"
import { createPdfRoute } from "../../create-pdf-route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = createPdfRoute({
  templateValidator: isCoverLetterTemplateName,
  printPath: "cover-letter/print",
  dataAttribute: "data-cover-letter-paper",
  filenamePrefix: "cover-letter",
  defaultTemplate: "modern",
  errorLabel: "cover letter",
})
