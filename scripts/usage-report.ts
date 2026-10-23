/**
 * Read-only report on real hosted-AI spend, to tune Pro pricing, credit weights and cost caps.
 * Usage: npm run usage:report -- [--days=30] [--price-gbp=12] [--gbp-usd=1.30]
 *
 * Only settled JobClock-key actions are counted; personal-key calls are never metered.
 * --gbp-usd is an assumption, not a live rate: set it to the current exchange rate.
 */

import postgres from "postgres"

const CREDIT_LIMIT = 300
const COST_LIMIT_USD = 4
const STRIPE_FEE_PCT = 0.015
const STRIPE_FEE_FIXED_GBP = 0.2

// Same shape as a typical application, using the credit weights in src/lib/billing/plans.ts.
const BUNDLES: { name: string; features: string[] }[] = [
  { name: "Light (import + cover letter)", features: ["job_import", "cover_letter"] },
  { name: "Standard (import + CV + cover letter)", features: ["job_import", "cv_tailoring", "cover_letter"] },
  {
    name: "Full prep (standard + research + interview prep)",
    features: ["job_import", "cv_tailoring", "cover_letter", "company_research", "interview_preparation"],
  },
]

function arg(name: string, fallback: number) {
  const raw = process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1]
  const value = raw === undefined ? fallback : Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`❌  --${name} must be a positive number`)
    process.exit(1)
  }
  return value
}

const usd = (microusd: number) => `$${(microusd / 1_000_000).toFixed(3)}`

