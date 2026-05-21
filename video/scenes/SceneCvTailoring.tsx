import { FileText } from "lucide-react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AppFrame } from "../components/AppFrame";
import { CaptionBar } from "../components/CaptionBar";
import { GenerationProgress } from "../components/GenerationProgress";
import { captions, role, tailoredBullets, tailoringSteps } from "../data";
import { seconds, stagger } from "../timing";
import { theme } from "../theme";

export const SceneCvTailoring = () => {
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
      <AppFrame active="Applications" kicker={role.company} title="CV Tailoring">
        <div
          style={{
            display: "grid",
            gap: 28,
            gridTemplateColumns: "520px minmax(0, 1fr)",
            height: "100%",
          }}
        >
          <div style={stagger(frame, 0, fps)}>
            <GenerationProgress
              rows={tailoringSteps}
              rowDurationFrames={seconds(1.55, fps)}
              startFrame={seconds(0.55, fps)}
            />
          </div>
          <div
            style={{
              ...stagger(frame, 1, fps),
              backgroundColor: theme.color.white,
              border: `1px solid ${theme.color.border}`,
              display: "grid",
              gap: 24,
              gridTemplateRows: "auto auto 1fr",
              padding: 34,
            }}
          >
            <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
              <FileText color={theme.color.accent} size={36} strokeWidth={1.8} />
              <span style={{ fontSize: 30, fontWeight: 800 }}>
                Tailored bullet preview
              </span>
            </div>
            <div
              style={{
                color: theme.color.mutedForeground,
                fontSize: 26,
                lineHeight: 1.34,
              }}
            >
              Matched to {role.title} at {role.company}
            </div>
            <div style={{ display: "grid", gap: 18, alignContent: "start" }}>
              {tailoredBullets.map((bullet, index) => (
                <div
                  key={bullet}
                  style={{
                    ...stagger(frame, index + 2, fps, 1.2),
                    border: `1px solid ${theme.color.border}`,
                    fontSize: 28,
                    fontWeight: 650,
                    lineHeight: 1.34,
                    padding: "22px 24px",
                  }}
                >
                  {bullet}
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppFrame>
      <CaptionBar text={captions.cvTailoring} />
    </AbsoluteFill>
  );
};
