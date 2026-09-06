import { gridPresenceFromEnrichment } from "@/lib/audit/grid-presence";
import { uniquePhones } from "@/lib/crm/dial";
import { peopleFromDeal } from "@/lib/crm/people";
import { mapsListingHref } from "@/lib/enrichment/company-name";
import { companySiteHref } from "@/lib/enrichment/company-site";
import type { CrmDeal } from "@/lib/crm/types";
import { formatPhone } from "@/lib/format";
import {
  gmbListingStatus,
  type GridPresenceAsset,
  type LeadDossier,
  type LeadEnrichment,
} from "@/lib/types";

export const CRM_PRESENCE_BADGE_IDS = [
  "site",
  "instagram",
  "whatsapp",
  "gmb",
] as const;

export type CrmPresenceBadgeId = (typeof CRM_PRESENCE_BADGE_IDS)[number];

export const CRM_CARD_PRESENCE_IDS = [
  "site",
  "instagram",
  "whatsapp",
  "maps",
] as const;

export type CrmCardPresenceId = (typeof CRM_CARD_PRESENCE_IDS)[number];

export type CrmBriefingBadge = {
  id: CrmPresenceBadgeId;
  label: string;
  found: boolean;
};

export type CrmBriefingAsset = {
  id: CrmCardPresenceId;
  found: boolean;
  href: string | null;
  unverified?: boolean;
};

export type CrmBriefing = {
  company: string;
  phone: string | null;
  phones: string[];
  contact: string | null;
  municipio: string | null;
  address: string | null;
  cnae: string | null;
  decisor: string | null;
  badges: CrmBriefingBadge[];
  assets: CrmBriefingAsset[];
  audited: boolean;
};

export type CrmBriefingPresence = Record<CrmPresenceBadgeId, boolean>;

export type CrmBriefingLookup = {
  municipioNome: string | null;
  extraPhones: string[];
  presence: CrmBriefingPresence | null;
  address: string | null;
  cnae: string | null;
  decisor: string | null;
  assets: CrmBriefingAsset[] | null;
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

export function emptyBriefingAssets(): CrmBriefingAsset[] {
  return CRM_CARD_PRESENCE_IDS.map((id) => ({
    id,
    found: false,
    href: null,
  }));
}

export function formatReceitaAddress(parts: {
  logradouro?: string | null;
  numero?: string | null;
  bairro?: string | null;
  municipio?: string | null;
  uf?: string | null;
}): string | null {
  const street = [parts.logradouro?.trim(), parts.numero?.trim()]
    .filter(Boolean)
    .join(", ");
  const city = [parts.municipio?.trim(), parts.uf?.trim()]
    .filter(Boolean)
    .join("/");
  const line = [street, parts.bairro?.trim(), city].filter(Boolean).join(" · ");
  return line || null;
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

export function briefingAssetsFromFields(input: {
  domain?: string | null;
  domainStatus?: string | null;
  instagram?: unknown;
  whatsapp?: unknown;
  gmb?: Parameters<typeof mapsListingHref>[0];
} | null): CrmBriefingAsset[] | null {
  if (!input) return null;
  const siteFound = (input.domainStatus ?? "nao_encontrado") !== "nao_encontrado";
  const instagram =
    typeof input.instagram === "string" && input.instagram.trim()
      ? input.instagram.trim()
      : null;
  const whatsapp =
    typeof input.whatsapp === "string" && input.whatsapp.trim()
      ? input.whatsapp.trim()
      : null;
  const maps = mapsListingHref(input.gmb);
  return [
    {
      id: "site",
      found: siteFound,
      href: siteFound ? companySiteHref(input.domain) : null,
    },
    {
      id: "instagram",
      found: Boolean(instagram),
      href: instagram,
    },
    {
      id: "whatsapp",
      found: Boolean(whatsapp),
      href: whatsapp,
    },
    {
      id: "maps",
      found: Boolean(maps),
      href: maps,
    },
  ];
}

export function briefingAssetsFromGridPresence(
  found: GridPresenceAsset[],
): CrmBriefingAsset[] {
  const byId = new Map(found.map((asset) => [asset.id, asset]));
  const maps = byId.get("maps") ?? byId.get("gmb");
  return CRM_CARD_PRESENCE_IDS.map((id) => {
    const hit = id === "maps" ? maps : byId.get(id);
    return {
      id,
      found: Boolean(hit),
      href: hit?.href ?? null,
      unverified: hit?.unverified,
    };
  });
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
      gmbMatched: gmbListingStatus(enrichment.gmb) !== "none",
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

function dossierAddress(dossier: LeadDossier): string | null {
  const est = dossier.establishment;
  return formatReceitaAddress({
    logradouro: est.logradouro,
    numero: est.numero,
    bairro: est.bairro,
    municipio: dossier.municipioNome,
    uf: est.uf,
  });
}

function dossierAssets(dossier: LeadDossier | null): CrmBriefingAsset[] {
  if (!dossier?.enrichment) return emptyBriefingAssets();
  return briefingAssetsFromGridPresence(
    gridPresenceFromEnrichment(dossier.enrichment),
  );
}

export function buildCrmBriefing(
  deal: Pick<
    CrmDeal,
    "company_name" | "contact_name" | "phones" | "people" | "secretaries"
  >,
  extras: LeadDossier | CrmBriefingLookup | null,
): CrmBriefing {
  const lookup = extras && isBriefingLookup(extras) ? extras : null;
  const dossier: LeadDossier | null =
    extras && !isBriefingLookup(extras) ? extras : null;
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
    lookup?.decisor?.trim() ||
    dossier?.decisor?.nome ||
    null;
  const audited = extrasAreAudited(lookup, dossier);
  return {
    company: deal.company_name,
    phone: phones[0] ?? null,
    phones,
    contact: contact || null,
    municipio:
      lookup?.municipioNome?.trim() ||
      dossier?.municipioNome?.trim() ||
      null,
    address: lookup?.address ?? (dossier ? dossierAddress(dossier) : null),
    cnae: lookup?.cnae?.trim() || dossier?.cnaeDescricao?.trim() || null,
    decisor:
      lookup?.decisor?.trim() ||
      dossier?.decisor?.nome?.trim() ||
      null,
    badges: lookup
      ? briefingBadgesFromPresence(lookup.presence)
      : briefingBadgesFromDossier(dossier),
    assets: audited
      ? (lookup?.assets ?? dossierAssets(dossier))
      : emptyBriefingAssets(),
    audited,
  };
}

function extrasAreAudited(
  lookup: CrmBriefingLookup | null,
  dossier: LeadDossier | null,
): boolean {
  if (lookup) return lookup.presence != null;
  return Boolean(dossier?.enrichment);
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
