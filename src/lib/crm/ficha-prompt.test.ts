import { describe, expect, it } from "vitest";
import { fichaCrmPrompt } from "./ficha-prompt";
import { COPY } from "@/lib/copy";

describe("fichaCrmPrompt", () => {
  it("asks to save when the list is not saved", () => {
    expect(
      fichaCrmPrompt({ hasDeal: false, searchSaved: false, wasQualified: true }),
    ).toBe("save");
  });

  it("does not ask to qualify when already audited but missing from CRM", () => {
    expect(
      fichaCrmPrompt({ hasDeal: false, searchSaved: true, wasQualified: true }),
    ).toBe("entering");
    expect(COPY.crmEnteringPista).not.toBe(COPY.crmQualifyToEnter);
  });

  it("asks to qualify when saved and not yet audited", () => {
    expect(
      fichaCrmPrompt({ hasDeal: false, searchSaved: true, wasQualified: false }),
    ).toBe("qualify");
  });

  it("hides the prompt when a deal exists", () => {
    expect(
      fichaCrmPrompt({ hasDeal: true, searchSaved: true, wasQualified: true }),
    ).toBeNull();
  });
});
