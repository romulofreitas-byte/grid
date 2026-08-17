export type SupportWhatsAppOptions = {
  name?: string | null;
  pathname?: string | null;
  phone?: string | null;
};

/** Digits for wa.me (country code 55, no +). Null if the number is missing or invalid. */
export function supportWhatsAppDigits(
  raw: string | null | undefined = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP,
): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }
  if (!digits.startsWith("55") || digits.length < 12 || digits.length > 13) {
    return null;
  }
  return digits;
}

export function supportWhatsAppHref(
  options: SupportWhatsAppOptions = {},
): string | null {
  const digits = supportWhatsAppDigits(options.phone);
  if (!digits) return null;
  const name = options.name?.trim() || "Piloto";
  const screen = options.pathname?.trim() || "/";
  const text = `Olá, sou ${name} e estou no GRID (${screen}). Preciso de ajuda.`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
