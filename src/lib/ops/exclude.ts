export const OPS_EXCLUDED_EMAILS = [
  "mundopodium@gmail.com",
  "administracao@combustivelmv.com",
  "romulo.freitas@combustivelmv.com",
] as const;

export const OPS_EXCLUDED_NAMES = [
  "mundopodium",
  "administracao",
  "romulo.freitas",
  "rômulo freitas",
] as const;

const excludedEmails = new Set<string>(OPS_EXCLUDED_EMAILS);
const excludedNames = new Set<string>(OPS_EXCLUDED_NAMES);

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function isOpsInternalTester(input: {
  email?: string | null;
  nome?: string | null;
}): boolean {
  return excludedEmails.has(norm(input.email)) || excludedNames.has(norm(input.nome));
}
