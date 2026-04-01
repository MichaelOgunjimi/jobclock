import type { CoverLetterRenderData } from "@/lib/supabase/database.types"

export function CoverLetterModern({ data }: { data: CoverLetterRenderData }) {
  const contactParts: string[] = []
  if (data.sender.email) contactParts.push(data.sender.email)
  if (data.sender.phone) contactParts.push(data.sender.phone)
  if (data.sender.location) contactParts.push(data.sender.location)
  if (data.sender.linkedin) contactParts.push(data.sender.linkedin)
  if (data.sender.website) contactParts.push(data.sender.website)

  const hasHeaderContent = Boolean(data.sender.name) || contactParts.length > 0
  const hasDateRecipientSection =
    Boolean(data.date) || Boolean(data.recipient.company) || Boolean(data.recipient.jobTitle)

  return (
    <div
      style={{
        fontFamily: "'Arial', 'Helvetica Neue', sans-serif",
        background: "white",
        padding: "40px 48px",
        boxSizing: "border-box",
      }}
    >
      {hasHeaderContent && (
        <div style={{ marginBottom: 28 }}>
          {data.sender.name && (
            <div style={{ fontSize: 23, fontWeight: 700, color: "#1a1a1a" }}>{data.sender.name}</div>
          )}
          {contactParts.length > 0 && (
            <div style={{ fontSize: 11.5, color: "#666", marginTop: 4 }}>{contactParts.join(" · ")}</div>
          )}
          <div
            style={{
              borderBottom: "1.5px solid #1a1a1a",
              marginTop: 12,
            }}
          />
        </div>
      )}

      {hasDateRecipientSection && (
        <div style={{ marginBottom: 24 }}>
          {data.date && <div style={{ fontSize: 12, color: "#777" }}>{data.date}</div>}
          {data.recipient.company && (
            <div style={{ fontSize: 12.5, color: "#555", marginTop: 2 }}>To: {data.recipient.company}</div>
          )}
          {data.recipient.jobTitle && (
            <div style={{ fontSize: 12.5, color: "#555", marginTop: 2 }}>Re: {data.recipient.jobTitle}</div>
          )}
        </div>
      )}

      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", marginBottom: 16 }}>
        Dear {data.recipient.name || "Hiring Manager"},
      </div>

      {data.content && (
        <div style={{ whiteSpace: "pre-wrap", fontSize: 13, lineHeight: 1.75, color: "#333" }}>
          {data.content}
        </div>
      )}

      <div style={{ fontSize: 13, color: "#1a1a1a", marginTop: 24 }}>Kind regards,</div>
      {data.sender.name && (
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginTop: 20 }}>
          {data.sender.name}
        </div>
      )}
    </div>
  )
}
