import type { CrmEventImage, CrmNoteImageMime } from "@/lib/crm/types";
import { CRM_NOTE_IMAGE_MIMES } from "@/lib/crm/types";

/** Phone screenshots are larger than a profile photo. */
export const NOTE_IMAGE_MAX_BYTES = 4_000_000;

export const NOTE_IMAGE_LIMIT = 3;

const ID_PART = "[A-Za-z0-9_-]{1,80}";
const NOTE_IMAGE_PATH = new RegExp(
  `^(${ID_PART})/(${ID_PART})/(${ID_PART})\\.(jpg|png|webp)$`,
);

const EXT_BY_MIME: Record<CrmNoteImageMime, "jpg" | "png" | "webp"> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MIME_BY_EXT: Record<"jpg" | "png" | "webp", CrmNoteImageMime> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function extForNoteMime(mime: string): "jpg" | "png" | "webp" | null {
  if (mime === "image/jpeg" || mime === "image/png" || mime === "image/webp") {
    return EXT_BY_MIME[mime];
  }
  return null;
}

export function noteImageObjectPath(
  userId: string,
  dealId: string,
  fileId: string,
  ext: "jpg" | "png" | "webp",
): string | null {
  const path = `${userId}/${dealId}/${fileId}.${ext}`;
  return isOwnedNoteImagePath(userId, dealId, path) ? path : null;
}

export function isOwnedNoteImagePath(
  userId: string,
  dealId: string,
  path: string,
): boolean {
  if (path.includes("..") || path.includes("\\") || path.includes("\0")) {
    return false;
  }
  const match = NOTE_IMAGE_PATH.exec(path);
  if (!match) return false;
  return match[1] === userId && match[2] === dealId;
}

export function noteImageHref(dealId: string, path: string): string {
  const params = new URLSearchParams({ path });
  return `/api/crm/deals/${encodeURIComponent(dealId)}/attachments?${params}`;
}

export function claimNoteImages(
  userId: string,
  dealId: string,
  images: { path: string; mime: string }[],
): CrmEventImage[] | null {
  if (images.length > NOTE_IMAGE_LIMIT) return null;
  const out: CrmEventImage[] = [];
  for (const image of images) {
    const match = NOTE_IMAGE_PATH.exec(image.path);
    if (!match || !isOwnedNoteImagePath(userId, dealId, image.path)) return null;
    const mime = MIME_BY_EXT[match[4] as "jpg" | "png" | "webp"];
    if (image.mime !== mime) return null;
    if (!CRM_NOTE_IMAGE_MIMES.includes(image.mime as CrmNoteImageMime)) return null;
    out.push({ path: image.path, mime });
  }
  return out;
}

export function readNoteImages(value: unknown): CrmEventImage[] {
  if (!Array.isArray(value)) return [];
  const out: CrmEventImage[] = [];
  for (const row of value) {
    if (out.length >= NOTE_IMAGE_LIMIT) break;
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const raw = row as Record<string, unknown>;
    if (typeof raw.path !== "string" || typeof raw.mime !== "string") continue;
    const match = NOTE_IMAGE_PATH.exec(raw.path);
    if (!match || raw.path.includes("..") || raw.path.includes("\\")) continue;
    const mime = MIME_BY_EXT[match[4] as "jpg" | "png" | "webp"];
    if (raw.mime !== mime) continue;
    out.push({ path: raw.path, mime });
  }
  return out;
}
