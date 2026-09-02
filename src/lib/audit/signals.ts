import { formatPhone } from "@/lib/format";
import { parseInstagramHandle } from "@/lib/instagram";
import { mapsListingHref } from "@/lib/enrichment/company-name";
import {
  companySiteHref,
  companySiteLabel,
  homepagePathOf,
} from "@/lib/enrichment/company-site";
import type { LeadEnrichment } from "@/lib/types";
import { gmbListingCorroborated } from "@/lib/types";

export type AuditGroup = "presenca" | "ferramentas";

export type AuditSignal = {
  id: string;
  group: AuditGroup;
  name: string;
  logo: string;
  initials: string;
  accent: string;
  found: boolean;
  unverified: boolean;
  href: string | null;
  openLabel: string | null;
  value: string;
  hint: string;
  note?: string;
  links: Array<{ label: string; href: string }>;
};

export const AUDIT_GROUPS: Array<{
  id: AuditGroup;
  label: string;
  hint: string;
}> = [
  {
    id: "presenca",
    label: "Presença",
    hint: "Onde a empresa aparece — site, redes, Google e WhatsApp.",
  },
  {
    id: "ferramentas",
    label: "Ferramentas",
    hint: "Pixels e tags que o site tem instalados.",
  },
];

const MARK = {
  site: {
    name: "Site",
    logo: "/audit/site.svg",
    initials: "ST",
    accent: "#F5B301",
  },
  instagram: {
    name: "Instagram",
    logo: "/audit/instagram.svg",
    initials: "IG",
    accent: "#E4405F",
  },
  facebook: {
    name: "Facebook",
    logo: "/audit/facebook.svg",
    initials: "FB",
    accent: "#1877F2",
  },
  linkedin: {
    name: "LinkedIn",
    logo: "/audit/linkedin.svg",
    initials: "in",
    accent: "#0A66C2",
  },
  youtube: {
    name: "YouTube",
    logo: "/audit/youtube.svg",
    initials: "YT",
    accent: "#FF0000",
  },
  gmb: {
    name: "Google Meu Negócio",
    logo: "/audit/gmb.svg",
    initials: "GM",
    accent: "#EA4335",
  },
  whatsapp: {
    name: "WhatsApp",
    logo: "/audit/whatsapp.svg",
    initials: "WA",
    accent: "#25D366",
  },
  atualizacao: {
    name: "Atualização",
    logo: "/audit/freshness.svg",
    initials: "©",
    accent: "#C5CDD8",
  },
  metaPixel: {
    name: "Meta Pixel",
    logo: "/audit/meta.svg",
    initials: "M",
    accent: "#0081FB",
  },
  gtm: {
    name: "GTM",
    logo: "/audit/gtm.svg",
    initials: "GT",
    accent: "#246FDB",
  },
  ga4: {
    name: "GA4",
    logo: "/audit/ga4.svg",
    initials: "GA",
    accent: "#E37400",
  },
  googleAds: {
    name: "Google Ads",
    logo: "/audit/google-ads.svg",
    initials: "AW",
    accent: "#4285F4",
  },
  tiktok: {
    name: "TikTok",
    logo: "/audit/tiktok.svg",
    initials: "TT",
    accent: "#FE2C55",
  },
  rdStation: {
    name: "RD Station",
    logo: "/integrations/rdstation.svg",
    initials: "RD",
    accent: "#19C1CE",
  },
  hotjar: {
    name: "Hotjar",
    logo: "/audit/hotjar.svg",
    initials: "HJ",
    accent: "#FF3C00",
  },
  clarity: {
    name: "Clarity",
    logo: "/audit/clarity.svg",
    initials: "CL",
    accent: "#6144D6",
  },
} as const;

const PLATFORM_MARK: Record<
  string,
  { name: string; logo: string; initials: string; accent: string }
> = {
  WordPress: {
    name: "WordPress",
    logo: "/audit/wordpress.svg",
    initials: "WP",
    accent: "#21759B",
  },
  Wix: {
    name: "Wix",
    logo: "/audit/wix.svg",
    initials: "WX",
    accent: "#0C6EFC",
  },
  Shopify: {
    name: "Shopify",
    logo: "/audit/shopify.svg",
    initials: "Sh",
    accent: "#96BF48",
  },
  VTEX: {
    name: "VTEX",
    logo: "/audit/vtex.svg",
    initials: "VX",
    accent: "#F71963",
  },
  Nuvemshop: {
    name: "Nuvemshop",
    logo: "/audit/nuvemshop.svg",
    initials: "Nv",
    accent: "#2D3277",
  },
  Tray: {
    name: "Tray",
    logo: "/audit/tray.svg",
    initials: "Tr",
    accent: "#FF6A00",
  },
};

