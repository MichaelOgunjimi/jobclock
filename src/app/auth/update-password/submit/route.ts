import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getSupabaseConfig, getSupabaseSetupHint } from "@/lib/supabase/config"

function redirect(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, request.url), { status: 303 })
}

function messageUrl(path: string, message: string, status: "error" | "success") {
  return `${path}?status=${status}&message=${encodeURIComponent(message)}`
}

export async function POST(request: NextRequest) {
  const config = getSupabaseConfig()

  if (!config) {
    return redirect(request, messageUrl("/auth/update-password", getSupabaseSetupHint(), "error"))
  }

  const formData = await request.formData()
  const password = String(formData.get("password") ?? "")
  const confirm = String(formData.get("confirm") ?? "")

  if (!password || password.length < 6) {
    return redirect(request, messageUrl("/auth/update-password", "Password must be at least 6 characters.", "error"))
  }

  if (password !== confirm) {
    return redirect(request, messageUrl("/auth/update-password", "Passwords do not match.", "error"))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    console.error("[auth/update-password] updateUser error:", error.status, error.message)
    return redirect(request, messageUrl("/auth/update-password", "Could not update password. Please try again.", "error"))
  }

  return redirect(request, "/dashboard")
}
