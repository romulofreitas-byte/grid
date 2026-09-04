export const BRAZIL_UF_LIST = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
] as const;

export type BrazilUfCode = (typeof BRAZIL_UF_LIST)[number];

const UF_SET = new Set<string>(BRAZIL_UF_LIST);

export function isBrazilUf(value: string): value is BrazilUfCode {
  return UF_SET.has(value.trim().toUpperCase());
}
