import { render, screen, within } from "@testing-library/react"
import { sql } from "drizzle-orm"
import { randomBytes } from "crypto"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { currentUser, sendNotice } = vi.hoisted(() => ({ currentUser: { id: null as string | null }, sendNotice: vi.fn() }))
vi.mock("@/lib/email/agent-access", () => ({ sendAgentAccessNotice: sendNotice }))

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
import { exchangeAuthorizationCode } from "@/lib/oauth/tokens"
import { oauthAuthorizationCodes, oauthGrants } from "@/lib/db/schema"
import { decideConsent } from "./actions"
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
  sendNotice.mockReset()
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

describe("Keep me connected for", () => {
  it("offers 30 days, 90 days, 1 year and until I revoke it, with 30 days chosen", async () => {
    currentUser.id = USER
    render(await AuthorizePage({ searchParams: Promise.resolve(await params()) }))
    const group = screen.getByRole("group", { name: "Keep me connected for" })
    const options = within(group).getAllByRole("radio")
    expect(options.map((radio) => (radio as HTMLInputElement).value)).toEqual(["30", "90", "365", "forever"])
    expect(options.map((radio) => (radio as HTMLInputElement).checked)).toEqual([true, false, false, false])
    expect(options.every((radio) => radio.getAttribute("name") === "duration")).toBe(true)
    expect(within(group).getByText("Until I revoke it")).toBeInTheDocument()
    expect(document.body.textContent).toContain("also if the app is not used for 30 days")
  })

  it("has no placeholder text anywhere on the page", async () => {
    currentUser.id = USER
    render(await AuthorizePage({ searchParams: Promise.resolve(await params()) }))
    expect(document.body.textContent).not.toMatch(/<(your|host|token)[a-z-]*>|your-jobclock|YOUR_|lorem|TODO/i)
  })
})

describe("consent decision", () => {
  const verifier = randomBytes(32).toString("base64url")

  async function decide(extra: Record<string, string>, { write = false } = {}) {
    currentUser.id = USER
    const query = await params({ code_challenge: s256Challenge(verifier) })
    const form = new FormData()
    for (const [name, value] of Object.entries({ ...query, ...extra })) form.set(name, value)
    form.set("decision", "allow")
    if (write) form.set("write", "on")
    const target = await redirectTarget(decideConsent(form))
    return { query, url: new URL(target!) }
  }

  const exchange = async (query: Record<string, string>, code: string) => {
    const result = await exchangeAuthorizationCode({ code, clientId: query.client_id, redirectUri: query.redirect_uri, codeVerifier: verifier })
    if (!result.ok) throw new Error(result.description)
  }

  it.each([["30", 30], ["90", 90], ["365", 365]])("%s days sets the connection to end that long from now", async (value, days) => {
    const before = Date.now()
    const { query, url } = await decide({ duration: value })
    await exchange(query, url.searchParams.get("code")!)
    const [grant] = await db.select().from(oauthGrants)
    const end = grant.expiresAt!.getTime()
    expect(end).toBeGreaterThanOrEqual(before + days * 86_400_000)
    expect(end).toBeLessThan(Date.now() + days * 86_400_000 + 1000)
  })

  it("until I revoke it leaves the connection without an end date", async () => {
    const { query, url } = await decide({ duration: "forever" })
    await exchange(query, url.searchParams.get("code")!)
    expect((await db.select().from(oauthGrants))[0].expiresAt).toBeNull()
  })

  it("a missing duration (an older page left open) means 30 days", async () => {
    const { query, url } = await decide({})
    await exchange(query, url.searchParams.get("code")!)
    const end = (await db.select().from(oauthGrants))[0].expiresAt!.getTime()
    expect(end).toBeGreaterThan(Date.now() + 29 * 86_400_000)
    expect(end).toBeLessThan(Date.now() + 31 * 86_400_000)
  })

  it.each(["0", "7", "never", "9999", "30; drop table", ""])("rejects the tampered duration %j: no code is issued and the app is told", async (value) => {
    const { url } = await decide({ duration: value })
    expect(url.searchParams.get("error")).toBe("invalid_request")
    expect(url.searchParams.get("code")).toBeNull()
    expect(await db.select().from(oauthAuthorizationCodes)).toHaveLength(0)
    expect(sendNotice).not.toHaveBeenCalled()
  })

  it("emails the owner a notice naming the app, the access and the end, never the code", async () => {
    const { url } = await decide({ duration: "90" }, { write: true })
    expect(sendNotice).toHaveBeenCalledTimes(1)
    const [email, notice] = sendNotice.mock.calls[0]
    expect(email).toBe("private@example.com")
    expect(notice).toMatchObject({ kind: "app", name: "Claude <b>x</b>", scopes: ["applications:read", "applications:write"] })
    expect(notice.expiresAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(JSON.stringify(sendNotice.mock.calls)).not.toContain(url.searchParams.get("code")!)
  })

  it("denying sends no email and issues no code", async () => {
    currentUser.id = USER
    const form = new FormData()
    for (const [name, value] of Object.entries(await params())) form.set(name, value)
    form.set("decision", "deny")
    const target = await redirectTarget(decideConsent(form))
    expect(new URL(target!).searchParams.get("error")).toBe("access_denied")
    expect(sendNotice).not.toHaveBeenCalled()
    expect(await db.select().from(oauthAuthorizationCodes)).toHaveLength(0)
  })
})
