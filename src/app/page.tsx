import Link from "next/link"
import { ArrowRight, Check } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { LandingAnchorLink } from "@/components/landing-anchor-link"
import { LandingNavbar } from "@/components/landing-navbar"
import { ExtensionAvailabilityBanner } from "@/components/extension-availability-banner"
import { ApplicationLedger } from "@/components/landing/application-ledger"
import { ClockDial } from "@/components/landing/clock-dial"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button-styles"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PRO_CREDIT_LIMIT, PRO_PRICES } from "@/lib/billing/plans"
import { formatPounds } from "@/lib/format-pounds"
import { cn } from "@/lib/utils"

const steps = [
  ["01", "Save", "Capture a role from any job site without retyping the listing."],
  ["02", "Tailor", "Shape your CV around the role using evidence you have confirmed."],
  ["03", "Write", "Draft a cover letter and research the company before you apply."],
  ["04", "Prepare", "Build interview answers from your experience and practise them."],
  ["05", "Track", "Keep every role, document and next step in one application timeline."],
] as const

const planFeatures = [
  "The full job-search workspace",
  "CVs, cover letters, interview prep, and exports",
  "AI generation with your own provider key",
] as const

export default async function HomePage() {
  let userProfile = null

  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single()
      userProfile = { email: user.email ?? "", fullName: profile?.full_name ?? null, avatarUrl: profile?.avatar_url ?? null }
    }
  }

  const primaryHref = userProfile ? "/dashboard" : "/auth"

  return (
    <main className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingNavbar userProfile={userProfile} />

      <section className="relative overflow-hidden border-b pt-24">
        <div className="relative mx-auto grid min-h-[42rem] w-full max-w-[1200px] gap-10 px-4 pb-12 pt-16 sm:px-6 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:pb-16">
          <div className="relative z-10 max-w-2xl lg:pb-12">
            <p className="page-kicker">Your job search, on the clock</p>
            <h1 className="page-title mt-5 text-[clamp(3.4rem,6vw,5.5rem)] leading-[0.92]">
              Every application.<br />
              <span className="text-muted-foreground">Right on time.</span>
            </h1>
            <p className="page-lede mt-7 max-w-lg">Save the role, tailor your CV, prepare for the interview, and always know what needs your attention next.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href={primaryHref} className={cn(buttonVariants({ size: "lg" }), "group")}>
                {userProfile ? "Open your workspace" : "Start free"}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link href="/pricing" className={buttonVariants({ variant: "outline", size: "lg" })}>See pricing</Link>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 border-t pt-5 text-sm text-muted-foreground">
              <span>Free forever</span>
              <span>No card required</span>
              <span>Pro from {formatPounds(PRO_PRICES.monthly.amountPence)}/month</span>
            </div>
          </div>

          <div className="relative min-h-[32rem] lg:min-h-[38rem]">
            <ClockDial className="lp-dial pointer-events-none absolute left-1/2 top-1/2 w-[34rem] max-w-none -translate-x-1/2 -translate-y-1/2 text-foreground/20 sm:w-[40rem] lg:w-[44rem]" />
            <div className="absolute left-1/2 top-1/2 z-10 w-[calc(100%-1rem)] max-w-[31rem] -translate-x-1/2 -translate-y-1/2 lg:translate-x-[-46%] lg:translate-y-[-42%]">
              <div className="mb-3 flex items-center justify-between border border-b-0 bg-background/95 px-4 py-3 backdrop-blur">
                <span className="page-kicker">Today · 09:41</span>
                <span className="size-2 bg-accent" aria-hidden="true" />
              </div>
              <ApplicationLedger className="bg-background/95 shadow-[0_30px_80px_-24px_rgba(0,0,0,0.24)] backdrop-blur" />
            </div>
          </div>
        </div>
        <div className="relative mx-auto w-full max-w-[1200px] px-4 pb-12 sm:px-6"><ExtensionAvailabilityBanner compact /></div>
      </section>

      <section id="features" className="border-b">
        <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="page-kicker">How it works</p>
            <h2 className="page-title mt-4 text-4xl sm:text-6xl">From saved role to interview.</h2>
            <p className="page-lede mt-4">A simple loop for the repetitive work around a serious job search.</p>
          </div>
          <ol className="mt-12 grid gap-px border bg-border md:grid-cols-2">
            {steps.map(([number, title, body], index) => (
              <li key={number} className={cn("bg-background p-6 sm:p-8", index === steps.length - 1 && "md:col-span-2")}>
                <p className="page-kicker">{number}</p>
                <h3 className="mt-4 text-xl font-medium tracking-[-0.03em]">{title}</h3>
                <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="why" className="border-b bg-secondary/35">
        <div className="mx-auto grid max-w-[1100px] gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <div>
            <p className="page-kicker">Grounded in your experience</p>
            <h2 className="page-title mt-4 text-4xl sm:text-6xl">Your evidence stays in charge.</h2>
            <p className="page-lede mt-5 max-w-md">JobClock works from the CVs, achievements, and stories you approve. It helps you present the truth clearly instead of inventing experience you do not have.</p>
            <Link href={primaryHref} className="mt-7 inline-flex items-center gap-2 text-sm font-medium underline decoration-border underline-offset-4 transition-colors hover:decoration-foreground">
              Add your experience <ArrowRight className="size-4" />
            </Link>
          </div>

          <div className="border bg-background">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <span className="page-kicker">Evidence trail</span>
              <span className="font-mono text-[11px] text-muted-foreground">3 sources · verified</span>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-3 bg-background p-5">
                <p className="text-xs text-muted-foreground">Your source material</p>
                {["Led a checkout redesign", "Reduced support tickets by 18%", "Mentored two junior designers"].map((item) => (
                  <div key={item} className="border bg-secondary/40 px-4 py-3 text-sm">{item}</div>
                ))}
              </div>
              <div className="bg-background p-5">
                <p className="text-xs text-muted-foreground">Tailored for Product Designer · Northgate Health</p>
                <p className="mt-5 text-lg font-medium leading-7 tracking-[-0.02em]">“Led the redesign of a high-volume checkout flow, reducing related support tickets by 18% while mentoring two junior designers.”</p>
                <div className="mt-8 flex flex-wrap gap-2">
                  {['CV', 'Cover letter', 'Interview answer'].map((item) => <span key={item} className="border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{item}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="ai" className="border-b">
        <div className="mx-auto max-w-[1100px] px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="page-kicker">Simple pricing</p>
            <h2 className="page-title mt-4 text-4xl sm:text-6xl">Your workspace stays useful for free.</h2>
            <p className="page-lede mt-4">Bring your own AI key, or let Pro handle provider access for you.</p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader className="border-b pb-6"><Badge variant="outline">Free forever</Badge><CardTitle className="mt-4 text-3xl">£0</CardTitle><p className="text-sm text-muted-foreground">The complete workspace, using your own AI provider key.</p></CardHeader>
              <CardContent className="flex h-full flex-col gap-6 pt-6">
                <ul className="space-y-3 text-sm">{planFeatures.map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" />{feature}</li>)}</ul>
                <Link href={primaryHref} className={cn(buttonVariants({ variant: "outline" }), "mt-auto w-full")}>Open Free workspace</Link>
              </CardContent>
            </Card>
            <Card className="border-foreground/30">
              <CardHeader className="border-b pb-6"><Badge>Pro</Badge><CardTitle className="mt-4 text-3xl">{formatPounds(PRO_PRICES.monthly.amountPence)}/month</CardTitle><p className="text-sm text-muted-foreground">Everything in Free, plus {PRO_CREDIT_LIMIT} JobClock AI credits each month.</p></CardHeader>
              <CardContent className="flex h-full flex-col gap-6 pt-6">
                <ul className="space-y-3 text-sm">{[...planFeatures, "AI generation without a separate provider account", "Extra credits available when you need them"].map((feature) => <li key={feature} className="flex gap-3"><Check className="mt-0.5 size-4 shrink-0" />{feature}</li>)}</ul>
                <Link href="/pricing" className={cn(buttonVariants(), "mt-auto w-full")}>Compare plans</Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="start" className="relative overflow-hidden bg-sidebar text-white">
        <ClockDial className="pointer-events-none absolute -bottom-72 right-[-10rem] w-[48rem] max-w-none text-white/15" />
        <div className="relative mx-auto max-w-[1100px] px-4 py-20 sm:px-6 md:py-28">
          <p className="page-kicker text-white/55">Start</p>
          <h2 className="mt-4 max-w-3xl text-4xl font-medium tracking-[-0.05em] sm:text-6xl">Put your next application on the clock.</h2>
          <p className="mt-5 max-w-xl text-base leading-7 text-white/70">Import your CV, save your first role, and see the whole search laid out in one place.</p>
          <Link href={primaryHref} className={cn(buttonVariants({ size: "lg", variant: "secondary" }), "mt-8 group")}>
            {userProfile ? "Open your workspace" : "Start free"}<ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <footer className="border-t bg-background">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between">
          <div><p className="font-heading text-xl tracking-[-0.03em]">JobClock</p><p className="mt-2 text-sm text-muted-foreground">Your job search, in one workspace.</p></div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <LandingAnchorLink className="hover:text-foreground" href="#features">How it works</LandingAnchorLink><Link className="hover:text-foreground" href="/pricing">Pricing</Link><Link className="hover:text-foreground" href="/privacy">Privacy</Link><Link className="hover:text-foreground" href="/terms">Terms</Link><Link className="hover:text-foreground" href="/cookies">Cookies</Link>
          </nav>
        </div>
      </footer>
    </main>
  )
}
