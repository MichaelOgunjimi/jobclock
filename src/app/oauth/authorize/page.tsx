import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Briefcase, Eye, MessagesSquare, Pencil, Sparkles, Trash2, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AUTHORIZE_PARAMS, buildClientRedirect, parseAuthorizeRequest } from "@/lib/oauth/authorize"
import { isLoopbackRedirect } from "@/lib/oauth/clients"
import { CONNECTION_DURATION_OPTIONS, DEFAULT_CONNECTION_DURATION, EXTRA_SCOPE_OPTIONS, type ExtraScope } from "@/lib/mcp/access-policy"
import { SCOPE_AI_GENERATE, SCOPE_DELETE, SCOPE_INTERVIEW_READ, SCOPE_PROFILE_READ, SCOPE_PROFILE_WRITE, SCOPE_WRITE } from "@/lib/oauth/config"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { createClient } from "@/lib/supabase/server"
import { decideConsent } from "./actions"

export const metadata: Metadata = {
  title: "Connect an app",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const EXTRA_ICONS: Record<ExtraScope, React.ReactNode> = {
  [SCOPE_PROFILE_READ]: <UserRound className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />,
  [SCOPE_INTERVIEW_READ]: <MessagesSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />,
  [SCOPE_PROFILE_WRITE]: <Pencil className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />,
  [SCOPE_DELETE]: <Trash2 className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />,
  [SCOPE_AI_GENERATE]: <Sparkles className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />,
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-xl">{children}</Card>
    </main>
  )
}

function Problem({ message }: { message: string }) {
  return (
    <Shell>
      <CardHeader className="border-b pb-6">
        <p className="page-kicker">Connect an app</p>
        <CardTitle>This request can&apos;t be completed</CardTitle>
        <CardDescription>{message} Nothing was shared. Close this tab and start again from the app.</CardDescription>
      </CardHeader>
    </Shell>
  )
}