async function main() {
  const url = process.env.DATABASE_URL ?? process.env.DATABASE_DIRECT_URL
  if (!url) {
    console.error("❌  DATABASE_URL is not set")
    process.exit(1)
  }
  const days = arg("days", 30)
  const priceGbp = arg("price-gbp", 12)
  const gbpUsd = arg("gbp-usd", 1.3)

  const sql = postgres(url, { max: 1, onnotice: () => {} })
  try {
    const features = await sql<{
      feature: string; n: string; credits: string; avg_cost: string; p50: string; p95: string
      max_cost: string; est: string; avg_in: string; avg_out: string
    }[]>`
      select feature,
             count(*) as n,
             max(credits) as credits,
             avg(actual_cost_microusd) as avg_cost,
             percentile_cont(0.5) within group (order by actual_cost_microusd) as p50,
             percentile_cont(0.95) within group (order by actual_cost_microusd) as p95,
             max(actual_cost_microusd) as max_cost,
             avg(estimated_cost_microusd) as est,
             avg(input_tokens) as avg_in,
             avg(output_tokens) as avg_out
      from ai_usage_actions
      where status = 'completed' and credential_source = 'jobclock'
        and settled_at > now() - make_interval(days => ${days})
      group by feature
      order by feature
    `

    console.log(`\nHosted AI spend by feature, last ${days} days (settled actions only)\n`)
    if (!features.length) {
      console.log("No settled hosted actions in this window yet. Use the app with a JobClock key, then re-run.\n")
      return
    }
    console.table(features.map((f) => ({
      feature: f.feature,
      runs: Number(f.n),
      credits: Number(f.credits),
      avg: usd(Number(f.avg_cost)),
      median: usd(Number(f.p50)),
      p95: usd(Number(f.p95)),
      max: usd(Number(f.max_cost)),
      reserved: usd(Number(f.est)),
      "avg tokens in/out": `${Math.round(Number(f.avg_in))}/${Math.round(Number(f.avg_out))}`,
      "p95 vs reserved": `${(Number(f.p95) / Number(f.est)).toFixed(2)}x`,
    })))
    console.log("p95 above 1.00x means the reservation under-holds for that feature; consider raising its estimate.\n")

    const avgCost = new Map(features.map((f) => [f.feature, Number(f.avg_cost)]))
    const credits = new Map(features.map((f) => [f.feature, Number(f.credits)]))
    const feeGbp = priceGbp * STRIPE_FEE_PCT + STRIPE_FEE_FIXED_GBP
    console.log(`Typical application (average cost; £${priceGbp} Pro, assumed £1 = $${gbpUsd}, Stripe fee ~£${feeGbp.toFixed(2)})\n`)
    console.table(BUNDLES.flatMap((bundle) => {
      if (bundle.features.some((f) => !avgCost.has(f))) return []
      const cost = bundle.features.reduce((sum, f) => sum + avgCost.get(f)!, 0)
      const bundleCredits = bundle.features.reduce((sum, f) => sum + credits.get(f)!, 0)
      const byCredits = Math.floor(CREDIT_LIMIT / bundleCredits)
      const byCost = Math.floor((COST_LIMIT_USD * 1_000_000) / cost)
      const perMonth = Math.min(byCredits, byCost)
      const monthlyCostGbp = (perMonth * cost) / 1_000_000 / gbpUsd
      return [{
        application: bundle.name,
        "cost each": usd(cost),
        credits: bundleCredits,
        "per month": perMonth,
        "limit hit first": byCredits <= byCost ? "credits" : "cost cap",
        "left over (£)": (priceGbp - feeGbp - monthlyCostGbp).toFixed(2),
      }]
    }))
    console.log("Bundles are skipped until every feature in them has at least one settled run.\n")

    const users = await sql<{
      user_id: string; period_start: Date; credits_used: number; cost_used: string
    }[]>`
      select user_id, period_start, credits_used, cost_used_microusd as cost_used
      from ai_usage_periods
      where period_end > now() - make_interval(days => ${days})
      order by cost_used_microusd desc
      limit 10
    `
    console.log("Heaviest users this window (ids shortened)\n")
    console.table(users.map((u) => ({
      user: u.user_id.slice(0, 8),
      period: u.period_start.toISOString().slice(0, 10),
      "credits used": `${u.credits_used}/${CREDIT_LIMIT}`,
      "cost used": `${usd(Number(u.cost_used))} / $${COST_LIMIT_USD}`,
      "cost per credit": u.credits_used ? usd(Number(u.cost_used) / u.credits_used) : "-",
    })))

    const [topUps] = await sql<{ actions: string; credits: string; cost: string; revenue: string }[]>`
      select
        (select count(*) from ai_usage_actions
          where funding = 'purchased' and status = 'completed' and settled_at > now() - make_interval(days => ${days})) as actions,
        (select coalesce(sum(credits), 0) from ai_usage_actions
          where funding = 'purchased' and status = 'completed' and settled_at > now() - make_interval(days => ${days})) as credits,
        (select coalesce(sum(actual_cost_microusd), 0) from ai_usage_actions
          where funding = 'purchased' and status = 'completed' and settled_at > now() - make_interval(days => ${days})) as cost,
        (select coalesce(sum(amount_pence), 0) from ai_credit_purchases
          where created_at > now() - make_interval(days => ${days})) as revenue
    `
    console.log(
      `Top-ups this window: £${(Number(topUps.revenue) / 100).toFixed(2)} sold; ` +
      `${topUps.actions} actions used ${topUps.credits} purchased credits costing ${usd(Number(topUps.cost))} ` +
      "(these are not in the monthly figures above).\n",
    )

    const [exhausted] = await sql<{ n: string }[]>`
      select count(*) as n from ai_usage_periods
      where period_end > now() - make_interval(days => ${days})
        and (credits_used >= ${CREDIT_LIMIT - 1} or cost_used_microusd >= ${COST_LIMIT_USD * 1_000_000 - 100_000})
    `
    console.log(`Users who hit their allowance this window: ${exhausted.n}. If many do, add a top-up or raise the limits.\n`)
  } catch (error) {
    if ((error as { code?: string }).code === "42P01") {
      console.error("❌  Usage tables are missing: migration 0027 has not been applied to this database (make migrate).")
      process.exitCode = 1
      return
    }
    throw error
  } finally {
    await sql.end()
  }
}

void main()
