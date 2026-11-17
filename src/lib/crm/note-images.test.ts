import { describe, expect, it } from "vitest";
import { parseNoteImageDataUrl } from "./note-image-parse";
import {
  NOTE_IMAGE_MAX_BYTES,
  claimNoteImages,
  isOwnedNoteImagePath,
  noteImageHref,
  noteImageObjectPath,
} from "./note-images";

const USER = "user_1";
const DEAL = "deal_1";

describe("parseNoteImageDataUrl", () => {
  it("accepts jpeg, png and webp up to 4 MB", () => {
    for (const mime of ["image/jpeg", "image/png", "image/webp"] as const) {
      const bytes = Buffer.from(`${mime}-bytes`);
      const parsed = parseNoteImageDataUrl(
        `data:${mime};base64,${bytes.toString("base64")}`,
      );
      expect(parsed?.mime).toBe(mime);
      expect(parsed?.bytes.equals(bytes)).toBe(true);
    }
    const limit = Buffer.alloc(NOTE_IMAGE_MAX_BYTES, 1);
    expect(
      parseNoteImageDataUrl(`data:image/png;base64,${limit.toString("base64")}`)?.bytes
        .length,
    ).toBe(NOTE_IMAGE_MAX_BYTES);
  });

  it("rejects other types and payloads over 4 MB", () => {
    expect(parseNoteImageDataUrl("data:image/gif;base64,AAAA")).toBeNull();
    expect(parseNoteImageDataUrl("data:application/pdf;base64,AAAA")).toBeNull();
    expect(parseNoteImageDataUrl("https://example.com/a.jpg")).toBeNull();
    const huge = Buffer.alloc(NOTE_IMAGE_MAX_BYTES + 1, 1);
    expect(
      parseNoteImageDataUrl(`data:image/jpeg;base64,${huge.toString("base64")}`),
    ).toBeNull();
  });
});

describe("note image paths", () => {
  it("only claims files under this user and deal", () => {
    const path = noteImageObjectPath(USER, DEAL, "file-1", "jpg");
    expect(path).toBe("user_1/deal_1/file-1.jpg");
    expect(isOwnedNoteImagePath(USER, DEAL, path!)).toBe(true);
    expect(
      claimNoteImages(USER, DEAL, [{ path: path!, mime: "image/jpeg" }]),
    ).toEqual([{ path, mime: "image/jpeg" }]);
    expect(
      claimNoteImages(USER, DEAL, [{ path: path!, mime: "image/png" }]),
    ).toBeNull();
    expect(
      claimNoteImages("other", DEAL, [{ path: path!, mime: "image/jpeg" }]),
    ).toBeNull();
    expect(isOwnedNoteImagePath(USER, DEAL, `${USER}/${DEAL}/../secret.jpg`)).toBe(
      false,
    );
    expect(claimNoteImages(USER, DEAL, [
      { path: path!, mime: "image/jpeg" },
      { path: path!, mime: "image/jpeg" },
      { path: path!, mime: "image/jpeg" },
      { path: path!, mime: "image/jpeg" },
    ])).toBeNull();
    expect(noteImageHref(DEAL, path!)).toBe(
      `/api/crm/deals/${DEAL}/attachments?path=${encodeURIComponent(path!)}`,
    );
  });
});
