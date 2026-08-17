const MAX_BYTES = 1_000_000;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function parseImageDataUrl(raw: string): { mime: string; bytes: Buffer } | null {
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    raw.trim(),
  );
  if (!match) return null;
  const mime = match[1];
  if (!ALLOWED.has(mime)) return null;
  const bytes = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  if (!bytes.length || bytes.length > MAX_BYTES) return null;
  return { mime, bytes };
}

export function extForMime(mime: string): "jpg" | "png" | "webp" {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}
