import { NextResponse, after } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import {
  ENRICH_CREDIT_COST,
  debitEnrich,
  getBalance,
} from "@/lib/billing/service";
import {
  insufficientCreditsPayload,
  planRequiredPayload,
} from "@/lib/billing/paywall";
import {
  EnrichmentNotAllowedError,
  InsufficientCreditsError,
} from "@/lib/billing/types";
import { pickEntradaStage } from "@/lib/crm/cadence";
import { applyImportLeads } from "@/lib/crm/import-apply";
import { parseImportCnpj } from "@/lib/crm/import";
import {
  issuesFromApply,
  toPublicImportRun,
} from "@/lib/crm/import-history";
import { crmImportSchema, importSchemaError } from "@/lib/crm/schema";
import { getDataSource, getRepo } from "@/lib/data";
import { QUALIFY_LIST_MAX } from "@/lib/enrichment/jobs";
import { processOwnedEnrichmentJobs } from "@/lib/enrichment/process-job";
import { isSerperPaused } from "@/lib/enrichment/serper-stats";

export const maxDuration = 60;

export async function GET(req: Request) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const runs = await getRepo().listCrmImportRuns(gated.userId);
  return NextResponse.json({ runs: runs.map(toPublicImportRun) });
}

function billingError(err: unknown) {
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

function kickEnrichment(searchId: string, userId: string) {
  if (getDataSource() === "mock") return;
  after(() =>
    processOwnedEnrichmentJobs(searchId, userId).catch((err) => {
      console.error("import_qualify_error", err);
    }),
  );
}

export async function POST(req: Request) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const parsed = crmImportSchema.safeParse(await readJson(req));
  if (!parsed.success) {
    return jsonError(importSchemaError(parsed.error));
  }

  const repo = getRepo();
  let pipelineId = parsed.data.pipeline_id ?? "";
  if (parsed.data.pipeline_nome && !parsed.data.pipeline_id) {
    const created = await repo.createCrmPipeline(
      gated.userId,
      parsed.data.pipeline_nome,
    );
    pipelineId = created.id;
  }
  const board = await repo.getCrmBoard(gated.userId, pipelineId);
  if (!board) return jsonError("Nicho não encontrado.", 404);
  const stageId = pickEntradaStage(board.stages)?.id;

  const rows = parsed.data.rows.map((row) => ({ ...row }));
  const cnpjs = [
    ...new Set(
      rows
        .map((row) => parseImportCnpj(row.cnpj).cnpj)
        .filter((value): value is string => Boolean(value)),
    ),
  ];

  let chargeable: string[] = [];
  if (parsed.data.qualify && cnpjs.length && !isSerperPaused()) {
    chargeable = (
      await repo.classifyEnrichmentCnpjs(cnpjs, gated.userId)
    ).chargeable.slice(0, QUALIFY_LIST_MAX);
    if (chargeable.length) {
      const balance = await getBalance(gated.userId);
      const needed = chargeable.length * ENRICH_CREDIT_COST;
      if (!balance.enrichAllowed && balance.trialExpired) {
        return NextResponse.json(
          planRequiredPayload(
            "Os 30 dias do Piloto da Plataforma acabaram. Assine o Piloto para continuar.",
            "trial_expired",
          ),
          { status: 403 },
        );
      }
      if (needed > balance.total) {
        return NextResponse.json(
          insufficientCreditsPayload(needed, balance.total),
          { status: 402 },
        );
      }
    }
  }

  const result = await applyImportLeads({
    repo,
    userId: gated.userId,
    pipelineId,
    stageId,
    source: "import",
    rows,
    existingDeals: board.deals,
  });
  if ("error" in result) return jsonError(result.error, result.status);

  const list =
    cnpjs.length > 0
      ? await repo.createSavedCnpjList(
          gated.userId,
          board.pipeline.nome,
          cnpjs,
        )
      : null;

  let qualified = 0;
  if (parsed.data.qualify && chargeable.length && list && !isSerperPaused()) {
    try {
      await debitEnrich(gated.userId, chargeable, list.id);
    } catch (err) {
      const billed = billingError(err);
      if (billed) return billed;
      throw err;
    }
    await repo.enqueueEnrichment({
      cnpjs: chargeable,
      userId: gated.userId,
      searchId: list.id,
      priority: true,
    });
    kickEnrichment(list.id, gated.userId);
    qualified = chargeable.length;
  }

  try {
    await repo.createCrmImportRun(gated.userId, {
      pipelineId,
      pipelineNome: board.pipeline.nome,
      fileName: parsed.data.file_name ?? null,
      created: result.created,
      skipped: result.skipped,
      errorCount: result.errors.length,
      matchedCnpjs: cnpjs.length,
      listId: list?.id ?? null,
      qualified,
      issues: issuesFromApply(rows, result),
    });
  } catch (err) {
    console.error("import_run_persist_error", err);
  }

  return NextResponse.json({
    ...result,
    pipeline_id: pipelineId,
    matched_cnpjs: cnpjs.length,
    list_id: list?.id ?? null,
    qualified,
  });
}
