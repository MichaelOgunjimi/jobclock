import type { CoverLetterRenderData } from "@/lib/supabase/database.types"

export function CoverLetterClassic({ data }: { data: CoverLetterRenderData }) {
  const hasRecipientInfo = Boolean(data.recipient.name || data.recipient.company || data.recipient.jobTitle)

  return (
    <div
      style={{
        fontFamily: "Georgia, serif",
        background: "white",
        padding: "48px 56px",
        color: "#1a1a1a",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 28 }}>
        {data.sender.name && (
          <div style={{ fontSize: 19, fontWeight: 700, color: "#1a1a1a", marginBottom: 8 }}>
            {data.sender.name}
          </div>
        )}

        {data.sender.email && (
          <div style={{ fontSize: 12.5, color: "#444", lineHeight: 1.5 }}>{data.sender.email}</div>
        )}
        {data.sender.phone && (
          <div style={{ fontSize: 12.5, color: "#444", lineHeight: 1.5 }}>{data.sender.phone}</div>
        )}
        {data.sender.location && (
          <div style={{ fontSize: 12.5, color: "#444", lineHeight: 1.5 }}>{data.sender.location}</div>
        )}

        {data.sender.linkedin && (
          <div style={{ fontSize: 12, color: "#444", lineHeight: 1.5 }}>{data.sender.linkedin}</div>
        )}
        {data.sender.website && (
          <div style={{ fontSize: 12, color: "#444", lineHeight: 1.5 }}>{data.sender.website}</div>
        )}
      </div>

      {data.date && (
        <div style={{ fontSize: 13, color: "#333", marginBottom: 24 }}>
          {data.date}
        </div>
      )}

      {hasRecipientInfo && (
        <div style={{ marginBottom: 20 }}>
          {data.recipient.company && (
            <div style={{ fontSize: 13, color: "#444", marginBottom: 4 }}>
              {data.recipient.company}
            </div>
          )}

          {data.recipient.jobTitle && (
            <div style={{ fontSize: 13, fontStyle: "italic", color: "#555", marginBottom: 6 }}>
              Re: {data.recipient.jobTitle}
            </div>
          )}

          <div style={{ fontSize: 13.5, color: "#1a1a1a" }}>
            Dear {data.recipient.name || "Hiring Manager"},
          </div>
        </div>
      )}

      {data.content && (
        <div style={{ fontSize: 13.5, lineHeight: 1.8, color: "#1a1a1a", whiteSpace: "pre-wrap" }}>
          {data.content}
        </div>
      )}

      <div style={{ marginTop: 28 }}>
        <div style={{ fontSize: 13.5, color: "#1a1a1a" }}>Yours sincerely,</div>
        {data.sender.name && (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "#1a1a1a", marginTop: 24 }}>
            {data.sender.name}
          </div>
        )}
      </div>
    </div>
  )
}
