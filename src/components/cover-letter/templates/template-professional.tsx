import type { CoverLetterRenderData } from "@/lib/supabase/database.types"

export function CoverLetterProfessional({ data }: { data: CoverLetterRenderData }) {
  const hasRecipientInfo = Boolean(data.recipient.name || data.recipient.company || data.recipient.jobTitle)

  const contactParts: string[] = []
  if (data.sender.location) contactParts.push(data.sender.location)
  if (data.sender.phone) contactParts.push(`P: ${data.sender.phone}`)
  if (data.sender.email) contactParts.push(data.sender.email)

  const profileLinks = [data.sender.linkedin, data.sender.website].filter(Boolean).join(" | ")

  return (
    <div
      style={{
        fontFamily: 'Georgia, "Times New Roman", serif',
        background: "white",
        padding: "48px 56px",
        color: "#1a1a1a",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 26 }}>
        {data.sender.name && (
          <div
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "#1a1a1a",
              paddingBottom: 6,
              borderBottom: "1px solid #1a1a1a",
              display: "inline-block",
              minWidth: "62%",
              marginBottom: 8,
            }}
          >
            {data.sender.name}
          </div>
        )}

        {contactParts.length > 0 && (
          <div style={{ fontSize: 11, color: "#444", lineHeight: 1.5 }}>{contactParts.join(" | ")}</div>
        )}

        {profileLinks && <div style={{ fontSize: 11, color: "#444", lineHeight: 1.5 }}>{profileLinks}</div>}
      </div>

      {data.date && (
        <div style={{ fontSize: 11, color: "#1a1a1a", marginBottom: 20 }}>
          {data.date}
        </div>
      )}

      {hasRecipientInfo && (
        <div style={{ marginBottom: 18 }}>
          {data.recipient.company && (
            <div style={{ fontSize: 11, color: "#444", marginBottom: 4 }}>
              {data.recipient.company}
            </div>
          )}
          {data.recipient.jobTitle && (
            <div style={{ fontSize: 11, fontStyle: "italic", color: "#444", marginBottom: 8 }}>
              Re: {data.recipient.jobTitle}
            </div>
          )}
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a" }}>
            Dear {data.recipient.name || "Hiring Manager"},
          </div>
        </div>
      )}

      {data.content && (
        <div style={{ fontSize: 12, lineHeight: 1.75, color: "#1a1a1a", whiteSpace: "pre-wrap" }}>
          {data.content}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 12, color: "#1a1a1a" }}>Yours sincerely,</div>
        {data.sender.name && (
          <div style={{ fontSize: 12, fontWeight: 700, color: "#1a1a1a", marginTop: 24 }}>
            {data.sender.name}
          </div>
        )}
      </div>
    </div>
  )
}
