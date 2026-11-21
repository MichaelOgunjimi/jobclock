"use server"

import { redirect } from "next/navigation"
import { sendAgentAccessNotice } from "@/lib/email/agent-access"
import { buildClientRedirect, CONSENT_SCOPE_FIELDS, grantedScopes, issueAuthorizationCode, parseAuthorizeRequest, parseConnectionDuration } from "@/lib/oauth/authorize"
import { SCOPE_WRITE } from "@/lib/oauth/config"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"

/**
 * The consent decision. Server Actions already reject cross-origin posts (Origin must match Host), and the session
 * cookie is the user's own. Everything in the form is re-validated from scratch: the hidden fields are untrusted, and
 * the only place this ever redirects is a redirect_uri the client registered.
 */
export async function decideConsent(formData: FormData) {
  const parsed = await parseAuthorizeRequest((name) => {
    const value = formData.get(name)
    return typeof value === "string" ? value : null
  })
  if (!parsed.ok) {
    if ("fatal" in parsed) redirect("/oauth/authorize")
    redirect(buildClientRedirect(parsed.redirectUri, { error: parsed.error, description: parsed.description, state: parsed.state }))
  }
  const { request } = parsed

  if (formData.get("decision") !== "allow") {
    redirect(buildClientRedirect(request.redirectUri, { error: "access_denied", description: "The user denied the request.", state: request.state }))
  }

  // Validated before anything is issued: the form value sets how long the app keeps access.
  const duration = parseConnectionDuration(formData.get("duration"))
  if (!duration.ok) {
    redirect(buildClientRedirect(request.redirectUri, { error: "invalid_request", description: "Invalid connection period.", state: request.state }))
  }

  if (!isSupabaseConfigured()) redirect("/auth")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  // Only a box that is on and was offered counts; `write` is the applications:write box, the others are named by their scope.
  const ticked = CONSENT_SCOPE_FIELDS.filter((scope) => formData.get(scope === SCOPE_WRITE ? "write" : scope) === "on")
  const scopes = grantedScopes(request, ticked)
  const code = await issueAuthorizationCode(user.id, request, ticked, duration.expiresAt)
  // The grant itself is created when the app exchanges the code a moment later; this is the owner's own approval, which is what they should hear about.
  await sendAgentAccessNotice(user.email, {
    kind: "app",
    name: request.clientName,
    scopes,
    expiresAt: duration.expiresAt?.toISOString() ?? null,
  })
  redirect(buildClientRedirect(request.redirectUri, { code, state: request.state }))
}
