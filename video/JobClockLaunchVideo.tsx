import { AbsoluteFill } from "remotion";
import { theme } from "./theme";

export const JobClockLaunchVideo = () => {
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: theme.color.background,
        color: theme.color.foreground,
        display: "flex",
        fontFamily: theme.font.sans,
        justifyContent: "center",
        padding: 96,
      }}
    >
      <div
        style={{
          borderTop: `1px solid ${theme.color.border}`,
          maxWidth: 1160,
          paddingTop: 48,
          textAlign: "center",
          width: "100%",
        }}
      >
        <h1
          style={{
            color: theme.color.foreground,
            fontFamily: theme.font.heading,
            fontSize: 156,
            fontWeight: 400,
            letterSpacing: 0,
            lineHeight: 0.92,
            margin: 0,
          }}
        >
          JobClock
        </h1>
        <p
          style={{
            color: theme.color.mutedForeground,
            fontSize: 38,
            lineHeight: 1.28,
            margin: "36px 0 0",
          }}
        >
          A full workflow for serious job applications.
        </p>
      </div>
    </AbsoluteFill>
  );
};
