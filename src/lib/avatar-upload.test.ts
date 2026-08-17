import { describe, expect, it } from "vitest";
import { parseImageDataUrl } from "./avatar-upload";

describe("parseImageDataUrl", () => {
  it("accepts a small jpeg data URL", () => {
    const bytes = Buffer.from("jpeg-bytes");
    const parsed = parseImageDataUrl(
      `data:image/jpeg;base64,${bytes.toString("base64")}`,
    );
    expect(parsed?.mime).toBe("image/jpeg");
    expect(parsed?.bytes.equals(bytes)).toBe(true);
  });

  it("rejects other mime types and oversized payloads", () => {
    expect(parseImageDataUrl("data:image/gif;base64,AAAA")).toBeNull();
    expect(parseImageDataUrl("https://example.com/a.jpg")).toBeNull();
    const huge = Buffer.alloc(1_000_001, 1);
    expect(
      parseImageDataUrl(`data:image/png;base64,${huge.toString("base64")}`),
    ).toBeNull();
  });
});
