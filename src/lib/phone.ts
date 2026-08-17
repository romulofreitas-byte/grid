/** Brazilian phone normalization and comparison. Pure functions — unit-tested. */

export const BR_DDDS = new Set([
  "11", "12", "13", "14", "15", "16", "17", "18", "19",
  "21", "22", "24", "27", "28",
  "31", "32", "33", "34", "35", "37", "38",
  "41", "42", "43", "44", "45", "46", "47", "48", "49",
  "51", "53", "54", "55",
  "61", "62", "63", "64", "65", "66", "67", "68", "69",
  "71", "73", "74", "75", "77", "79",
  "81", "82", "83", "84", "85", "86", "87", "88", "89",
  "91", "92", "93", "94", "95", "96", "97", "98", "99",
]);

const SPECIAL_PREFIXES = ["0800", "0300", "4004", "3003", "4003"];

export type PhoneTipo = "fixo" | "movel" | "especial";

export type NormalizedPhone = {
  e164: string;
  ddd: string | null;
  local: string;
  tipo: PhoneTipo;
  display: string;
};

function onlyDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function isRepeating(digits: string): boolean {
  return /^(.)\1+$/.test(digits);
}

function isObviousSequence(digits: string): boolean {
  const seq = "01234567890123456789";
  const rev = "98765432109876543210";
  return seq.includes(digits) || rev.includes(digits);
}

function formatDisplay(ddd: string | null, local: string, tipo: PhoneTipo): string {
  if (tipo === "especial") {
    if (local.length === 11 && local.startsWith("0")) {
      return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
    }
    return local.replace(/(\d{4})(\d{4})/, "$1-$2");
  }
  if (!ddd) return local;
  if (local.length === 9) return `(${ddd}) ${local.slice(0, 5)}-${local.slice(5)}`;
  if (local.length === 8) return `(${ddd}) ${local.slice(0, 4)}-${local.slice(4)}`;
  return `(${ddd}) ${local}`;
}

export function normalizePhoneBR(
  raw: string,
  fallbackDdd?: string | null,
): NormalizedPhone | null {
  let digits = onlyDigits(raw);
  if (!digits) return null;

  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }

  for (const prefix of SPECIAL_PREFIXES) {
    if (digits.startsWith(prefix)) {
      if (digits.length < 8 || digits.length > 12) return null;
      if (isRepeating(digits)) return null;
      return {
        e164: `+55${digits}`,
        ddd: null,
        local: digits,
        tipo: "especial",
        display: formatDisplay(null, digits, "especial"),
      };
    }
  }

  let ddd: string | null = null;
  let local = digits;

  if (digits.length === 11) {
    ddd = digits.slice(0, 2);
    local = digits.slice(2);
  } else if (digits.length === 10) {
    ddd = digits.slice(0, 2);
    local = digits.slice(2);
  } else if (digits.length === 9 || digits.length === 8) {
    ddd = fallbackDdd ? onlyDigits(fallbackDdd).slice(0, 2) : null;
    local = digits;
  } else {
    return null;
  }

  if (!ddd || !BR_DDDS.has(ddd)) return null;
  if (isRepeating(local) || isObviousSequence(local)) return null;

  let tipo: PhoneTipo;
  if (local.length === 9) {
    if (!local.startsWith("9")) return null;
    tipo = "movel";
  } else if (local.length === 8) {
    const first = local[0]!;
    if (first >= "2" && first <= "5") tipo = "fixo";
    else if (first >= "6" && first <= "9") tipo = "movel";
    else return null;
  } else {
    return null;
  }

  return {
    e164: `+55${ddd}${local}`,
    ddd,
    local,
    tipo,
    display: formatDisplay(ddd, local, tipo),
  };
}

/** Ninth-digit migration: 10-digit and 11-digit forms of the same line. */
export function sameNumberBR(a: NormalizedPhone, b: NormalizedPhone): boolean {
  if (a.e164 === b.e164) return true;
  if (!a.ddd || !b.ddd || a.ddd !== b.ddd) return false;
  const short = a.local.length <= b.local.length ? a : b;
  const long = a.local.length > b.local.length ? a : b;
  if (short.local.length !== 8 || long.local.length !== 9) return false;
  if (!long.local.startsWith("9")) return false;
  return long.local.slice(-8) === short.local;
}

export function phonesMatch(
  rawA: string,
  rawB: string,
  fallbackDdd?: string | null,
): boolean {
  const a = normalizePhoneBR(rawA, fallbackDdd);
  const b = normalizePhoneBR(rawB, fallbackDdd);
  if (!a || !b) return false;
  return sameNumberBR(a, b);
}
