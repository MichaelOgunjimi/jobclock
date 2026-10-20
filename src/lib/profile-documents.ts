import { z } from "zod/v4"

export const PROFILE_DOCUMENT_TYPES = [
  "certificate",
  "transcript",
  "degree",
  "training_record",
  "other",
] as const

export type ProfileDocumentType = (typeof PROFILE_DOCUMENT_TYPES)[number]

export const PROFILE_DOCUMENT_TYPE_LABELS: Record<ProfileDocumentType, string> = {
  certificate: "Certificate",
  transcript: "Academic transcript",
  degree: "Degree or diploma",
  training_record: "Training record",
  other: "Other qualification document",
}

export const PROFILE_DOCUMENT_ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

export const PROFILE_DOCUMENT_MAX_BYTES = 15 * 1024 * 1024

export const profileDocumentTypeSchema = z.enum(PROFILE_DOCUMENT_TYPES)

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) => {
      const parsed = new Date(`${value}T00:00:00.000Z`)
      return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
    },
    "Date must be a real calendar date",
  )

export const profileDocumentFactSchema = z.object({
  category: z.enum([
    "education",
    "certification",
    "skill",
    "achievement",
    "language",
    "activity",
    "experience",
    "project",
  ]),
  label: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(1).max(2_000),
})

const optionalDate = z
  .union([isoDateSchema, z.null()])
  .nullable()
  .optional()
  .transform((value) => value || null)

const optionalText = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((value) => value || null)

export const extractedProfileDocumentSchema = z.object({
  name: z.string().trim().min(1).max(200),
  issuer: optionalText,
  issuedAt: optionalDate,
  expiresAt: optionalDate,
  credentialId: optionalText,
  credentialUrl: z
    .string()
    .trim()
    .url()
    .refine((value) => /^https?:\/\//i.test(value))
    .nullable()
    .optional()
    .catch(null)
    .transform((value) => value || null),
  facts: z.array(profileDocumentFactSchema).min(1).max(50),
})

export type ExtractedProfileDocument = z.infer<typeof extractedProfileDocumentSchema>
export type ProfileDocumentFact = z.infer<typeof profileDocumentFactSchema>

export function matchesProfileDocumentSignature(
  bytes: Uint8Array,
  mimeType: string,
): boolean {
  const startsWith = (...signature: number[]) =>
    signature.every((value, index) => bytes[index] === value)

  if (mimeType === "application/pdf") return startsWith(0x25, 0x50, 0x44, 0x46, 0x2d)
  if (mimeType === "image/jpeg") return startsWith(0xff, 0xd8, 0xff)
  if (mimeType === "image/png") return startsWith(0x89, 0x50, 0x4e, 0x47)
  if (mimeType === "image/webp") {
    return (
      startsWith(0x52, 0x49, 0x46, 0x46) &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    )
  }
  if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return startsWith(0x50, 0x4b, 0x03, 0x04)
  }
  return false
}
