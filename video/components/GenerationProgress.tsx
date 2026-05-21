import { Check, LoaderCircle } from "lucide-react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { seconds } from "../timing";

type GenerationProgressProps = {
  rows?: string[];
  steps?: string[];
  startFrame?: number;
  rowDurationFrames?: number;
  activeIndex?: number;
  completedCount?: number;
};

const defaultRows = [
  "Reading job description",
  "Comparing role requirements",
  "Drafting tailored material",
];

export const GenerationProgress = ({
  rows,
  steps,
  startFrame = 0,
  rowDurationFrames,
  activeIndex,
  completedCount,
}: GenerationProgressProps) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const labels = rows ?? steps ?? defaultRows;
  const rowDuration = rowDurationFrames ?? seconds(0.9, fps);
  const derivedProgress = Math.max(0, frame - startFrame) / rowDuration;

  return (
    <div
      style={{
        backgroundColor: theme.color.white,
        border: `1px solid ${theme.color.border}`,
        display: "grid",
        gap: 12,
        padding: 22,
      }}
    >
      {labels.map((label, index) => {
        const explicitCompleted =
          typeof completedCount === "number" ? index < completedCount : false;
        const explicitActive =
          typeof activeIndex === "number" ? index === activeIndex : false;
        const autoCompleted =
          typeof completedCount === "number" || typeof activeIndex === "number"
            ? false
            : derivedProgress >= index + 1;
        const autoActive =
          typeof completedCount === "number" || typeof activeIndex === "number"
            ? false
            : derivedProgress >= index && derivedProgress < index + 1;
        const isCompleted = explicitCompleted || autoCompleted;
        const isActive = explicitActive || autoActive;
        const fill = interpolate(
          derivedProgress - index,
          [0, 1],
          [0, 100],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <div
            key={label}
            style={{
              alignItems: "center",
              border: `1px solid ${
                isActive || isCompleted ? "rgba(107,45,60,0.28)" : theme.color.border
              }`,
              display: "grid",
              gap: 14,
              gridTemplateColumns: "30px 1fr 72px",
              minHeight: 58,
              overflow: "hidden",
              padding: "12px 14px",
              position: "relative",
            }}
          >
            <div
              style={{
                backgroundColor: "rgba(107,45,60,0.08)",
                bottom: 0,
                left: 0,
                position: "absolute",
                top: 0,
                width: `${isCompleted ? 100 : isActive ? fill : 0}%`,
              }}
            />
            <div
              style={{
                alignItems: "center",
                backgroundColor: isCompleted ? theme.color.accent : theme.color.muted,
                color: isCompleted ? theme.color.white : theme.color.accent,
                display: "flex",
                height: 34,
                justifyContent: "center",
                position: "relative",
                width: 34,
              }}
            >
              {isCompleted ? (
                <Check size={18} strokeWidth={2.2} />
              ) : (
                <LoaderCircle size={18} strokeWidth={2} />
              )}
            </div>
            <span
              style={{
                color: theme.color.foreground,
                fontSize: 18,
                fontWeight: 650,
                position: "relative",
              }}
            >
              {label}
            </span>
            <span
              style={{
                color: isCompleted || isActive
                  ? theme.color.accent
                  : theme.color.mutedForeground,
                fontFamily: theme.font.mono,
                fontSize: 13,
                fontWeight: 700,
                position: "relative",
                textAlign: "right",
                textTransform: "uppercase",
              }}
            >
              {isCompleted ? "Done" : isActive ? "Running" : "Queued"}
            </span>
          </div>
        );
      })}
    </div>
  );
};
