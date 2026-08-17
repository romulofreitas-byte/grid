/** Instagram handle from a stored URL, @handle, or bare username. */

const RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "tv",
  "explore",
  "accounts",
  "about",
  "legal",
  "directory",
  "emails",
  "invite",
  "nametag",
  "popular",
  "tags",
  "locations",
  "direct",
  "inbox",
]);

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

const PROFILE_PATH =
  /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([^/?#]+)/i;

export function parseInstagramHandle(
  raw: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  let candidate = trimmed;
  const fromUrl = trimmed.match(PROFILE_PATH);
  if (fromUrl?.[1]) {
    candidate = fromUrl[1];
  } else if (candidate.startsWith("@")) {
    candidate = candidate.slice(1);
  }

  candidate = candidate.replace(/\/+$/, "");
  if (!candidate || RESERVED.has(candidate.toLowerCase())) return null;
  if (!HANDLE_RE.test(candidate)) return null;
  return candidate;
}
