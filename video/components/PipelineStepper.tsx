import { Check } from "lucide-react";
import { interpolate } from "remotion";
import { theme } from "../theme";

type PipelineStatus = "Saved" | "Applied" | "Screening" | "Interview" | "Offer";

type PipelineStepperProps = {
  current?: PipelineStatus;
  progress?: number;
};

const statuses: PipelineStatus[] = [
  "Saved",
  "Applied",
  "Screening",
  "Interview",
  "Offer",
];

export const PipelineStepper = ({
  current = "Saved",
  progress,
}: PipelineStepperProps) => {
  const currentIndex = statuses.indexOf(current);
  const normalizedProgress =
    typeof progress === "number"
      ? Math.min(1, Math.max(0, progress))
      : currentIndex / (statuses.length - 1);
  const activeFloat = normalizedProgress * (statuses.length - 1);

  return (
    <div
      style={{
        backgroundColor: theme.color.white,
        border: `1px solid ${theme.color.border}`,
        padding: 24,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${statuses.length}, 1fr)`,
          position: "relative",
        }}
      >
        <div
          style={{
            backgroundColor: theme.color.border,
            height: 2,
            left: "10%",
            position: "absolute",
            right: "10%",
            top: 25,
          }}
        />
        <div
          style={{
            backgroundColor: theme.color.accent,
            height: 2,
            left: "10%",
            position: "absolute",
            top: 25,
            width: `${interpolate(normalizedProgress, [0, 1], [0, 80])}%`,
          }}
        />

        {statuses.map((status, index) => {
          const isComplete = index < activeFloat;
          const isCurrent = Math.round(activeFloat) === index;

          return (
            <div
              key={status}
              style={{
                alignItems: "center",
                display: "flex",
                flexDirection: "column",
                gap: 11,
                minWidth: 0,
                position: "relative",
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  backgroundColor:
                    isComplete || isCurrent ? theme.color.accent : theme.color.white,
                  border: `2px solid ${
                    isComplete || isCurrent ? theme.color.accent : theme.color.border
                  }`,
                  color: isComplete || isCurrent
                    ? theme.color.white
                    : theme.color.mutedForeground,
                  display: "flex",
                  fontFamily: theme.font.mono,
                  fontSize: 14,
                  fontWeight: 800,
                  height: 46,
                  justifyContent: "center",
                  width: 46,
                }}
              >
                {isComplete ? <Check size={21} strokeWidth={2.3} /> : index + 1}
              </div>
              <span
                style={{
                  color: isComplete || isCurrent
                    ? theme.color.foreground
                    : theme.color.mutedForeground,
                  fontSize: 13,
                  fontWeight: isCurrent ? 750 : 650,
                  textAlign: "center",
                }}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
