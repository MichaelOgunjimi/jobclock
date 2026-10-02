import { isIP } from "net"
import { lookup } from "dns/promises"
import type { JobImportHints } from "./import-job"

const MAX_REDIRECTS = 4
const MAX_HTML_BYTES = 1_000_000

function isPrivateIpv4(address: string): boolean {
  const octets = address.split(".").map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part))) return true
  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  )
}

export function isPrivateNetworkAddress(address: string): boolean {
  if (isIP(address) === 4) return isPrivateIpv4(address)
  if (isIP(address) !== 6) return true

  const normalized = address.toLowerCase()
  if (normalized === "::" || normalized === "::1") return true
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true
  if (/^fe[89ab]/.test(normalized)) return true

  const mapped = normalized.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped ? isPrivateIpv4(mapped[1]) : false
}

async function assertPublicHttpUrl(url: URL): Promise<void> {
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS job links are supported.")
  }
  if (url.username || url.password || url.port) {
    throw new Error("This job link contains unsupported credentials or a custom port.")
  }
  if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
    throw new Error("Local network links are not supported.")
  }

  const addresses = await lookup(url.hostname, { all: true, verbatim: true })
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
    throw new Error("Local or private network links are not supported.")
  }
}

async function readLimitedText(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get("content-length"))
  if (Number.isFinite(declaredLength) && declaredLength > MAX_HTML_BYTES) {
    throw new Error("This job page is too large to import.")
  }
  if (!response.body) return ""

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytesRead = 0
  let result = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytesRead += value.byteLength
    if (bytesRead > MAX_HTML_BYTES) {
      await reader.cancel()
      throw new Error("This job page is too large to import.")
    }
    result += decoder.decode(value, { stream: true })
  }

  return result + decoder.decode()
}

function decodeHtml(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  }
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (entity, token: string) => {
    if (token.startsWith("#x")) return String.fromCodePoint(Number.parseInt(token.slice(2), 16))
    if (token.startsWith("#")) return String.fromCodePoint(Number.parseInt(token.slice(1), 10))
    return named[token.toLowerCase()] ?? entity
  })
}

function stripHtml(value: string): string {
  return decodeHtml(
    value
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function findMeta(html: string, key: string): string | null {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const patterns = [
    new RegExp(`<meta[^>]+(?:name|property)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${escaped}["'][^>]*>`, "i"),
  ]
  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (match?.[1]) return decodeHtml(match[1]).trim()
  }
  return null
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findJobPosting(item)
      if (found) return found
    }
    return null
  }
  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  const types = Array.isArray(record["@type"]) ? record["@type"] : [record["@type"]]
  if (types.some((type) => type === "JobPosting")) return record
  return findJobPosting(record["@graph"])
}

function parseJobPosting(html: string): Record<string, unknown> | null {
  const scripts = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )
  for (const script of scripts) {
    try {
      const parsed = JSON.parse(decodeHtml(script[1]).trim())
      const posting = findJobPosting(parsed)
      if (posting) return posting
    } catch {
      // Many sites include unrelated malformed JSON-LD. Continue to the next block.
    }
  }
  return null
}

function nestedString(value: unknown, ...path: string[]): string | null {
  let current = value
  for (const key of path) {
    if (!current || typeof current !== "object") return null
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === "string" && current.trim() ? current.trim() : null
}

function jobLocation(posting: Record<string, unknown>): string | null {
  const location = Array.isArray(posting.jobLocation) ? posting.jobLocation[0] : posting.jobLocation
  const parts = [
    nestedString(location, "address", "addressLocality"),
    nestedString(location, "address", "addressRegion"),
    nestedString(location, "address", "addressCountry"),
  ].filter(Boolean)
  return parts.length > 0 ? Array.from(new Set(parts)).join(", ") : null
}

function salaryText(posting: Record<string, unknown>): string | null {
  const currency = nestedString(posting, "baseSalary", "currency")
  const min = nestedString(posting, "baseSalary", "value", "minValue")
  const max = nestedString(posting, "baseSalary", "value", "maxValue")
  const value = nestedString(posting, "baseSalary", "value", "value")
  const amount = min && max ? `${min}-${max}` : min ?? max ?? value
  return currency && amount ? `${currency} ${amount}` : null
}

export function extractJobPage(html: string): {
  pageTitle: string
  pageText: string
  pageHints: JobImportHints
} {
  const posting = parseJobPosting(html)
  const titleTag = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const pageTitle =
    (posting && nestedString(posting, "title")) ??
    findMeta(html, "og:title") ??
    (titleTag ? stripHtml(titleTag) : "Untitled job page")

  const rawDescription =
    (posting && nestedString(posting, "description")) ??
    findMeta(html, "og:description") ??
    findMeta(html, "description")
  const description = rawDescription ? stripHtml(rawDescription) : null
  const company = posting ? nestedString(posting, "hiringOrganization", "name") : null
  const location = posting ? jobLocation(posting) : null
  const salary = posting ? salaryText(posting) : null

  const body = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
  const pageText = stripHtml(body).slice(0, 70_000)

  return {
    pageTitle,
    pageText: pageText || [pageTitle, description].filter(Boolean).join("\n\n"),
    pageHints: {
      title: pageTitle,
      company,
      location,
      description,
      salaryText: salary,
    },
  }
}

/**
 * Fetches a single user-supplied job link. Sends ordinary browser headers (many job
 * sites 403 self-identified bots) and replays Set-Cookie across redirects, which
 * consent/share redirectors need to avoid looping.
 */
export async function fetchJobPage(urlValue: string): Promise<{
  finalUrl: string
  pageTitle: string
  pageText: string
  pageHints: JobImportHints
}> {
  let url = new URL(urlValue)
  const cookies = new Map<string, string>()

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    await assertPublicHttpUrl(url)
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-GB,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
        ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
      },
    })

    for (const setCookie of response.headers.getSetCookie()) {
      const [pair] = setCookie.split(";")
      const eq = pair.indexOf("=")
      if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      if (!location) throw new Error("The job page redirected without a destination.")
      url = new URL(location, url)
      continue
    }
    if (!response.ok) throw new Error(`The job page returned HTTP ${response.status}.`)

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new Error("That link does not point to a readable job page.")
    }

    if (/(^|\.)google\.[a-z.]+$/i.test(url.hostname)) {
      throw new Error("That Google link does not resolve to a job page.")
    }

    return { finalUrl: url.toString(), ...extractJobPage(await readLimitedText(response)) }
  }

  throw new Error("The job page redirected too many times.")
}

