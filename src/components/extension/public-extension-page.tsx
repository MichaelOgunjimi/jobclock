import Image from "next/image"
import Link from "next/link"
import { ArrowRight, ExternalLink, ShieldCheck } from "lucide-react"
import type { ReactNode } from "react"
import { buttonVariants } from "@/components/ui/button-styles"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface PublicExtensionPageProps {
  kicker: string
  title: string
  lede: string
  updatedAt: string
  children: ReactNode
}

export function PublicExtensionPage({
  kicker,
  title,
  lede,
  updatedAt,
  children,
}: PublicExtensionPageProps) {
  return (
    <main className="landing-page min-h-screen bg-background text-foreground">
      <header className="border-b bg-background/95">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-4 sm:px-6 md:flex-row md:items-center md:justify-between md:px-10 xl:px-12">
          <Link
            href="/"
            aria-label="JobClock home"
            className="flex items-center gap-3"
          >
            <span className="relative flex size-11 items-center justify-center overflow-hidden border bg-primary">
              <Image
                src="/logo-mark-light-white.svg"
                alt=""
                width={44}
                height={44}
                priority
                unoptimized
                data-testid="extension-logo-light"
                className="size-full object-contain dark:hidden"
              />
              <Image
                src="/logo-mark-light.svg"
                alt=""
                width={44}
                height={44}
                priority
                unoptimized
                data-testid="extension-logo-dark"
                className="hidden size-full object-contain dark:block"
              />
            </span>
            <span>
              <span className="page-kicker block">JobClock</span>
              <span className="block text-sm text-muted-foreground">
                Chrome extension
              </span>
            </span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Extension information" className="flex">
              <Link
                href="/extension/support"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Support
              </Link>
              <Link
                href="/extension/privacy"
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                Privacy
              </Link>
            </nav>
            <Link href="/auth" className={buttonVariants({ size: "sm" })}>
              Open JobClock
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b">
        <div className="landing-grid absolute inset-0 opacity-50" aria-hidden />
        <div className="relative mx-auto w-full max-w-[1440px] px-4 py-14 sm:px-6 md:px-10 md:py-20 xl:px-12">
          <div className="max-w-4xl space-y-6">
            <div className="inline-flex border bg-secondary px-3 py-2">
              <p className="page-kicker">{kicker}</p>
            </div>
            <div className="space-y-5">
              <h1 className="max-w-[15ch] text-[3rem] leading-[0.92] tracking-[-0.06em] sm:text-[4.25rem]">
                {title}
              </h1>
              <p className="max-w-3xl text-[16px] leading-7 text-muted-foreground sm:text-[17px]">
                {lede}
              </p>
            </div>
            <p className="text-xs uppercase tracking-[0.1em] text-muted-foreground">
              Last updated {updatedAt}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto grid w-full max-w-[1440px] gap-8 px-4 py-12 sm:px-6 md:px-10 md:py-16 lg:grid-cols-[minmax(0,1fr)_20rem] xl:px-12">
        <article className="min-w-0 space-y-6">{children}</article>

        <aside className="space-y-5 lg:sticky lg:top-8 lg:self-start">
          <Card className="border-foreground/10 bg-sidebar text-white">
            <CardHeader className="border-b border-white/10">
              <p className="page-kicker text-white/50">At a glance</p>
              <CardTitle className="text-white">
                User-triggered, account-bound.
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-[13px] leading-6 text-white/70">
              <p>
                JobClock reads the active job page when you open the extension,
                then lets you review the result before saving it.
              </p>
              <div className="flex items-start gap-3 border border-white/10 bg-white/5 p-3">
                <ShieldCheck className="mt-1 size-4 shrink-0 text-white" />
                <span>
                  The extension connects only to the production JobClock
                  service.
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b">
              <p className="page-kicker">Need help?</p>
              <CardTitle>Contact JobClock support.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm leading-6 text-muted-foreground">
              <p>
                Include the page URL and the error shown in the extension. Do
                not include your extension token.
              </p>
              <a
                href="mailto:michael_ogunjimi@yahoo.com"
                aria-label="Email JobClock support"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "w-full"
                )}
              >
                Email support
                <ExternalLink className="size-3.5" />
              </a>
            </CardContent>
          </Card>
        </aside>
      </div>

      <footer className="border-t bg-sidebar text-white">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-4 py-8 text-sm text-white/60 sm:px-6 md:flex-row md:items-center md:justify-between md:px-10 xl:px-12">
          <p>JobClock by Michael Ogunjimi.</p>
          <p>Public extension information, available without signing in.</p>
        </div>
      </footer>
    </main>
  )
}
