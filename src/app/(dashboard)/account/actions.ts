"use server"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { revalidatePath } from "next/cache"
import { isValidTimezone } from "@/lib/timezone"

export async function saveAccountInfo(payload: {
  fullName: string
  phone: string
  linkedinUrl: string
  githubUrl: string
  portfolioUrl: string
  avatarUrl: string
  /** IANA zone name; empty clears it (emails then use Europe/London until the browser sets it again). */
  timezone: string
}) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const timezone = payload.timezone.trim()
  if (timezone && !isValidTimezone(timezone)) return { error: "Choose a timezone from the list, such as Europe/London." }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: payload.fullName || null,
      phone: payload.phone || null,
      linkedin_url: payload.linkedinUrl || null,
      github_url: payload.githubUrl || null,
      portfolio_url: payload.portfolioUrl || null,
      avatar_url: payload.avatarUrl || null,
      timezone: timezone || null,
    })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/account")
  revalidatePath("/", "layout")
  return { success: true }
}
