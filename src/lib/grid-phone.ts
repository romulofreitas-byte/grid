import {
  clampGrupoVerdict,
  demoteOversizedGrupoSeal,
  sealLabel,
} from "@/lib/contact-confidence";
import type {
  ContactInfo,
  ContactSeal,
  LeadEnrichment,
  PhoneEvidence,
  SharedPhoneVerdict,
} from "@/lib/types";

export function contactsFromEnrichmentPhones(
  phones: PhoneEvidence[],
): ContactInfo[] {
  return phones
    .filter((p) => {
      if (!p?.e164 || typeof p.e164 !== "string") return false;
      const sources = Array.isArray(p.sources) ? p.sources : [];
      return sources.some((s) => s !== "osm");
    })
    .map((p) => {
      const sources = Array.isArray(p.sources) ? p.sources : [];
      const digits = p.e164.replace(/^\+55/, "").replace(/\D/g, "");
      const ddd = p.tipo === "especial" ? null : digits.slice(0, 2);
      const tel = p.tipo === "especial" ? digits : digits.slice(2);
      const fromSite = sources.some((s) => s.startsWith("site"));
      const sharedCount = p.sharedCount ?? 0;
      const seal = demoteOversizedGrupoSeal(p.seal, sharedCount);
      return {
        ddd,
        telefone: tel,
        seal,
        sharedCount,
        sharedVerdict: clampGrupoVerdict(
          sharedCount,
          p.sharedVerdict ?? "proprio",
        ),
        label: sealLabel(seal, sharedCount),
        source: fromSite ? ("site" as const) : ("receita" as const),
        sideNote:
          p.seal === "CONFIRMADO" && (p.sharedCount ?? 0) >= 3
            ? `também aparece em ${p.sharedCount} empresas`
            : undefined,
      };
    });
}

export type GridPhoneFields = {
  telefone: string | null;
  seal: ContactSeal;
  sharedCount: number;
  sharedVerdict?: SharedPhoneVerdict;
};

export function applyClusterCap(row: GridPhoneFields): GridPhoneFields {
  const sharedVerdict = clampGrupoVerdict(
    row.sharedCount,
    row.sharedVerdict ?? "proprio",
  );
  const seal = demoteOversizedGrupoSeal(row.seal, row.sharedCount);
  if (seal === row.seal && sharedVerdict === row.sharedVerdict) return row;
  return { ...row, seal, sharedVerdict };
}

/** After a fresh audit, the grid shows the best evidence phone (site beats Receita). */
export function overlayGridPhone(
  row: GridPhoneFields,
  enrichment: LeadEnrichment | null | undefined,
): GridPhoneFields {
  try {
    if (!enrichment?.phones.length) return applyClusterCap(row);
    const primary = contactsFromEnrichmentPhones(enrichment.phones)[0];
    if (!primary) return applyClusterCap(row);
    return applyClusterCap({
      telefone:
        primary.ddd && primary.telefone
          ? `${primary.ddd}${primary.telefone}`
          : row.telefone,
      seal: primary.seal,
      sharedCount: primary.sharedCount,
      sharedVerdict: primary.sharedVerdict,
    });
  } catch {
    return applyClusterCap(row);
  }
}
