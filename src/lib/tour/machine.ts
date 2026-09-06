import {
  TOUR_STEP_COUNT,
  tourStepAt,
  type TourOrigin,
} from "./steps";

export type TourSession = {
  index: number;
  origin: TourOrigin;
};

export type TourAdvance =
  | { kind: "step"; session: TourSession }
  | { kind: "done"; origin: TourOrigin };

export function startTour(
  origin: TourOrigin,
  index = 0,
): TourSession {
  return {
    origin,
    index: clampIndex(index),
  };
}

export function nextTour(session: TourSession): TourAdvance {
  if (session.index >= TOUR_STEP_COUNT - 1) {
    return { kind: "done", origin: session.origin };
  }
  return {
    kind: "step",
    session: { ...session, index: session.index + 1 },
  };
}

export function backTour(session: TourSession): TourSession {
  return { ...session, index: Math.max(0, session.index - 1) };
}

export function isLastTourStep(index: number): boolean {
  return index >= TOUR_STEP_COUNT - 1;
}

export function tourSceneChanged(
  fromIndex: number,
  toIndex: number,
): boolean {
  return tourStepAt(fromIndex)?.scene !== tourStepAt(toIndex)?.scene;
}

function clampIndex(index: number): number {
  if (!Number.isFinite(index) || index < 0) return 0;
  return Math.min(Math.floor(index), TOUR_STEP_COUNT - 1);
}
