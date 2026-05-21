import { LockKeyhole } from "lucide-react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { CaptionBar } from "../components/CaptionBar";
import { captions } from "../data";
import { fadeUp, seconds } from "../timing";
import { theme } from "../theme";

export const SceneEndCard = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: theme.color.foreground,
        color: theme.color.white,
        display: "flex",
        fontFamily: theme.font.sans,
        justifyContent: "center",
        padding: "80px 96px 150px",
      }}
    >
      <div
        style={{
          ...fadeUp(frame, 0, seconds(0.8, fps)),
          alignItems: "center",
          display: "flex",
          flexDirection: "column",
          gap: 28,
          textAlign: "center",
        }}
      >
        <div
          style={{
            alignItems: "center",
            backgroundColor: theme.color.white,
            color: theme.color.foreground,
            display: "flex",
            height: 84,
            justifyContent: "center",
            width: 84,
          }}
        >
          <LockKeyhole size={42} strokeWidth={1.8} />
        </div>
        <h1
          style={{
            fontFamily: theme.font.heading,
            fontSize: 104,
            fontWeight: 400,
            lineHeight: 1,
            margin: 0,
          }}
        >
          JobClock
        </h1>
        <p
          style={{
            fontSize: 40,
            fontWeight: 750,
            lineHeight: 1.22,
            margin: 0,
            maxWidth: 980,
          }}
        >
          {captions.endCard}
        </p>
        <p
          style={{
            color: "rgba(255,255,255,0.72)",
            fontSize: 30,
            fontWeight: 700,
            margin: "10px 0 0",
          }}
        >
          Built by Michael Ogunjimi
        </p>
      </div>
      <CaptionBar text={captions.endCard} />
    </AbsoluteFill>
  );
};
