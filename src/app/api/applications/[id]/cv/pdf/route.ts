import { isCvTemplateName } from "@/components/cv/templates/cv-template-renderer"
import { createPdfRoute } from "../../create-pdf-route"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const GET = createPdfRoute({
  templateValidator: isCvTemplateName,
  printPath: "cv/print",
  dataAttribute: "data-cv-paper",
  filenamePrefix: "tailored-cv",
  defaultTemplate: "modern",
  errorLabel: "CV",
})
