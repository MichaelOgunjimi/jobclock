import { z } from "zod"

/** The owner-visible job details the web app lets you edit (title, company, location, salary). */
export const jobDetailSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("title"), value: z.string().trim().min(1, "Role is required").max(200) }),
  z.object({ field: z.literal("company"), value: z.string().trim().min(1, "Company is required").max(200) }),
  z.object({ field: z.literal("location"), value: z.string().trim().max(200) }),
  z.object({ field: z.literal("salary"), value: z.string().trim().max(120) }),
])

export const JOB_DETAIL_FIELDS = {
  title: "customTitle",
  company: "customCompany",
  location: "customLocation",
  salary: "customSalaryText",
} as const
