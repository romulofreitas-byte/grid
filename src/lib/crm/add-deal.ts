import { digitsCnpj } from "@/lib/crm/bridge";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatPhone } from "@/lib/format";
import { normalizePhoneBR, phonesMatch } from "@/lib/phone";
import type { CompanySearchHit, LeadDossier, PartnerCard } from "@/lib/types";

export type AddDealSelectedCompany = {
  cnpj: string;
  municipio: string;
  uf: string;
};

export type AddDealFromHit = {
  company_name: string;
  contact_name: string;
  phones: string[];
  cnpj: string;
  municipio: string;
  uf: string;
};

export type AddDealSocio = {
  nome: string;
  qualificacao: string;
};

export type AddDealFromDossier = {
  phones: string[];
  socios: AddDealSocio[];
  contact_name: string;
};

function formatDealPhone(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const parsed = normalizePhoneBR(trimmed);
  const display = parsed?.display ?? trimmed;
  return display.slice(0, 24);
}

export function mergeDealPhones(base: string[], extra: string[]): string[] {
  const out: string[] = [];
  for (const raw of [...base, ...extra]) {
    const phone = formatDealPhone(raw);
    if (!phone) continue;
    if (out.some((existing) => existing === phone || phonesMatch(existing, phone))) {
      continue;
    }
    out.push(phone);
    if (out.length >= 8) break;
  }
  return out;
}

export function dealFieldsFromCompanyHit(hit: CompanySearchHit): AddDealFromHit {
  return {
    company_name: displayCompanyName(hit.nomeFantasia, hit.razaoSocial).slice(0, 120),
    contact_name: (hit.decisorNome ?? "").trim().slice(0, 80),
    phones: mergeDealPhones([], hit.telefone ? [hit.telefone] : []),
    cnpj: digitsCnpj(hit.cnpj),
    municipio: hit.municipio,
    uf: hit.uf,
  };
}

export function sociosFromPartners(socios: PartnerCard[]): AddDealSocio[] {
  const seen = new Set<string>();
  const out: AddDealSocio[] = [];
  for (const socio of socios) {
    const nome = socio.nome.trim().slice(0, 80);
    if (!nome) continue;
    const key = nome.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ nome, qualificacao: socio.qualificacao.trim() });
  }
  return out;
}

export function dealFieldsFromDossier(
  dossier: Pick<LeadDossier, "contacts" | "socios" | "decisor">,
): AddDealFromDossier {
  const phones = mergeDealPhones(
    [],
    dossier.contacts
      .map((contact) => formatPhone(contact.ddd, contact.telefone))
      .filter((phone): phone is string => Boolean(phone)),
  );
  const socios = sociosFromPartners(dossier.socios);
  return {
    phones,
    socios,
    contact_name: (dossier.decisor?.nome ?? socios[0]?.nome ?? "").trim().slice(0, 80),
  };
}

export function findDealByCnpj<T extends { cnpj: string | null }>(
  deals: T[],
  cnpj: string,
): T | null {
  const digits = digitsCnpj(cnpj);
  return deals.find((deal) => deal.cnpj && digitsCnpj(deal.cnpj) === digits) ?? null;
}
