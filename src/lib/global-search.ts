export type GlobalSearchItemType = "navigation" | "application" | "cv" | "action"

export interface GlobalSearchItem {
  id: string
  type: GlobalSearchItemType
  label: string
  description: string
  href: string
  keywords?: string[]
}

export const GLOBAL_SEARCH_RECENTS_LIMIT = 5

export function globalSearchRecentsKey(userId: string) {
  return `jobclock:global-search:recent:${userId}`
}

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function fuzzyTokenScore(token: string, candidate: string): number | null {
  if (candidate === token) return 1_000
  if (candidate.startsWith(token)) return 800 - Math.min(candidate.length - token.length, 100)

  const includedAt = candidate.indexOf(token)
  if (includedAt >= 0) return 600 - Math.min(includedAt * 2, 100)

  let candidateIndex = 0
  let previousMatch = -1
  let score = 0
  for (const character of token) {
    const matchIndex = candidate.indexOf(character, candidateIndex)
    if (matchIndex < 0) return null

    const gap = previousMatch < 0 ? matchIndex : matchIndex - previousMatch - 1
    const atWordStart = matchIndex === 0 || /[\s/&-]/.test(candidate[matchIndex - 1])
    score += 30 + (gap === 0 ? 20 : 0) + (atWordStart ? 15 : 0) - Math.min(gap, 15)
    previousMatch = matchIndex
    candidateIndex = matchIndex + 1
  }

  return score
}

export function scoreGlobalSearchItem(query: string, item: GlobalSearchItem): number | null {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0

  const fields = [item.label, item.description, ...(item.keywords ?? [])].map(normalize)
  let total = 0
  for (const token of tokens) {
    const tokenScore = fields.reduce<number | null>((best, field) => {
      const score = fuzzyTokenScore(token, field)
      return score !== null && (best === null || score > best) ? score : best
    }, null)
    if (tokenScore === null) return null
    total += tokenScore
  }

  return total
}

export function rankGlobalSearchItems(
  query: string,
  items: GlobalSearchItem[],
  limit = 15,
): GlobalSearchItem[] {
  return items
    .map((item, index) => ({ item, index, score: scoreGlobalSearchItem(query, item) }))
    .filter((entry): entry is typeof entry & { score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item)
}

export function parseRecentGlobalSearches(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter((entry): entry is string => typeof entry === "string" && Boolean(entry.trim()))
      .map((entry) => entry.trim())
      .slice(0, GLOBAL_SEARCH_RECENTS_LIMIT)
  } catch {
    return []
  }
}

export function addRecentGlobalSearch(recent: string[], query: string): string[] {
  const trimmed = query.trim()
  if (!trimmed) return recent

  return [
    trimmed,
    ...recent.filter((entry) => normalize(entry) !== normalize(trimmed)),
  ].slice(0, GLOBAL_SEARCH_RECENTS_LIMIT)
}
