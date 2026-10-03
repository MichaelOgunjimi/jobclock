/** Telegram inline keyboard: rows of buttons that either call back or open a URL. */
export type TelegramButton = { text: string; callback_data: string } | { text: string; url: string }
export type TelegramKeyboard = TelegramButton[][]

async function callTelegram(method: string, payload: Record<string, unknown>): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error("Telegram Bot API configuration is incomplete")

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!response.ok) throw new Error(`Telegram ${method} failed (${response.status})`)
}

/** Escapes text for use inside a Telegram HTML message. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export async function sendTelegramText(
  chatId: string,
  body: string,
  keyboard?: TelegramKeyboard
): Promise<void> {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: body.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {}),
  })
}

/**
 * Sends a message formatted with Telegram's HTML subset (b, i, pre, a). Callers must
 * escapeHtml() any user-controlled text before interpolating it.
 */
export async function sendTelegramHtml(chatId: string, html: string): Promise<void> {
  await callTelegram("sendMessage", {
    chat_id: chatId,
    text: html.slice(0, 4096),
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
  })
}

/** Replaces the text and buttons of a message the bot previously sent. */
export async function editTelegramText(
  chatId: string,
  messageId: number,
  body: string,
  keyboard?: TelegramKeyboard
): Promise<void> {
  await callTelegram("editMessageText", {
    chat_id: chatId,
    message_id: messageId,
    text: body.slice(0, 4096),
    link_preview_options: { is_disabled: true },
    reply_markup: { inline_keyboard: keyboard ?? [] },
  })
}

/** Stops the button's loading spinner; optional toast text shown to the user. */
export async function answerTelegramCallback(callbackId: string, text?: string): Promise<void> {
  await callTelegram("answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) })
}
