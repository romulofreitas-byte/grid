export const MAX_DEAL_AMOUNT_CENTS = 9_999_999_999;

/** Parse a Brazilian reais draft (`1.234,56`, `1234,56`, `1234.56`, `1234`) into cents. Empty → null. */
export function parseBrlToCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.includes("-")) return null;
  const compact = trimmed.replace(/[^\d.,]/g, "");
  if (!compact) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let reais: string;
  let cents: string;

  if (lastComma > lastDot) {
    reais = compact.slice(0, lastComma).replace(/\D/g, "");
    cents = compact.slice(lastComma + 1).replace(/\D/g, "").padEnd(2, "0").slice(0, 2);
  } else if (lastDot > lastComma) {
    const decimals = compact.slice(lastDot + 1).replace(/\D/g, "");
    if (decimals.length > 0 && decimals.length <= 2) {
      reais = compact.slice(0, lastDot).replace(/\D/g, "");
      cents = decimals.padEnd(2, "0");
    } else {
      reais = compact.replace(/\D/g, "");
      cents = "00";
    }
  } else {
    reais = compact.replace(/\D/g, "");
    cents = "00";
  }

  if (!reais) reais = "0";
  const n = Number(reais) * 100 + Number(cents);
  if (!Number.isFinite(n) || n < 0 || n > MAX_DEAL_AMOUNT_CENTS) return null;
  return n;
}

export function formatCentsInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
