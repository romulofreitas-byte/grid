import type {
  ContactSeal,
  PhoneEvidence,
  SharedPhoneVerdict,
} from "@/lib/types";
import { presenceBrandTokens } from "@/lib/enrichment/confirm-domain";
import { sameNumberBR, type NormalizedPhone } from "@/lib/phone";
import { sealLabel } from "@/lib/seal-display";

export {
  sealCsvLabel,
  sealDisplay,
  sealLabel,
  type ContactSealType,
} from "@/lib/seal-display";

export const CONTACT_RULES = {
  sharedPhoneThreshold: 3,
  /** Clusters bigger than this are accounting, not an economic group. */
  groupMaxCluster: 50,
  /** Same partner must appear in at least this many CNPJs to call it a group. */
  groupMinOverlapCnpjs: 3,
  /** Overlap must cover this share of the cluster (0–1). */
  groupMinOverlapShare: 0.4,
  sharedEmailThreshold: 3,
  sharedAddressThreshold: 5,
  accountantDomainHints: [
    "contab",
    "contabil",
    "assessoria",
    "escritorio",
    "fiscal",
    "tributar",
  ],
  freeEmailProviders: [
    "gmail",
    "hotmail",
    "outlook",
    "yahoo",
    "uol",
    "bol",
    "terra",
    "ig.com",
    "live.com",
    // portais / ISP BR — não são site da empresa
    "uai.com",
    "uai.com.br",
    "globo.com",
    "globomail",
    "zipmail",
    "icloud",
    "me.com",
    "proton",
    "protonmail",
    "aol.com",
    "msn.com",
    "r7.com",
    "oi.com.br",
    "superig",
    "pop.com.br",
    "sercomtel",
    "itelefonica",
    "ig.com.br",
  ],
} as const;

export function previewSealsEnabled(): boolean {
  // Never lottery CONFIRMADO/ATUALIZADO outside explicit local mock preview.
  if (process.env.MOCK_PREVIEW_SEALS !== "1") return false;
  if ((process.env.DATA_SOURCE ?? "mock") !== "mock") return false;
  if (
    process.env.GRID_ENV === "production" ||
    process.env.VERCEL_ENV === "production"
  ) {
    return false;
  }
  return true;
}

/** Mock preview only. Real seals come from deriveSeal. */
export function mockPhoneSeal(
  seed: string,
  qtdEmpresas: number,
  verdict: SharedPhoneVerdict = "proprio",
): ContactSeal {
  if (verdict === "contabilidade") return "COMPARTILHADO";
  if (verdict === "grupo_economico") return "GRUPO";
  if (!previewSealsEnabled()) return "NAO_CONFIRMADO";
  let n = 0;
  for (let i = 0; i < seed.length; i++) n = (n + seed.charCodeAt(i) * (i + 1)) % 100;
  if (n < 28) return "CONFIRMADO";
  if (n < 48) return "ATUALIZADO";
  return "NAO_CONFIRMADO";
}

/** Clusters larger than the cap are never an economic group — any surface. */
export function clampGrupoVerdict(
  qtdEmpresas: number,
  verdict: SharedPhoneVerdict,
): SharedPhoneVerdict {
  if (
    qtdEmpresas > CONTACT_RULES.groupMaxCluster &&
    verdict === "grupo_economico"
  ) {
    return "contabilidade";
  }
  return verdict;
}

export function demoteOversizedGrupoSeal(
  seal: ContactSeal,
  qtdEmpresas: number,
): ContactSeal {
  if (seal === "GRUPO" && qtdEmpresas > CONTACT_RULES.groupMaxCluster) {
    return "COMPARTILHADO";
  }
  return seal;
}

export function phoneSealFromUsage(
  qtdEmpresas: number,
  seed?: string,
  verdict: SharedPhoneVerdict = "proprio",
): { seal: ContactSeal; label: string } {
  const capped = clampGrupoVerdict(qtdEmpresas, verdict);
  const resolved: SharedPhoneVerdict =
    qtdEmpresas >= CONTACT_RULES.sharedPhoneThreshold
      ? capped === "proprio"
        ? "contabilidade"
        : capped
      : "proprio";
  const seal = seed
    ? mockPhoneSeal(seed, qtdEmpresas, resolved)
    : resolved === "contabilidade"
      ? "COMPARTILHADO"
      : resolved === "grupo_economico"
        ? "GRUPO"
        : "NAO_CONFIRMADO";
  return { seal, label: sealLabel(seal, qtdEmpresas) };
}

export function isFreeEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return CONTACT_RULES.freeEmailProviders.some((p) => domain.includes(p));
}

export function hasAccountantDomainHint(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return CONTACT_RULES.accountantDomainHints.some((h) => domain.includes(h));
}

/**
 * Host do e-mail da Receita quando é provedor (compartilhado / contabilidade).
 * Não é site da empresa — deve ir para discardedDomains na qualificação.
 * E-mails gratuitos não geram host (gmail etc. não são “site do contador”).
 */
export function receitaProviderDomain(
  email: string | null | undefined,
  opts?: { shared?: boolean; accountantHint?: boolean },
): string | null {
  if (!email || !email.includes("@")) return null;
  if (isFreeEmail(email)) return null;
  const ban =
    opts?.shared === true ||
    opts?.accountantHint === true ||
    hasAccountantDomainHint(email);
  if (!ban) return null;
  const host = (email.split("@")[1] ?? "")
    .toLowerCase()
    .replace(/^www\./, "")
    .trim();
  return host || null;
}

