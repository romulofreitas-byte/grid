export type DocumentoTipo = "cpf" | "cnpj";

export type ParsedDocumento = {
  digits: string;
  tipo: DocumentoTipo;
};

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function allSameDigits(digits: string): boolean {
  return /^(\d)\1+$/.test(digits);
}

function cpfValid(digits: string): boolean {
  if (digits.length !== 11 || allSameDigits(digits)) return false;
  const nums = digits.split("").map(Number);
  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += nums[i] * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== nums[9]) return false;
  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += nums[i] * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === nums[10];
}

function cnpjValid(digits: string): boolean {
  if (digits.length !== 14 || allSameDigits(digits)) return false;
  const nums = digits.split("").map(Number);
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 12; i += 1) sum += nums[i] * w1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (d1 !== nums[12]) return false;
  sum = 0;
  for (let i = 0; i < 13; i += 1) sum += nums[i] * w2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return d2 === nums[13];
}

export function parseDocumento(raw: string | null | undefined): ParsedDocumento | null {
  if (!raw) return null;
  const digits = onlyDigits(raw);
  if (digits.length === 11 && cpfValid(digits)) {
    return { digits, tipo: "cpf" };
  }
  if (digits.length === 14 && cnpjValid(digits)) {
    return { digits, tipo: "cnpj" };
  }
  return null;
}

export function formatDocumento(digits: string, tipo: DocumentoTipo): string {
  if (tipo === "cpf" && digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (tipo === "cnpj" && digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return digits;
}
