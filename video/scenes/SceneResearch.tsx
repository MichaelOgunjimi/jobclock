import { Building2, Search } from "lucide-react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AppFrame } from "../components/AppFrame";
import { CaptionBar } from "../components/CaptionBar";
import { Tabs } from "../components/Tabs";
import { captions, researchFindings, role } from "../data";
import { stagger } from "../timing";
import { theme } from "../theme";

export const SceneResearch = () => {
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
        kicker={`${role.company} / ${role.source}`}
        title={role.title}
      >
        <div
          style={{
            backgroundColor: theme.color.white,
            border: `1px solid ${theme.color.border}`,
            display: "grid",
            gap: 22,
            height: "100%",
            padding: 28,
          }}
        >
          <Tabs
            active="research"
            tabs={[
              { value: "overview", label: "Overview" },
              {
                value: "research",
                label: "Company Research",
                icon: <Building2 size={22} strokeWidth={1.8} />,
              },
              { value: "tailoring", label: "CV Tailoring" },
            ]}
          />
          <div style={{ display: "grid", gap: 22, gridTemplateColumns: "1fr 420px" }}>
            <div>
              <div
                style={{
                  ...stagger(frame, 0, fps),
                  border: `1px solid ${theme.color.border}`,
                  display: "grid",
                  gap: 20,
                  padding: 30,
                }}
              >
                <Search color={theme.color.accent} size={40} strokeWidth={1.8} />
                <h2
                  style={{
                    fontFamily: theme.font.heading,
                    fontSize: 52,
                    fontWeight: 400,
                    lineHeight: 1.04,
                    margin: 0,
                  }}
                >
                  Company Research
                </h2>
                <p
                  style={{
                    color: theme.color.mutedForeground,
                    fontSize: 26,
                    lineHeight: 1.34,
                    margin: 0,
                  }}
                >
                  JobClock turns the saved listing into structured talking points
                  for {role.company}.
                </p>
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {researchFindings.map((finding, index) => (
                <div
                  key={finding}
                  style={{
                    ...stagger(frame, index + 1, fps),
                    border: `1px solid ${theme.color.border}`,
                    display: "grid",
                    gap: 8,
                    padding: "14px 18px",
                  }}
                >
                  <span
                    style={{
                      color: theme.color.accent,
                      fontFamily: theme.font.mono,
                      fontSize: 24,
                      fontWeight: 800,
                    }}
                  >
                    0{index + 1}
                  </span>
                  <span style={{ fontSize: 25, fontWeight: 750, lineHeight: 1.22 }}>
                    {finding}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppFrame>
      <CaptionBar text={captions.research} />
    </AbsoluteFill>
  );
};
