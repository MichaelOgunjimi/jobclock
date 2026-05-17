import { registerHandler } from "./handlers"
import { coverLetterHandler } from "./handlers/cover-letter"
import { companyResearchHandler } from "./handlers/company-research"
import { interviewPrepHandler } from "./handlers/interview-prep"
import { cvTailorHandler } from "./handlers/cv-tailor"
import { interviewAnswerHandler } from "./handlers/interview-answer"

registerHandler("cover_letter", coverLetterHandler)
registerHandler("company_research", companyResearchHandler)
registerHandler("interview_prep", interviewPrepHandler)
registerHandler("cv_tailor", cvTailorHandler)
registerHandler("interview_answer", interviewAnswerHandler)
