export async function sendTelegramText(chatId: string, body: string): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) throw new Error("Telegram Bot API configuration is incomplete")

  const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: body.slice(0, 4096),
    }),
  })

  if (!response.ok) throw new Error(`Telegram send failed (${response.status})`)
}
