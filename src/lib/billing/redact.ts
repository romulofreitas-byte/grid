import type { CompanySearchHit, GridRow, LeadDossier, LeadEnrichment } from "@/lib/types";

const MASK_PHONE = "••••-••••";

/** Hides contact/decisor on grid for Treino livre — export still unlocks full data. */
export function redactGridRow(row: GridRow, enrichAllowed: boolean): GridRow {
  if (enrichAllowed) return row;
  return {
    ...row,
    telefone: row.telefone ? MASK_PHONE : null,
    email: row.email ? "••••@••••" : null,
    decisorNome: null,
  };
}

export function redactGridRows(rows: GridRow[], enrichAllowed: boolean): GridRow[] {
  if (enrichAllowed) return rows;
  return rows.map((r) => redactGridRow(r, false));
}

/** Masks phone and decisor on autocomplete cards for Treino livre. */
export function redactCompanySearchHit(
  hit: CompanySearchHit,
  enrichAllowed: boolean,
): CompanySearchHit {
  if (enrichAllowed) return hit;
  return {
    ...hit,
    telefone: hit.telefone ? MASK_PHONE : null,
    decisorNome: null,
  };
}

export function redactCompanySearchHits(
  hits: CompanySearchHit[],
  enrichAllowed: boolean,
): CompanySearchHit[] {
  if (enrichAllowed) return hits;
  return hits.map((h) => redactCompanySearchHit(h, false));
}

function stripEnrichmentFields(enrichment: LeadEnrichment | null): LeadEnrichment | null {
  if (!enrichment) return null;
  return {
    ...enrichment,
    phones: [],
    emails: [],
    whatsapp: null,
    socials: {},
    tech: {
      metaPixel: false,
      gtm: false,
      ga4: false,
      googleAds: false,
      tiktokPixel: false,
      rdStation: false,
      hotjar: false,
      clarity: false,
      chat: null,
      plataforma: null,
      https: false,
      viewport: false,
    },
    people: null,
    contexto: [],
    dor_digital: 0,
    domain: null,
    domain_status: "nao_encontrado",
    gmb: null,
    discarded_domains: [],
    stage: "complete",
  };
}

/** Paid plans see qualification; free plan only sees Receita cadastral in the ficha. */
export function redactDossier(
  dossier: LeadDossier,
  opts: { showEnrichment: boolean; showContacts: boolean },
): LeadDossier {
  let out: LeadDossier = { ...dossier };

  if (!opts.showEnrichment) {
    out = {
      ...out,
      enrichment: stripEnrichmentFields(out.enrichment),
      enrichmentJobStatus: null,
      goldenMinute:
        dossier.enrichment && dossier.goldenMinute
          ? { contexto: "", facts: [], insufficient: true }
          : dossier.goldenMinute,
    };
  }

  if (!opts.showContacts) {
    out = {
      ...out,
      contacts: out.contacts.map((c) => ({
        ...c,
        ddd: "**",
        telefone: "••••-••••",
        label: "Exporte para ver o contato",
      })),
      emailSeal: {
        email: null,
        shared: false,
        free: false,
        accountantHint: false,
      },
      decisor: out.decisor
        ? {
            ...out.decisor,
            nome: "Assine para ver",
            qualificacao: "—",
          }
        : null,
      socios: out.socios.map((s) => ({
        ...s,
        nome: "Assine para ver sócios",
      })),
      establishment: {
        ...out.establishment,
        email: null,
        ddd1: null,
        telefone1: null,
        ddd2: null,
        telefone2: null,
      },
    };
  }

  return out;
}
