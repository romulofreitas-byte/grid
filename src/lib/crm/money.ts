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

const MAX_INT_DIGITS = 8;

function formatIntDigits(intDigits: string): string {
  return Number(intDigits || "0").toLocaleString("pt-BR");
}

/**
 * Live mask: digits grow the reais; `,00` is always visible unless the user
 * is typing cents after a comma. Extra digits after a padded `,00` fold into
 * the integer part (`R$ 2,00` + `0` → `R$ 20,00`).
 */
export function maskDealAmountTyping(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  let commaSeen = false;
  let intDigits = "";
  let centDigits = "";
  for (const ch of trimmed) {
    if (ch >= "0" && ch <= "9") {
      if (commaSeen) {
        centDigits += ch;
      } else if (intDigits.length < MAX_INT_DIGITS) {
        intDigits += ch;
      }
    } else if (ch === "," && !commaSeen && intDigits.length > 0) {
      commaSeen = true;
    }
  }

  if (centDigits.length > 2) {
    if (centDigits.slice(0, 2) === "00") {
      intDigits = (intDigits + centDigits.slice(2)).slice(0, MAX_INT_DIGITS);
      commaSeen = false;
      centDigits = "";
    } else {
      centDigits = centDigits.slice(0, 2);
    }
  }

  intDigits = intDigits.replace(/^0+(?=\d)/, "");
  if (!intDigits && !centDigits && !commaSeen) return "";
  const intFormatted = formatIntDigits(intDigits);
  if (!commaSeen) return `R$ ${intFormatted},00`;
  if (centDigits.length === 0) return `R$ ${intFormatted},`;
  return `R$ ${intFormatted},${centDigits}`;
}

export function formatCentsInput(cents: number | null | undefined): string {
  if (cents == null) return "";
  return `R$ ${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)}`;
}
