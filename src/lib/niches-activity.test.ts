import { describe, expect, it } from "vitest";
import { combineActivityCnaes } from "./niches";

describe("combineActivityCnaes", () => {
  it("returns scoped codes when nothing was picked", () => {
    const scoped = new Set(["111", "222"]);
    expect(combineActivityCnaes([], scoped)).toEqual(scoped);
  });

  it("uses only explicit codes when there is no segment scope", () => {
    expect(combineActivityCnaes(["9602502"], null)).toEqual(new Set(["9602502"]));
  });

  it("refines to the checked subset when all picks are inside the segment", () => {
    const scoped = new Set(["111", "222", "333"]);
    expect(combineActivityCnaes(["222"], scoped)).toEqual(new Set(["222"]));
  });

  it("unions extras from typeahead with the full segment set", () => {
    const scoped = new Set(["111", "222"]);
    expect(combineActivityCnaes(["999"], scoped)).toEqual(
      new Set(["111", "222", "999"]),
    );
  });

  it("unions extras with a refined subset", () => {
    const scoped = new Set(["111", "222", "333"]);
    expect(combineActivityCnaes(["111", "999"], scoped)).toEqual(
      new Set(["111", "999"]),
    );
  });
});
