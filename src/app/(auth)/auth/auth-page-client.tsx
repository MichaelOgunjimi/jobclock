"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from "@/lib/supabase/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ThemeToggle } from "@/components/theme-toggle"
import { ArrowRight, Briefcase, Loader2, Sparkles } from "lucide-react"

export function AuthPageClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signin" | "signup" | "forgot_password">("signin")
  const [pendingIntent, setPendingIntent] = useState<string | null>(null)
  const isConfigured = isSupabaseConfigured()

  // Callback errors (e.g. expired magic link) arrive via URL params — read once then clean URL.
  const [feedback, setFeedback] = useState<{ status: string; message: string } | null>(() => {
    const msg = searchParams.get("message")
    const st = searchParams.get("status")
    return msg ? { status: st === "success" ? "success" : "error", message: msg } : null
  })

  useEffect(() => {
    if (searchParams.get("message")) {
      router.replace("/auth", { scroll: false })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitForm(intent: string) {
    if (!isConfigured) return
    setPendingIntent(intent)
    setFeedback(null)

    const body = new FormData()
    body.set("intent", intent)
    body.set("email", email)
    if (password) body.set("password", password)

    try {
      const res = await fetch("/auth/submit", { method: "POST", body })
      const data = await res.json() as { ok: boolean; redirect?: string; message?: string }

      if (data.redirect) {
        router.push(data.redirect)
        return
      }

      setFeedback({ status: data.ok ? "success" : "error", message: data.message ?? "Something went wrong." })
      setPendingIntent(null)
    } catch {
      setFeedback({ status: "error", message: "Something went wrong. Please try again." })
      setPendingIntent(null)
    }
  }

  function changeMode(newMode: "signin" | "signup" | "forgot_password") {
    setMode(newMode)
    setFeedback(null)
    setPendingIntent(null)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="hidden lg:flex flex-col justify-between bg-sidebar px-8 py-8 text-white md:px-12 md:py-10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-[8px] border border-white/10 bg-sidebar-primary">
                <span className="font-heading text-[24px] font-semibold">J</span>
              </div>
              <div>
                <p className="section-label text-white/45">Job Assistant</p>
                <p className="font-heading text-[1.55rem] leading-none">Editorial career workflow</p>
              </div>
            </div>
            <ThemeToggle />
          </div>

          <div className="flex flex-1 items-center py-12">
          <div className="max-w-xl space-y-8 xl:mx-auto xl:max-w-2xl">
            <div className="space-y-4">
              <p className="page-kicker text-white/45">Career system</p>
              <h1 className="font-heading text-[3.5rem] leading-[0.92] font-medium tracking-[-0.05em] md:text-[4.5rem]">
                Turn a messy job search into a disciplined editorial process.
              </h1>
              <p className="max-w-lg text-[15px] leading-6 text-white/70">
                Save roles, track applications, and refine your CV from one restrained workspace.
              </p>
            </div>

            <div className="grid gap-px border border-white/10 bg-white/10 md:grid-cols-3">
              {[
                ["01", "Curate", "Collect roles worth applying to."],
                ["02", "Tailor", "Keep your CV and profile current."],
                ["03", "Track", "Follow each application status clearly."],
              ].map(([index, title, copy]) => (
                <div key={index} className="space-y-4 bg-sidebar px-5 py-6">
                  <p className="section-label text-white/35">{index}</p>
                  <div className="space-y-2">
                    <p className="font-medium tracking-[0.02em] text-white">{title}</p>
                    <p className="text-[13px] leading-5 text-white/65">{copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-white/45">
            <Sparkles className="h-4 w-4" />
            <span>A calmer way to organize your applications.</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 md:px-12">
          <Card className="w-full max-w-xl">
            <CardHeader className="border-b pb-6">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-3">
                  {mode === "signin" && (
                    <>
                      <p className="page-kicker">Welcome back</p>
                      <CardTitle>Sign in to continue.</CardTitle>
                      <CardDescription>
                        {isConfigured
                          ? "Use your email and password or request a magic link."
                          : "Add your Supabase URL and anon key to enable authentication."}
                      </CardDescription>
                    </>
                  )}
                  {mode === "signup" && (
                    <>
                      <p className="page-kicker">Get started</p>
                      <CardTitle>Create your account.</CardTitle>
                      <CardDescription>
                        {isConfigured
                          ? "Set up your workspace and start organizing your job search."
                          : "Add your Supabase URL and anon key to enable authentication."}
                      </CardDescription>
                    </>
                  )}
                  {mode === "forgot_password" && (
                    <>
                      <p className="page-kicker">Reset access</p>
                      <CardTitle>Forgot your password?</CardTitle>
                      <CardDescription>
                        Enter your email and we&apos;ll send you a link to reset your password.
                      </CardDescription>
                    </>
                  )}
                </div>
                <div className="hidden size-12 items-center justify-center border bg-secondary md:flex">
                  <Briefcase className="h-5 w-5" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isConfigured && (
                <div className="border border-destructive/20 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
                  {SUPABASE_SETUP_MESSAGE}
                </div>
              )}

              {feedback?.message && (
                <div
                  className={
                    feedback.status === "success"
                      ? "rounded border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-[13px] text-emerald-700 dark:text-emerald-400"
                      : "rounded border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-700 dark:text-red-400"
                  }
                >
                  {feedback.message}
                </div>
              )}

              {mode === "forgot_password" ? (
                <form
                  className="space-y-5"
                  onSubmit={(e) => { e.preventDefault(); submitForm("forgot_password") }}
                >
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={!isConfigured || pendingIntent === "forgot_password"}>
                    {pendingIntent === "forgot_password" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>Send Reset Link <ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </form>
              ) : (
                <>
                  <form
                    className="space-y-5"
                    onSubmit={(e) => { e.preventDefault(); submitForm(mode === "signin" ? "signin" : "signup") }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">Password</Label>
                        {mode === "signin" && (
                          <button
                            type="button"
                            className="text-[12px] text-muted-foreground transition-opacity hover:opacity-70"
                            onClick={() => changeMode("forgot_password")}
                          >
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <Input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required={mode === "signup"}
                        minLength={mode === "signup" ? 6 : undefined}
                      />
                    </div>
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={!isConfigured || !!pendingIntent}
                    >
                      {pendingIntent === "signin" || pendingIntent === "signup" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>{mode === "signin" ? "Sign In" : "Create Account"} <ArrowRight className="h-4 w-4" /></>
                      )}
                    </Button>
                    {mode === "signup" && (
                      <p className="text-center text-xs leading-5 text-muted-foreground">
                        By creating an account, you agree to the{" "}
                        <Link href="/terms" className="font-medium text-foreground underline underline-offset-4">
                          Terms
                        </Link>{" "}
                        and acknowledge the{" "}
                        <Link href="/privacy" className="font-medium text-foreground underline underline-offset-4">
                          Privacy Policy
                        </Link>
                        .
                      </p>
                    )}
                  </form>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-card px-3 text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
                        Or use email link
                      </span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={!isConfigured || !!pendingIntent}
                    onClick={() => submitForm("magic_link")}
                  >
                    {pendingIntent === "magic_link" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Send Magic Link"
                    )}
                  </Button>
                </>
              )}

              <div className="flex items-center justify-between gap-4 border-t pt-5 text-[13px] text-muted-foreground">
                {mode === "forgot_password" ? (
                  <>
                    <span>Remember your password?</span>
                    <button
                      type="button"
                      className="font-medium text-foreground transition-opacity hover:opacity-70"
                      onClick={() => changeMode("signin")}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    <span>{mode === "signin" ? "No account yet?" : "Already have an account?"}</span>
                    <button
                      type="button"
                      className="font-medium text-foreground transition-opacity hover:opacity-70"
                      onClick={() => changeMode(mode === "signin" ? "signup" : "signin")}
                    >
                      {mode === "signin" ? "Create account" : "Sign in"}
                    </button>
                  </>
                )}
              </div>
              <nav className="flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs text-muted-foreground" aria-label="Legal pages">
                <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
                <Link href="/terms" className="hover:text-foreground">Terms</Link>
                <Link href="/cookies" className="hover:text-foreground">Cookies</Link>
              </nav>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
