import { Composition, Still } from "remotion";
import { JobClockLaunchVideo } from "./JobClockLaunchVideo";
import { durationInFrames, fps, height, width } from "./data";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="JobClockLaunchVideo"
        component={JobClockLaunchVideo}
        durationInFrames={durationInFrames}
        fps={fps}
        width={width}
        height={height}
      />
      <Still
        id="JobClockLaunchPoster"
        component={JobClockLaunchVideo}
        width={width}
        height={height}
      />
    </>
  );
};
