import { describe, expect, it } from "vitest";
import {
  enterFullscreen,
  FOCUS_CHROME_MS,
  FOCUS_SPRINT_MS,
  focusFullscreenDelayMs,
  focusSprintRemainingMs,
  formatFocusSprintClock,
  isFullscreen,
  leaveFullscreen,
  parseFocusOn,
  serializeFocusOn,
  type FullscreenHost,
} from "./focus-mode";

function fakeHost(opts?: {
  fullscreen?: boolean;
  failEnter?: boolean;
  failExit?: boolean;
}): FullscreenHost {
  let element: Element | null = opts?.fullscreen ? ({} as Element) : null;
  return {
    get fullscreenElement() {
      return element;
    },
    request: async () => {
      if (opts?.failEnter) throw new Error("denied");
      element = {} as Element;
    },
    exit: async () => {
      if (opts?.failExit) throw new Error("fail");
      element = null;
    },
  };
}

describe("focus chrome delay", () => {
  it("waits for the slide before fullscreen, unless motion is reduced", () => {
    expect(focusFullscreenDelayMs(false)).toBe(FOCUS_CHROME_MS);
    expect(focusFullscreenDelayMs(true)).toBe(0);
    expect(FOCUS_CHROME_MS).toBeGreaterThanOrEqual(280);
  });
});

describe("focus sprint clock", () => {
  it("starts at 25:00 and counts down without going negative", () => {
    const start = 1_000_000;
    expect(formatFocusSprintClock(focusSprintRemainingMs(start, start))).toBe(
      "25:00",
    );
    expect(
      formatFocusSprintClock(focusSprintRemainingMs(start, start + 1_000)),
    ).toBe("24:59");
    expect(
      formatFocusSprintClock(
        focusSprintRemainingMs(start, start + 12 * 60 * 1000 + 5_000),
      ),
    ).toBe("12:55");
    expect(
      formatFocusSprintClock(
        focusSprintRemainingMs(start, start + FOCUS_SPRINT_MS),
      ),
    ).toBe("0:00");
    expect(
      formatFocusSprintClock(
        focusSprintRemainingMs(start, start + FOCUS_SPRINT_MS + 8_000),
      ),
    ).toBe("0:00");
    expect(
      formatFocusSprintClock(focusSprintRemainingMs(start, start - 4_000)),
    ).toBe("25:00");
  });
});

describe("focus on flag", () => {
  it("treats only the explicit 1 as on", () => {
    expect(parseFocusOn(null)).toBe(false);
    expect(parseFocusOn("")).toBe(false);
    expect(parseFocusOn("0")).toBe(false);
    expect(parseFocusOn("maybe")).toBe(false);
    expect(parseFocusOn("1")).toBe(true);
  });

  it("round-trips on and off", () => {
    expect(serializeFocusOn(true)).toBe("1");
    expect(serializeFocusOn(false)).toBe("0");
    expect(parseFocusOn(serializeFocusOn(true))).toBe(true);
    expect(parseFocusOn(serializeFocusOn(false))).toBe(false);
  });
});

describe("fullscreen helpers", () => {
  it("enters when the host allows it and is a no-op when already full", async () => {
    const host = fakeHost();
    expect(isFullscreen(host)).toBe(false);
    expect(await enterFullscreen(host)).toBe(true);
    expect(isFullscreen(host)).toBe(true);
    expect(await enterFullscreen(host)).toBe(true);
  });

  it("still reports Focus-ready when the host refuses fullscreen", async () => {
    const host = fakeHost({ failEnter: true });
    expect(await enterFullscreen(host)).toBe(false);
    expect(isFullscreen(host)).toBe(false);
  });

  it("leaves fullscreen and swallows an exit failure", async () => {
    const host = fakeHost({ fullscreen: true });
    await leaveFullscreen(host);
    expect(isFullscreen(host)).toBe(false);

    const stubborn = fakeHost({ fullscreen: true, failExit: true });
    await leaveFullscreen(stubborn);
    expect(isFullscreen(stubborn)).toBe(true);
  });

  it("does not call exit when nothing is full", async () => {
    const host = fakeHost({ failExit: true });
    await leaveFullscreen(host);
    expect(isFullscreen(host)).toBe(false);
  });
});