/**
 * E-mail da Receita só pode sugerir o site da empresa se o domínio/local-part
 * carregar token forte da marca (evita uai.com.br a partir de serconsjn@uai…).
 */
export function emailDomainCorrelatesWithBrand(
  email: string | null | undefined,
  razaoSocial: string,
  nomeFantasia: string | null,
  municipio: string,
): boolean {
  if (!email || !email.includes("@")) return false;
  const [localRaw, hostRaw] = email.split("@");
  const local = (localRaw ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  const host = (hostRaw ?? "").toLowerCase();
  const label = (host.split(".")[0] ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "");
  const hay = `${local}${label}`;
  const strong = presenceBrandTokens(razaoSocial, nomeFantasia, municipio);
  if (strong.length === 0) return false;
  return strong.some((t) => hay.includes(t));
}

export function isOwnDomainEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  if (isFreeEmail(email)) return false;
  if (hasAccountantDomainHint(email)) return false;
  return true;
}

export function sealRank(seal: ContactSeal): number {
  switch (seal) {
    case "CONFIRMADO":
      return 5;
    case "ATUALIZADO":
      return 4;
    case "GRUPO":
      return 3;
    case "NAO_CONFIRMADO":
      return 2;
    case "COMPARTILHADO":
      return 1;
    default:
      return 0;
  }
}

export type DeriveSealInput = {
  domainStatus: "confirmado" | "nao_confirmado" | "nao_encontrado";
  receita: NormalizedPhone | null;
  sitePhones: NormalizedPhone[];
  sharedCount: number;
  sharedVerdict: SharedPhoneVerdict;
};

/**
 * Seal is derived from evidence, never written by hand.
 * CONFIRMADO wins over Contabilidade when the official site publishes the shared number.
 */
export function deriveSeal(input: DeriveSealInput): {
  seal: ContactSeal;
  principalIsSite: boolean;
  sideNote?: string;
} {
  const sharedVerdict = clampGrupoVerdict(
    input.sharedCount,
    input.sharedVerdict,
  );
  const { domainStatus, receita, sitePhones, sharedCount } = input;
  const siteMatch =
    !!receita &&
    domainStatus === "confirmado" &&
    sitePhones.some((p) => sameNumberBR(p, receita));

  if (siteMatch) {
    const note =
      sharedVerdict === "contabilidade" && sharedCount >= CONTACT_RULES.sharedPhoneThreshold
        ? `também aparece em ${sharedCount} empresas`
        : sharedVerdict === "grupo_economico"
          ? `mesmo telefone em ${sharedCount} empresas do grupo`
          : undefined;
    return { seal: "CONFIRMADO", principalIsSite: false, sideNote: note };
  }

  if (domainStatus === "confirmado" && sitePhones.length > 0) {
    return { seal: "ATUALIZADO", principalIsSite: true };
  }

  if (sharedVerdict === "contabilidade") {
    return { seal: "COMPARTILHADO", principalIsSite: false };
  }
  if (sharedVerdict === "grupo_economico") {
    return { seal: "GRUPO", principalIsSite: false };
  }
  return { seal: "NAO_CONFIRMADO", principalIsSite: false };
}

export function applySealToEvidence(
  evidence: Omit<PhoneEvidence, "seal">,
  seal: ContactSeal,
): PhoneEvidence {
  return { ...evidence, seal };
}

export function normalizePartnerName(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function verdictFromOverlapStats(
  qtdEmpresas: number,
  maxOverlap: number,
): SharedPhoneVerdict {
  if (qtdEmpresas < CONTACT_RULES.sharedPhoneThreshold) return "proprio";
  if (qtdEmpresas > CONTACT_RULES.groupMaxCluster) return "contabilidade";
  if (
    maxOverlap >= CONTACT_RULES.groupMinOverlapCnpjs &&
    maxOverlap / qtdEmpresas >= CONTACT_RULES.groupMinOverlapShare
  ) {
    return "grupo_economico";
  }
  return "contabilidade";
}

/**
 * Shared phone is accounting when owners don't overlap strongly.
 * Large clusters (hundreds of CNPJs) are never an economic group.
 */
export function verdictFromPartnerOverlap(
  qtdEmpresas: number,
  partnerNamesByCnpjBasico: Map<string, string[]>,
): SharedPhoneVerdict {
  if (qtdEmpresas < CONTACT_RULES.sharedPhoneThreshold) return "proprio";
  const nameToCnpjs = new Map<string, Set<string>>();
  for (const [cnpj, names] of partnerNamesByCnpjBasico) {
    for (const raw of names) {
      const n = normalizePartnerName(raw);
      if (!n) continue;
      const set = nameToCnpjs.get(n) ?? new Set();
      set.add(cnpj);
      nameToCnpjs.set(n, set);
    }
  }
  let maxOverlap = 0;
  for (const set of nameToCnpjs.values()) {
    if (set.size > maxOverlap) maxOverlap = set.size;
  }
  return verdictFromOverlapStats(qtdEmpresas, maxOverlap);
}