const CHAT_MARK: Record<
  string,
  { name: string; logo: string; initials: string; accent: string }
> = {
  Tawk: {
    name: "Tawk",
    logo: "/audit/chat.svg",
    initials: "Tk",
    accent: "#03A84E",
  },
  JivoChat: {
    name: "JivoChat",
    logo: "/audit/chat.svg",
    initials: "JV",
    accent: "#3B82F6",
  },
  Blip: {
    name: "Blip",
    logo: "/audit/chat.svg",
    initials: "Bl",
    accent: "#1E90FF",
  },
  Zendesk: {
    name: "Zendesk",
    logo: "/audit/chat.svg",
    initials: "Zd",
    accent: "#03363D",
  },
  Movidesk: {
    name: "Movidesk",
    logo: "/audit/chat.svg",
    initials: "Mv",
    accent: "#6C5CE7",
  },
};

const GENERIC_PLATFORM = {
  name: "Plataforma",
  logo: "/audit/site.svg",
  initials: "PL",
  accent: "#7A8494",
};

const GENERIC_CHAT = {
  name: "Chat",
  logo: "/audit/chat.svg",
  initials: "CH",
  accent: "#25D366",
};

function signal(
  partial: Omit<AuditSignal, "links"> & { links?: AuditSignal["links"] },
): AuditSignal {
  return { links: [], ...partial };
}

function absUrl(raw: string | undefined, host: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http")) return trimmed;
  if (trimmed.startsWith("@")) return `https://${host}/${trimmed.slice(1)}`;
  return `https://${host}/${trimmed.replace(/^\/+/, "")}`;
}

function siteHref(e: LeadEnrichment): string | null {
  return companySiteHref(e.domain, homepagePathOf(e));
}

function siteValue(e: LeadEnrichment): string {
  return companySiteLabel(e.domain, homepagePathOf(e)) ?? "NÃO ENCONTRADO";
}

function adsLibraryUrl(raw: string | undefined): string | null {
  const handle = parseInstagramHandle(raw);
  if (!handle) return null;
  const q = encodeURIComponent(`@${handle}`);
  return `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=BR&is_targeted_country=false&media_type=all&search_type=keyword_unordered&q=${q}`;
}

function whatsappHref(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function whatsappValue(raw: string | null): string {
  if (!raw) return "NÃO ENCONTRADO";
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    const rest = digits.slice(2);
    return formatPhone(rest.slice(0, 2), rest.slice(2)) ?? digits;
  }
  return digits || raw;
}

function instagramValue(raw: string | undefined): string {
  if (!raw) return "NÃO ENCONTRADO";
  const handle = parseInstagramHandle(raw);
  return handle ? `@${handle}` : raw;
}

function presenceSearched(e: LeadEnrichment, key: string): boolean {
  const fonte = e.fonte[key]?.fonte;
  if (!fonte || fonte === "skipped_no_site" || fonte === "skipped_weak_brand") {
    return false;
  }
  return true;
}

function socialHint(
  found: boolean,
  searched: boolean,
  confirmed: boolean,
  live: string,
  missingConfirmed: string,
  missingSearch: string,
  blocked: string,
): string {
  if (found) return live;
  if (searched) return missingSearch;
  if (confirmed) return missingConfirmed;
  return blocked;
}

function isSerperSocialFonte(fonte: string | undefined): boolean {
  return fonte === "serper" || fonte === "serper_kg";
}

function socialLiveHint(
  fonte: string | undefined,
  confirmed = true,
  corroborated = false,
): string {
  if (fonte === "human") return "Inserido por você — não veio da Receita.";
  if (fonte === "site") return "Link encontrado no site confirmado.";
  if (isSerperSocialFonte(fonte) && corroborated) {
    return "Correlacionado na busca e no Maps.";
  }
  if (isSerperSocialFonte(fonte) && !confirmed) {
    return "A confirmar na busca — confirme o site para validar.";
  }
  if (isSerperSocialFonte(fonte)) {
    return "Perfil correlacionado à marca na busca (título/handle).";
  }
  return "Perfil encontrado no site confirmado ou na busca com a marca.";
}

