import type { ContactSeal, GridRow, LeadDossier, Profile } from "@/lib/types";
import type { LeadCrmState } from "@/lib/crm/types";

export type LeadPreview = {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string;
  uf: string;
  telefone: string | null;
  seal: ContactSeal | null;
  decisorNome: string | null;
  cnaeDescricao: string;
};

export function normalizeLeadCnpj(cnpj: string): string {
  return cnpj.replace(/\D/g, "").padStart(14, "0");
}

export function leadQueryKey(cnpj: string, searchId?: string) {
  return ["lead", normalizeLeadCnpj(cnpj), searchId ?? null] as const;
}

export function leadPreviewKey(cnpj: string) {
  return ["lead-preview", normalizeLeadCnpj(cnpj)] as const;
}

export function gridRowToPreview(row: GridRow): LeadPreview {
  return {
    cnpj: normalizeLeadCnpj(row.cnpj),
    razaoSocial: row.razaoSocial,
    nomeFantasia: row.nomeFantasia,
    municipio: row.municipio,
    uf: row.uf,
    telefone: row.telefone,
    seal: row.seal,
    decisorNome: row.decisorNome,
    cnaeDescricao: row.cnaeDescricao,
  };
}

export function companyHitToPreview(hit: {
  cnpj: string;
  razaoSocial: string;
  nomeFantasia: string | null;
  municipio: string;
  uf: string;
  telefone?: string | null;
  decisorNome?: string | null;
  cnaeDescricao?: string;
}): LeadPreview {
  return {
    cnpj: normalizeLeadCnpj(hit.cnpj),
    razaoSocial: hit.razaoSocial,
    nomeFantasia: hit.nomeFantasia,
    municipio: hit.municipio,
    uf: hit.uf,
    telefone: hit.telefone ?? null,
    seal: null,
    decisorNome: hit.decisorNome ?? null,
    cnaeDescricao: hit.cnaeDescricao ?? "",
  };
}

export async function fetchLeadDossier(cnpj: string, searchId?: string) {
  const id = normalizeLeadCnpj(cnpj);
  const qs = searchId ? `?searchId=${encodeURIComponent(searchId)}` : "";
  const res = await fetch(`/api/lead/${id}${qs}`);
  if (!res.ok) throw new Error("Lead não encontrado");
  return (await res.json()) as LeadDossier & {
    profile: Profile;
    enrichAllowed?: boolean;
    searchSaved?: boolean;
    searchNome?: string | null;
    crm?: LeadCrmState | null;
    wasQualified?: boolean;
  };
}
