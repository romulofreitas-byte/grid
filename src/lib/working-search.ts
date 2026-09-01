export const WORKING_SEARCH_COOKIE = "grid_working_search";

export function readWorkingSearchId(
  cookieHeader: string | null | undefined,
): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";");
  for (const part of parts) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === WORKING_SEARCH_COOKIE) {
      const value = rest.join("=").trim();
      return value || null;
    }
  }
  return null;
}

export function workingSearchCookie(searchId: string | null): string {
  if (!searchId) {
    return `${WORKING_SEARCH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  }
  return `${WORKING_SEARCH_COOKIE}=${encodeURIComponent(searchId)}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax`;
}

export function writeWorkingSearchCookie(searchId: string | null) {
  if (typeof document === "undefined") return;
  document.cookie = workingSearchCookie(searchId);
}
