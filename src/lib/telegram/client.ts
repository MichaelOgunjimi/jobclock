/** Telegram inline keyboard: rows of buttons that either call back or open a URL. */
export type TelegramButton = { text: string; callback_data: string } | { text: string; url: string }
export type TelegramKeyboard = TelegramButton[][]

async function callTelegram(method: string, payload: Record<string, unknown>): Promise<Response> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error("Telegram Bot API configuration is incomplete")

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  return response
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
}

/**
 * Calls a Telegram method with an HTML text payload. If Telegram rejects the markup
 * (400), resends the message as plain text so the user still gets it.
 */
async function callTelegramHtml(method: string, payload: { text: string } & Record<string, unknown>): Promise<void> {
  let response = await callTelegram(method, { ...payload, parse_mode: "HTML" })
  if (response.status === 400) {
    response = await callTelegram(method, { ...payload, text: stripHtml(payload.text) })
  }
  if (!response.ok) throw new Error(`Telegram ${method} failed (${response.status})`)
}

/** Escapes text for use inside a Telegram HTML message. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

/**
 * Sends a message in Telegram's HTML subset (b, i, code, pre, a). Every bot message is
 * HTML, so callers must escapeHtml() any user-controlled text they interpolate.
 */
export async function sendTelegramText(
  chatId: string,
  body: string,
  keyboard?: TelegramKeyboard
): Promise<void> {
  await callTelegramHtml("sendMessage", {
    chat_id: chatId,
    text: body.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  })
}

/** Replaces the text and buttons of a message the bot previously sent. */
export async function editTelegramText(
  chatId: string,
  messageId: number,
  body: string,
  keyboard?: TelegramKeyboard
): Promise<void> {
  await callTelegramHtml("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: body.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  })
}

/** Stops the button's loading spinner; optional toast text shown to the user. */
export async function answerTelegramCallback(callbackId: string, text?: string): Promise<void> {
  const response = await callTelegram("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) })
  if (!response.ok) throw new Error(`Telegram answerCallbackQuery failed (${response.status})`)
}
