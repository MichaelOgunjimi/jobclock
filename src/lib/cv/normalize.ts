const REPLACEMENTS: Array<[RegExp, string]> = [
  // Smart quotes → ASCII
  [/[‘’‚‛]/g, "'"],
  [/[“”„‟]/g, '"'],
  // Dashes — em dash, en dash, horizontal bar → hyphen
  [/[–—―]/g, "-"],
  // Ellipsis → three dots
  [/…/g, "..."],
  // Non-breaking space → regular space
  [/ /g, " "],
  // Bullet variants → ASCII hyphen
  [/[•‣⁃∙◦⁌⁍]/g, "-"],
  // Ligatures
  [/ﬁ/g, "fi"],
  [/ﬂ/g, "fl"],
  // Zero-width spaces and BOM
  [/[​‌‍﻿]/g, ""],
]

export function normalizeForAts(text: string): string {
  let result = text
  for (const [pattern, replacement] of REPLACEMENTS) {
    result = result.replace(pattern, replacement)
  }
  return result
}

export function normalizeObjectStrings<T>(obj: T): T {
  if (typeof obj === "string") return normalizeForAts(obj) as unknown as T
  if (Array.isArray(obj)) return obj.map((item) => normalizeObjectStrings(item)) as unknown as T
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, normalizeObjectStrings(v)])
    ) as T
  }
  return obj
}
