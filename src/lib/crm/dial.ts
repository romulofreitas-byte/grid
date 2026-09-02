import { normalizePhoneBR, phonesMatch } from "@/lib/phone";

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "");
}

export function telHrefFromPhone(raw: string): string | null {
  const parsed = normalizePhoneBR(raw);
  if (parsed) return `tel:${parsed.e164}`;
  const digits = digitsOnly(raw);
  if (digits.length < 8) return null;
  const national = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return `tel:+${national}`;
}

export function waHrefFromPhone(raw: string): string | null {
  const parsed = normalizePhoneBR(raw);
  const digits = parsed
    ? parsed.e164.replace(/\D/g, "")
    : digitsOnly(raw);
  if (digits.length < 10) return null;
  const national = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${national}`;
}

export function uniquePhones(values: string[]): string[] {
  const out: string[] = [];
  for (const raw of values) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (
      out.some(
        (existing) => existing === trimmed || phonesMatch(existing, trimmed),
      )
    ) {
      continue;
    }
    out.push(trimmed);
  }
  return out;
}

export function firstDialablePhone(phones: string[]): string | null {
  for (const phone of phones) {
    const trimmed = phone.trim();
    if (!trimmed) continue;
    if (telHrefFromPhone(trimmed)) return trimmed;
  }
  return null;
}