function serperCandidate(
  fonte: string | undefined,
  confirmed: boolean,
  corroborated: boolean,
): boolean {
  return isSerperSocialFonte(fonte) && !confirmed && !corroborated;
}

function socialBlockedHint(asset: string): string {
  return `Sem site confirmado e sem marca distintiva — confirme o site para ver o ${asset}.`;
}

/** Server 5xx — the host answered and is actually down. */
export function isSiteOffline(e: LeadEnrichment): boolean {
  if (!e.domain || e.domain_status === "nao_encontrado") return false;
  return e.http_status != null && e.http_status >= 500;
}

/**
 * Bot could not read the page (4xx, timeout, WAF, robots). Not the same as
 * the site being down — the browser may still open it.
 */
export function isSiteFetchFailed(e: LeadEnrichment): boolean {
  if (!e.domain || e.domain_status === "nao_encontrado") return false;
  if (e.http_status != null) {
    return e.http_status >= 400 && e.http_status < 500;
  }
  return e.stage == null || e.stage === "complete";
}

function siteNote(e: LeadEnrichment): string | undefined {
  const bits: string[] = [];
  if (isSiteOffline(e)) {
    bits.push("Site fora do ar");
  } else if (isSiteFetchFailed(e)) {
    bits.push("Não abriu agora");
  }
  if (e.osm?.matched === true) {
    bits.push(
      e.osm.attribution
        ? `dados de contato conferidos com OpenStreetMap · ${e.osm.attribution}`
        : "dados de contato conferidos com OpenStreetMap",
    );
  }
  if (e.osm?.matched === false) {
    const base =
      "OpenStreetMap tem outro número — conferir na ficha. O número do OSM não entra no export.";
    bits.push(e.osm.attribution ? `${base} · ${e.osm.attribution}` : base);
  }
  return bits.length ? bits.join(" · ") : undefined;
}

function paidMediaHint(found: boolean): string {
  return found
    ? "Tag de anúncio no HTML — não é prova de verba ativa."
    : "Nenhuma tag de anúncio no HTML.";
}

export function isAuditGap(signal: AuditSignal): boolean {
  return !signal.found && !signal.unverified;
}

export function isAuditLive(signal: AuditSignal): boolean {
  return signal.found && !signal.unverified;
}

/** Site, Instagram and Google drive Qualificada / Oportunidade — same three as the public home. */
export const QUALIFY_SUMMARY_IDS = ["site", "instagram", "gmb"] as const;

export type QualifyChipKind = "qualificando" | "qualificada" | "oportunidade";

export function qualifyChipKind(
  signals: AuditSignal[],
  opts: { scanning: boolean; complete: boolean },
): QualifyChipKind | null {
  if (opts.scanning) return "qualificando";
  if (!opts.complete) return null;
  const core = QUALIFY_SUMMARY_IDS.map((id) =>
    signals.find((signal) => signal.id === id),
  );
  if (core.some((signal) => signal && isAuditGap(signal))) return "oportunidade";
  if (core.every((signal) => signal && isAuditLive(signal))) return "qualificada";
  return null;
}

export function auditSummary(signals: AuditSignal[]): {
  live: number;
  gaps: number;
  unverified: number;
} {
  let live = 0;
  let gaps = 0;
  let unverified = 0;
  for (const s of signals) {
    if (isAuditLive(s)) live += 1;
    else if (isAuditGap(s)) gaps += 1;
    else unverified += 1;
  }
  return { live, gaps, unverified };
}

export function defaultAuditSelection(signals: AuditSignal[]): string {
  return (
    signals.find(isAuditGap)?.id ??
    signals.find((s) => s.id === "site")?.id ??
    signals[0]?.id ??
    "site"
  );
}

const PENDING_VALUE = "—";
const PENDING_HINT = "Qualifique para ver este ativo.";

const SCAN_TOOLS_IDS = [
  "atualizacao",
  "metaPixel",
  "gtm",
  "ga4",
  "googleAds",
  "tiktok",
  "rdStation",
  "hotjar",
  "clarity",
  "chat",
  "plataforma",
] as const;

