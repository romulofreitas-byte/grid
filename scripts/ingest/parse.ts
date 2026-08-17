/**
 * Low-level parsers for RF CSV rows (ISO-8859-1 text, semicolon, quoted fields).
 */

/** Parse one CSV line respecting double quotes and `;` separator. */
export function parseCsvLine(line: string, separator = ";"): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === separator && !inQuotes) {
      fields.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  fields.push(current);
  return fields;
}

/** Parse RF date string AAAAMMDD → Date or null. */
export function parseDate(raw: string | undefined | null): Date | null {
  const value = (raw ?? "").trim();
  if (!/^\d{8}$/.test(value) || value === "00000000") return null;

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format Date as YYYY-MM-DD for Postgres COPY. */
export function formatDate(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

export function normalizeDigits(raw: string | undefined | null): string {
  return (raw ?? "").replace(/\D/g, "");
}

/** Strip non-digits; return null when fewer than 8 digits. */
export function normalizePhone(raw: string | undefined | null): string | null {
  const digits = normalizeDigits(raw);
  if (digits.length < 8) return null;
  return digits.slice(0, 10);
}

export function normalizeDdd(raw: string | undefined | null): string | null {
  const digits = normalizeDigits(raw);
  if (!digits) return null;
  return digits.slice(0, 4);
}

export function normalizeEmail(raw: string | undefined | null): string | null {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value || !value.includes("@")) return null;
  return value;
}

export function normalizeCep(raw: string | undefined | null): string | null {
  const digits = normalizeDigits(raw);
  return digits.length === 8 ? digits : null;
}

export function normalizeUf(raw: string | undefined | null): string | null {
  const value = (raw ?? "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(value) ? value : null;
}

/** RF capital social uses comma as decimal separator. */
export function parseCapitalSocial(raw: string | undefined | null): number | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const normalized = value.replace(/\./g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}

export function parseCnaeSecundarios(raw: string | undefined | null): string[] {
  const value = (raw ?? "").trim();
  if (!value) return [];
  return value
    .split(",")
    .map((c) => c.trim())
    .filter((c) => /^\d{7}$/.test(c));
}

export function buildCnpj(basico: string, ordem: string, dv: string): string {
  return `${basico}${ordem}${dv}`.replace(/\D/g, "").slice(0, 14);
}

export function pickField(fields: string[], index: number): string {
  return (fields[index] ?? "").trim();
}

export function parseSnFlag(raw: string | undefined | null): boolean | null {
  const value = (raw ?? "").trim().toUpperCase();
  if (value === "S") return true;
  if (value === "N") return false;
  return null;
}
