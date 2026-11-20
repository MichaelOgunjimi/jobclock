import { authorizationServerMetadata } from "@/lib/oauth/config"
import { oauthJson, preflight } from "@/lib/oauth/http"

export const dynamic = "force-dynamic"

/** RFC 8414. The issuer has no path, so the metadata lives at the well-known root. */
export const GET = () => oauthJson(authorizationServerMetadata(), 200, { "Cache-Control": "public, max-age=300" })
export const OPTIONS = preflight
