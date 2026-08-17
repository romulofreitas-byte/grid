import type { ContactInfo, LeadDossier, LeadEnrichment, PhoneSource } from "@/lib/types";
import { normalizePhoneBR } from "@/lib/phone";
import {
  leadOutboundSchema,
  type LeadOutbound,
  type LeadOutboundPhone,
  type OutboundPhoneSource,
} from "./schema";

const EXPORTABLE_SOURCES = new Set<OutboundPhoneSource>([
  "receita",
  "site_tel",
  "site_schema",
  "site_texto",
  "site_whatsapp",
]);

export type LeadOutboundContext = {
  searchId: string;
  searchName?: string | null;
  dossierUrl: string;
  nicheSlug?: string | null;
  segmentSlugs?: string[];
  collectedAt?: string;
};

function exportableSources(sources: PhoneSource[]): OutboundPhoneSource[] {
  return sources.filter((s): s is OutboundPhoneSource => EXPORTABLE_SOURCES.has(s as OutboundPhoneSource));
}

function contactSourceToOutbound(source: ContactInfo["source"]): OutboundPhoneSource {
  return source === "site" ? "site_tel" : "receita";
}

function phoneFromContact(contact: ContactInfo): LeadOutboundPhone | null {
  const raw = `${contact.ddd ?? ""}${contact.telefone ?? ""}`;
  const normalized = normalizePhoneBR(raw, contact.ddd);
  if (!normalized) return null;
  return {
    e164: normalized.e164,
    display: normalized.display,
    tipo: normalized.tipo,
    sources: [contactSourceToOutbound(contact.source)],
    isWhatsApp: false,
    seal: contact.seal,
    sharedCount: contact.sharedCount,
    sharedVerdict: contact.sharedVerdict,
  };
}

function phonesFromEnrichment(enrichment: LeadEnrichment): LeadOutboundPhone[] {
  const out: LeadOutboundPhone[] = [];
  for (const phone of enrichment.phones) {
    const sources = exportableSources(phone.sources);
    if (sources.length === 0) continue;
    out.push({
      e164: phone.e164.startsWith("+") ? phone.e164 : `+${phone.e164.replace(/^\+/, "")}`,
      display: phone.display,
      tipo: phone.tipo,
      sources,
      isWhatsApp: phone.isWhatsApp,
      seal: phone.seal,
      sharedCount: phone.sharedCount,
      sharedVerdict: phone.sharedVerdict,
    });
  }
  return out;
}

function mergePhones(primary: LeadOutboundPhone[]): LeadOutboundPhone[] {
  const byE164 = new Map<string, LeadOutboundPhone>();
  for (const phone of primary) {
    const existing = byE164.get(phone.e164);
    if (!existing) {
      byE164.set(phone.e164, { ...phone, sources: [...phone.sources] });
      continue;
    }
    const sources = new Set<OutboundPhoneSource>([...existing.sources, ...phone.sources]);
    byE164.set(phone.e164, {
      ...existing,
      sources: [...sources],
      isWhatsApp: existing.isWhatsApp || phone.isWhatsApp,
      sharedCount: existing.sharedCount ?? phone.sharedCount,
      sharedVerdict: existing.sharedVerdict ?? phone.sharedVerdict,
    });
  }
  return [...byE164.values()];
}

function whatsappE164(dossier: LeadDossier, phones: LeadOutboundPhone[]): string | null {
  const fromEnrichment = dossier.enrichment?.whatsapp;
  if (fromEnrichment) {
    const normalized = normalizePhoneBR(fromEnrichment);
    if (normalized) return normalized.e164;
    if (fromEnrichment.startsWith("+")) return fromEnrichment;
  }
  return phones.find((p) => p.isWhatsApp)?.e164 ?? null;
}

