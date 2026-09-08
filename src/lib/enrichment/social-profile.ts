/** Company social profiles — not posts, videos, or unrelated people. */

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "youtube";

const FACEBOOK_CONTENT = new Set([
  "watch",
  "reel",
  "reels",
  "posts",
  "videos",
  "story",
  "stories",
  "share",
  "permalink.php",
  "photo.php",
  "photo",
  "events",
  "groups",
  "marketplace",
  "gaming",
  "login",
  "dialog",
  "sharer",
]);

const LINKEDIN_CONTENT = new Set([
  "posts",
  "pulse",
  "feed",
  "jobs",
  "signup",
  "login",
  "school",
  "showcase",
]);

const YOUTUBE_CONTENT = new Set([
  "watch",
  "shorts",
  "embed",
  "playlist",
  "results",
  "live",
]);

const QSA_SKIP = new Set(["de", "da", "do", "dos", "das", "e", "del"]);

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function pathParts(url: string): { host: string; parts: string[] } | null {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname.replace(/^www\./i, "").toLowerCase(),
      parts: parsed.pathname.split("/").filter(Boolean),
    };
  } catch {
    return null;
  }
}

export function linkedinHandleMatchesQsa(
  handle: string,
  qsaNomes: string[] = [],
): boolean {
  const compact = fold(handle).replace(/[^a-z0-9]/g, "");
  if (compact.length < 6) return false;
  for (const nome of qsaNomes) {
    const tokens = fold(nome)
      .split(/[^a-z0-9]+/)
      .filter((part) => part.length >= 3 && !QSA_SKIP.has(part));
    if (tokens.length < 2) continue;
    const first = tokens[0];
    const last = tokens[tokens.length - 1];
    if (compact.includes(first) && compact.includes(last)) return true;
  }
  return false;
}

/** LinkedIn company page — not a personal `/in/` profile. */
export function isLinkedInCompanyUrl(url: string): boolean {
  const parsed = pathParts(url);
  if (!parsed || !parsed.host.includes("linkedin.com")) return false;
  return parsed.parts[0]?.toLowerCase() === "company" && Boolean(parsed.parts[1]);
}

/**
 * True when the URL is a profile/page we can show as the company's channel.
 * LinkedIn `/in/` only passes when the handle matches a sócio.
 */
export function isUsableSocialProfileUrl(
  url: string,
  platform: SocialPlatform,
  opts: { qsaNomes?: string[] } = {},
): boolean {
  const parsed = pathParts(url);
  if (!parsed) return false;
  const head = parsed.parts[0]?.toLowerCase() ?? "";

  if (platform === "facebook") {
    if (!parsed.host.includes("facebook.com") && parsed.host !== "fb.com") {
      return false;
    }
    if (!head || FACEBOOK_CONTENT.has(head)) return false;
    return true;
  }

  if (platform === "linkedin") {
    if (!parsed.host.includes("linkedin.com")) return false;
    if (head === "company" && parsed.parts[1]) return true;
    if (head === "in" && parsed.parts[1]) {
      return linkedinHandleMatchesQsa(parsed.parts[1], opts.qsaNomes);
    }
    if (LINKEDIN_CONTENT.has(head)) return false;
    return false;
  }

  if (platform === "youtube") {
    if (
      !parsed.host.includes("youtube.com") &&
      parsed.host !== "youtu.be"
    ) {
      return false;
    }
    if (parsed.host === "youtu.be") return false;
    if (!head || YOUTUBE_CONTENT.has(head)) return false;
    return true;
  }

  return true;
}