/** Tiles currently being read, based on the last completed enrichment stage. */
export function scanningSignalIds(
  stage: LeadEnrichment["stage"] | null | undefined,
  qualifying: boolean,
  enrichment?: LeadEnrichment | null,
): string[] {
  if (!qualifying) return [];
  if (!stage || stage === "domain") return ["site"];
  if (stage === "home") return ["site"];
  if (stage === "presence") {
    const step = enrichment?.fonte.presence_scan?.fonte;
    if (step === "gmb") return ["gmb"];
    if (step) return [step];
    return ["instagram"];
  }
  if (stage === "site") return [...SCAN_TOOLS_IDS];
  return [];
}

function pendingSignal(
  id: string,
  group: AuditGroup,
  mark: { name: string; logo: string; initials: string; accent: string },
): AuditSignal {
  return signal({
    id,
    group,
    ...mark,
    found: false,
    unverified: true,
    href: null,
    openLabel: null,
    value: PENDING_VALUE,
    hint: PENDING_HINT,
  });
}

export function emptyAuditSignals(): AuditSignal[] {
  return [
    pendingSignal("site", "presenca", MARK.site),
    pendingSignal("instagram", "presenca", MARK.instagram),
    pendingSignal("facebook", "presenca", MARK.facebook),
    pendingSignal("linkedin", "presenca", MARK.linkedin),
    pendingSignal("youtube", "presenca", MARK.youtube),
    pendingSignal("gmb", "presenca", MARK.gmb),
    pendingSignal("whatsapp", "presenca", MARK.whatsapp),
    pendingSignal("atualizacao", "presenca", MARK.atualizacao),
    pendingSignal("metaPixel", "ferramentas", MARK.metaPixel),
    pendingSignal("gtm", "ferramentas", MARK.gtm),
    pendingSignal("ga4", "ferramentas", MARK.ga4),
    pendingSignal("googleAds", "ferramentas", MARK.googleAds),
    pendingSignal("tiktok", "ferramentas", MARK.tiktok),
    pendingSignal("rdStation", "ferramentas", MARK.rdStation),
    pendingSignal("hotjar", "ferramentas", MARK.hotjar),
    pendingSignal("clarity", "ferramentas", MARK.clarity),
    pendingSignal("chat", "ferramentas", GENERIC_CHAT),
    pendingSignal("plataforma", "ferramentas", GENERIC_PLATFORM),
  ];
}

