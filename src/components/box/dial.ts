import { telHrefFromPhone, waHrefFromPhone } from "@/lib/crm/dial";
import type { BoxQueueItem } from "@/lib/box/queue";
import { normalizePhoneBR } from "@/lib/phone";

export function formatBoxPhoneDisplay(raw: string): string {
  const parsed = normalizePhoneBR(raw);
  return parsed?.display ?? raw;
}

export function pickBoxWaHref(item: BoxQueueItem): string | null {
  for (const phone of item.phones.length ? item.phones : item.phone ? [item.phone] : []) {
    const href = waHrefFromPhone(phone);
    if (href) return href;
  }
  return null;
}

export function pickBoxTel(
  item: BoxQueueItem,
): { phone: string; href: string } | null {
  const phones = item.phones.length ? item.phones : item.phone ? [item.phone] : [];
  for (const phone of phones) {
    const href = telHrefFromPhone(phone);
    if (href) return { phone, href };
  }
  return null;
}
