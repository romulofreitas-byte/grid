export type ExportQuote = {
  companies: number;
  chargeable: number;
  skipped: number;
  unitCost: number;
  needed: number;
  available: number;
};

function readFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parseExportQuote(json: unknown): ExportQuote | null {
  if (!json || typeof json !== "object") return null;
  const row = json as Record<string, unknown>;
  const companies = readFiniteNumber(row.companies);
  const chargeable = readFiniteNumber(row.chargeable);
  const skipped = readFiniteNumber(row.skipped);
  const unitCost = readFiniteNumber(row.unitCost);
  const needed = readFiniteNumber(row.needed);
  const available = readFiniteNumber(row.available);
  if (
    companies === null ||
    chargeable === null ||
    skipped === null ||
    unitCost === null ||
    needed === null ||
    available === null
  ) {
    return null;
  }
  return { companies, chargeable, skipped, unitCost, needed, available };
}
