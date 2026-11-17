import { NOTE_IMAGE_MAX_BYTES, extForNoteMime } from "@/lib/crm/note-images";
import type { CrmNoteImageMime } from "@/lib/crm/types";

const ALLOWED = new Set<CrmNoteImageMime>([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export function parseNoteImageDataUrl(
  raw: string,
): { mime: CrmNoteImageMime; bytes: Buffer } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    raw.trim(),
  );
  if (!match) return null;
  const mime = match[1];
  if (!extForNoteMime(mime) || !ALLOWED.has(mime as CrmNoteImageMime)) return null;
  const bytes = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!bytes.length || bytes.length > NOTE_IMAGE_MAX_BYTES) return null;
  return { mime: mime as CrmNoteImageMime, bytes };
}
