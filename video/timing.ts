import { Easing, interpolate } from "remotion";

const easeOut = Easing.bezier(0.16, 1, 0.3, 1);

export const seconds = (value: number, fps: number) => {
  return Math.round(value * fps);
};

export const ease = (frame: number, from: number, duration: number) => {
  return interpolate(frame, [from, from + duration], [0, 1], {
    easing: easeOut,
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
};

export const fadeUp = (frame: number, delay: number, duration: number) => {
  const progress = ease(frame, delay, duration);

  return {
    opacity: progress,
    transform: `translateY(${interpolate(progress, [0, 1], [28, 0])}px)`,
  };
};

export const stagger = (
  frame: number,
  index: number,
  fps: number,
  startSeconds = 0.3,
) => {
  return fadeUp(
    frame,
    seconds(startSeconds, fps) + index * seconds(0.14, fps),
    seconds(0.55, fps),
  );
};
