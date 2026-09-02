import { getDataSource, getRepo } from "@/lib/data";
import { isUndefinedTableError, searchJobFailureMessage } from "@/lib/data/pg";
import {
  searchJobConcurrency,
  type SearchJob,
} from "@/lib/search-jobs";
import {
  hasAccountantDomainHint,
  receitaProviderDomain,
} from "@/lib/contact-confidence";
import { enrichCompany, type CascadeCompany } from "@/lib/enrichment/cascade";
import {
  applyOsmFollowup,
  enqueueOsmFollowup,
  phonesForOsm,
} from "@/lib/enrichment/osm";
import type { GridRepo } from "@/lib/data/repo";
import { isEnrichmentComplete } from "@/lib/enrichment/fresh";
import type { EnrichmentJob, ScoreProfile } from "@/lib/types";

export const DEFAULT_ENRICH_CONCURRENCY = 8;
export const DEFAULT_WORKER_IDLE_MS = 400;

export function enrichConcurrency(
  raw: string | undefined = process.env.ENRICH_CONCURRENCY,
): number {
  const n = Number(raw ?? DEFAULT_ENRICH_CONCURRENCY);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_ENRICH_CONCURRENCY;
  return Math.min(32, Math.floor(n));
}

function elapsed(started: number): number {
  return Date.now() - started;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve();
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

export async function resolveJobScoreProfile(
  repo: Pick<GridRepo, "getSearch" | "getPreset">,
  searchId: string | null,
): Promise<ScoreProfile> {
  if (!searchId) return "b2c_local";
  const search = await repo.getSearch(searchId);
  if (!search) return "b2c_local";
  const id = search.filtros.segmentIds[0] ?? search.filtros.presetId;
  if (!id) return "b2c_local";
  const preset = await repo.getPreset(id);
  return preset?.perfil_score === "b2b_industria" ? "b2b_industria" : "b2c_local";
}

export function deferOsmFollowup(
  row: Parameters<typeof applyOsmFollowup>[0],
  company: CascadeCompany,
  persist: (row: Parameters<typeof applyOsmFollowup>[0]) => Promise<void>,
): void {
  if (!phonesForOsm(row).length) return;
  void enqueueOsmFollowup(async () => {
    const started = Date.now();
    try {
      const patched = await applyOsmFollowup(row, {
        razaoSocial: company.company.razao_social,
        nomeFantasia: company.establishment.nome_fantasia,
        municipioNome: company.municipioNome,
        uf: company.establishment.uf,
        logradouro: company.establishment.logradouro,
        numero: company.establishment.numero,
        fallbackDdd: company.establishment.ddd1,
        domain: row.domain,
      });
      console.log(
        JSON.stringify({
          event: "osm_followup",
          cnpj: row.cnpj,
          osm_ms: Date.now() - started,
          matched: patched?.osm?.matched ?? null,
        }),
      );
      if (patched) await persist(patched);
    } catch (err) {
      console.log(
        JSON.stringify({
          event: "osm_followup",
          cnpj: row.cnpj,
          osm_ms: Date.now() - started,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    }
  });
}

export async function processJob(job: EnrichmentJob): Promise<void> {
  const started = Date.now();
  const repo = getRepo();
  const log = (extra: Record<string, unknown>) => {
    console.log(
      JSON.stringify({
        job_id: job.id,
        cnpj: job.cnpj,
        total_ms: elapsed(started),
        ...extra,
      }),
    );
  };

  log({ event: "enrich_start", attempts: job.attempts });

  if (await repo.isOptedOut(job.cnpj)) {
    await repo.updateJob(job.id, {
      status: "skipped",
      last_error: "opt-out",
      finished_at: new Date().toISOString(),
    });
    log({ status: "skipped", reason: "opt-out" });
    return;
  }
  const existing = await repo.getEnrichment(job.cnpj);
  if (existing && !job.payload?.force && isEnrichmentComplete(existing)) {
    await repo.updateJob(job.id, {
      status: "skipped",
      finished_at: new Date().toISOString(),
    });
    log({ status: "skipped", reason: "fresh" });
    return;
  }
  if (job.attempts > 3) {
    await repo.updateJob(job.id, {
      status: "failed",
      last_error: "max attempts",
      finished_at: new Date().toISOString(),
    });
    log({ status: "failed", error: "max attempts" });
    return;
  }

  const dossierStarted = Date.now();
  const dossier = await repo.getDossier(job.cnpj, job.search_id ?? undefined);
  const dossier_ms = elapsed(dossierStarted);
  if (!dossier) {
    await repo.updateJob(job.id, {
      status: "failed",
      last_error: "lead not found",
      finished_at: new Date().toISOString(),
    });
    log({ status: "failed", error: "lead not found", dossier_ms });
    return;
  }

  try {
    const cache = await repo.getDomainCache(dossier.establishment.cnpj_basico);
    const scoreProfile = await resolveJobScoreProfile(repo, job.search_id);
    const company: CascadeCompany = {
      establishment: dossier.establishment,
      company: dossier.company,
      municipioNome: dossier.municipioNome,
      sharedCount: dossier.contacts[0]?.sharedCount ?? 0,
      sharedVerdict: dossier.contacts[0]?.sharedVerdict ?? "proprio",
      scoreProfile,
      qsaNomes: dossier.socios.map((s) => s.nome),
    };
    const isRefresh =
      job.payload?.refresh === true ||
      job.payload?.action === "confirm" ||
      job.payload?.action === "reject";
    const providerHost = receitaProviderDomain(dossier.establishment.email, {
      shared: dossier.emailSeal?.shared === true,
      accountantHint:
        dossier.emailSeal?.accountantHint === true ||
        hasAccountantDomainHint(dossier.establishment.email),
    });
    const { row, timings } = await enrichCompany(
      company,
      cache,
      // Keep the prior complete audit visible until the new crawl finishes.
      isRefresh ? undefined : (partial) => repo.upsertEnrichment(partial),
      {
        discardedDomains: [
          ...(existing?.discarded_domains ?? []),
          ...(job.payload?.discarded_domains ?? []),
          ...(job.payload?.action === "reject" && job.payload.domain
            ? [job.payload.domain]
            : []),
          ...(providerHost ? [providerHost] : []),
        ],
        forceConfirmDomain:
          job.payload?.action === "confirm" ? (job.payload.domain ?? null) : null,
        emailShared: dossier.emailSeal?.shared === true,
      },
    );
    const upsertStarted = Date.now();
    await repo.upsertEnrichment(row);
    if (row.domain) {
      await repo.setDomainCache(
        dossier.establishment.cnpj_basico,
        row.domain,
        row.domain_status,
      );
    }
    await repo.updateJob(job.id, {
      status: "done",
      finished_at: new Date().toISOString(),
      last_error: null,
    });
    log({
      status: "done",
      domain_status: row.domain_status,
      dossier_ms,
      serper_ms: timings.serper_ms,
      crawl_ms: timings.crawl_ms,
      pages: timings.pages,
      osm_ms: 0,
      osm: phonesForOsm(row).length ? "deferred" : "skipped",
      progress_ms: timings.progress_ms,
      upsert_ms: elapsed(upsertStarted),
    });
    deferOsmFollowup(row, company, (patched) => repo.upsertEnrichment(patched));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = job.attempts >= 3;
    await repo.updateJob(job.id, {
      status: failed ? "failed" : "pending",
      last_error: message,
      locked_at: null,
      finished_at: failed ? new Date().toISOString() : null,
    });
    log({
      status: failed ? "failed" : "retry",
      error: message,
      dossier_ms,
    });
  }
}

/** Keep `concurrency` slots busy: a finished job immediately claims the next. */
export async function runJobPool<T>(options: {
  concurrency: number;
  claim: () => Promise<T | null>;
  run: (job: T) => Promise<void>;
}): Promise<number> {
  const n = Math.max(1, Math.floor(options.concurrency));
  let processed = 0;

  async function slot(): Promise<void> {
    for (;;) {
      const job = await options.claim();
      if (!job) return;
      processed += 1;
      await options.run(job);
    }
  }

  await Promise.all(Array.from({ length: n }, () => slot()));
  return processed;
}

/** Drain the queue until empty, with `concurrency` slots (no wave barrier). */
export async function drainJobs(
  concurrency = DEFAULT_ENRICH_CONCURRENCY,
): Promise<number> {
  const repo = getRepo();
  return runJobPool({
    concurrency,
    claim: () => repo.claimEnrichmentJob(),
    run: processJob,
  });
}

export async function processSearchJob(job: SearchJob): Promise<void> {
  const repo = getRepo();
  try {
    const search = await repo.runSearch(job.user_id, job.nome, job.filtros);
    await repo.finishSearchJob(job.id, {
      status: "done",
      search_id: search.id,
    });
    console.log(
      JSON.stringify({
        event: "search_job_done",
        id: job.id,
        searchId: search.id,
      }),
    );
  } catch (err) {
    const message = searchJobFailureMessage(err);
    await repo.finishSearchJob(job.id, { status: "failed", error: message });
    console.error(
      JSON.stringify({
        event: "search_job_failed",
        id: job.id,
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}

/** Claim this user's job (if pending/stale) and run it. Safe if another worker holds the lock. */
export async function processOwnedSearchJob(
  jobId: string,
  userId: string,
): Promise<SearchJob | null> {
  const repo = getRepo();
  const claimed = await repo.claimOwnedSearchJob(jobId, userId);
  if (claimed) await processSearchJob(claimed);
  return repo.getSearchJob(jobId, userId);
}

export async function drainSearchJobs(
  concurrency = searchJobConcurrency(),
): Promise<number> {
  const repo = getRepo();
  try {
    return await runJobPool({
      concurrency,
      claim: () => repo.claimSearchJob(),
      run: processSearchJob,
    });
  } catch (err) {
    if (isUndefinedTableError(err)) return 0;
    throw err;
  }
}

export async function runSearchJobWorker(
  options: {
    concurrency?: number;
    idleMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  const concurrency = options.concurrency ?? searchJobConcurrency();
  const idleMs = options.idleMs ?? DEFAULT_WORKER_IDLE_MS;
  const repo = getRepo();

  async function slot(slotId: number): Promise<void> {
    while (!options.signal?.aborted) {
      try {
        const job = await repo.claimSearchJob();
        if (!job) {
          await sleep(idleMs, options.signal);
          continue;
        }
        await processSearchJob(job);
      } catch (err) {
        if (!isUndefinedTableError(err)) {
          console.error(
            JSON.stringify({
              event: "search_worker_slot_error",
              slot: slotId,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
        await sleep(idleMs, options.signal);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => slot(i)));
}

export async function runGridWorker(
  options: {
    searchConcurrency?: number;
    enrichConcurrency?: number;
    idleMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  await Promise.all([
    runSearchJobWorker({
      concurrency: options.searchConcurrency,
      idleMs: options.idleMs,
      signal: options.signal,
    }),
    runEnrichmentWorker({
      concurrency: options.enrichConcurrency,
      idleMs: options.idleMs,
      signal: options.signal,
    }),
  ]);
}

export async function runEnrichmentWorker(
  options: {
    concurrency?: number;
    idleMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  const concurrency = options.concurrency ?? enrichConcurrency();
  const idleMs = options.idleMs ?? DEFAULT_WORKER_IDLE_MS;
  const repo = getRepo();

  async function slot(slotId: number): Promise<void> {
    while (!options.signal?.aborted) {
      try {
        const job = await repo.claimEnrichmentJob();
        if (!job) {
          await sleep(idleMs, options.signal);
          continue;
        }
        await processJob(job);
      } catch (err) {
        console.error(
          JSON.stringify({
            event: "worker_slot_error",
            slot: slotId,
            error: err instanceof Error ? err.message : String(err),
          }),
        );
        await sleep(idleMs, options.signal);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, (_, i) => slot(i)));
}

/** Mock store lives in the Next process. Postgres jobs are owned by `pnpm worker:dev`. */
export function drainJobsIfMock(
  concurrency = DEFAULT_ENRICH_CONCURRENCY,
): void {
  if (getDataSource() !== "mock") return;
  void drainSearchJobs(1);
  void drainJobs(concurrency);
}
