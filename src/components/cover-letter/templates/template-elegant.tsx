import type { CoverLetterRenderData } from "@/lib/supabase/database.types"

export function CoverLetterElegant({ data }: { data: CoverLetterRenderData }) {
  const contactItems = [data.sender.email, data.sender.phone, data.sender.location].filter(
    Boolean,
  ) as string[]
  const linkItems = [data.sender.linkedin, data.sender.website].filter(Boolean) as string[]

  const hasHeader = Boolean(data.sender.name || contactItems.length > 0 || linkItems.length > 0)
  const hasRecipientBlock = Boolean(data.recipient.company || data.recipient.jobTitle)
  const hasBody = Boolean(data.content?.trim())

  return (
    <div
      style={{
        backgroundColor: "#ffffff",
        color: "#222",
        fontFamily: "'Georgia', 'Times New Roman', serif",
        padding: "52px 60px",
      }}
    >
      {hasHeader ? (
        <header style={{ marginBottom: "36px", textAlign: "center" }}>
          {data.sender.name ? (
            <h1
              style={{
                margin: 0,
                fontSize: "21px",
                fontWeight: 400,
                letterSpacing: "3px",
                textTransform: "uppercase",
                color: "#1a1a1a",
                textAlign: "center",
              }}
            >
              {data.sender.name}
            </h1>
          ) : null}

          <div
            style={{
              borderTop: "0.5px solid #999",
              width: "60px",
              margin: "12px auto 12px auto",
            }}
          />

          {contactItems.length > 0 ? (
            <p
              style={{
                margin: 0,
                fontSize: "11.5px",
                color: "#666",
                textAlign: "center",
              }}
            >
              {contactItems.join(" | ")}
            </p>
          ) : null}

          {linkItems.length > 0 ? (
            <p
              style={{
                margin: contactItems.length > 0 ? "6px 0 0 0" : 0,
                fontSize: "11.5px",
                color: "#666",
                textAlign: "center",
              }}
            >
              {linkItems.join(" | ")}
            </p>
          ) : null}
        </header>
      ) : null}

      {data.date ? (
        <p
          style={{
            margin: "0 0 28px 0",
            fontSize: "12px",
            color: "#888",
            fontStyle: "italic",
            textAlign: "center",
          }}
        >
          {data.date}
        </p>
      ) : null}

      {hasRecipientBlock ? (
        <section style={{ marginBottom: "20px", textAlign: "left" }}>
          {data.recipient.company ? (
            <p style={{ margin: 0, fontSize: "13px", color: "#444" }}>{data.recipient.company}</p>
          ) : null}
          {data.recipient.jobTitle ? (
            <p
              style={{
                margin: data.recipient.company ? "6px 0 0 0" : 0,
                fontSize: "12.5px",
                fontStyle: "italic",
                color: "#666",
              }}
            >
              Re: {data.recipient.jobTitle}
            </p>
          ) : null}
        </section>
      ) : null}

      <p style={{ margin: "0 0 18px 0", fontSize: "13.5px", color: "#1a1a1a" }}>
        Dear {data.recipient.name || "Hiring Manager"},
      </p>

      {hasBody ? (
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            lineHeight: 1.85,
            color: "#222",
            whiteSpace: "pre-wrap",
          }}
        >
          {data.content}
        </p>
      ) : null}

      {hasBody ? (
        <footer>
          <p
            style={{
              margin: "30px 0 0 0",
              fontSize: "13px",
              fontStyle: "italic",
              color: "#333",
            }}
          >
            With kind regards,
          </p>
          {data.sender.name ? (
            <p
              style={{
                margin: "22px 0 0 0",
                fontSize: "13.5px",
                fontWeight: 600,
                letterSpacing: "0.5px",
                color: "#1a1a1a",
              }}
            >
              {data.sender.name}
            </p>
          ) : null}
        </footer>
      ) : null}
    </div>
  )
}
