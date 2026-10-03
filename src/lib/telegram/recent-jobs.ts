import { getNormalStatusChoices } from "@/lib/applications/status-transitions"
import {
  listRecentApplicationsForUser,
  updateApplicationStatusForUser,
  type RecentApplicationItem,
} from "@/lib/jobs/persist-job"
import type { ApplicationStatus } from "@/lib/supabase/database.types"
import { escapeHtml, type TelegramKeyboard } from "./client"
import type { TelegramInboundCallback } from "./types"

/** How many recent jobs the /recent list and its buttons show. */
const RECENT_LIMIT = 5

export function appOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? "https://jobclock.michaelogunjimi.com"
}

const STATUS_EMOJI: Record<string, string> = {
  saved: "📌", applied: "📨", screening: "🔍", interview: "🎤",
  offer: "🎉", rejected: "❌", withdrawn: "↩️", ghosted: "👻",
}

/** Status with its emoji, e.g. "📨 applied". */
export function statusLabel(status: string): string {
  return `${STATUS_EMOJI[status] ?? "•"} ${status}`
}

function label(item: RecentApplicationItem): string {
  return `${item.title} at ${item.company} (${item.status})`
}

/** The full /recent text plus one button per job. */
export async function buildRecentList(
  userId: string
): Promise<{ text: string; keyboard?: TelegramKeyboard }> {
  const recent = await listRecentApplicationsForUser(userId, appOrigin(), RECENT_LIMIT)
  if (recent.length === 0) {
    return { text: "📭 <b>No saved jobs yet.</b>\nSend me a job link to add one." }
  }

  return {
    text: [
      "🗂 <b>Your recent jobs</b>",
      ...recent.map(
        (item) =>
          `<b>${escapeHtml(item.title)}</b> at ${escapeHtml(item.company)}\n${statusLabel(item.status)} · <a href="${escapeHtml(item.applicationUrl)}">Open in JobClock</a>`
      ),
    ].join("\n\n"),
    keyboard: recent.map((item) => [{ text: label(item).slice(0, 60), callback_data: `j:${item.applicationId}` }]),
  }
}

function buildDetail(item: RecentApplicationItem): { text: string; keyboard: TelegramKeyboard } {
  const links = [{ text: "Open in JobClock", url: item.applicationUrl }]
  if (item.postingUrl) links.push({ text: "Job posting", url: item.postingUrl })

  const statusButtons = getNormalStatusChoices(item.status as ApplicationStatus)
    .filter((status) => status !== item.status)
    .map((status) => ({ text: `Mark ${status}`, callback_data: `s:${item.applicationId}:${status}` }))

  const rows: TelegramKeyboard = [links]
  for (let i = 0; i < statusButtons.length; i += 2) rows.push(statusButtons.slice(i, i + 2))
  rows.push([{ text: "← Back", callback_data: "r" }])

  return {
    text: `<b>${escapeHtml(item.title)}</b>\n🏢 ${escapeHtml(item.company)}${item.location ? `\n📍 ${escapeHtml(item.location)}` : ""}\n${statusLabel(item.status)}`,
    keyboard: rows,
  }
}

/**
 * Resolves a button tap into the message the chat should now show. Every lookup is
 * scoped to `userId` (derived from the tapping Telegram account), never to the
 * application id carried in the button.
 */
export async function resolveRecentCallback(
  userId: string,
  data: TelegramInboundCallback["data"]
): Promise<{ text: string; keyboard?: TelegramKeyboard; toast?: string } | null> {
  if (data === "r") return buildRecentList(userId)

  const [kind, applicationId, status] = data.split(":")
  if ((kind !== "j" && kind !== "s") || !applicationId) return null

  let toast: string | undefined
  if (kind === "s") {
    const updated = await updateApplicationStatusForUser(userId, applicationId, status as ApplicationStatus)
    toast = updated ? `Marked ${status}` : "Couldn't change that status"
  }

  const recent = await listRecentApplicationsForUser(userId, appOrigin(), RECENT_LIMIT)
  const item = recent.find((candidate) => candidate.applicationId === applicationId)
  if (!item) return { text: "🫥 <b>That job is no longer in your recent list.</b>", toast }

  return { ...buildDetail(item), toast }
}
