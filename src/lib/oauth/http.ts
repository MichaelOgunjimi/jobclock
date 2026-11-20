/**
 * These endpoints carry no cookies (clients authenticate with PKCE, not a session), so any origin may call them:
 * browser-based MCP clients need CORS for discovery, registration and the token exchange.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, MCP-Protocol-Version",
}

export function oauthJson(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const cacheable = headers["Cache-Control"] !== undefined
  return Response.json(body, { status, headers: { ...CORS, ...(cacheable ? {} : { "Cache-Control": "no-store", Pragma: "no-cache" }), ...headers } })
}

export function oauthError(status: number, error: string, description: string, headers: Record<string, string> = {}) {
  return oauthJson({ error, error_description: description }, status, headers)
}

export const preflight = () => new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Max-Age": "86400" } })

export const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"

/** Reads a small body as text; null when it is larger than `maxBytes`. The cap applies to the bytes actually read, not to a Content-Length claim. */
export async function readLimitedText(request: Request, maxBytes: number): Promise<string | null> {
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return null
  const text = await request.text()
  return Buffer.byteLength(text) > maxBytes ? null : text
}
