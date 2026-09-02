import { describe, expect, it } from "vitest";
import { placeAnchorPopover } from "./AnchorPopover";

describe("placeAnchorPopover", () => {
  const anchor = {
    top: 500,
    bottom: 536,
    left: 200,
    right: 236,
    width: 36,
    height: 36,
    x: 200,
    y: 500,
    toJSON() {
      return this;
    },
  } satisfies DOMRect;

  it("opens below when there is room", () => {
    expect(
      placeAnchorPopover({
        anchor,
        panelWidth: 192,
        panelHeight: 120,
        viewportWidth: 800,
        viewportHeight: 800,
        align: "end",
      }),
    ).toEqual({ top: 542, left: 44 });
  });

  it("flips above when the panel would leave the viewport", () => {
    expect(
      placeAnchorPopover({
        anchor,
        panelWidth: 192,
        panelHeight: 160,
        viewportWidth: 800,
        viewportHeight: 560,
        align: "end",
      }),
    ).toEqual({ top: 334, left: 44 });
  });
});
