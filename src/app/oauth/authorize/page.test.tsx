import { render, screen } from "@testing-library/react"
import { sql } from "drizzle-orm"
import { randomBytes } from "crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { currentUser } = vi.hoisted(() => ({ currentUser: { id: null as string | null } }))

vi.mock("@/lib/db", async () => ({ db: await (await import("@/lib/oauth/test-db")).createOAuthTestDb() }))
vi.mock("@/lib/supabase/config", () => ({ isSupabaseConfigured: () => true }))
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: currentUser.id ? { id: currentUser.id, email: "private@example.com" } : null } }) } }) }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { redirectUrl: url })
  },
}))

import { db } from "@/lib/db"
import { registerClient } from "@/lib/oauth/clients"
import { s256Challenge } from "@/lib/oauth/pkce"
import AuthorizePage from "./page"

const USER = "11111111-1111-4111-8111-111111111111"
const REDIRECT = "https://claude.ai/api/mcp/auth_callback"

async function params(overrides: Record<string, string> = {}, redirectUris = [REDIRECT]) {
  const result = await registerClient({ client_name: "Claude <b>x</b>", redirect_uris: redirectUris })
  if ("error" in result) throw new Error(result.description)
  return {
    client_id: result.client.client_id,
    redirect_uri: REDIRECT,
    response_type: "code",
    code_challenge: s256Challenge(randomBytes(32).toString("base64url")),
    code_challenge_method: "S256",
    state: "s1",
    resource: "https://jobclock.dev/api/mcp",
    ...overrides,
  }
}

const redirectTarget = (promise: Promise<unknown>) => promise.then(() => null, (error) => (error as { redirectUrl: string }).redirectUrl)

beforeEach(async () => {
  currentUser.id = null
  await db.execute(sql`TRUNCATE oauth_clients, oauth_grants, oauth_authorization_codes, oauth_tokens, profiles CASCADE`)
  await db.execute(sql`INSERT INTO profiles (id) VALUES (${USER})`)
})

describe("consent page", () => {
  it("sends a signed-out visitor to /auth and back to the same authorization request", async () => {
    const query = await params()
    const target = await redirectTarget(AuthorizePage({ searchParams: Promise.resolve(query) }))
    expect(target).toMatch(/^\/auth\?next=/)
    const next = new URL(decodeURIComponent(target!.split("next=")[1]), "https://jobclock.dev")
    expect(next.pathname).toBe("/oauth/authorize")
    expect(Object.fromEntries(next.searchParams)).toEqual(query)
  })

  it("shows the app, where it returns to, and read access; write is a separate, unticked choice", async () => {
    currentUser.id = USER
    render(await AuthorizePage({ searchParams: Promise.resolve(await params()) }))
    expect(screen.getByText(/Allow Claude <b>x<\/b> to access JobClock/)).toBeInTheDocument()
    expect(screen.getAllByText(/claude\.ai/).length).toBeGreaterThan(0)
    expect(screen.getByText("Read your applications")).toBeInTheDocument()
    const write = screen.getByRole("checkbox", { name: /making changes/i })
    expect(write).not.toBeChecked()
    expect(write).toHaveAttribute("name", "write")
    expect(screen.getByRole("button", { name: "Deny" })).toHaveAttribute("value", "deny")
    expect(screen.getByRole("button", { name: /Allow/ })).toHaveAttribute("value", "allow")
    expect(document.body.innerHTML).not.toContain("private@example.com")
    expect(document.body.querySelector("b")).toBeNull() // the client-chosen name is text, never markup
  })

  it("does not offer write when the client only asked for read", async () => {
    currentUser.id = USER
    render(await AuthorizePage({ searchParams: Promise.resolve(await params({ scope: "applications:read" })) }))
    expect(screen.queryByRole("checkbox")).toBeNull()
  })

  it("says it is a local app for a loopback redirect", async () => {
    currentUser.id = USER
    const loopback = "http://localhost:3118/callback"
    render(await AuthorizePage({ searchParams: Promise.resolve(await params({ redirect_uri: loopback }, [loopback])) }))
    expect(screen.getByText(/running on this device/)).toBeInTheDocument()
  })

  it("shows an error and offers no buttons for an unregistered redirect_uri, even when signed in", async () => {
    currentUser.id = USER
    render(await AuthorizePage({ searchParams: Promise.resolve(await params({ redirect_uri: "https://evil.example/cb" })) }))
    expect(screen.getByText(/did not register/)).toBeInTheDocument()
    expect(screen.queryByRole("button")).toBeNull()
  })

  it("returns protocol errors (no PKCE) to the registered redirect_uri, not to the page", async () => {
    currentUser.id = USER
    const target = await redirectTarget(AuthorizePage({ searchParams: Promise.resolve(await params({ code_challenge: "", code_challenge_method: "" })) }))
    const url = new URL(target!)
    expect(`${url.origin}${url.pathname}`).toBe(REDIRECT)
    expect(url.searchParams.get("error")).toBe("invalid_request")
    expect(url.searchParams.get("state")).toBe("s1")
  })
})
