import { BookOpen, Tags } from "lucide-react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AppFrame } from "../components/AppFrame";
import { CaptionBar } from "../components/CaptionBar";
import { captions, storyBank } from "../data";
import { stagger } from "../timing";
import { theme } from "../theme";

export const SceneStoryBank = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const [expandedStory] = storyBank;

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
      <AppFrame active="Interview Prep" kicker="Reusable answers" title="Story Bank">
        <div
          style={{
            display: "grid",
            gap: 24,
            gridTemplateColumns: "480px minmax(0, 1fr)",
            height: "100%",
          }}
        >
          <div style={{ display: "grid", gap: 18 }}>
            {storyBank.map((story, index) => (
              <div
                key={story.title}
                style={{
                  ...stagger(frame, index, fps),
                  backgroundColor: theme.color.white,
                  border: `1px solid ${
                    index === 0 ? "rgba(107,45,60,0.45)" : theme.color.border
                  }`,
                  display: "grid",
                  gap: 16,
                  padding: "22px 24px",
                }}
              >
                <BookOpen color={theme.color.accent} size={30} strokeWidth={1.8} />
                <h2
                  style={{
                    fontSize: 29,
                    fontWeight: 800,
                    lineHeight: 1.16,
                    margin: 0,
                  }}
                >
                  {story.title}
                </h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {story.tags.map((tag) => (
                    <span
                      key={tag}
                      style={{
                        backgroundColor: theme.color.muted,
                        color: theme.color.accent,
                        fontSize: 24,
                        fontWeight: 750,
                        padding: "7px 10px",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              ...stagger(frame, 1, fps),
              backgroundColor: theme.color.white,
              border: `1px solid ${theme.color.border}`,
              display: "grid",
              gap: 22,
              gridTemplateRows: "auto 1fr",
              padding: 34,
            }}
          >
            <div style={{ alignItems: "center", display: "flex", gap: 14 }}>
              <Tags color={theme.color.accent} size={36} strokeWidth={1.8} />
              <span style={{ fontSize: 30, fontWeight: 800 }}>Expanded STAR story</span>
            </div>
            <div style={{ display: "grid", gap: 14 }}>
              {[
                ["Situation", expandedStory.situation],
                ["Task", expandedStory.task],
                ["Action", expandedStory.action],
                ["Result", expandedStory.result],
              ].map(([label, copy]) => (
                <div
                  key={label}
                  style={{
                    border: `1px solid ${theme.color.border}`,
                    display: "grid",
                    gap: 8,
                    padding: "16px 18px",
                  }}
                >
                  <span
                    style={{
                      color: theme.color.accent,
                      fontSize: 24,
                      fontWeight: 800,
                    }}
                  >
                    {label}
                  </span>
                  <span style={{ fontSize: 25, lineHeight: 1.32 }}>{copy}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </AppFrame>
      <CaptionBar text={captions.storyBank} />
    </AbsoluteFill>
  );
};
