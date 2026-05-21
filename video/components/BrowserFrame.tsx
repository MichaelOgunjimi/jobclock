import type { ReactNode } from "react";
import { BriefcaseBusiness, ExternalLink, MapPin } from "lucide-react";
import { role as sharedRole } from "../data";
import { theme } from "../theme";

type BrowserRole = {
  title: string;
  company: string;
  location: string;
  source?: string;
  salary?: string;
};

type BrowserFrameProps = {
  role?: BrowserRole;
  url?: string;
  extensionPanel?: ReactNode;
};

export const BrowserFrame = ({
  role = sharedRole,
  url = "https://careers.northstarlabs.example/platform-tools",
  extensionPanel,
}: BrowserFrameProps) => {
  return (
    <div
      style={{
        backgroundColor: theme.color.white,
        border: `1px solid ${theme.color.border}`,
        boxShadow: theme.shadow,
        color: theme.color.foreground,
        fontFamily: theme.font.sans,
        overflow: "hidden",
        width: 1540,
      }}
    >
      <div
        style={{
          alignItems: "center",
          backgroundColor: theme.color.muted,
          borderBottom: `1px solid ${theme.color.border}`,
          display: "flex",
          gap: 18,
          height: 70,
          padding: "0 22px",
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {["#ff5f57", "#ffbd2e", "#28c840"].map((color) => (
            <div
              key={color}
              style={{
                backgroundColor: color,
                borderRadius: 999,
                height: 13,
                width: 13,
              }}
            />
          ))}
        </div>
        <div
          style={{
            alignItems: "center",
            backgroundColor: theme.color.white,
            border: `1px solid ${theme.color.border}`,
            color: theme.color.mutedForeground,
            display: "flex",
            flex: 1,
            fontFamily: theme.font.mono,
            fontSize: 18,
            gap: 12,
            height: 40,
            padding: "0 18px",
          }}
        >
          <ExternalLink size={18} strokeWidth={1.7} />
          <span>{url}</span>
        </div>
      </div>

      <div
        style={{
          backgroundColor: "#f7f7f7",
          display: "grid",
          gap: 26,
          gridTemplateColumns: extensionPanel ? "1fr 430px" : "1fr",
          minHeight: 760,
          padding: 36,
        }}
      >
        <article
          style={{
            backgroundColor: theme.color.white,
            border: `1px solid ${theme.color.border}`,
            display: "grid",
            gap: 28,
            gridTemplateRows: "auto 1fr",
            padding: 42,
          }}
        >
          <div
            style={{
              borderBottom: `1px solid ${theme.color.border}`,
              paddingBottom: 30,
            }}
          >
            <div
              style={{
                alignItems: "center",
                color: theme.color.mutedForeground,
                display: "flex",
                fontSize: 18,
                gap: 10,
              }}
            >
              <BriefcaseBusiness size={20} strokeWidth={1.8} />
              {role.company}
            </div>
            <h2
              style={{
                fontFamily: theme.font.heading,
                fontSize: 62,
                fontWeight: 400,
                lineHeight: 1.02,
                margin: "18px 0",
                maxWidth: 920,
              }}
            >
              {role.title}
            </h2>
            <div
              style={{
                alignItems: "center",
                color: theme.color.mutedForeground,
                display: "flex",
                fontSize: 22,
                gap: 18,
              }}
            >
              <span style={{ alignItems: "center", display: "flex", gap: 8 }}>
                <MapPin size={20} strokeWidth={1.8} />
                {role.location}
              </span>
              {role.salary ? <span>{role.salary}</span> : null}
              {role.source ? <span>{role.source}</span> : null}
            </div>
          </div>

          <div
            style={{
              color: theme.color.foreground,
              display: "grid",
              gap: 22,
              maxWidth: 1040,
            }}
          >
            {[
              "Build internal tools that help engineering teams ship platform work with less operational drag.",
              "Partner with product and infrastructure teams to improve developer workflows, reporting, and reliability.",
              "Use TypeScript, React, Postgres, and pragmatic automation to turn repeated manual steps into durable systems.",
            ].map((copy) => (
              <p
                key={copy}
                style={{
                  color: theme.color.foreground,
                  fontSize: 26,
                  lineHeight: 1.42,
                  margin: 0,
                }}
              >
                {copy}
              </p>
            ))}
          </div>
        </article>

        {extensionPanel ? (
          <div
            style={{
              alignSelf: "start",
              backgroundColor: theme.color.white,
              border: `1px solid ${theme.color.border}`,
              boxShadow: "0 22px 58px rgba(10,10,10,0.12)",
            }}
          >
            {extensionPanel}
          </div>
        ) : null}
      </div>
    </div>
  );
};
