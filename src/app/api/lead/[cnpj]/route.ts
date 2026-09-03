import { NextResponse, after } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getSearchForUser } from "@/lib/auth/search-access";
import { getBillingStore, getBalance, crmAllowed } from "@/lib/billing/service";
import { redactDossier } from "@/lib/billing/redact";
import { FICHA_MOVE_KEYS } from "@/lib/crm/cadence";
import {
  advanceCrmOnCall,
  loadLeadCrm,
  moveLeadCrmFromFicha,
  syncCrmDealNotes,
} from "@/lib/crm/lead-sync";
import { getDataSource, getRepo } from "@/lib/data";
import { needsDiscoveryRetry } from "@/lib/enrichment/discovery";
import { enqueueDiscoveryRetries } from "@/lib/enrichment/discovery-retry";
import {
  drainJobsIfMock,
  processOwnedEnrichmentJobs,
} from "@/lib/enrichment/process-job";
import type { LeadStatus } from "@/lib/types";

function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, "").padStart(14, "0");
}

const patchSchema = z.object({
  savedLeadId: z.string().uuid().optional(),
  searchId: z.string().uuid().optional(),
  status: z.enum(["novo", "ligando", "reuniao", "descartado"]).optional(),
  notas: z.string().max(4000).optional(),
  crmStageKey: z.enum(FICHA_MOVE_KEYS).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ cnpj: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { cnpj: rawCnpj } = await ctx.params;
  const cnpj = normalizeCnpj(rawCnpj);
  const { searchParams } = new URL(req.url);
  const searchId = searchParams.get("searchId") ?? undefined;
  const repo = getRepo();
  const search = searchId
    ? await getSearchForUser(gated.userId, searchId)
    : null;
  if (searchId && !search) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  const [dossier, profile, balance, enriched] = await Promise.all([
    repo.getDossier(cnpj, searchId),
    repo.getProfile(gated.userId),
    getBalance(gated.userId),
    getBillingStore().then((store) =>
      store.isCnpjBilled(gated.userId, cnpj, "enrich"),
    ),
  ]);
  if (!dossier) {
    return NextResponse.json({ error: "NÃO ENCONTRADO" }, { status: 404 });
  }
  const safe = redactDossier(dossier, {
    showEnrichment: enriched,
    showContacts: balance.enrichAllowed,
  });
  const crm = balance.enrichAllowed
    ? await loadLeadCrm(repo, {
        userId: gated.userId,
        cnpj,
        search,
      })
    : null;
  if (
    enriched &&
    balance.enrichAllowed &&
    needsDiscoveryRetry(dossier.enrichment)
  ) {
    const userId = gated.userId;
    after(() =>
      enqueueDiscoveryRetries({
        cnpjs: [cnpj],
        userId,
        searchId: search?.id ?? null,
        priority: true,
      })
        .then((queued) => {
          if (!queued) return;
          drainJobsIfMock();
          if (getDataSource() === "mock") return;
          return processOwnedEnrichmentJobs(search?.id ?? null, userId);
        })
        .catch((err) => {
          console.error(
            JSON.stringify({
              event: "discovery_retry_error",
              cnpj,
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }),
    );
  }
  return NextResponse.json({
    ...safe,
    notas: crm?.notes || safe.notas,
    profile,
    enrichAllowed: balance.enrichAllowed,
    searchSaved: search?.saved ?? false,
    wasQualified: enriched,
    crm,
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ cnpj: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { cnpj: rawCnpj } = await ctx.params;
  const cnpj = normalizeCnpj(rawCnpj);
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const body = parsed.data;
  const repo = getRepo();
  const search = body.searchId
    ? await getSearchForUser(gated.userId, body.searchId)
    : null;

  let status: LeadStatus | undefined = body.status;
  if (await crmAllowed(gated.userId)) {
    if (body.crmStageKey) {
      const moved = await moveLeadCrmFromFicha(repo, {
        userId: gated.userId,
        cnpj,
        search,
        targetKey: body.crmStageKey,
      });
      if (moved.status) status = moved.status;
    } else if (body.status === "ligando") {
      await advanceCrmOnCall(repo, {
        userId: gated.userId,
        cnpj,
        search,
      });
    } else if (body.status === "reuniao" || body.status === "descartado") {
      const moved = await moveLeadCrmFromFicha(repo, {
        userId: gated.userId,
        cnpj,
        search,
        targetKey: body.status === "reuniao" ? "reuniao_agendada" : "descartado",
      });
      if (moved.status) status = moved.status;
    }

    if (body.notas != null) {
      await syncCrmDealNotes(repo, {
        userId: gated.userId,
        cnpj,
        search,
        notes: body.notas,
      });
    }
  }

  if (body.savedLeadId && (status !== undefined || body.notas !== undefined)) {
    await repo.updateLead(body.savedLeadId, {
      status,
      notas: body.notas,
    });
  }
  return NextResponse.json({ ok: true });
}
