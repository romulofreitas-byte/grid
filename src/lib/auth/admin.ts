import { usesMockAuth } from "@/lib/auth/mock";

function parseAdminEmails(): Set<string> {
  const raw = process.env.GRID_ADMIN_EMAILS?.trim();
  if (!raw) return new Set();
  return new Set(
    raw
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email?.trim()) return false;
  const admins = parseAdminEmails();
  if (!admins.size) return false;
  return admins.has(email.trim().toLowerCase());
}

/** Mock dev: open admin when GRID_ADMIN_EMAILS unset; prod requires explicit allowlist. */
export function isAdminSession(session: {
  email: string | null;
}): boolean {
  if (usesMockAuth()) {
    const admins = parseAdminEmails();
    if (!admins.size) return true;
    return isAdminEmail(session.email);
  }
  return isAdminEmail(session.email);
}
