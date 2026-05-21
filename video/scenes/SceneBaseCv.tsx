import { UploadCloud } from "lucide-react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AppFrame } from "../components/AppFrame";
import { CaptionBar } from "../components/CaptionBar";
import { DocumentPanel } from "../components/DocumentPanel";
import { baseCv, captions } from "../data";
import { fadeUp, stagger } from "../timing";
import { theme } from "../theme";

export const SceneBaseCv = () => {
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
      <AppFrame active="My CV" kicker="Library" title="My CV">
        <div
          style={{
            display: "grid",
            gap: 28,
            gridTemplateColumns: "440px minmax(0, 1fr)",
            height: "100%",
            minWidth: 0,
          }}
        >
          <div
            style={{
              ...fadeUp(frame, 0, Math.round(0.7 * fps)),
              backgroundColor: theme.color.white,
              border: `1px solid ${theme.color.border}`,
              display: "grid",
              gap: 28,
              gridTemplateRows: "auto auto 1fr",
              padding: 30,
            }}
          >
            <div
              style={{
                alignItems: "center",
                backgroundColor: "rgba(107,45,60,0.08)",
                color: theme.color.accent,
                display: "flex",
                height: 86,
                justifyContent: "center",
                width: 86,
              }}
            >
              <UploadCloud size={42} strokeWidth={1.8} />
            </div>
            <div>
              <div
                style={{
                  color: theme.color.mutedForeground,
                  fontSize: 24,
                  fontWeight: 750,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                }}
              >
                Base CV
              </div>
              <h2
                style={{
                  fontFamily: theme.font.heading,
                  fontSize: 44,
                  fontWeight: 400,
                  lineHeight: 1.06,
                  margin: "12px 0 0",
                }}
              >
                {baseCv.name}
              </h2>
            </div>
            <div style={{ display: "grid", gap: 16, alignSelf: "end" }}>
              <div
                style={{
                  border: `1px solid ${theme.color.border}`,
                  fontSize: 28,
                  fontWeight: 700,
                  padding: "20px 22px",
                }}
              >
                {baseCv.status}
              </div>
              <div
                style={{
                  color: theme.color.mutedForeground,
                  fontSize: 24,
                  lineHeight: 1.35,
                }}
              >
                {baseCv.updated}
              </div>
            </div>
          </div>

          <div style={stagger(frame, 1, fps)}>
            <DocumentPanel
              title={baseCv.name}
              subtitle={`${baseCv.status} / ${baseCv.updated}`}
              sections={[
                {
                  heading: "Profile",
                  bullets: [
                    "Platform-minded software engineer focused on practical automation.",
                    "Turns repeated operational work into reliable internal tooling.",
                  ],
                },
                {
                  heading: "Reusable source material",
                  bullets: [
                    "Backend projects, platform tooling, automation, and databases.",
                    "JobClock keeps the base document intact before tailoring begins.",
                  ],
                },
              ]}
              items={baseCv.sections}
            />
          </div>
        </div>
      </AppFrame>
      <CaptionBar text={captions.baseCv} />
    </AbsoluteFill>
  );
};
