import { CheckCircle2, FileText, Send } from "lucide-react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AppFrame } from "../components/AppFrame";
import { CaptionBar } from "../components/CaptionBar";
import { captions, role, baseCv } from "../data";
import { stagger } from "../timing";
import { theme } from "../theme";

export const SceneApplicationWorkspace = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: theme.color.background,
        color: theme.color.foreground,
        display: "flex",
        fontFamily: theme.font.sans,
        justifyContent: "center",
        padding: "70px 96px 150px",
      }}
    >
      <AppFrame
        active="Applications"
        kicker={`${role.company} / ${role.location}`}
        title={role.title}
      >
        <div
          style={{
            display: "grid",
            gap: 26,
            gridTemplateColumns: "minmax(0, 1fr) 430px",
            height: "100%",
          }}
        >
          <div
            style={{
              ...stagger(frame, 0, fps),
              backgroundColor: theme.color.white,
              border: `1px solid ${theme.color.border}`,
              display: "grid",
              gap: 24,
              gridTemplateRows: "auto auto 1fr",
              padding: 34,
            }}
          >
            <div
              style={{
                color: theme.color.mutedForeground,
                fontSize: 24,
                fontWeight: 750,
                textTransform: "uppercase",
              }}
            >
              Saved application
            </div>
            <h2
              style={{
                fontFamily: theme.font.heading,
                fontSize: 56,
                fontWeight: 400,
                lineHeight: 1.04,
                margin: 0,
              }}
            >
              {role.title}
            </h2>
            <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
              {[
                ["Company", role.company],
                ["Source", role.source],
                ["Location", role.location],
                ["Salary", role.salary],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    borderBottom: `1px solid ${theme.color.border}`,
                    display: "grid",
                    gap: 8,
                    gridTemplateColumns: "180px 1fr",
                    paddingBottom: 18,
                  }}
                >
                  <span
                    style={{
                      color: theme.color.mutedForeground,
                      fontSize: 24,
                      fontWeight: 700,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontSize: 28, fontWeight: 750 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gap: 24, gridTemplateRows: "auto 1fr" }}>
            <div
              style={{
                ...stagger(frame, 1, fps),
                backgroundColor: theme.color.white,
                border: `1px solid ${theme.color.border}`,
                display: "grid",
                gap: 18,
                padding: 28,
              }}
            >
              <FileText color={theme.color.accent} size={34} strokeWidth={1.8} />
              <div
                style={{
                  color: theme.color.mutedForeground,
                  fontSize: 24,
                  fontWeight: 750,
                }}
              >
                Selected CV
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.18 }}>
                {baseCv.name}
              </div>
            </div>
            <div
              style={{
                ...stagger(frame, 2, fps),
                backgroundColor: theme.color.white,
                border: `1px solid ${theme.color.border}`,
                display: "grid",
                gap: 18,
                padding: 28,
              }}
            >
              <div
                style={{ alignItems: "center", display: "flex", gap: 12 }}
              >
                <Send color={theme.color.accent} size={32} strokeWidth={1.8} />
                <span style={{ fontSize: 30, fontWeight: 800 }}>Next actions</span>
              </div>
              {["Research company", "Tailor CV", "Prepare interview stories"].map(
                (action) => (
                  <div
                    key={action}
                    style={{
                      alignItems: "center",
                      border: `1px solid ${theme.color.border}`,
                      display: "flex",
                      fontSize: 26,
                      fontWeight: 700,
                      gap: 12,
                      padding: "16px 18px",
                    }}
                  >
                    <CheckCircle2 color={theme.color.accent} size={28} />
                    {action}
                  </div>
                ),
              )}
            </div>
          </div>
        </div>
      </AppFrame>
      <CaptionBar text={captions.applicationWorkspace} />
    </AbsoluteFill>
  );
};
