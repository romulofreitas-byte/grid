import { digitsCnpj } from "@/lib/crm/bridge";
import {
  emptyPerson,
  peopleFromDeal,
  sanitizePeople,
} from "@/lib/crm/people";
import {
  briefingBadgesFromPresence,
  briefingPresenceFromEnrichment,
  type CrmBriefingBadge,
} from "@/lib/crm/briefing";
import { displayCompanyName } from "@/lib/enrichment/company-name";
import { formatPhone } from "@/lib/format";
import { normalizePhoneBR, phonesMatch } from "@/lib/phone";
import type {
  Company,
  CompanySearchHit,
  Establishment,
  LeadDossier,
  PartnerCard,
} from "@/lib/types";

export type AddDealSelectedCompany = {
  cnpj: string;
  municipio: string;
  uf: string;
  cnaeDescricao: string;
};

export type AddDealFromHit = {
  company_name: string;
  contact_name: string;
  phones: string[];
  cnpj: string;
  municipio: string;
  uf: string;
  cnaeDescricao: string;
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

export type AddDealReviewBriefing = {
  company: string;
  cnpj: string;
  municipio: string | null;
  uf: string | null;
  cnae: string | null;
  phones: string[];
  contact: string | null;
  badges: CrmBriefingBadge[];
};

export type AddDealReviewDossier = {
  establishment: Pick<Establishment, "cnpj" | "nome_fantasia" | "uf">;
  company: Pick<Company, "razao_social">;
  cnaeDescricao: string;
  municipioNome: string;
  contacts: LeadDossier["contacts"];
  socios: LeadDossier["socios"];
  decisor: LeadDossier["decisor"];
  enrichment: LeadDossier["enrichment"];
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
    cnaeDescricao: hit.cnaeDescricao.trim(),
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

export function reviewBriefingFromDossier(
  dossier: AddDealReviewDossier,
  fallback?: {
    company?: string;
    municipio?: string;
    uf?: string;
    cnae?: string;
  },
): AddDealReviewBriefing {
  const extras = dealFieldsFromDossier(dossier);
  const company =
    displayCompanyName(
      dossier.establishment.nome_fantasia,
      dossier.company.razao_social,
    ).trim() ||
    fallback?.company?.trim() ||
    "";
  const municipio =
    dossier.municipioNome.trim() || fallback?.municipio?.trim() || null;
  const uf = dossier.establishment.uf.trim() || fallback?.uf?.trim() || null;
  const cnae = dossier.cnaeDescricao.trim() || fallback?.cnae?.trim() || null;
  return {
    company,
    cnpj: digitsCnpj(dossier.establishment.cnpj),
    municipio,
    uf,
    cnae,
    phones: extras.phones,
    contact: extras.contact_name || null,
    badges: briefingBadgesFromPresence(
      briefingPresenceFromEnrichment(dossier.enrichment),
    ),
  };
}

export function enrichJobIsSettled(jobStatus: string | null | undefined): boolean {
  return jobStatus !== "pending" && jobStatus !== "running";
}

export function findDealByCnpj<T extends { cnpj: string | null }>(
  deals: T[],
  cnpj: string,
): T | null {
  const digits = digitsCnpj(cnpj);
  return deals.find((deal) => deal.cnpj && digitsCnpj(deal.cnpj) === digits) ?? null;
}

export function attachCompanyHitToDeal(
  deal: {
    contact_name: string;
    secretaries?: string[];
    phones: string[];
    people?: { name: string; phone: string; email: string }[];
  },
  hit: CompanySearchHit,
): {
  cnpj: string;
  phones: string[];
  people: { name: string; phone: string; email: string }[];
  contact_name: string;
} {
  const fields = dealFieldsFromCompanyHit(hit);
  const phones = mergeDealPhones(deal.phones, fields.phones);
  const people = sanitizePeople(
    peopleFromDeal({
      contact_name: deal.contact_name,
      secretaries: deal.secretaries ?? [],
      people: deal.people,
    }),
  );
  const primary = people[0] ?? emptyPerson();
  if (!primary.name.trim() && fields.contact_name) {
    primary.name = fields.contact_name;
  }
  const nextPeople = sanitizePeople([primary, ...people.slice(1)]);
  return {
    cnpj: fields.cnpj,
    phones,
    people: nextPeople,
    contact_name: nextPeople[0]?.name || deal.contact_name,
  };
}
