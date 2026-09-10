import { describe, expect, it } from "vitest";
import {
  backTour,
  firstIndexForScene,
  isLastTourStep,
  nextTour,
  startTour,
  TOUR_STEP_COUNT,
  TOUR_STEPS,
  tourPathFor,
  tourSceneChanged,
} from "./index";

describe("tour steps", () => {
  it("covers Painel then Grid without mixing scenes mid-block", () => {
    expect(TOUR_STEP_COUNT).toBe(8);
    expect(TOUR_STEPS.slice(0, 4).every((step) => step.scene === "painel")).toBe(
      true,
    );
    expect(TOUR_STEPS.slice(4).every((step) => step.scene === "grid")).toBe(true);
    expect(firstIndexForScene("grid")).toBe(4);
    expect(TOUR_STEPS.find((step) => step.id === "painel-new-list")?.placement).toBe(
      "top",
    );
  });
});

describe("tour machine", () => {
  it("starts, walks forward, and finishes on the last step", () => {
    let session = startTour("app");
    expect(session).toEqual({ origin: "app", index: 0 });

    for (let i = 0; i < TOUR_STEP_COUNT - 1; i++) {
      const next = nextTour(session);
      expect(next.kind).toBe("step");
      if (next.kind === "step") session = next.session;
    }

    expect(session.index).toBe(TOUR_STEP_COUNT - 1);
    expect(isLastTourStep(session.index)).toBe(true);
    expect(nextTour(session)).toEqual({ kind: "done", origin: "app" });
  });

  it("does not go below the first step", () => {
    expect(backTour(startTour("landing")).index).toBe(0);
    expect(backTour({ origin: "app", index: 3 }).index).toBe(2);
  });

  it("detects the Painel → Grid scene change", () => {
    expect(tourSceneChanged(3, 4)).toBe(true);
    expect(tourSceneChanged(1, 2)).toBe(false);
  });

  it("keeps the landing visitor on /tour and sends the app to the demo Grid", () => {
    expect(tourPathFor(0, "landing")).toBe("/tour");
    expect(tourPathFor(5, "landing")).toBe("/tour");
    expect(tourPathFor(0, "app")).toBe("/painel");
    expect(tourPathFor(4, "app")).toBe("/tour?from=app");
  });
});
