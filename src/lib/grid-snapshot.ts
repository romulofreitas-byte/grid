import type { GridRow, GridRowSnapshot } from "@/lib/types";

function asObject(raw: unknown): Record<string, unknown> | null {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

export function parseGridSnapshot(raw: unknown): GridRowSnapshot | null {
  const obj = asObject(raw);
  if (!obj) return null;
  const inner = asObject(obj.gridSnapshot) ?? (obj.razaoSocial != null ? obj : null);
  if (!inner) return null;
  if (typeof inner.razaoSocial !== "string" || typeof inner.uf !== "string") {
    return null;
  }
  return {
    razaoSocial: inner.razaoSocial,
    nomeFantasia:
      inner.nomeFantasia == null ? null : String(inner.nomeFantasia),
    municipio:
      typeof inner.municipio === "string" ? inner.municipio : "NÃO ENCONTRADO",
    uf: inner.uf,
    cnaeCodigo: inner.cnaeCodigo == null ? null : String(inner.cnaeCodigo),
    cnaeDescricao:
      typeof inner.cnaeDescricao === "string"
        ? inner.cnaeDescricao
        : "NÃO ENCONTRADO",
    telefone: inner.telefone == null ? null : String(inner.telefone),
    seal: (inner.seal as GridRowSnapshot["seal"]) ?? "NAO_CONFIRMADO",
    sharedCount: Number(inner.sharedCount ?? 0),
    sharedVerdict: inner.sharedVerdict as GridRowSnapshot["sharedVerdict"],
    decisorNome:
      inner.decisorNome == null ? null : String(inner.decisorNome),
    porte: inner.porte == null ? null : String(inner.porte),
    email: inner.email == null ? null : String(inner.email),
  };
}

export function gridRowFromSnapshot(
  cnpj: string,
  snap: GridRowSnapshot,
  lead: { gridScore: number; gridPosition: number },
): GridRow {
  return {
    cnpj,
    razaoSocial: snap.razaoSocial,
    nomeFantasia: snap.nomeFantasia,
    municipio: snap.municipio,
    uf: snap.uf,
    cnaeCodigo: snap.cnaeCodigo,
    cnaeDescricao: snap.cnaeDescricao,
    telefone: snap.telefone,
    seal: snap.seal,
    sharedCount: snap.sharedCount,
    sharedVerdict: snap.sharedVerdict,
    decisorNome: snap.decisorNome,
    porte: snap.porte,
    email: snap.email ?? null,
    gridScore: lead.gridScore,
    gridPosition: lead.gridPosition,
    enrichmentStatus: null,
    hasAudit: false,
  };
}

/** Last resort after a real RF lookup fails — never invented company data. */
export function gridRowStub(
  cnpj: string,
  lead: { gridScore: number; gridPosition: number },
): GridRow {
  return {
    cnpj,
    razaoSocial: cnpj,
    nomeFantasia: null,
    municipio: "NÃO ENCONTRADO",
    uf: "",
    cnaeCodigo: null,
    cnaeDescricao: "NÃO ENCONTRADO",
    telefone: null,
    seal: "NAO_CONFIRMADO",
    sharedCount: 0,
    decisorNome: null,
    porte: null,
    email: null,
    gridScore: lead.gridScore,
    gridPosition: lead.gridPosition,
    enrichmentStatus: null,
    hasAudit: false,
  };
}
