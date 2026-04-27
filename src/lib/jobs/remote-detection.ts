const REMOTE_PATTERNS = /\b(remote|fully remote|100%\s*remote|work from home|wfh)\b/i
const HYBRID_PATTERNS = /\bhybrid\b/i
const ONSITE_PATTERNS = /\b(on[-\s]?site|in[-\s]?office|office[-\s]?based)\b/i

export type RemoteType = "remote" | "hybrid" | "on-site"

export function detectRemoteType(
  title: string,
  location: string | null | undefined,
  description: string | null | undefined
): { isRemote: boolean; remoteType: RemoteType | null } {
  const corpus = [title, location ?? "", (description ?? "").slice(0, 500)].join(" ")

  if (REMOTE_PATTERNS.test(corpus)) return { isRemote: true, remoteType: "remote" }
  if (HYBRID_PATTERNS.test(corpus)) return { isRemote: false, remoteType: "hybrid" }
  if (ONSITE_PATTERNS.test(corpus)) return { isRemote: false, remoteType: "on-site" }

  return { isRemote: false, remoteType: null }
}
