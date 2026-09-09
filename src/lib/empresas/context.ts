import { crmHref, gridHref } from "@/lib/back";
import { CRM_ACTIVITY_KINDS, type CrmActivityKind } from "@/lib/crm/types";
import { COMPANY_SEARCH_LIMIT } from "@/lib/data/company-search";
import type { CompanySearchHit } from "@/lib/types";

export type CompanyGridCrm = {
  dealId: string;
  pipelineId: string;
  pipelineNome: string;
  stageNome: string;
  nextKind: CrmActivityKind | null;
  nextDueAt: string | null;
};

export type CompanyGridList = {
  searchId: string;
  nome: string;
  saved: boolean;
};

export type CompanyGridPlacement = {
  cnpj: string;
  called: boolean;
  crm: CompanyGridCrm | null;
  list: CompanyGridList | null;
};

export type CompanyGridContext = CompanyGridPlacement & {
  qualified: boolean;
};

export type CompanyGridAction =
  | { type: "open_crm"; href: string }
  | { type: "open_list"; href: string }
  | { type: "enter_crm" };

export function uniqueCompanyCnpjs(cnpjs: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of cnpjs) {
    const rawDigits = raw.replace(/\D/g, "");
    if (!rawDigits) continue;
    const digits = rawDigits.padStart(14, "0");
    if (!/^\d{14}$/.test(digits) || seen.has(digits)) continue;
    seen.add(digits);
    out.push(digits);
    if (out.length >= COMPANY_SEARCH_LIMIT) break;
  }
  return out;
}

export function asCrmActivityKind(value: unknown): CrmActivityKind | null {
  const raw = String(value ?? "");
  return (CRM_ACTIVITY_KINDS as readonly string[]).includes(raw)
    ? (raw as CrmActivityKind)
    : null;
}

export function emptyCompanyPlacement(cnpj: string): CompanyGridPlacement {
  return { cnpj, called: false, crm: null, list: null };
}

export function companyGridAction(
  ctx: CompanyGridContext | CompanyGridPlacement | undefined,
): CompanyGridAction {
  if (ctx?.crm) {
    return {
      type: "open_crm",
      href: crmHref({ pipeline: ctx.crm.pipelineId, deal: ctx.crm.dealId }),
    };
  }
  if (ctx?.list) {
    return {
      type: "open_list",
      href: gridHref(ctx.list.searchId, "empresas"),
    };
  }
  return { type: "enter_crm" };
}

export function asCompanySearchHit(
  hit: Pick<
    CompanySearchHit,
    "cnpj" | "razaoSocial" | "nomeFantasia" | "municipio" | "uf"
  > &
    Partial<CompanySearchHit>,
): CompanySearchHit {
  return {
    cnpj: hit.cnpj,
    razaoSocial: hit.razaoSocial,
    nomeFantasia: hit.nomeFantasia,
    municipio: hit.municipio,
    uf: hit.uf,
    cnaeCodigo: hit.cnaeCodigo ?? null,
    cnaeDescricao: hit.cnaeDescricao ?? "",
    telefone: hit.telefone ?? null,
    decisorNome: hit.decisorNome ?? null,
  };
}
