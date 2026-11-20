import { eq } from "drizzle-orm"
import { z } from "zod/v4"
import { db } from "@/lib/db"
import { oauthClients } from "@/lib/db/schema"
import { MAX_CLIENT_NAME_LENGTH, MAX_REDIRECT_URI_LENGTH, MAX_REDIRECT_URIS } from "./config"

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"])

export function isLoopbackRedirect(uri: string): boolean {
  try {
    const url = new URL(uri)
    return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)
  } catch {
    return false
  }
}

/** https, or http on a loopback host for native clients. No fragments, no credentials, no other schemes. */
export function isAllowedRedirectUri(uri: string): boolean {
  if (uri.length > MAX_REDIRECT_URI_LENGTH) return false
  let url: URL
  try {
    url = new URL(uri)
  } catch {
    return false
  }
  if (url.hash || uri.includes("#") || url.username || url.password) return false
  return url.protocol === "https:" || isLoopbackRedirect(uri)
}

/** Exact string comparison against the registered list: no prefix, wildcard or port-insensitive matching. */
export function redirectUriMatches(registered: string[], candidate: string): boolean {
  return registered.includes(candidate)
}

const registrationSchema = z.object({
  client_name: z.string().trim().max(MAX_CLIENT_NAME_LENGTH).optional(),
  redirect_uris: z.array(z.string()).min(1).max(MAX_REDIRECT_URIS),
  token_endpoint_auth_method: z.literal("none").optional(),
  grant_types: z.array(z.enum(["authorization_code", "refresh_token"])).optional(),
  response_types: z.array(z.literal("code")).optional(),
})

export type RegistrationResult =
  | { client: { client_id: string; client_name: string; redirect_uris: string[]; created_at: number } }
  | { error: "invalid_client_metadata" | "invalid_redirect_uri"; description: string }

/** RFC 7591 for public clients only. Anything we cannot honour is rejected rather than silently ignored. */
export async function registerClient(metadata: unknown): Promise<RegistrationResult> {
  const parsed = registrationSchema.safeParse(metadata)
  if (!parsed.success) return { error: "invalid_client_metadata", description: "Invalid client metadata." }
  const { redirect_uris: redirectUris, client_name: name } = parsed.data
  if (!redirectUris.every(isAllowedRedirectUri)) {
    return { error: "invalid_redirect_uri", description: "Redirect URIs must be https, or http on localhost, 127.0.0.1 or [::1], with no fragment." }
  }
  const clientName = name || "Unnamed app"
  const [row] = await db
    .insert(oauthClients)
    .values({ clientName, redirectUris: [...new Set(redirectUris)] })
    .returning()
  return { client: { client_id: row.id, client_name: row.clientName, redirect_uris: row.redirectUris, created_at: Math.floor(row.createdAt.getTime() / 1000) } }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function getClient(clientId: string) {
  if (!UUID.test(clientId)) return null
  const [row] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId)).limit(1)
  return row ?? null
}