function emailFromDossier(
  dossier: LeadDossier,
  collectedAt: string,
): LeadOutbound["email"] {
  const valor = dossier.emailSeal.email?.trim() || null;
  if (!valor) return null;
  const fromEnrichment = dossier.enrichment?.emails.find((e) => e.valor === valor);
  return {
    valor,
    shared: dossier.emailSeal.shared,
    free: dossier.emailSeal.free,
    accountantHint: dossier.emailSeal.accountantHint,
    fonte: fromEnrichment?.fonte ?? "receita",
    coletado_em: fromEnrichment?.coletado_em ?? collectedAt,
  };
}

function fonteValor(key: string, dossier: LeadDossier): string {
  if (key === "domain") return dossier.enrichment?.domain ?? "";
  if (key === "razao_social") return dossier.company.razao_social;
  if (key === "nome_fantasia") return dossier.establishment.nome_fantasia ?? "";
  return "";
}

function fonteRecord(dossier: LeadDossier, collectedAt: string): LeadOutbound["fonte"] {
  const fonte: LeadOutbound["fonte"] = {
    razao_social: {
      valor: dossier.company.razao_social,
      fonte: "receita",
      coletado_em: collectedAt,
    },
  };
  if (dossier.enrichment?.fonte) {
    for (const [key, meta] of Object.entries(dossier.enrichment.fonte)) {
      fonte[key] = {
        valor: fonteValor(key, dossier),
        fonte: meta.fonte,
        coletado_em: meta.coletado_em,
      };
    }
  }
  return fonte;
}

/**
 * Map a GRID dossier to the canonical outbound contract.
 * Drops OSM-only phones. Never copies a CPF field.
 */
export function toLeadOutbound(
  dossier: LeadDossier,
  ctx: LeadOutboundContext,
): LeadOutbound {
  const collectedAt = ctx.collectedAt ?? dossier.enrichment?.collected_at ?? new Date().toISOString();
  const fromContacts = dossier.contacts
    .map(phoneFromContact)
    .filter((p): p is LeadOutboundPhone => p !== null);
  const fromEnrichment = dossier.enrichment ? phonesFromEnrichment(dossier.enrichment) : [];
  const phones = mergePhones([...fromEnrichment, ...fromContacts]);

  const payload: LeadOutbound = {
    cnpj: dossier.establishment.cnpj.replace(/\D/g, "").padStart(14, "0"),
    razao_social: dossier.company.razao_social,
    nome_fantasia: dossier.establishment.nome_fantasia,
    is_matriz: dossier.establishment.is_matriz,
    porte: dossier.company.porte,
    capital_social: dossier.company.capital_social,
    cnae_principal: dossier.establishment.cnae_principal,
    cnae_descricao: dossier.cnaeDescricao,
    address: {
      logradouro: dossier.establishment.logradouro,
      numero: dossier.establishment.numero,
      complemento: dossier.establishment.complemento,
      bairro: dossier.establishment.bairro,
      cep: dossier.establishment.cep,
      municipio: dossier.municipioNome,
      uf: dossier.establishment.uf,
    },
    phones,
    email: emailFromDossier(dossier, collectedAt),
    whatsapp: whatsappE164(dossier, phones),
    domain: dossier.enrichment?.domain ?? null,
    decisor: dossier.decisor
      ? {
          nome: dossier.decisor.nome,
          qualificacao: dossier.decisor.qualificacao,
          data_entrada: dossier.decisor.dataEntrada,
          faixa_etaria: dossier.decisor.faixaEtaria,
        }
      : null,
    grid_score: dossier.gridScore,
    grid_position: dossier.gridPosition,
    status: dossier.status,
    search_id: ctx.searchId,
    search_name: ctx.searchName ?? null,
    niche_slug: ctx.nicheSlug ?? null,
    segment_slugs: ctx.segmentSlugs ?? [],
    dossier_url: ctx.dossierUrl,
    osm_matched: dossier.enrichment?.osm?.matched ?? null,
    golden_minute: dossier.goldenMinute.insufficient
      ? null
      : {
          contexto: dossier.goldenMinute.contexto,
          facts: dossier.goldenMinute.facts,
          insufficient: dossier.goldenMinute.insufficient,
        },
    fonte: fonteRecord(dossier, collectedAt),
  };

  return leadOutboundSchema.parse(payload);
}
