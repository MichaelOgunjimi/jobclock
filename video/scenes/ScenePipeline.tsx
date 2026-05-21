import { CalendarCheck, Send } from "lucide-react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AppFrame } from "../components/AppFrame";
import { CaptionBar } from "../components/CaptionBar";
import { PipelineStepper } from "../components/PipelineStepper";
import { captions, role } from "../data";
import { seconds, stagger } from "../timing";
import { theme } from "../theme";

export const ScenePipeline = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const progress = interpolate(frame, [seconds(0.7, fps), seconds(4.2, fps)], [0, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

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
      <AppFrame active="Applications" kicker="Pipeline" title="Application Tracker">
        <div
          style={{
            display: "grid",
            gap: 28,
            gridTemplateRows: "auto 1fr",
            height: "100%",
          }}
        >
          <div style={stagger(frame, 0, fps)}>
            <PipelineStepper progress={progress} />
          </div>
          <div
            style={{
              display: "grid",
              gap: 26,
              gridTemplateColumns: "minmax(0, 1fr) 430px",
            }}
          >
            <div
              style={{
                ...stagger(frame, 1, fps),
                backgroundColor: theme.color.white,
                border: `1px solid ${theme.color.border}`,
                display: "grid",
                gap: 22,
                padding: 34,
              }}
            >
              <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
                <Send color={theme.color.accent} size={34} strokeWidth={1.8} />
                <span style={{ fontSize: 30, fontWeight: 800 }}>
                  Saved to applied
                </span>
              </div>
              <h2
                style={{
                  fontFamily: theme.font.heading,
                  fontSize: 54,
                  fontWeight: 400,
                  lineHeight: 1.04,
                  margin: 0,
                }}
              >
                {role.title}
              </h2>
              <p
                style={{
                  color: theme.color.mutedForeground,
                  fontSize: 28,
                  lineHeight: 1.34,
                  margin: 0,
                }}
              >
                JobClock keeps the source, tailored CV, research, and prep attached
                to the same application.
              </p>
            </div>
            <div
              style={{
                ...stagger(frame, 2, fps),
                backgroundColor: theme.color.white,
                border: `1px solid ${theme.color.border}`,
                display: "grid",
                gap: 18,
                padding: 30,
              }}
            >
              <CalendarCheck color={theme.color.accent} size={36} strokeWidth={1.8} />
              {[
                ["Company", role.company],
                ["Status", "Applied"],
                ["Source", role.source],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    border: `1px solid ${theme.color.border}`,
                    display: "grid",
                    gap: 6,
                    padding: "16px 18px",
                  }}
                >
                  <span
                    style={{
                      color: theme.color.mutedForeground,
                      fontSize: 24,
                      fontWeight: 750,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontSize: 28, fontWeight: 800 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppFrame>
      <CaptionBar text={captions.pipeline} />
    </AbsoluteFill>
  );
};
