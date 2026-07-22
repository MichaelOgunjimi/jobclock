import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { ArrowLeft, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { buttonVariants } from "@/components/ui/button-styles"
import { cn } from "@/lib/utils"

const legalDocuments = [
  { href: "/privacy", label: "Privacy policy" },
  { href: "/terms", label: "Terms of service" },
  { href: "/cookies", label: "Cookie policy" },
]

export function PublicLegalPage({ kicker, title, summary, updatedAt, children }: {
  kicker: string
  title: string
  summary: string
  updatedAt: string
  children: ReactNode
}) {
  return (
    <main className="landing-page min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 md:px-10 xl:px-12">
          <Link href="/" className="flex items-center gap-3" aria-label="JobClock home">
            <span className="relative flex size-11 items-center justify-center overflow-hidden border bg-primary">
              <Image src="/logo-mark-light-white.svg" alt="" width={44} height={44} priority unoptimized className="size-full object-contain dark:hidden" />
              <Image src="/logo-mark-light.svg" alt="" width={44} height={44} priority unoptimized className="hidden size-full object-contain dark:block" />
            </span>
            <span>
              <span className="page-kicker block">JobClock</span>
              <span className="block text-sm text-muted-foreground">Legal information</span>
            </span>
          </Link>
          <Link href="/" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <ArrowLeft className="size-3.5" />
            Back to JobClock
          </Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b">
        <div className="landing-grid absolute inset-0 opacity-45" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1440px] px-4 py-14 sm:px-6 md:px-10 md:py-20 xl:px-12">
          <div className="max-w-4xl space-y-6">
            <p className="page-kicker">{kicker}</p>
            <h1 className="max-w-[16ch] text-[3rem] leading-[0.92] tracking-[-0.06em] sm:text-[4.25rem]">{title}</h1>
            <p className="max-w-3xl text-[16px] leading-7 text-muted-foreground sm:text-[17px]">{summary}</p>
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">Effective and last updated {updatedAt}</p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-12 sm:px-6 md:px-10 md:py-16 lg:grid-cols-[minmax(0,1fr)_20rem] xl:px-12">
        <article className="min-w-0 space-y-6">{children}</article>
        <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          <Card>
            <CardHeader className="border-b">
              <p className="page-kicker">Document set</p>
              <CardTitle>JobClock policies</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {legalDocuments.map((document) => (
                <Link key={document.href} href={document.href} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "w-full justify-between")}>
                  {document.label}
                  <ExternalLink className="size-3.5" />
                </Link>
              ))}
            </CardContent>
          </Card>
          <Card className="border-foreground/10 bg-sidebar text-white">
            <CardHeader className="border-b border-white/10">
              <p className="page-kicker text-white/50">Questions</p>
              <CardTitle className="text-white">Contact JobClock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-white/70">
              <p>Ask about these policies or make a data-rights request by email.</p>
              <a href="mailto:support@jobclock.michaelogunjimi.com" className="break-all font-medium text-white underline underline-offset-4">support@jobclock.michaelogunjimi.com</a>
            </CardContent>
          </Card>
        </aside>
      </div>

      <footer className="border-t bg-sidebar text-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-3 px-4 py-8 text-sm text-white/60 sm:px-6 md:flex-row md:items-center md:justify-between md:px-10 xl:px-12">
          <p>JobClock by Michael Ogunjimi.</p>
          <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal pages">
            {legalDocuments.map((document) => <Link key={document.href} href={document.href} className="hover:text-white">{document.label}</Link>)}
          </nav>
        </div>
      </footer>
    </main>
  )
}

export function LegalSection({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader className="border-b">
        <p className="page-kicker">{number}</p>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-[15px] leading-7 text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:text-foreground">
        {children}
      </CardContent>
    </Card>
  )
}
