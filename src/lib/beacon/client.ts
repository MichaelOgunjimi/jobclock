const BEACON_API_URL = process.env.BEACON_API_URL ?? "https://beacon.michaelogunjimi.com"
const BEACON_API_KEY = process.env.BEACON_API_KEY ?? ""

interface BeaconRecipient {
  channels: ("email" | "sms" | "webhook")[]
  email?: string
  user_id?: string
}

interface BeaconEventPayload {
  event_type: string
  template_id?: string
  recipients: BeaconRecipient[]
  payload: Record<string, string>
  idempotency_key?: string
}

interface BeaconBatchPayload {
  events: BeaconEventPayload[]
}

export async function sendBeaconEvent(event: BeaconEventPayload): Promise<void> {
  if (!BEACON_API_KEY) return
  const res = await fetch(`${BEACON_API_URL}/api/v1/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key": BEACON_API_KEY },
    body: JSON.stringify(event),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Beacon event failed (${res.status}): ${text}`)
  }
}

export async function sendBeaconEventBatch(events: BeaconEventPayload[]): Promise<void> {
  if (!BEACON_API_KEY || events.length === 0) return
  const batches: BeaconEventPayload[][] = []
  for (let i = 0; i < events.length; i += 50) batches.push(events.slice(i, i + 50))

  for (const batch of batches) {
    const payload: BeaconBatchPayload = { events: batch }
    const res = await fetch(`${BEACON_API_URL}/api/v1/events/batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": BEACON_API_KEY },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Beacon batch failed (${res.status}): ${text}`)
    }
  }
}
