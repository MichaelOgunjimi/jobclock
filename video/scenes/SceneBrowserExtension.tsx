import { Check, LockKeyhole } from "lucide-react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrowserFrame } from "../components/BrowserFrame";
import { CaptionBar } from "../components/CaptionBar";
import { captions, role } from "../data";
import { fadeUp, seconds } from "../timing";
import { theme } from "../theme";

export const SceneBrowserExtension = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const saved = interpolate(frame, [seconds(4.4, fps), seconds(5.1, fps)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        backgroundColor: theme.color.background,
        display: "flex",
        fontFamily: theme.font.sans,
        justifyContent: "center",
        padding: "64px 86px 150px",
      }}
    >
      <div style={fadeUp(frame, 0, seconds(0.7, fps))}>
        <BrowserFrame
          role={role}
          extensionPanel={
            <div style={{ display: "grid", gap: 24, padding: 28 }}>
              <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
                <div
                  style={{
                    alignItems: "center",
                    backgroundColor: theme.color.sidebar,
                    color: theme.color.white,
                    display: "flex",
                    height: 48,
                    justifyContent: "center",
                    width: 48,
                  }}
                >
                  <LockKeyhole size={23} strokeWidth={1.8} />
                </div>
                <div>
                  <div
                    style={{
                      color: theme.color.mutedForeground,
                      fontSize: 24,
                      fontWeight: 750,
                    }}
                  >
                    JobClock
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 750 }}>
                    Save this role
                  </div>
                </div>
              </div>
              {[
                ["Company", role.company],
                ["Role", role.title],
                ["Location", role.location],
                ["Source", role.source],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    border: `1px solid ${theme.color.border}`,
                    display: "grid",
                    gap: 8,
                    padding: "18px 20px",
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
                  <span style={{ fontSize: 26, fontWeight: 750, lineHeight: 1.22 }}>
                    {value}
                  </span>
                </div>
              ))}
              <div
                style={{
                  backgroundColor: theme.color.foreground,
                  color: theme.color.white,
                  fontSize: 28,
                  fontWeight: 800,
                  padding: "22px 24px",
                  textAlign: "center",
                }}
              >
                Save to JobClock
              </div>
              <div
                style={{
                  alignItems: "center",
                  color: theme.color.accent,
                  display: "flex",
                  fontSize: 26,
                  fontWeight: 750,
                  gap: 12,
                  opacity: saved,
                }}
              >
                <Check size={28} strokeWidth={2.4} />
                Saved to Applications
              </div>
            </div>
          }
        />
      </div>
      <CaptionBar text={captions.browserExtension} />
    </AbsoluteFill>
  );
};
