import { AbsoluteFill, Series } from "remotion";
import { sceneDurations, fps } from "./data";
import { SceneApplicationWorkspace } from "./scenes/SceneApplicationWorkspace";
import { SceneBaseCv } from "./scenes/SceneBaseCv";
import { SceneBrowserExtension } from "./scenes/SceneBrowserExtension";
import { SceneCvTailoring } from "./scenes/SceneCvTailoring";
import { SceneEndCard } from "./scenes/SceneEndCard";
import { SceneGrillMe } from "./scenes/SceneGrillMe";
import { SceneInterviewPrep } from "./scenes/SceneInterviewPrep";
import { ScenePipeline } from "./scenes/ScenePipeline";
import { SceneResearch } from "./scenes/SceneResearch";
import { SceneStoryBank } from "./scenes/SceneStoryBank";
import { theme } from "./theme";

const frames = (seconds: number) => seconds * fps;

export const JobClockLaunchVideo = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.color.background,
        color: theme.color.foreground,
        fontFamily: theme.font.sans,
      }}
    >
      <Series>
        <Series.Sequence durationInFrames={frames(sceneDurations.baseCv)}>
          <SceneBaseCv />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.browserExtension)}>
          <SceneBrowserExtension />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.applicationWorkspace)}>
          <SceneApplicationWorkspace />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.research)}>
          <SceneResearch />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.cvTailoring)}>
          <SceneCvTailoring />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.storyBank)}>
          <SceneStoryBank />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.interviewPrep)}>
          <SceneInterviewPrep />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.grillMe)}>
          <SceneGrillMe />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.pipeline)}>
          <ScenePipeline />
        </Series.Sequence>
        <Series.Sequence durationInFrames={frames(sceneDurations.endCard)}>
          <SceneEndCard />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
