import type { CrmPerson } from "@/lib/crm/types";
import type { ContactInfo } from "@/lib/types";
import { normalizePhoneBR, phonesMatch } from "@/lib/phone";

export class HidePhoneError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HidePhoneError";
    this.status = status;
  }
}

/** Stable key for a hidden line: E.164 digits, or the raw digits when normalization fails. */
export function phoneHideKey(raw: string): string | null {
  const parsed = normalizePhoneBR(raw);
  if (parsed) return parsed.e164.replace(/^\+/, "");
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

export function cnpjKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  const padded = digits.padStart(14, "0").slice(-14);
  if (!/[1-9]/.test(padded)) return null;
  return padded;
}

export function phoneIsHidden(
  raw: string | null | undefined,
  hidden: readonly string[],
): boolean {
  if (!raw?.trim() || hidden.length === 0) return false;
  return hidden.some((key) => key === phoneHideKey(raw) || phonesMatch(key, raw));
}

export function omitHiddenContacts(
  contacts: readonly ContactInfo[],
  hidden: readonly string[],
): ContactInfo[] {
  if (!hidden.length) return [...contacts];
  return contacts.filter((contact) => {
    const raw =
      contact.ddd && contact.telefone
        ? `${contact.ddd}${contact.telefone}`
        : contact.telefone;
    return !phoneIsHidden(raw, hidden);
  });
}

export function stripPhoneFromDealFields<
  T extends {
    phones: string[];
    people: CrmPerson[];
    secretaries: CrmPerson[];
  },
>(deal: T, phone: string): T {
  const keys = [phoneHideKey(phone) ?? phone];
  return {
    ...deal,
    phones: deal.phones.filter((item) => !phoneIsHidden(item, keys)),
    people: deal.people.map((person) =>
      phoneIsHidden(person.phone, keys) ? { ...person, phone: "" } : person,
    ),
    secretaries: deal.secretaries.map((person) =>
      phoneIsHidden(person.phone, keys) ? { ...person, phone: "" } : person,
    ),
  };
}
