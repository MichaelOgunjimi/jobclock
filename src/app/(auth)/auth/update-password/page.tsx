import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { UpdatePasswordClient } from "./update-password-client"

export const metadata: Metadata = {
  title: "Update password",
  robots: { index: false, follow: false },
}

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; status?: string }>
}) {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      redirect("/auth")
    }
  }

  const params = await searchParams
  const feedback = params.message
    ? { message: params.message, status: params.status === "success" ? "success" : "error" }
    : null

  return <UpdatePasswordClient feedback={feedback} />
}
