const MAX_INT_DIGITS = 12;

export function eachTen(percent: number): string {
  const n = percent / 10;
  return n.toLocaleString("pt-BR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  });
}

export function formatBrl(reais: number): string {
  if (!Number.isFinite(reais) || reais <= 0) return "";
  return reais.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function takeBrlParts(raw: string): {
  intDigits: string;
  centDigits: string;
  commaSeen: boolean;
} {
  let commaSeen = false;
  let intDigits = "";
  let centDigits = "";
  for (const ch of raw) {
    if (ch >= "0" && ch <= "9") {
      if (commaSeen) {
        if (centDigits.length < 2) centDigits += ch;
      } else if (intDigits.length < MAX_INT_DIGITS) {
        intDigits += ch;
      }
    } else if (ch === "," && !commaSeen) {
      commaSeen = true;
    }
  }
  intDigits = intDigits.replace(/^0+(?=\d)/, "");
  return { intDigits, centDigits, commaSeen };
}

function formatIntDigits(intDigits: string): string {
  return Number(intDigits || "0").toLocaleString("pt-BR");
}

/** Live mask: reais grow as you type. Cents only after a comma. No padded `,00`. */
export function maskBrlTyping(raw: string): string {
  if (!raw.trim()) return "";
  const { intDigits, centDigits, commaSeen } = takeBrlParts(raw);
  if (!intDigits && !centDigits && !commaSeen) return "";
  const intFormatted = formatIntDigits(intDigits);
  if (!commaSeen) return `R$ ${intFormatted}`;
  if (centDigits.length === 0) return `R$ ${intFormatted},`;
  return `R$ ${intFormatted},${centDigits}`;
}

/** Focused value without trailing `,00`, so extra keystrokes stay in the reais. */
export function formatBrlForEdit(reais: number): string {
  if (!Number.isFinite(reais) || reais <= 0) return "";
  const cents = Math.round(reais * 100);
  const intPart = Math.floor(cents / 100);
  const centPart = cents % 100;
  const intFormatted = intPart.toLocaleString("pt-BR");
  if (centPart === 0) return `R$ ${intFormatted}`;
  return `R$ ${intFormatted},${String(centPart).padStart(2, "0")}`;
}

export function reaisFromBrlMask(display: string): number {
  if (!display.trim()) return 0;
  const { intDigits, centDigits } = takeBrlParts(display);
  const cents = (centDigits + "00").slice(0, 2);
  return Number(intDigits || "0") + Number(cents) / 100;
}

export function roundReais(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100) / 100;
}
