import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { debitEnrich } from "@/lib/billing/service";
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
  })
  .refine((d) => (d.cnpjs && d.cnpjs.length > 0) || d.scope, {
    message: "Informe cnpjs ou scope",
  })
  .refine((d) => !d.scope || Boolean(d.searchId), {
    message: "scope exige searchId",
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
      await debitEnrich(userId, chargeable.length, searchId);
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
    const [enrichment, job] = await Promise.all([
      repo.getEnrichment(cnpj),
      repo.getLatestEnrichmentJob(cnpj),
    ]);
    return NextResponse.json({
      enrichment: isEnrichmentVisible(enrichment) ? enrichment : null,
      jobStatus: job?.status ?? null,
    });
  }
  if (!searchId) {
    return NextResponse.json({ error: "searchId ou cnpj obrigatório" }, { status: 400 });
  }
  const jobs = await repo.listEnrichmentJobs(searchId);
  return NextResponse.json({ jobs });
}
