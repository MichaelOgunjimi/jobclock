import { useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { fadeUp, seconds } from "../timing";

type CaptionBarProps = {
  text: string;
  delaySeconds?: number;
};

export const CaptionBar = ({ text, delaySeconds = 0.2 }: CaptionBarProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <div
      style={{
        ...fadeUp(frame, seconds(delaySeconds, fps), seconds(0.55, fps)),
        bottom: 58,
        display: "flex",
        justifyContent: "center",
        left: 0,
        padding: "0 96px",
        position: "absolute",
        right: 0,
        zIndex: 20,
      }}
    >
      <div
        style={{
          backgroundColor: "rgba(10,10,10,0.86)",
          boxShadow: "0 24px 70px rgba(10,10,10,0.22)",
          color: theme.color.white,
          fontFamily: theme.font.sans,
          fontSize: 34,
          fontWeight: 650,
          lineHeight: 1.25,
          maxWidth: 1180,
          padding: "22px 34px",
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </div>
  );
};
