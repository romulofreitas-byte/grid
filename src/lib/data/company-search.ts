export type CompanySearchOpts = {
  ufs?: string[];
  limit?: number;
  soMatriz?: boolean;
};

export const COMPANY_NAME_MIN_CHARS = 3;
export const COMPANY_SEARCH_LIMIT = 20;
export const COMPANY_PREFIX_ENOUGH = 8;

export function companySearchDigits(q: string): string {
  return q.replace(/\D/g, "");
}

export function isCompanyCnpjQuery(q: string): boolean {
  const digits = companySearchDigits(q);
  return digits.length >= 8 && digits.length <= 14;
}

export function canSearchCompanies(q: string): boolean {
  const t = q.trim();
  if (isCompanyCnpjQuery(t)) return true;
  return t.length >= COMPANY_NAME_MIN_CHARS;
}

export function escapeIlike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
