import { protectedResourceMetadata } from "@/lib/oauth/config"
import { oauthJson, preflight } from "@/lib/oauth/http"

export const dynamic = "force-dynamic"

/** RFC 9728. The path after /.well-known/oauth-protected-resource is the resource's own path (/api/mcp). */
export const GET = () => oauthJson(protectedResourceMetadata(), 200, { "Cache-Control": "public, max-age=300" })
export const OPTIONS = preflight
