import { createHash, timingSafeEqual } from "crypto"

// RFC 7636: the verifier is 43-128 unreserved characters; an S256 challenge is the unpadded base64url of a SHA-256 digest (43 chars).
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/
const CHALLENGE = /^[A-Za-z0-9\-_]{43}$/

export const isValidCodeChallenge = (value: string) => CHALLENGE.test(value)

export function s256Challenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url")
}

/** Only S256 exists: there is no `plain` fallback, so a challenge is never equal to a verifier. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!VERIFIER.test(verifier) || !CHALLENGE.test(challenge)) return false
  return timingSafeEqual(Buffer.from(s256Challenge(verifier)), Buffer.from(challenge))
}
