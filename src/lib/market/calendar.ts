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