export function buildAuditSignals(e: LeadEnrichment): AuditSignal[] {
  const confirmed = e.domain_status === "confirmado";
  const corroborated = gmbListingCorroborated(e.gmb);
  const year = new Date().getFullYear();
  const copyright = e.freshness.copyrightYear;
  const hasMeasurement = e.tech.metaPixel || e.tech.gtm;
  const hasPaidSignal = e.tech.metaPixel || e.tech.googleAds;
  const igAds = adsLibraryUrl(e.socials.instagram);
  const platform =
    (e.tech.plataforma && PLATFORM_MARK[e.tech.plataforma]) || GENERIC_PLATFORM;
  const chat = (e.tech.chat && CHAT_MARK[e.tech.chat]) || GENERIC_CHAT;

  const siteDown = isSiteOffline(e);
  const siteSoftFail = isSiteFetchFailed(e);
  const siteHint =
    e.domain_status === "confirmado"
      ? siteDown
        ? "Site confirmado, mas fora do ar agora. Dá para abrir a ligação por isso."
        : siteSoftFail
          ? "Site confirmado, mas a página não abriu agora (bloqueio ou 404)."
          : "Domínio confirmado — este é o site da empresa. Abra o link para conferir."
      : e.domain_status === "nao_confirmado"
        ? siteDown
          ? "Achei este domínio, mas ele não abriu. Confirme se é o site da empresa."
          : siteSoftFail
            ? "Achei este domínio, mas a página não abriu agora. Confirme se é o site da empresa."
            : "Achei este domínio, mas ainda sem confirmação de que é da empresa."
        : e.fonte.domain?.fonte === "human"
          ? "Você removeu o site desta qualificação."
          : "Sem site encontrado — dá para abrir a ligação por isso.";

  const atualizacao =
    !confirmed
      ? {
          found: false,
          unverified: true,
          value: "NÃO VERIFICADO",
          hint: "Só lemos o rodapé quando o site está confirmado.",
        }
      : typeof copyright === "number" && copyright <= year - 2
        ? {
            found: false,
            unverified: false,
            value: `rodapé com ${copyright}`,
            hint: `Rodapé ainda em ${copyright}.`,
          }
        : typeof copyright === "number"
          ? {
              found: true,
              unverified: false,
              value: `rodapé com ${copyright}`,
              hint: "Rodapé recente.",
            }
          : {
              found: false,
              unverified: true,
              value: "NÃO ENCONTRADO",
              hint: "Não achei o ano no rodapé.",
            };

  return [
    signal({
      id: "site",
      group: "presenca",
      ...MARK.site,
      found: e.domain_status !== "nao_encontrado",
      unverified: e.domain_status === "nao_confirmado",
      href: siteHref(e),
      openLabel: e.domain ? "Abrir site" : null,
      value: siteValue(e),
      hint: siteHint,
      note: siteNote(e),
    }),
    signal({
      id: "instagram",
      group: "presenca",
      ...MARK.instagram,
      found: Boolean(e.socials.instagram),
      unverified: Boolean(e.socials.instagram)
        ? serperCandidate(e.fonte.instagram?.fonte, confirmed, corroborated)
        : !presenceSearched(e, "instagram") && !confirmed,
      href: absUrl(e.socials.instagram, "instagram.com"),
      openLabel: e.socials.instagram ? "Abrir Instagram" : null,
      value: instagramValue(e.socials.instagram),
      hint: socialHint(
        Boolean(e.socials.instagram),
        presenceSearched(e, "instagram"),
        confirmed,
        socialLiveHint(e.fonte.instagram?.fonte, confirmed, corroborated),
        "Não achei link de Instagram no site confirmado.",
        "Não achei Instagram no site nem na busca com a marca.",
        socialBlockedHint("Instagram"),
      ),
      links: igAds
        ? [{ label: "Biblioteca de Anúncios", href: igAds }]
        : [],
    }),
    signal({
      id: "facebook",
      group: "presenca",
      ...MARK.facebook,
      found: Boolean(e.socials.facebook),
      unverified: Boolean(e.socials.facebook)
        ? serperCandidate(e.fonte.facebook?.fonte, confirmed, corroborated)
        : !presenceSearched(e, "facebook"),
      href: absUrl(e.socials.facebook, "facebook.com"),
      openLabel: e.socials.facebook ? "Abrir Facebook" : null,
      value: e.socials.facebook ?? "NÃO ENCONTRADO",
      hint: socialHint(
        Boolean(e.socials.facebook),
        presenceSearched(e, "facebook"),
        confirmed,
        socialLiveHint(e.fonte.facebook?.fonte, confirmed, corroborated),
        "Não achei link de Facebook no site confirmado.",
        "Não achei Facebook no site nem na busca com a marca.",
        socialBlockedHint("Facebook"),
      ),
    }),
    signal({
      id: "linkedin",
      group: "presenca",
      ...MARK.linkedin,
      found: Boolean(e.socials.linkedin),
      unverified: Boolean(e.socials.linkedin)
        ? serperCandidate(e.fonte.linkedin?.fonte, confirmed, corroborated)
        : !presenceSearched(e, "linkedin"),
      href: absUrl(e.socials.linkedin, "linkedin.com"),
      openLabel: e.socials.linkedin ? "Abrir LinkedIn" : null,
      value: e.socials.linkedin ?? "NÃO ENCONTRADO",
      hint: socialHint(
        Boolean(e.socials.linkedin),
        presenceSearched(e, "linkedin"),
        confirmed,
        socialLiveHint(e.fonte.linkedin?.fonte, confirmed, corroborated),
        "Não achei link de LinkedIn no site confirmado.",
        "Não achei LinkedIn no site nem na busca com a marca.",
        socialBlockedHint("LinkedIn"),
      ),
    }),
    signal({
      id: "youtube",
      group: "presenca",
      ...MARK.youtube,
      found: Boolean(e.socials.youtube),
      unverified: Boolean(e.socials.youtube)
        ? serperCandidate(e.fonte.youtube?.fonte, confirmed, corroborated)
        : !presenceSearched(e, "youtube"),
      href: absUrl(e.socials.youtube, "youtube.com"),
      openLabel: e.socials.youtube ? "Abrir YouTube" : null,
      value: e.socials.youtube ?? "NÃO ENCONTRADO",
      hint: socialHint(
        Boolean(e.socials.youtube),
        presenceSearched(e, "youtube"),
        confirmed,
        socialLiveHint(e.fonte.youtube?.fonte, confirmed, corroborated),
        "Não achei link de YouTube no site confirmado.",
        "Não achei YouTube no site nem na busca com a marca.",
        socialBlockedHint("YouTube"),
      ),
    }),
    signal({
      id: "gmb",
      group: "presenca",
      ...MARK.gmb,
      found: Boolean(e.gmb?.matched),
      unverified: e.gmb == null,
      href: mapsListingHref(e.gmb),
      openLabel: e.gmb?.matched ? "Abrir ficha" : null,
      value: e.gmb?.matched ? e.gmb.name : e.gmb ? "NÃO ENCONTRADO" : "—",
      hint: e.gmb?.matched
        ? e.fonte.gmb?.fonte === "human"
          ? "Ficha inserida por você — não veio da Receita."
          : corroborated
            ? "Conferido com a Receita (endereço/telefone)."
            : "Ficha do Google Meu Negócio encontrada na busca."
        : e.gmb
          ? e.fonte.gmb?.fonte === "human"
            ? "Você removeu a ficha desta qualificação."
            : "Busca no Google Meu Negócio não achou a ficha."
          : "Qualifique para buscar o Google Meu Negócio.",
    }),
    signal({
      id: "whatsapp",
      group: "presenca",
      ...MARK.whatsapp,
      found: Boolean(e.whatsapp),
      unverified: !confirmed && !e.whatsapp,
      href: whatsappHref(e.whatsapp),
      openLabel: e.whatsapp ? "Abrir WhatsApp" : null,
      value: whatsappValue(e.whatsapp),
      hint: e.whatsapp
        ? e.fonte.whatsapp?.fonte === "human"
          ? "Número inserido por você — não veio da Receita."
          : "Canal de WhatsApp no site."
        : confirmed
          ? "não achei um canal de WhatsApp no site de vocês."
          : "Só conferimos WhatsApp do site quando o domínio está confirmado.",
    }),
    signal({
      id: "atualizacao",
      group: "presenca",
      ...MARK.atualizacao,
      found: atualizacao.found,
      unverified: atualizacao.unverified,
      href: siteHref(e),
      openLabel: e.domain ? "Abrir site" : null,
      value: atualizacao.value,
      hint: atualizacao.hint,
    }),
    signal({
      id: "metaPixel",
      group: "ferramentas",
      ...MARK.metaPixel,
      found: confirmed && e.tech.metaPixel,
      unverified: !confirmed || (confirmed && !e.tech.metaPixel && hasMeasurement),
      href: null,
      openLabel: null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.metaPixel
          ? "pixel detectado"
          : "sem pixel",
      hint: !confirmed
        ? "Só conferimos pixel quando o site está confirmado."
        : e.tech.metaPixel
          ? paidMediaHint(true)
          : hasMeasurement
            ? "GTM no ar; Meta Pixel não apareceu no HTML."
            : "Site no ar sem mensuração — dá para abrir a ligação por isso.",
    }),
    signal({
      id: "gtm",
      group: "ferramentas",
      ...MARK.gtm,
      found: confirmed && e.tech.gtm,
      unverified: !confirmed || (confirmed && !e.tech.gtm && hasMeasurement),
      href: null,
      openLabel: null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.gtm
          ? "GTM detectado"
          : "sem GTM",
      hint: !confirmed
        ? "Só conferimos GTM quando o site está confirmado."
        : e.tech.gtm
          ? "Google Tag Manager no HTML."
          : hasMeasurement
            ? "Pixel no ar; GTM não apareceu no HTML."
            : "Site no ar sem mensuração — dá para abrir a ligação por isso.",
    }),
    signal({
      id: "ga4",
      group: "ferramentas",
      ...MARK.ga4,
      found: confirmed && e.tech.ga4,
      unverified: !confirmed || !e.tech.ga4,
      href: null,
      openLabel: null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.ga4
          ? "GA4 detectado"
          : "sem GA4",
      hint: !confirmed
        ? "Só conferimos GA4 quando o site está confirmado."
        : e.tech.ga4
          ? "Google Analytics 4 no HTML."
          : "GA4 não apareceu no HTML.",
    }),
    signal({
      id: "googleAds",
      group: "ferramentas",
      ...MARK.googleAds,
      found: confirmed && e.tech.googleAds,
      unverified: !confirmed || (confirmed && !e.tech.googleAds && hasPaidSignal),
      href: null,
      openLabel: null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.googleAds
          ? "tag AW detectada"
          : "sem tag AW",
      hint: !confirmed
        ? "Só conferimos mídia paga quando o site está confirmado."
        : e.tech.googleAds
          ? paidMediaHint(true)
          : hasPaidSignal
            ? "Pixel no ar; tag do Google Ads não apareceu."
            : paidMediaHint(false),
    }),
    signal({
      id: "tiktok",
      group: "ferramentas",
      ...MARK.tiktok,
      found: confirmed && e.tech.tiktokPixel,
      unverified: !confirmed || !e.tech.tiktokPixel,
      href: null,
      openLabel: null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.tiktokPixel
          ? "pixel detectado"
          : "sem pixel",
      hint: !confirmed
        ? "Só conferimos o pixel do TikTok quando o site está confirmado."
        : e.tech.tiktokPixel
          ? "Pixel do TikTok no HTML."
          : "Pixel do TikTok não apareceu no HTML.",
    }),
    signal({
      id: "rdStation",
      group: "ferramentas",
      ...MARK.rdStation,
      found: confirmed && e.tech.rdStation,
      unverified: !confirmed || !e.tech.rdStation,
      href: null,
      openLabel: null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.rdStation
          ? "RD Station detectado"
          : "sem RD Station",
      hint: !confirmed
        ? "Só conferimos RD Station quando o site está confirmado."
        : e.tech.rdStation
          ? "Script da RD Station no HTML."
          : "RD Station não apareceu no HTML.",
    }),
    signal({
      id: "hotjar",
      group: "ferramentas",
      ...MARK.hotjar,
      found: confirmed && e.tech.hotjar,
      unverified: !confirmed || !e.tech.hotjar,
      href: null,
      openLabel: null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.hotjar
          ? "Hotjar detectado"
          : "sem Hotjar",
      hint: !confirmed
        ? "Só conferimos Hotjar quando o site está confirmado."
        : e.tech.hotjar
          ? "Hotjar no HTML."
          : "Hotjar não apareceu no HTML.",
    }),
    signal({
      id: "clarity",
      group: "ferramentas",
      ...MARK.clarity,
      found: confirmed && e.tech.clarity,
      unverified: !confirmed || !e.tech.clarity,
      href: null,
      openLabel: null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.clarity
          ? "Clarity detectado"
          : "sem Clarity",
      hint: !confirmed
        ? "Só conferimos Clarity quando o site está confirmado."
        : e.tech.clarity
          ? "Microsoft Clarity no HTML."
          : "Clarity não apareceu no HTML.",
    }),
    signal({
      id: "chat",
      group: "ferramentas",
      name: e.tech.chat ?? chat.name,
      logo: chat.logo,
      initials: chat.initials,
      accent: chat.accent,
      found: confirmed && Boolean(e.tech.chat),
      unverified: !confirmed || !e.tech.chat,
      href: null,
      openLabel: null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.chat ?? "NÃO ENCONTRADO",
      hint: !confirmed
        ? "Só conferimos chat no site quando o domínio está confirmado."
        : e.tech.chat
          ? `Widget ${e.tech.chat} no site.`
          : "Nenhum chat no HTML.",
    }),
    signal({
      id: "plataforma",
      group: "ferramentas",
      name: e.tech.plataforma ?? platform.name,
      logo: platform.logo,
      initials: platform.initials,
      accent: platform.accent,
      found: confirmed && Boolean(e.tech.plataforma),
      unverified: !confirmed || !e.tech.plataforma,
      href: siteHref(e),
      openLabel: e.domain && e.tech.plataforma ? "Abrir site" : null,
      value: !confirmed
        ? "NÃO VERIFICADO"
        : e.tech.plataforma ?? "NÃO ENCONTRADO",
      hint: !confirmed
        ? "Só identificamos a plataforma quando o site está confirmado."
        : e.tech.plataforma
          ? `Site em ${e.tech.plataforma}.`
          : "Não identifiquei a plataforma.",
    }),
  ];
}
