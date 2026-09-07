import { AsyncLocalStorage } from "node:async_hooks";
import {
  gmbListingStatus,
  type DomainStatus,
  type GmbListing,
  type LeadEnrichment,
} from "@/lib/types";

export type SerperKind = "search" | "maps";

export type SerperStage =
  | "domain"
  | "domain_fallback"
  | "domain_national"
  | "gmb"
  | "gmb_retry_brand"
  | "gmb_site"
  | "instagram"
  | "facebook"
  | "linkedin"
  | "youtube";

export type DomainWave =
  | "primary"
  | "fallback"
  | "national"
  | "gmb"
  | "email"
  | "cache"
  | "human"
  | "hint";

/**
 * early — first wave / no extra spend.
 * dense — later queries paid off (keep searching).
 * exhausted — full budget, still missing (brand/index, not “search more of the same”).
 * skipped — never searched (cache, weak brand, no key).
 * candidate — Maps pin exists but is not locked to the CNPJ.
 */
export type DensityVerdict =
  | "early"
  | "dense"
  | "exhausted"
  | "skipped"
  | "candidate";

export type SerperCallRecord = {
  kind: SerperKind;
  stage: SerperStage;
  ok: boolean;
  hits: number;
  ms: number;
};

export type SerperDensitySummary = {
  calls: number;
  search: number;
  maps: number;
  errors: number;
  by_stage: Partial<Record<SerperStage, number>>;
  domain: DensityVerdict;
  gmb: DensityVerdict;
  instagram: DensityVerdict;
};

type SerperStatsStore = {
  calls: SerperCallRecord[];
  stage: SerperStage;
  meta: { domainWave: DomainWave | null };
};

const als = new AsyncLocalStorage<SerperStatsStore>();

export function withSerperStats<T>(fn: () => Promise<T>): Promise<T> {
  const store: SerperStatsStore = {
    calls: [],
    stage: "domain",
    meta: { domainWave: null },
  };
  return als.run(store, fn);
}

export async function withSerperStage<T>(
  stage: SerperStage,
  fn: () => Promise<T>,
): Promise<T> {
  const parent = als.getStore();
  if (!parent) return fn();
  return als.run(
    { calls: parent.calls, stage, meta: parent.meta },
    fn,
  );
}

export function noteDomainWave(wave: DomainWave): void {
  const store = als.getStore();
  if (store) store.meta.domainWave = wave;
}

export function recordSerperCall(
  call: Omit<SerperCallRecord, "stage">,
): void {
  const store = als.getStore();
  if (!store) return;
  store.calls.push({ ...call, stage: store.stage });
}

export function serperStatsSnapshot(): {
  calls: SerperCallRecord[];
  domainWave: DomainWave | null;
} {
  const store = als.getStore();
  return {
    calls: store?.calls ?? [],
    domainWave: store?.meta.domainWave ?? null,
  };
}

function countByStage(
  calls: SerperCallRecord[],
): Partial<Record<SerperStage, number>> {
  const by_stage: Partial<Record<SerperStage, number>> = {};
  for (const call of calls) {
    by_stage[call.stage] = (by_stage[call.stage] ?? 0) + 1;
  }
  return by_stage;
}

function stageCalls(
  calls: SerperCallRecord[],
  stages: readonly SerperStage[],
): number {
  const want = new Set(stages);
  return calls.filter((call) => want.has(call.stage)).length;
}

export function domainDensityVerdict(input: {
  status: DomainStatus;
  wave: DomainWave | null;
  searchCalls: number;
}): DensityVerdict {
  if (input.status !== "nao_encontrado") {
    if (
      input.wave === "fallback" ||
      input.wave === "national" ||
      input.wave === "gmb"
    ) {
      return "dense";
    }
    return "early";
  }
  return input.searchCalls > 0 ? "exhausted" : "skipped";
}

export function gmbDensityVerdict(input: {
  listing: GmbListing | null | undefined;
  mapsCalls: number;
  retryOrSiteCalls: number;
}): DensityVerdict {
  const status = gmbListingStatus(input.listing);
  if (status === "matched") {
    if (input.retryOrSiteCalls > 0) return "dense";
    return input.mapsCalls > 1 ? "dense" : "early";
  }
  if (status === "candidate") return "candidate";
  return input.mapsCalls > 0 ? "exhausted" : "skipped";
}

export function instagramDensityVerdict(input: {
  url: string | undefined;
  fonte: string | undefined;
  searchCalls: number;
}): DensityVerdict {
  if (input.url) {
    if (input.fonte === "serper" && input.searchCalls > 1) return "dense";
    return "early";
  }
  if (input.searchCalls > 0) return "exhausted";
  return "skipped";
}

export function summarizeSerperDensity(input: {
  calls: SerperCallRecord[];
  domainWave: DomainWave | null;
  domainStatus: DomainStatus;
  gmb: GmbListing | null | undefined;
  instagramUrl: string | undefined;
  instagramFonte: string | undefined;
}): SerperDensitySummary {
  const search = input.calls.filter((call) => call.kind === "search").length;
  const maps = input.calls.filter((call) => call.kind === "maps").length;
  const gmbSeed = stageCalls(input.calls, ["gmb"]);
  const gmbExtra = stageCalls(input.calls, ["gmb_retry_brand", "gmb_site"]);
  return {
    calls: input.calls.length,
    search,
    maps,
    errors: input.calls.filter((call) => !call.ok).length,
    by_stage: countByStage(input.calls),
    domain: domainDensityVerdict({
      status: input.domainStatus,
      wave: input.domainWave,
      searchCalls: stageCalls(input.calls, [
        "domain",
        "domain_fallback",
        "domain_national",
      ]),
    }),
    gmb: gmbDensityVerdict({
      listing: input.gmb,
      mapsCalls: gmbSeed + gmbExtra,
      retryOrSiteCalls: gmbExtra,
    }),
    instagram: instagramDensityVerdict({
      url: input.instagramUrl,
      fonte: input.instagramFonte,
      searchCalls: stageCalls(input.calls, ["instagram"]),
    }),
  };
}

export function serperDensityFromRow(
  row: Pick<LeadEnrichment, "domain_status" | "gmb" | "socials" | "fonte">,
): SerperDensitySummary {
  const snap = serperStatsSnapshot();
  return summarizeSerperDensity({
    calls: snap.calls,
    domainWave: snap.domainWave,
    domainStatus: row.domain_status,
    gmb: row.gmb,
    instagramUrl: row.socials.instagram,
    instagramFonte: row.fonte.instagram?.fonte,
  });
}
