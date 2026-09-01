/** Cupom publicado em /planos e na FAQ. A trava real é a lista de assinantes. */
export const DEFAULT_PLATFORM_COUPON = "PILOTOPODIUM";

/** Valor do primeiro deploy — se a env da Vercel não foi atualizada, ainda é este. */
const LEGACY_PLATFORM_COUPON = "PODIUM";

export function normalizePlatformCoupon(raw: string | null | undefined): string {
  const value = (raw ?? "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[\s_-]+/g, "")
    .toUpperCase();
  if (value === LEGACY_PLATFORM_COUPON) return DEFAULT_PLATFORM_COUPON;
  return value;
}

export function expectedPlatformCoupon(): string {
  return (
    normalizePlatformCoupon(process.env.BILLING_PLATFORM_COUPON) ||
    DEFAULT_PLATFORM_COUPON
  );
}

export function isValidPlatformCoupon(input: string | null | undefined): boolean {
  const entered = normalizePlatformCoupon(input);
  if (!entered) return false;
  return entered === expectedPlatformCoupon();
}
