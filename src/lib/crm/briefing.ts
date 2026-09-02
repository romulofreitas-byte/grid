import { uniquePhones } from "@/lib/crm/dial";
import { peopleFromDeal } from "@/lib/crm/people";
import type { CrmDeal } from "@/lib/crm/types";
import { formatPhone } from "@/lib/format";
import type { LeadDossier, LeadEnrichment } from "@/lib/types";

export const CRM_PRESENCE_BADGE_IDS = [
  "site",
  "instagram",
  "whatsapp",
  "gmb",
] as const;

export type CrmPresenceBadgeId = (typeof CRM_PRESENCE_BADGE_IDS)[number];

export type CrmBriefingBadge = {
  id: CrmPresenceBadgeId;
  label: string;
  found: boolean;
};

export type CrmBriefing = {
  company: string;
  phone: string | null;
  phones: string[];
  contact: string | null;
  municipio: string | null;
  badges: CrmBriefingBadge[];
};

export type CrmBriefingPresence = Record<CrmPresenceBadgeId, boolean>;

export type CrmBriefingLookup = {
  municipioNome: string | null;
  extraPhones: string[];
  presence: CrmBriefingPresence | null;
};

const BADGE_LABELS: Record<CrmPresenceBadgeId, string> = {
  site: "Site",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  gmb: "Maps",
};

export function shouldFetchDossier(cnpj: string | null | undefined): boolean {
  return Boolean(cnpj && cnpj.replace(/\D/g, "").length === 14);
}

export function emptyBriefingPresence(): CrmBriefingPresence {
  return {
    site: false,
    instagram: false,
    whatsapp: false,
    gmb: false,
  };
}

export function briefingPresenceFromFields(input: {
  domainStatus?: string | null;
  instagram?: unknown;
  whatsapp?: unknown;
  gmbMatched?: unknown;
} | null): CrmBriefingPresence | null {
  if (!input) return null;
  return {
    site: (input.domainStatus ?? "nao_encontrado") !== "nao_encontrado",
    instagram: Boolean(input.instagram),
    whatsapp: Boolean(input.whatsapp),
    gmb: Boolean(input.gmbMatched),
  };
}

export function briefingPresenceFromEnrichment(
  enrichment: LeadEnrichment | null,
): CrmBriefingPresence {
  if (!enrichment) return emptyBriefingPresence();
  return (
    briefingPresenceFromFields({
      domainStatus: enrichment.domain_status,
      instagram: enrichment.socials?.instagram,
      whatsapp: enrichment.whatsapp,
      gmbMatched: enrichment.gmb?.matched,
    }) ?? emptyBriefingPresence()
  );
}

export function briefingBadgesFromPresence(
  presence: CrmBriefingPresence | null,
): CrmBriefingBadge[] {
  const flags = presence ?? emptyBriefingPresence();
  return CRM_PRESENCE_BADGE_IDS.map((id) => ({
    id,
    label: BADGE_LABELS[id],
    found: flags[id],
  }));
}

export function briefingBadgesFromDossier(
  dossier: LeadDossier | null,
): CrmBriefingBadge[] {
  return briefingBadgesFromPresence(
    briefingPresenceFromEnrichment(dossier?.enrichment ?? null),
  );
}

function dossierPhones(dossier: LeadDossier): string[] {
  const est = dossier.establishment;
  const fromEstablishment = [
    formatPhone(est.ddd1, est.telefone1),
    formatPhone(est.ddd2, est.telefone2),
  ];
  const fromContacts = (dossier.contacts ?? []).map((contact) =>
    formatPhone(contact.ddd, contact.telefone),
  );
  return uniquePhones(
    [...fromEstablishment, ...fromContacts].filter(
      (value): value is string => Boolean(value),
    ),
  );
}

export function buildCrmBriefing(
  deal: Pick<CrmDeal, "company_name" | "contact_name" | "phones" | "people">,
  extras: LeadDossier | CrmBriefingLookup | null,
): CrmBriefing {
  const lookup = extras && isBriefingLookup(extras) ? extras : null;
  const dossier = extras && !lookup ? extras : null;
  const people = peopleFromDeal(deal);
  const primary = people[0];
  const phones = uniquePhones([
    ...deal.phones,
    ...(primary?.phone ? [primary.phone] : []),
    ...(lookup ? lookup.extraPhones : []),
    ...(dossier ? dossierPhones(dossier) : []),
  ]);
  const contact =
    primary?.name.trim() ||
    deal.contact_name.trim() ||
    dossier?.decisor?.nome ||
    null;
  return {
    company: deal.company_name,
    phone: phones[0] ?? null,
    phones,
    contact: contact || null,
    municipio:
      lookup?.municipioNome?.trim() ||
      dossier?.municipioNome?.trim() ||
      null,
    badges: lookup
      ? briefingBadgesFromPresence(lookup.presence)
      : briefingBadgesFromDossier(dossier),
  };
}

function isBriefingLookup(
  value: LeadDossier | CrmBriefingLookup,
): value is CrmBriefingLookup {
  return "extraPhones" in value && "presence" in value;
}

export async function loadCrmBriefing(
  deal: CrmDeal,
  getLookup: (cnpj: string) => Promise<CrmBriefingLookup | null>,
): Promise<CrmBriefing> {
  if (!shouldFetchDossier(deal.cnpj)) {
    return buildCrmBriefing(deal, null);
  }
  try {
    const lookup = await getLookup(deal.cnpj!);
    return buildCrmBriefing(deal, lookup);
  } catch {
    return buildCrmBriefing(deal, null);
  }
}
