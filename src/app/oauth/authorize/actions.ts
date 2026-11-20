"use server"

import { redirect } from "next/navigation"
import { buildClientRedirect, issueAuthorizationCode, parseAuthorizeRequest } from "@/lib/oauth/authorize"
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

  if (!isSupabaseConfigured()) redirect("/auth")
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth")

  const code = await issueAuthorizationCode(user.id, request, formData.get("write") === "on")
  redirect(buildClientRedirect(request.redirectUri, { code, state: request.state }))
}
