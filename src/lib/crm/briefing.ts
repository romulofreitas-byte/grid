import { gridPresenceFromEnrichment } from "@/lib/audit/grid-presence";
import { uniquePhones, waHrefFromPhone } from "@/lib/crm/dial";
import { peopleFromDeal } from "@/lib/crm/people";
import { mapsListingHref } from "@/lib/enrichment/company-name";
import { companySiteHref } from "@/lib/enrichment/company-site";
import type { CrmDeal } from "@/lib/crm/types";
import { formatPhone } from "@/lib/format";
import { phonesMatch } from "@/lib/phone";
import {
  gmbListingStatus,
  type ContactInfo,
  type GridPresenceAsset,
  type LeadDossier,
  type LeadEnrichment,
  type PhoneEvidence,
  type PhoneSource,
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

export type CrmPhoneSourceKind = "site" | "receita" | "maps" | "crm";

export type CrmSourcedPhone = {
  phone: string;
  source: CrmPhoneSourceKind;
};

const PHONE_SOURCE_RANK: Record<CrmPhoneSourceKind, number> = {
  site: 0,
  maps: 1,
  receita: 2,
  crm: 3,
};

export type CrmBriefing = {
  company: string;
  phone: string | null;
  phones: string[];
  phoneSources: CrmSourcedPhone[];
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
  sourcedPhones?: CrmSourcedPhone[];
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

export function briefingWhatsappHref(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const trimmed = raw.trim();
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com)\//i.test(trimmed)) {
    return trimmed;
  }
  return waHrefFromPhone(trimmed);
}

export function mergeSourcedPhones(
  entries: readonly CrmSourcedPhone[],
): CrmSourcedPhone[] {
  const out: CrmSourcedPhone[] = [];
  for (const entry of entries) {
    const phone = entry.phone.trim();
    if (!phone) continue;
    const idx = out.findIndex(
      (row) => row.phone === phone || phonesMatch(row.phone, phone),
    );
    if (idx < 0) {
      out.push({ phone, source: entry.source });
      continue;
    }
    const current = out[idx]!;
    if (PHONE_SOURCE_RANK[entry.source] < PHONE_SOURCE_RANK[current.source]) {
      out[idx] = { phone: current.phone, source: entry.source };
    }
  }
  return out;
}

function kindFromPhoneSources(
  sources: readonly PhoneSource[],
): CrmPhoneSourceKind | null {
  const usable = sources.filter((source) => source !== "osm");
  if (usable.length === 0) return null;
  if (usable.some((source) => source.startsWith("site"))) return "site";
  if (usable.includes("maps")) return "maps";
  if (usable.includes("receita")) return "receita";
  return null;
}

function displayFromE164(e164: string): string | null {
  const digits = e164.replace(/\D/g, "");
  const national = digits.startsWith("55") ? digits.slice(2) : digits;
  if (national.length < 10) return null;
  return formatPhone(national.slice(0, 2), national.slice(2));
}

export function sourcedPhonesFromEvidence(
  phones: readonly PhoneEvidence[],
): CrmSourcedPhone[] {
  const out: CrmSourcedPhone[] = [];
  for (const evidence of phones) {
    const kind = kindFromPhoneSources(
      Array.isArray(evidence.sources) ? evidence.sources : [],
    );
    if (!kind) continue;
    const phone =
      (typeof evidence.display === "string" && evidence.display.trim()) ||
      (typeof evidence.e164 === "string" ? displayFromE164(evidence.e164) : null);
    if (!phone) continue;
    out.push({ phone, source: kind });
  }
  return mergeSourcedPhones(out);
}

export function sourcedPhonesFromUnknown(raw: unknown): CrmSourcedPhone[] {
  if (!Array.isArray(raw)) return [];
  const evidences: PhoneEvidence[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Partial<PhoneEvidence>;
    if (typeof row.e164 !== "string" && typeof row.display !== "string") continue;
    evidences.push(row as PhoneEvidence);
  }
  return sourcedPhonesFromEvidence(evidences);
}

function kindFromContact(contact: ContactInfo): CrmPhoneSourceKind {
  return contact.source === "site" ? "site" : "receita";
}

function sourcedPhonesFromDossier(dossier: LeadDossier): CrmSourcedPhone[] {
  const est = dossier.establishment;
  const fromEstablishment = [
    formatPhone(est.ddd1, est.telefone1),
    formatPhone(est.ddd2, est.telefone2),
  ]
    .filter((phone): phone is string => Boolean(phone))
    .map((phone) => ({ phone, source: "receita" as const }));
  const fromContacts = (dossier.contacts ?? []).flatMap((contact) => {
    const phone = formatPhone(contact.ddd, contact.telefone);
    return phone ? [{ phone, source: kindFromContact(contact) }] : [];
  });
  const fromEnrichment = dossier.enrichment
    ? sourcedPhonesFromEvidence(dossier.enrichment.phones)
    : [];
  return mergeSourcedPhones([
    ...fromEnrichment,
    ...fromContacts,
    ...fromEstablishment,
  ]);
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
  const whatsappHref = briefingWhatsappHref(input.whatsapp);
  const whatsappFound =
    Boolean(whatsappHref) ||
    (typeof input.whatsapp === "string" && Boolean(input.whatsapp.trim()));
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
      found: whatsappFound,
      href: whatsappHref,
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
  const phoneSources = mergeSourcedPhones([
    ...deal.phones.map((phone) => ({ phone, source: "crm" as const })),
    ...(primary?.phone ? [{ phone: primary.phone, source: "crm" as const }] : []),
    ...(lookup?.sourcedPhones ?? []),
    ...(lookup?.extraPhones ?? []).map((phone) => ({
      phone,
      source: "receita" as const,
    })),
    ...(dossier ? sourcedPhonesFromDossier(dossier) : []),
  ]);
  const phones = uniquePhones(phoneSources.map((row) => row.phone));
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
    phoneSources,
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
