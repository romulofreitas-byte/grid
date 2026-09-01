import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { debitEnrich, getBalance, getBillingStore } from "@/lib/billing/service";
import {
  insufficientCreditsPayload,
  planRequiredPayload,
} from "@/lib/billing/paywall";
import { EnrichmentNotAllowedError, InsufficientCreditsError } from "@/lib/billing/types";
import { bridgeQualifiedLeadsToCrm } from "@/lib/crm/bridge";
import { getRepo } from "@/lib/data";
import {
  applyPresenceCorrection,
  hasPresenceFields,
  PresenceCorrectionError,
} from "@/lib/enrichment/correct-presence";
import { isEnrichmentEverComplete, isEnrichmentVisible } from "@/lib/enrichment/fresh";
import {
  drainJobsIfMock,
  resolveJobScoreProfile,
} from "@/lib/enrichment/process-job";
import { z } from "zod";

export const maxDuration = 60;

const correctionsSchema = z.object({
  domain: z.string().nullable().optional(),
  instagram: z.string().nullable().optional(),
  facebook: z.string().nullable().optional(),
  linkedin: z.string().nullable().optional(),
  youtube: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  gmb: z.string().nullable().optional(),
});

const schema = z
  .object({
    searchId: z.string().optional(),
    cnpjs: z.array(z.string()).optional(),
    scope: z.enum(["first_unaudited", "all_unaudited"]).optional(),
    limit: z.union([z.literal(10), z.literal(20), z.literal(50)]).optional(),
    action: z.enum(["confirm", "reject", "correct"]).optional(),
    domain: z.string().optional(),
    refresh: z.boolean().optional(),
    corrections: correctionsSchema.optional(),
  })
  .refine(
    (d) => (d.cnpjs && d.cnpjs.length > 0) || d.scope || d.action || d.refresh,
    { message: "Informe cnpjs, scope, action ou refresh" },
  )
  .refine((d) => !d.scope || Boolean(d.searchId), {
    message: "scope exige searchId",
  })
  .refine(
    (d) => {
      if (!d.action) return true;
      if (d.action === "correct") {
        return Boolean(
          d.cnpjs &&
            d.cnpjs.length === 1 &&
            d.corrections &&
            hasPresenceFields(d.corrections),
        );
      }
      return Boolean(d.cnpjs && d.cnpjs.length === 1 && d.domain);
    },
    { message: "confirm/reject exige um cnpj e domain; correct exige corrections" },
  )
  .refine((d) => !d.refresh || (d.cnpjs && d.cnpjs.length === 1), {
    message: "refresh exige exatamente um cnpj",
  });

