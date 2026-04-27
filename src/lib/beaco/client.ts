const BEACO_API_URL = process.env.BEACO_API_URL ?? "https://beaco.michaelogunjimi.com"
const BEACO_API_KEY = process.env.BEACO_API_KEY ?? ""

interface BeacoRecipient {
  channels: ("email" | "sms" | "webhook")[]
  email?: string
  user_id?: string
}

interface BeacoEventPayload {
  event_type: string
  template_id?: string
  recipients: BeacoRecipient[]
  payload: Record<string, string>
  idempotency_key?: string
}

interface BeacoBatchPayload {
  events: BeacoEventPayload[]
}

export async function sendBeacoEvent(event: BeacoEventPayload): Promise<void> {
  if (!BEACO_API_KEY) return
  const res = await fetch(`${BEACO_API_URL}/api/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": BEACO_API_KEY },
    body: JSON.stringify(event),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Beaco event failed (${res.status}): ${text}`)
  }
}

export async function sendBeacoEventBatch(events: BeacoEventPayload[]): Promise<void> {
  if (!BEACO_API_KEY || events.length === 0) return
  const batches: BeacoEventPayload[][] = []
  for (let i = 0; i < events.length; i += 50) batches.push(events.slice(i, i + 50))

  for (const batch of batches) {
    const payload: BeacoBatchPayload = { events: batch }
    const res = await fetch(`${BEACO_API_URL}/api/v1/events/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": BEACO_API_KEY },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Beaco batch failed (${res.status}): ${text}`)
    }
  }
}
