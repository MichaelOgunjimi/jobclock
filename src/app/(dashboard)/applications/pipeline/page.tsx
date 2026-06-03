import { redirect } from "next/navigation"

export default async function ApplicationsPipelinePage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>
}) {
  const params = searchParams ? await searchParams : undefined
  const query = params?.status ? `?status=${encodeURIComponent(params.status)}` : ""

  redirect(`/analytics${query}`)
}
