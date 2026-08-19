import { hasLiveDatabase } from "@/lib/data";
import { isUndefinedTableError, query } from "@/lib/data/pg";

export function normalizeSubscriberEmail(raw: string | null | undefined): string | null {
  const email = raw?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

export async function isPlatformSubscriber(
  email: string | null | undefined,
): Promise<boolean> {
  const normalized = normalizeSubscriberEmail(email);
  if (!normalized || !hasLiveDatabase()) return false;
  try {
    const { rows } = await query<{ email: string }>(
      `select email from platform_subscribers where email = $1 limit 1`,
      [normalized],
    );
    return rows.length > 0;
  } catch (err) {
    if (isUndefinedTableError(err)) return false;
    throw err;
  }
}

/** Banner no Box: assinante na base e ainda sem plano membro_plataforma. */
export function shouldShowPlatformCouponBanner(
  isSubscriber: boolean,
  plano: string,
): boolean {
  return isSubscriber && plano !== "membro_plataforma";
}
