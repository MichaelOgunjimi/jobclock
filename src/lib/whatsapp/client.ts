export async function sendWhatsAppText(to: string, body: string): Promise<void> {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  const apiVersion = process.env.WHATSAPP_GRAPH_API_VERSION
  if (!accessToken || !phoneNumberId || !apiVersion) {
    throw new Error("WhatsApp Cloud API configuration is incomplete")
  }

  const response = await fetch(
    `https://graph.facebook.com/${encodeURIComponent(apiVersion)}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { preview_url: true, body: body.slice(0, 4096) },
      }),
    }
  )

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`WhatsApp send failed (${response.status}): ${detail}`)
  }
}

