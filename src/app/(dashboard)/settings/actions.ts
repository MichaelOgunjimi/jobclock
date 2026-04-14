"use server"

import { createClient } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/config"
import { revalidatePath } from "next/cache"
import { PROVIDER_MODELS, type AiProvider, type UserPreferences, type JobSources } from "@/lib/ai"
import { encrypt, decrypt, isEncryptionConfigured } from "@/lib/crypto"

const VALID_PROVIDERS = new Set<AiProvider>(["anthropic", "openai"])

export async function saveAiSettings(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase is not configured" }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const provider = formData.get("provider") as AiProvider
  const model = formData.get("model") as string
  const anthropicKey = (formData.get("anthropic_api_key") as string).trim()
  const openaiKey = (formData.get("openai_api_key") as string).trim()

  if (!VALID_PROVIDERS.has(provider)) {
    return { error: "Invalid provider" }
  }

  const validModels = PROVIDER_MODELS[provider].map((m) => m.id)
  if (!validModels.includes(model)) {
    return { error: "Invalid model for provider" }
  }

  if ((anthropicKey || openaiKey) && !isEncryptionConfigured()) {
    return { error: "ENCRYPTION_SECRET must be configured to store API keys securely." }
  }

  // Note: read-then-write on JSONB preferences has a theoretical race condition
  // if two settings tabs save simultaneously. In practice this is rare for
  // single-user settings. A PostgreSQL RPC with jsonb || would be fully atomic.
  const { data: existing } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()

  const prev = (existing?.preferences ?? {}) as UserPreferences

  const updatedPreferences: UserPreferences = {
    ...prev,
    ai_provider: provider,
    ai_model: model,
    // Only overwrite a key if user entered a new value; empty = keep existing
    ...(anthropicKey ? { anthropic_api_key: encrypt(anthropicKey) } : {}),
    ...(openaiKey ? { openai_api_key: encrypt(openaiKey) } : {}),
  }

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: updatedPreferences as unknown as import("@/lib/supabase/database.types").Json })
    .eq("id", user.id)

  if (error) {
    return { error: "Failed to save settings" }
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function saveJobSources(sources: JobSources) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  // Note: read-then-write on JSONB preferences has a theoretical race condition
  // if two settings tabs save simultaneously. In practice this is rare for
  // single-user settings. A PostgreSQL RPC with jsonb || would be fully atomic.
  const { data: existing } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()

  const prev = (existing?.preferences ?? {}) as UserPreferences

  // Encrypt Reed API key if present, matching how AI keys are stored
  const encryptedSources = { ...sources }
  if (encryptedSources.reed?.api_key) {
    encryptedSources.reed = {
      ...encryptedSources.reed,
      api_key: encrypt(encryptedSources.reed.api_key),
    }
  }

  const updated: UserPreferences = { ...prev, job_sources: encryptedSources }

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: updated as unknown as import("@/lib/supabase/database.types").Json })
    .eq("id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { success: true }
}

export async function saveTemplate(type: "cv" | "cover_letter", path: string) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const column = type === "cv" ? "cv_template_path" : "cover_letter_template_path"

  const { error } = await supabase
    .from("profiles")
    .update({ [column]: path })
    .eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

export async function deleteTemplate(type: "cv" | "cover_letter") {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const storagePath = `${user.id}/${type}-template.docx`
  await supabase.storage.from("templates").remove([storagePath])

  const column = type === "cv" ? "cv_template_path" : "cover_letter_template_path"
  const { error } = await supabase.from("profiles").update({ [column]: null }).eq("id", user.id)

  if (error) return { error: error.message }

  revalidatePath("/settings")
  return { success: true }
}

export async function saveDocumentTemplate(
  type: "cv" | "cover_letter",
  template: string,
) {
  if (!isSupabaseConfigured()) return { error: "Supabase not configured" }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Unauthorized" }

  const key = type === "cv" ? "preferred_cv_template" : "preferred_cover_letter_template"

  // Note: read-then-write on JSONB preferences has a theoretical race condition
  // if two settings tabs save simultaneously. In practice this is rare for
  // single-user settings. A PostgreSQL RPC with jsonb || would be fully atomic.
  const { data: existing } = await supabase
    .from("profiles")
    .select("preferences")
    .eq("id", user.id)
    .single()

  const prev = (existing?.preferences ?? {}) as UserPreferences
  const updated: UserPreferences = { ...prev, [key]: template }

  const { error } = await supabase
    .from("profiles")
    .update({ preferences: updated as unknown as import("@/lib/supabase/database.types").Json })
    .eq("id", user.id)

  if (error) return { error: error.message }
  revalidatePath("/settings")
  return { success: true }
}
