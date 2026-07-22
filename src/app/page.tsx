import Link from "next/link"
import { ArrowRight, BadgeCheck, BriefcaseBusiness, FileCheck2, FolderKanban, KeyRound, Search, ShieldCheck, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { LandingAnchorLink } from "@/components/landing-anchor-link"
import { LandingNavbar } from "@/components/landing-navbar"
import { ExtensionAvailabilityBanner } from "@/components/extension-availability-banner"
import { buttonVariants } from "@/components/ui/button-styles"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const featureCards = [
  {
    icon: Search,
    kicker: "Search",
    title: "Curate roles with more signal.",
    body: "Search the market, narrow by salary and location, and save only the roles worth tailoring for.",
  },
  {
    icon: FileCheck2,
    kicker: "Profile",
    title: "Keep every CV variation current.",
    body: "Manage multiple CVs, refine sections quickly, and keep your profile aligned with the work you want.",
  },
  {
    icon: FolderKanban,
    kicker: "Pipeline",
    title: "Track the application story clearly.",
    body: "Move from saved to applied to interview without losing the thread of what happened and what comes next.",
  },
]

const workflowSteps = [
  ["01", "Collect", "Bring promising roles into one place instead of scattering them across tabs, notes, and screenshots."],
  ["02", "Tailor", "Update the CV that fits the role and keep your materials precise before you send anything."],
  ["03", "Track", "Watch every application move through your pipeline with less ambiguity and less admin."],
]

const proofPoints = [
  "Role search with salary and location filters",
  "Multiple CV management and inline editing",
  "Bring your own AI provider key for generation",
  "Application pipeline for saved, applied, and interview stages",
  "Document templates for CV and cover letter output",
]

export default async function HomePage() {
  let userProfile = null

  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", user.id)
        .single()
      userProfile = {
        email: user.email ?? "",
        fullName: profile?.full_name ?? null,
        avatarUrl: profile?.avatar_url ?? null,
      }
    }
  }

  return (
    <main className="landing-page min-h-screen overflow-x-hidden bg-background text-foreground">
      <LandingNavbar userProfile={userProfile} />

      <section className="relative isolate border-b">
        <div className="landing-glow landing-glow-one" aria-hidden="true" />
        <div className="landing-glow landing-glow-two" aria-hidden="true" />
        <div className="landing-grid absolute inset-0 opacity-60" aria-hidden="true" />

        <div className="relative mx-auto flex min-h-screen w-full max-w-[1440px] flex-col px-4 pb-12 pt-24 sm:px-6 sm:pt-28 md:px-10 md:pb-16 md:pt-28 xl:px-12">
          <div className="grid flex-1 items-start gap-12 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-12">
            <div className="space-y-10">
              <div className="landing-reveal landing-delay-1 space-y-6">
                <div className="inline-flex items-center gap-2 border bg-secondary px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5" />
                  Free workspace. Configure an AI key.
                </div>

                <div className="space-y-5">
                  <h1 className="landing-hero-title max-w-[12ch] text-[3.4rem] leading-[0.9] tracking-[-0.07em] sm:text-[4.5rem] md:text-[5.5rem]">
                    Turn the job hunt into a deliberate system.
                  </h1>
                  <p className="max-w-2xl text-[16px] leading-7 text-muted-foreground sm:text-[17px]">
                    Search roles, tailor your CV, save the opportunities worth pursuing, and track every application from one restrained workspace. AI generation uses the provider key you configure.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Link href="/auth" className={cn(buttonVariants({ size: "lg" }), "landing-cta-primary")}>
                    Start with your workspace
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <LandingAnchorLink href="#features" className={buttonVariants({ size: "lg", variant: "outline" })}>
                    Explore the flow
                  </LandingAnchorLink>
                </div>

                <div className="grid max-w-2xl gap-4 border bg-background/75 p-4 sm:grid-cols-[auto_minmax(0,1fr)]">
                  <div className="flex size-11 items-center justify-center border bg-secondary">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Bring your own AI provider key.</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">
                      Add your OpenAI or Anthropic key in Settings for CV tailoring, cover letters, research, and interview prep.
                    </p>
                  </div>
                </div>

                <ExtensionAvailabilityBanner />
              </div>

              <div className="landing-reveal landing-delay-2 grid gap-px border bg-border sm:grid-cols-3">
                {workflowSteps.map(([index, title, body]) => (
                  <div key={index} className="bg-background px-5 py-6">
                    <p className="page-kicker">{index}</p>
                    <p className="mt-5 text-[1.05rem] font-medium tracking-[-0.02em] text-foreground">{title}</p>
                    <p className="mt-2 text-[13px] leading-6 text-muted-foreground">{body}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="landing-reveal landing-delay-3 relative">
              <div className="landing-orb landing-orb-left" aria-hidden="true" />
              <div className="landing-orb landing-orb-right" aria-hidden="true" />

              <div className="relative space-y-4">
                <Card className="landing-card-float border-foreground/10 bg-card/95 backdrop-blur-sm">
                  <CardHeader className="border-b pb-5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="page-kicker">Overview</p>
                        <CardTitle className="mt-2 text-[1.7rem] tracking-[-0.04em]">
                          One workspace, three decisions.
                        </CardTitle>
                      </div>
                      <div className="flex size-11 items-center justify-center border bg-secondary">
                        <BriefcaseBusiness className="h-5 w-5" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6 pt-6">
                    <div className="grid gap-px border bg-border sm:grid-cols-3">
                      {[
                        ["148", "Roles reviewed"],
                        ["23", "Saved for tailoring"],
                        ["8", "Active interviews"],
                      ].map(([value, label], index) => (
                        <div key={label} className={`bg-card px-5 py-5 landing-delay-${index + 1}`}>
                          <p className="metric-value text-[2.4rem]">{value}</p>
                          <p className="metric-label mt-2">{label}</p>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      {[
                        "Search the market without drowning in noise.",
                        "Keep your working CV versions precise and current.",
                        "Track progress without a spreadsheet sidecar.",
                      ].map((item) => (
                        <div key={item} className="flex items-start gap-3 border border-border/80 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                          <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="landing-card-float-alt ml-auto w-full max-w-[26rem] border-foreground/10 bg-sidebar text-white">
                  <CardHeader className="border-b border-white/10 pb-5">
                    <p className="page-kicker text-white/45">Signal</p>
                    <CardTitle className="mt-2 text-[1.45rem] text-white">
                      Built for disciplined applications, not tab hoarding.
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-3 text-sm text-white/72">
                      {proofPoints.map((item) => (
                        <div key={item} className="flex items-start gap-3 border border-white/10 bg-white/5 px-4 py-3">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-white" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-b">
        <div className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-6 md:px-10 md:py-20 xl:px-12">
          <div className="landing-reveal max-w-3xl space-y-4">
            <p className="page-kicker">Features</p>
            <h2 className="text-[2.5rem] leading-[0.95] tracking-[-0.06em] sm:text-[3.25rem]">
              A calmer interface for a high-friction process.
            </h2>
            <p className="max-w-2xl text-[15px] leading-7 text-muted-foreground">
              The product is built around fewer, better actions: search, tailor, track. Everything else stays subordinate to that flow.
            </p>
          </div>

          <div className="mt-10 grid gap-5 lg:grid-cols-3">
            {featureCards.map(({ icon: Icon, kicker, title, body }, index) => (
              <Card key={title} className={`landing-reveal landing-delay-${index + 1} border-foreground/10`}>
                <CardHeader className="border-b pb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <p className="page-kicker">{kicker}</p>
                      <CardTitle className="text-[1.6rem] leading-[1] tracking-[-0.04em]">
                        {title}
                      </CardTitle>
                    </div>
                    <div className="flex size-11 shrink-0 items-center justify-center border bg-secondary">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <p className="text-[14px] leading-7 text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section id="workflow" className="relative overflow-hidden">
        <div className="landing-grid absolute inset-0 opacity-35" aria-hidden="true" />
        <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:grid-cols-[0.95fr_1.05fr] xl:px-12">
          <div className="landing-reveal space-y-4">
            <p className="page-kicker">Why it works</p>
            <h2 className="text-[2.35rem] leading-[0.95] tracking-[-0.06em] sm:text-[3rem]">
              Less interface noise, more application quality.
            </h2>
            <p className="max-w-xl text-[15px] leading-7 text-muted-foreground">
              Most job tools overload the process. This one compresses it. You get a tighter loop between the role, the CV, and the application outcome.
            </p>
          </div>

          <div className="grid gap-px border bg-border sm:grid-cols-2">
            {[
              ["Search faster", "Narrow the market before you start tailoring."],
              ["Edit cleaner", "Keep the right CV variation close to the role you want."],
              ["Track better", "See what is saved, sent, or moving toward interview."],
              ["Control AI cost", "Use your own provider key for AI generation instead of hidden usage."],
            ].map(([title, body], index) => (
              <div key={title} className={`landing-reveal landing-delay-${(index % 3) + 1} bg-background px-6 py-8`}>
                <p className="text-[1.1rem] font-medium tracking-[-0.03em] text-foreground">{title}</p>
                <p className="mt-3 text-[14px] leading-7 text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="start" className="border-t bg-sidebar text-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-16 sm:px-6 md:px-10 md:py-20 lg:flex-row lg:items-end lg:justify-between xl:px-12">
          <div className="landing-reveal max-w-3xl space-y-4">
            <p className="page-kicker text-white/45">Start</p>
            <h2 className="text-[2.6rem] leading-[0.94] tracking-[-0.06em] text-white sm:text-[3.3rem]">
              Build a more deliberate application workflow.
            </h2>
            <p className="max-w-2xl text-[15px] leading-7 text-white/68">
              Open the workspace, import your CV, and stop treating your job search like a pile of browser tabs.
            </p>
          </div>

          <div className="landing-reveal landing-delay-1 flex flex-col gap-3 sm:flex-row">
            <Link href="/auth" className={buttonVariants({ size: "lg", variant: "secondary" })}>
              Open workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth"
              className={cn(
                buttonVariants({ size: "lg", variant: "ghost" }),
                "border border-white/12 bg-transparent text-white hover:bg-white/8 hover:text-white"
              )}
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t bg-background">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 px-4 py-8 sm:px-6 md:flex-row md:items-end md:justify-between md:px-10 xl:px-12">
          <div className="space-y-2">
            <p className="page-kicker">Job Assistant</p>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              Search roles, tailor your materials, and track applications from one calmer workspace.
            </p>
          </div>

          <div className="flex flex-col gap-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:gap-6">
            <LandingAnchorLink className="transition-colors hover:text-foreground" href="#features">
              Features
            </LandingAnchorLink>
            <LandingAnchorLink className="transition-colors hover:text-foreground" href="#workflow">
              Workflow
            </LandingAnchorLink>
            <Link className="transition-colors hover:text-foreground" href="/auth">
              Open workspace
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/privacy">
              Privacy
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/terms">
              Terms
            </Link>
            <Link className="transition-colors hover:text-foreground" href="/cookies">
              Cookies
            </Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
