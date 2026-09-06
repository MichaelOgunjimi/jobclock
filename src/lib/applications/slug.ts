import { randomBytes } from "node:crypto"

const MAX_SLUG_BASE_LENGTH = 72

export function slugifyApplicationTitle(title: string): string {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_BASE_LENGTH)
    .replace(/-+$/g, "")

  return slug || "application"
}

export function createApplicationSlug(
  title: string,
  suffix = randomBytes(8).toString("base64url").toLowerCase(),
): string {
  return `${slugifyApplicationTitle(title)}-${suffix}`
}
