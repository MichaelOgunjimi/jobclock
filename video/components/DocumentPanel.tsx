import { FileText } from "lucide-react";
import { theme } from "../theme";

type DocumentSection = {
  heading: string;
  bullets: string[];
};

type DocumentPanelProps = {
  title: string;
  subtitle?: string;
  sections: DocumentSection[];
  items?: string[];
};

export const DocumentPanel = ({
  title,
  subtitle,
  sections,
  items = [],
}: DocumentPanelProps) => {
  return (
    <div
      style={{
        backgroundColor: theme.color.white,
        border: `1px solid ${theme.color.border}`,
        display: "grid",
        gap: 28,
        gridTemplateColumns: "minmax(0, 1fr) 280px",
        minHeight: 620,
        padding: 24,
      }}
    >
      <div
        style={{
          backgroundColor: "#fbfbfb",
          border: `1px solid ${theme.color.border}`,
          display: "flex",
          justifyContent: "center",
          padding: "28px 24px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            backgroundColor: theme.color.white,
            border: `1px solid ${theme.color.border}`,
            boxShadow: "0 18px 48px rgba(10,10,10,0.08)",
            minHeight: 520,
            padding: "38px 42px",
            width: "100%",
          }}
        >
          <h2
            style={{
              fontFamily: theme.font.heading,
              fontSize: 34,
              fontWeight: 400,
              lineHeight: 1.06,
              margin: 0,
            }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p
              style={{
                color: theme.color.mutedForeground,
                fontSize: 14,
                lineHeight: 1.45,
                margin: "10px 0 28px",
              }}
            >
              {subtitle}
            </p>
          ) : null}
          <div style={{ display: "grid", gap: 22 }}>
            {sections.map((section) => (
              <section key={section.heading}>
                <h3
                  style={{
                    borderBottom: `1px solid ${theme.color.border}`,
                    fontSize: 13,
                    fontWeight: 750,
                    letterSpacing: 1.3,
                    margin: "0 0 12px",
                    paddingBottom: 8,
                    textTransform: "uppercase",
                  }}
                >
                  {section.heading}
                </h3>
                <div style={{ display: "grid", gap: 8 }}>
                  {section.bullets.map((bullet) => (
                    <p
                      key={bullet}
                      style={{
                        color: theme.color.foreground,
                        fontSize: 14,
                        lineHeight: 1.45,
                        margin: 0,
                      }}
                    >
                      {bullet}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>
      </div>

      <aside
        style={{
          borderLeft: `1px solid ${theme.color.border}`,
          display: "flex",
          flexDirection: "column",
          gap: 22,
          minWidth: 0,
          padding: "8px 0 8px 24px",
        }}
      >
        <div
          style={{
            alignItems: "center",
            backgroundColor: theme.color.muted,
            display: "flex",
            height: 58,
            justifyContent: "center",
            width: 58,
          }}
        >
          <FileText color={theme.color.accent} size={28} strokeWidth={1.8} />
        </div>
        <div>
          <p
            style={{
              color: theme.color.mutedForeground,
              fontSize: 13,
              fontWeight: 750,
              letterSpacing: 1.6,
              margin: "0 0 8px",
              textTransform: "uppercase",
            }}
          >
            Document summary
          </p>
          <h3
            style={{
              fontFamily: theme.font.heading,
              fontSize: 28,
              fontWeight: 400,
              lineHeight: 1.08,
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>
        <div style={{ display: "grid", gap: 12 }}>
          {items.map((item) => (
            <div
              key={item}
              style={{
                border: `1px solid ${theme.color.border}`,
                color: theme.color.foreground,
                fontSize: 17,
                fontWeight: 600,
                lineHeight: 1.35,
                padding: "14px 16px",
              }}
            >
              {item}
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
};
