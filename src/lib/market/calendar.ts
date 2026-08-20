export const MES_CURTO = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
] as const;

export const MES_NOME = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
] as const;

export type SeasonStatus = "agora" | "na-porta" | "fora" | "nenhuma";

export function mesNumero(now = new Date()): number {
  return now.getMonth() + 1;
}

export function nomeMes(month: number): string {
  return MES_NOME[month - 1] ?? "";
}

export function peakMonths(months: number[]): number[] {
  return [...new Set(months.filter((m) => m >= 1 && m <= 12))].sort(
    (a, b) => a - b,
  );
}

export function peakCaption(months: number[], now = new Date()): string | null {
  const peaks = peakMonths(months);
  if (!peaks.length) return null;
  const labels = peaks.map((m) => MES_CURTO[m - 1].toLowerCase());
  const current = nomeMes(mesNumero(now));
  const status = seasonStatus(months, now);
  const pico = `Pico: ${labels.join(", ")}.`;
  if (status === "agora") return `${pico} ${current} está no pico.`;
  if (status === "na-porta") return `${pico} ${current} está na porta do pico.`;
  return `${pico} ${current} está fora do pico.`;
}

export function seasonStatus(
  months: number[],
  now = new Date(),
): SeasonStatus {
  if (!months.length) return "nenhuma";
  const month = mesNumero(now);
  const next = month === 12 ? 1 : month + 1;
  if (months.includes(month)) return "agora";
  if (months.includes(next)) return "na-porta";
  return "fora";
}