function enrichBillingError(err: unknown) {
  if (err instanceof EnrichmentNotAllowedError) {
    const trial = err.message.includes("30 dias");
    return NextResponse.json(
      planRequiredPayload(err.message, trial ? "trial_expired" : "plan_required"),
      { status: 403 },
    );
  }
  if (err instanceof InsufficientCreditsError) {
    return NextResponse.json(
      insufficientCreditsPayload(err.needed, err.available),
      { status: 402 },
    );
  }
  return null;
}

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const userId = gated.userId;
  const repo = getRepo();
  const searchId = parsed.data.searchId ?? null;
  const search =
    searchId != null ? await repo.getSearch(searchId) : undefined;
  if (searchId) {
    if (!search || search.user_id !== userId) {
      return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
    }
  }

  if (
    (parsed.data.action === "confirm" || parsed.data.action === "reject") &&
    parsed.data.domain &&
    parsed.data.cnpjs?.[0]
  ) {
    const cnpj = parsed.data.cnpjs[0].replace(/\D/g, "").padStart(14, "0");
    const store = await getBillingStore();
    const billed = await store.isCnpjBilled(userId, cnpj, "enrich");
    if (!billed) {
      return NextResponse.json(
        { error: "Qualifique a empresa antes de confirmar o site." },
        { status: 400 },
      );
    }
    const result = await repo.enqueueEnrichment({
      cnpjs: [cnpj],
      userId,
      searchId,
      force: true,
      payload: {
        force: true,
        action: parsed.data.action,
        domain: parsed.data.domain.replace(/^https?:\/\//, "").toLowerCase(),
      },
    });
    drainJobsIfMock();
    return NextResponse.json(result);
  }

  if (
    parsed.data.action === "correct" &&
    parsed.data.corrections &&
    parsed.data.cnpjs?.[0]
  ) {
    const cnpj = parsed.data.cnpjs[0].replace(/\D/g, "").padStart(14, "0");
    const store = await getBillingStore();
    const billed = await store.isCnpjBilled(userId, cnpj, "enrich");
    if (!billed) {
      return NextResponse.json(
        { error: "Qualifique a empresa antes de corrigir os ativos." },
        { status: 400 },
      );
    }
    const [enrichment, active] = await Promise.all([
      repo.getEnrichment(cnpj),
      repo.getLatestEnrichmentJob(cnpj),
    ]);
    if (active && (active.status === "pending" || active.status === "running")) {
      return NextResponse.json(
        { error: "Já existe uma qualificação em andamento para esta empresa." },
        { status: 409 },
      );
    }
    if (!enrichment || !isEnrichmentEverComplete(enrichment)) {
      return NextResponse.json(
        { error: "Qualifique a empresa antes de corrigir os ativos." },
        { status: 400 },
      );
    }
    let decided;
    try {
      const scoreProfile = await resolveJobScoreProfile(repo, searchId);
      decided = applyPresenceCorrection(enrichment, parsed.data.corrections, {
        scoreProfile,
      });
    } catch (err) {
      if (err instanceof PresenceCorrectionError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
    if (decided.kind === "recrawl") {
      const result = await repo.enqueueEnrichment({
        cnpjs: [cnpj],
        userId,
        searchId,
        force: true,
        payload: {
          force: true,
          action: "confirm",
          domain: decided.domain,
        },
      });
      drainJobsIfMock();
      return NextResponse.json({ ...result, recrawl: true });
    }
    await repo.upsertEnrichment(decided.row);
    if (parsed.data.corrections.domain === null) {
      await repo.setDomainCache(cnpj.slice(0, 8), null, "nao_encontrado");
    }
    return NextResponse.json({
      recrawl: false,
      enrichment: decided.row,
    });
  }

  if (parsed.data.refresh && parsed.data.cnpjs?.[0]) {
    const cnpj = parsed.data.cnpjs[0].replace(/\D/g, "").padStart(14, "0");
    const active = await repo.getLatestEnrichmentJob(cnpj);
    if (active && (active.status === "pending" || active.status === "running")) {
      return NextResponse.json(
        { error: "Já existe uma qualificação em andamento para esta empresa." },
        { status: 409 },
      );
    }
    try {
      await debitEnrich(userId, [cnpj], searchId, { forceCharge: true });
    } catch (err) {
      const billing = enrichBillingError(err);
      if (billing) return billing;
      throw err;
    }
    const result = await repo.enqueueEnrichment({
      cnpjs: [cnpj],
      userId,
      searchId,
      force: true,
      payload: { force: true, refresh: true },
    });
    drainJobsIfMock();
    return NextResponse.json(result);
  }

  let cnpjs = parsed.data.cnpjs ?? [];
  if (parsed.data.scope && searchId) {
    const unaudited = await repo.listUnauditedCnpjs(searchId);
    cnpjs =
      parsed.data.scope === "first_unaudited"
        ? unaudited.slice(0, parsed.data.limit ?? 50)
        : unaudited;
  }
  if (!cnpjs.length) {
    return NextResponse.json({ queued: 0, skippedOptOut: 0 });
  }

  const chargeable = (await repo.classifyEnrichmentCnpjs(cnpjs, userId))
    .chargeable;
  try {
    if (chargeable.length) {
      await debitEnrich(userId, chargeable, searchId);
    }
  } catch (err) {
    const billing = enrichBillingError(err);
    if (billing) return billing;
    throw err;
  }
  const result = await repo.enqueueEnrichment({
    cnpjs,
    userId,
    searchId,
  });
  drainJobsIfMock();

  let crmBridge: Awaited<ReturnType<typeof bridgeQualifiedLeadsToCrm>> | null =
    null;
  if (search?.saved) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      crmBridge = await Promise.race([
        bridgeQualifiedLeadsToCrm(repo, {
          userId,
          search,
          cnpjs,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("crm_qualify_bridge_timeout")),
            5_000,
          );
        }),
      ]);
    } catch (err) {
      console.error("crm_qualify_bridge_error", err);
      crmBridge = {
        created: 0,
        skipped: 0,
        pipelineId: null,
        pipelineNome: null,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return NextResponse.json({ ...result, crmBridge, crmPending: Boolean(search?.saved) });
}

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { searchParams } = new URL(req.url);
  const searchId = searchParams.get("searchId");
  const cnpj = searchParams.get("cnpj");
  const repo = getRepo();
  if (cnpj) {
    const [enrichment, job, store, balance] = await Promise.all([
      repo.getEnrichment(cnpj),
      repo.getLatestEnrichmentJob(cnpj),
      getBillingStore(),
      getBalance(gated.userId),
    ]);
    const digits = cnpj.replace(/\D/g, "").padStart(14, "0");
    const showEnrichment = await store.isCnpjBilled(gated.userId, digits, "enrich");
    const visible = isEnrichmentVisible(enrichment);
    return NextResponse.json({
      enrichment: visible && showEnrichment ? enrichment : null,
      jobStatus: job?.status ?? null,
      enrichAllowed: balance.enrichAllowed,
    });
  }
  if (!searchId) {
    return NextResponse.json({ error: "searchId ou cnpj obrigatório" }, { status: 400 });
  }
  const jobs = await repo.listEnrichmentJobs(searchId);
  return NextResponse.json({ jobs });
}
