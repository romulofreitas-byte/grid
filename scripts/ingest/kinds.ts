/**
 * Detect Receita Federal open-data file kinds from zip names and inner entries.
 * Inner CSVs often have no .csv extension (EMPRECSV, ESTABELE, SOCIOCSV, …).
 */

export const RF_KINDS = [
  "empresas",
  "estabelecimentos",
  "socios",
  "simples",
  "cnaes",
  "municipios",
  "naturezas",
  "qualificacoes",
] as const;

export type RfKind = (typeof RF_KINDS)[number];

const SKIP_ARCHIVES = /^(motivos|paises)(\d*)\.zip$/i;

const KIND_ZIP: Record<RfKind, RegExp> = {
  empresas: /^empresas\d*\.zip$/i,
  estabelecimentos: /^estabelecimentos\d*\.zip$/i,
  socios: /^socios\d*\.zip$/i,
  simples: /^simples\.zip$/i,
  cnaes: /^cnaes\.zip$/i,
  municipios: /^municipios\.zip$/i,
  naturezas: /^naturezas\.zip$/i,
  qualificacoes: /^qualificacoes\.zip$/i,
};

const KIND_ENTRY: Record<RfKind, RegExp> = {
  empresas: /emprecsv$/i,
  estabelecimentos: /estabele$/i,
  socios: /sociocsv$/i,
  simples: /simples/i,
  cnaes: /cnaecsv$/i,
  municipios: /municcsv$/i,
  naturezas: /natjucsv$/i,
  qualificacoes: /qualscsv$/i,
};

export function basenameLower(fileName: string): string {
  const normalized = fileName.replace(/\\/g, "/");
  const base = normalized.slice(normalized.lastIndexOf("/") + 1);
  return base.toLowerCase();
}

export function isSkippedArchive(fileName: string): boolean {
  return SKIP_ARCHIVES.test(basenameLower(fileName));
}

export function isMonthDumpZip(fileName: string): boolean {
  return /^\d{4}-\d{2}\.zip$/i.test(basenameLower(fileName));
}

export function matchesKindZip(fileName: string, kind: RfKind): boolean {
  const base = basenameLower(fileName);
  if (!base.endsWith(".zip") || isSkippedArchive(base)) return false;
  return KIND_ZIP[kind].test(base);
}

export function matchesKindEntry(fileName: string, kind: RfKind): boolean {
  const base = basenameLower(fileName);
  if (base.endsWith(".zip") || base.endsWith("/")) return false;
  if (KIND_ENTRY[kind].test(base)) return true;
  if (base.endsWith(".csv") && KIND_ZIP[kind].test(base.replace(/\.csv$/i, ".zip"))) {
    return true;
  }
  return false;
}

export function kindFromZipName(fileName: string): RfKind | null {
  for (const kind of RF_KINDS) {
    if (matchesKindZip(fileName, kind)) return kind;
  }
  return null;
}

export function isRfZip(fileName: string): boolean {
  return kindFromZipName(fileName) !== null;
}

export function isDirectoryEntry(fileName: string): boolean {
  return fileName.endsWith("/") || fileName.endsWith("\\");
}
