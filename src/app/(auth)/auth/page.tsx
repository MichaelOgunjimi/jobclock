"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { isSupabaseConfigured, SUPABASE_SETUP_MESSAGE } from "@/lib/supabase/config"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import { ArrowRight, Briefcase, Sparkles } from "lucide-react"

export default function AuthPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"signin" | "signup">("signin")
  const [loading, setLoading] = useState(false)
  const isConfigured = isSupabaseConfigured()

  const supabase = isConfigured ? createClient() : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!supabase) {
      toast.error(SUPABASE_SETUP_MESSAGE)
      return
    }

    setLoading(true)

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Signed in!")
        window.location.href = "/"
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      })
      if (error) {
        toast.error(error.message)
      } else {
        toast.success("Check your email for a confirmation link!")
      }
    }

    setLoading(false)
  }

  async function handleMagicLink() {
    if (!supabase) {
      toast.error(SUPABASE_SETUP_MESSAGE)
      return
    }

    if (!email) {
      toast.error("Enter your email first")
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/` },
    })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success("Magic link sent!")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between bg-sidebar px-8 py-8 text-white md:px-12 md:py-10">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-[8px] border border-white/10 bg-sidebar-primary">
              <span className="font-heading text-[24px] font-semibold">J</span>
            </div>
            <div>
              <p className="section-label text-white/45">Job Assistant</p>
              <p className="font-heading text-[1.55rem] leading-none">Swiss elegant workflow</p>
            </div>
          </div>

          <div className="max-w-xl space-y-8 py-12">
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

          <div className="flex items-center gap-2 text-[12px] text-white/45">
            <Sparkles className="h-4 w-4" />
            <span>Designed after the Pencil guide: webapp-02-swisselegant_light</span>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-10 md:px-12">
          <Card className="w-full max-w-xl">
            <CardHeader className="border-b pb-6">
              <div className="flex items-center justify-between gap-3">
                <div className="space-y-3">
                  <p className="page-kicker">{mode === "signin" ? "Welcome back" : "Create access"}</p>
                  <CardTitle>
                    {mode === "signin" ? "Sign in to continue." : "Open your workspace."}
                  </CardTitle>
                  <CardDescription>
                    {isConfigured
                      ? mode === "signin"
                        ? "Use your email and password or request a magic link."
                        : "Create an account and start organizing your applications."
                      : "Add your Supabase URL and anon key to enable authentication."}
                  </CardDescription>
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

              <form onSubmit={handleSubmit} className="space-y-5">
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
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading || !isConfigured}>
                  {loading ? "Loading..." : mode === "signin" ? "Sign In" : "Create Account"}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
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
                variant="outline"
                className="w-full"
                onClick={handleMagicLink}
                disabled={loading || !isConfigured}
              >
                Send Magic Link
              </Button>

              <div className="flex items-center justify-between gap-4 border-t pt-5 text-[13px] text-muted-foreground">
                <span>{mode === "signin" ? "Need an account?" : "Already registered?"}</span>
                <button
                  type="button"
                  className="font-medium text-foreground transition-colors hover:text-accent"
                  onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                >
                  {mode === "signin" ? "Create one" : "Sign in"}
                </button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  )
}
