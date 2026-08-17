import type {
  ContactSeal,
  PhoneEvidence,
  SharedPhoneVerdict,
} from "@/lib/types";
import { sameNumberBR, type NormalizedPhone } from "@/lib/phone";

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
  ],
} as const;

export type ContactSealType = ContactSeal;

export function previewSealsEnabled(): boolean {
  return (
    (process.env.DATA_SOURCE ?? "mock") === "mock" &&
    process.env.MOCK_PREVIEW_SEALS === "1"
  );
}

export function sealLabel(
  seal: ContactSeal,
  qtdEmpresas = 0,
): string {
  switch (seal) {
    case "CONFIRMADO":
      return "Confere com o site oficial";
    case "ATUALIZADO":
      return "Número atualizado pelo site da empresa";
    case "COMPARTILHADO":
      return `Este número aparece em ${qtdEmpresas} empresas — provavelmente é do escritório, não da empresa`;
    case "GRUPO":
      return `Mesmo telefone em ${qtdEmpresas} empresas do grupo`;
    case "NAO_CONFIRMADO":
    default:
      return "não verificado";
  }
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

export function isOwnDomainEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return false;
  if (isFreeEmail(email)) return false;
  if (hasAccountantDomainHint(email)) return false;
  return true;
}

export function sealDisplay(seal: ContactSeal): {
  colorClass: string;
  title: string;
} {
  switch (seal) {
    case "CONFIRMADO":
      return { colorClass: "text-podium-success", title: "Confirmado" };
    case "ATUALIZADO":
      return { colorClass: "text-podium-yellow", title: "Do site" };
    case "COMPARTILHADO":
      return { colorClass: "text-amber-400", title: "Contabilidade" };
    case "GRUPO":
      return { colorClass: "text-sky-400", title: "Grupo" };
    case "NAO_CONFIRMADO":
    default:
      return { colorClass: "text-podium-muted", title: "Não verificado" };
  }
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

export function sealCsvLabel(seal: ContactSeal): string {
  switch (seal) {
    case "CONFIRMADO":
      return "Confirmado";
    case "ATUALIZADO":
      return "Atualizado";
    case "COMPARTILHADO":
      return "Contabilidade - provavel escritorio";
    case "GRUPO":
      return "Grupo economico";
    case "NAO_CONFIRMADO":
      return "Nao confirmado";
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
