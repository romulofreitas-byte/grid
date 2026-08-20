import { describe, expect, it } from "vitest";
import { polyfillFileGlobal } from "./polyfill-file";

describe("polyfillFileGlobal", () => {
  it("leaves File defined after running", () => {
    polyfillFileGlobal();
    expect(typeof globalThis.File).toBe("function");
  });
});
