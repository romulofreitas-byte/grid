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

export function maskBrlTyping(raw: string): string {
  if (!raw.trim()) return "";
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
  if (!intDigits && !centDigits && !commaSeen) return "";
  const intFormatted = Number(intDigits || "0").toLocaleString("pt-BR");
  if (!commaSeen) return `R$ ${intFormatted},00`;
  if (centDigits.length === 0) return `R$ ${intFormatted},`;
  if (centDigits.length === 1) return `R$ ${intFormatted},${centDigits}`;
  return `R$ ${intFormatted},${centDigits}`;
}

export function reaisFromBrlMask(display: string): number {
  if (!display.trim()) return 0;
  let commaSeen = false;
  let intDigits = "";
  let centDigits = "";
  for (const ch of display) {
    if (ch >= "0" && ch <= "9") {
      if (commaSeen) {
        if (centDigits.length < 2) centDigits += ch;
      } else {
        intDigits += ch;
      }
    } else if (ch === "," && !commaSeen) {
      commaSeen = true;
    }
  }
  intDigits = intDigits.replace(/^0+(?=\d)/, "") || "0";
  const cents = (centDigits + "00").slice(0, 2);
  return Number(intDigits) + Number(cents) / 100;
}

export function roundReais(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 100) / 100;
}
