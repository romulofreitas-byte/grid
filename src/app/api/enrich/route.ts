import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { debitEnrich, getBalance, getBillingStore } from "@/lib/billing/service";
import {
  insufficientCreditsPayload,
  planRequiredPayload,
} from "@/lib/billing/paywall";
import { EnrichmentNotAllowedError, InsufficientCreditsError } from "@/lib/billing/types";
import { getRepo } from "@/lib/data";
import { drainJobsIfMock } from "@/lib/enrichment/process-job";
import { isEnrichmentVisible } from "@/lib/enrichment/fresh";
import { z } from "zod";

export const maxDuration = 60;

const schema = z
  .object({
    searchId: z.string().optional(),
    cnpjs: z.array(z.string()).optional(),
    scope: z.enum(["first_unaudited", "all_unaudited"]).optional(),
    action: z.enum(["confirm", "reject"]).optional(),
    domain: z.string().optional(),
  })
  .refine((d) => (d.cnpjs && d.cnpjs.length > 0) || d.scope || d.action, {
    message: "Informe cnpjs, scope ou action",
  })
  .refine((d) => !d.scope || Boolean(d.searchId), {
    message: "scope exige searchId",
  })
  .refine((d) => !d.action || (d.cnpjs && d.cnpjs.length === 1 && d.domain), {
    message: "confirm/reject exige um cnpj e domain",
  });

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
  if (searchId) {
    const search = await repo.getSearch(searchId);
    if (!search || search.user_id !== userId) {
      return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
    }
  }

  if (parsed.data.action && parsed.data.domain && parsed.data.cnpjs?.[0]) {
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

  let cnpjs = parsed.data.cnpjs ?? [];
  if (parsed.data.scope && searchId) {
    const unaudited = await repo.listUnauditedCnpjs(searchId);
    cnpjs =
      parsed.data.scope === "first_unaudited"
        ? unaudited.slice(0, 50)
        : unaudited;
  }
  if (!cnpjs.length) {
    return NextResponse.json({ queued: 0, skippedOptOut: 0 });
  }

  const chargeable = (await repo.classifyEnrichmentCnpjs(cnpjs)).chargeable;
  try {
    if (chargeable.length) {
      await debitEnrich(userId, chargeable, searchId);
    }
  } catch (err) {
    if (err instanceof EnrichmentNotAllowedError) {
      return NextResponse.json(planRequiredPayload(err.message), { status: 403 });
    }
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        insufficientCreditsPayload(err.needed, err.available),
        { status: 402 },
      );
    }
    throw err;
  }
  const result = await repo.enqueueEnrichment({
    cnpjs,
    userId,
    searchId,
  });
  drainJobsIfMock();
  return NextResponse.json(result);
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