export default async function AuthorizePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams
  const single = (name: string) => (typeof query[name] === "string" ? (query[name] as string) : null)
  const parsed = await parseAuthorizeRequest(single)

  // An unregistered client or redirect_uri is never redirected to: that would be an open redirect.
  if (!parsed.ok && "fatal" in parsed) return <Problem message={parsed.fatal} />
  if (!parsed.ok) redirect(buildClientRedirect(parsed.redirectUri, { error: parsed.error, description: parsed.description, state: parsed.state }))
  const { request } = parsed

  if (!isSupabaseConfigured()) return <Problem message="Sign-in is not configured on this server." />
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    const forward = new URLSearchParams()
    for (const name of AUTHORIZE_PARAMS) {
      const value = single(name)
      if (value !== null) forward.set(name, value)
    }
    redirect(`/auth?next=${encodeURIComponent(`/oauth/authorize?${forward}`)}`)
  }

  const redirectUrl = new URL(request.redirectUri)
  const local = isLoopbackRedirect(request.redirectUri)
  const offersWrite = request.offeredScopes.includes(SCOPE_WRITE)
  const offeredExtras = EXTRA_SCOPE_OPTIONS.filter((option) => option.group === "private" && request.offeredScopes.includes(option.scope))
  const offeredPower = EXTRA_SCOPE_OPTIONS.filter((option) => option.group === "power" && request.offeredScopes.includes(option.scope))

  return (
    <Shell>
      <CardHeader className="border-b pb-6">
        <p className="page-kicker">Connect an app</p>
        <CardTitle className="break-words">Allow {request.clientName} to access JobClock?</CardTitle>
        <CardDescription>
          {local ? "An app running on this device" : <>An app at <strong className="break-all text-foreground">{redirectUrl.host}</strong></>} is asking to connect to your account.
          The name is chosen by the app and is not verified. Only continue if you started this connection yourself.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={decideConsent} className="space-y-6">
          {AUTHORIZE_PARAMS.map((name) => {
            const value = single(name)
            return value === null ? null : <input key={name} type="hidden" name={name} value={value} />
          })}

          <div className="space-y-3">
            <p className="section-label">It will be able to</p>
            <div className="flex gap-3 border p-4">
              <Eye className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Read your applications</p>
                <p className="text-[13px] text-muted-foreground">List and view your applications and see what is due.</p>
              </div>
            </div>
            {offersWrite && (
              <label className="flex cursor-pointer gap-3 border p-4 has-[:checked]:border-foreground">
                <Pencil className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="flex-1 space-y-1">
                  <p className="text-sm font-medium text-foreground">Make changes</p>
                  <p className="text-[13px] text-muted-foreground">
                    Change status, set follow-ups and interview times, and add notes. Off unless you tick it.
                  </p>
                </div>
                <input type="checkbox" name="write" className="mt-0.5 size-5 shrink-0 accent-foreground" aria-label="Allow making changes to my applications" />
              </label>
            )}
            {offeredExtras.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="section-label">Private details (all off unless you tick them)</p>
                {offeredExtras.map((option) => (
                  <label key={option.scope} className="flex cursor-pointer gap-3 border p-4 has-[:checked]:border-foreground">
                    {EXTRA_ICONS[option.scope]}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium text-foreground">{option.label}</p>
                      <p className="text-[13px] text-muted-foreground">{option.description}</p>
                    </div>
                    <input type="checkbox" name={option.scope} className="mt-0.5 size-5 shrink-0 accent-foreground" aria-label={`Allow access to: ${option.label}`} />
                  </label>
                ))}
                <p className="text-[12px] text-muted-foreground">
                  This is the most private data in your account. Only tick what the app needs for what you asked it to do.
                </p>
              </div>
            )}
            {offeredPower.length > 0 && (
              <div className="space-y-3 pt-2">
                <p className="section-label">Powerful permissions (off unless you tick them)</p>
                {offeredPower.map((option) => (
                  <label key={option.scope} className="flex cursor-pointer gap-3 border border-destructive/40 p-4 has-[:checked]:border-destructive">
                    {EXTRA_ICONS[option.scope]}
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-sm font-medium text-foreground">{option.prompt ?? option.label}</p>
                      <p className="text-[13px] text-muted-foreground">{option.description}</p>
                    </div>
                    <input type="checkbox" name={option.scope} className="mt-0.5 size-5 shrink-0 accent-foreground" aria-label={`Allow: ${option.prompt ?? option.label}`} />
                  </label>
                ))}
                <p className="text-[12px] text-muted-foreground">
                  You set a daily limit for each in Settings, under AI Agent. Only tick what the app needs for what you asked it to do.
                </p>
              </div>
            )}
            <p className="text-[12px] text-muted-foreground">
              {offeredPower.length > 0 ? "Unless you tick them above, it can never delete anything or spend AI credits. " : "It can never delete anything or spend AI credits. "}
              It can never touch billing. You can disconnect it any time in Settings, under AI Agent.
            </p>
          </div>

          <fieldset className="space-y-3">
            <legend className="section-label">Keep me connected for</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONNECTION_DURATION_OPTIONS.map((option) => (
                <label key={option.value} className="flex cursor-pointer items-center gap-3 border p-3 has-[:checked]:border-foreground">
                  <input type="radio" name="duration" value={option.value} defaultChecked={option.value === DEFAULT_CONNECTION_DURATION} className="size-4 accent-foreground" />
                  <span className="text-sm text-foreground">{option.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[12px] text-muted-foreground">
              The connection ends on its own at the end of this period, and also if the app is not used for 30 days. Settings, under AI Agent, shows when each one ends.
            </p>
          </fieldset>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="submit" name="decision" value="deny" variant="outline" size="lg" className="w-full sm:w-auto">
              Deny
            </Button>
            <Button type="submit" name="decision" value="allow" size="lg" className="w-full sm:w-auto">
              <Briefcase className="size-4" aria-hidden /> Allow
            </Button>
          </div>
          <p className="break-all text-[12px] text-muted-foreground">After you choose, you will be sent back to {request.redirectUri.split("?")[0]}</p>
        </form>
      </CardContent>
    </Shell>
  )
}
