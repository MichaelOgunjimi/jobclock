import { connection } from "next/server"
import { notFound } from "next/navigation"
import { GlobalSearchTestHarnessClient } from "./global-search-test-harness-client"

export default async function GlobalSearchTestHarnessPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  await connection()

  if (process.env.PLAYWRIGHT_GLOBAL_SEARCH_FIXTURE !== "1") {
    notFound()
  }

  const { view } = await searchParams

  return <GlobalSearchTestHarnessClient view={view} />
}
