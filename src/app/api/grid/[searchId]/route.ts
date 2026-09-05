import { NextResponse, after } from "next/server";
import { getSearchForUser } from "@/lib/auth/search-access";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { filterQualifiedCnpjs, getBalance } from "@/lib/billing/service";
import { redactGridRows } from "@/lib/billing/redact";
import { getDataSource, getRepo } from "@/lib/data";
import { enqueueDiscoveryRetries } from "@/lib/enrichment/discovery-retry";
import {
  drainJobsIfMock,
  processOwnedEnrichmentJobs,
} from "@/lib/enrichment/process-job";

export const maxDuration = 60;

function isPgTimeout(err: unknown): boolean {
  return Boolean(
    err &&
      typeof err === "object" &&
      "code" in err &&
      String((err as { code: unknown }).code) === "57014",
  );
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ searchId: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  try {
    const { searchId } = await ctx.params;
    const search = await getSearchForUser(gated.userId, searchId);
    if (!search) {
      return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
    }
    const { searchParams } = new URL(req.url);
    if (searchParams.get("unauditedIds") === "1") {
      const cnpjs = await getRepo().listUnauditedCnpjs(searchId);
      return NextResponse.json({ cnpjs });
    }
    const cursor = Number(searchParams.get("cursor") ?? "0");
    const limit = Number(searchParams.get("limit") ?? "50");
    const result = await getRepo().listGridRows(searchId, cursor, limit);
    const { discoveryRetryCnpjs, ...grid } = result;
    const pageCnpjs = grid.rows.map((row) => row.cnpj);
    const repo = getRepo();
    const [balance, inCrmList, called] = await Promise.all([
      getBalance(gated.userId),
      search.saved && pageCnpjs.length > 0
        ? repo.listCrmDealCnpjs(gated.userId, pageCnpjs)
        : Promise.resolve([] as string[]),
      pageCnpjs.length > 0
        ? repo.listCallEventsToday(gated.userId, pageCnpjs)
        : Promise.resolve([] as { cnpj: string; created_at: string }[]),
    ]);
    const revealed = balance.enrichAllowed
      ? undefined
      : new Set(await filterQualifiedCnpjs(gated.userId, pageCnpjs));
    const inCrm = new Set(inCrmList);
    const calledAt = new Map(
      called.map((row) => [
        row.cnpj.replace(/\D/g, "").padStart(14, "0"),
        row.created_at,
      ]),
    );
    const rows = redactGridRows(grid.rows, balance.enrichAllowed, revealed).map(
      (row) => {
        const padded = row.cnpj.replace(/\D/g, "").padStart(14, "0");
        const at = calledAt.get(padded);
        return {
          ...row,
          inCrm: inCrm.has(padded),
          calledToday: Boolean(at),
          calledAt: at ?? null,
        };
      },
    );
    const retryCnpjs =
      discoveryRetryCnpjs?.length && !balance.enrichAllowed
        ? await filterQualifiedCnpjs(gated.userId, discoveryRetryCnpjs)
        : discoveryRetryCnpjs;
    if (retryCnpjs?.length) {
      const userId = gated.userId;
      after(() =>
        enqueueDiscoveryRetries({
          cnpjs: retryCnpjs,
          userId,
          searchId,
        })
          .then((queued) => {
            if (!queued) return;
            drainJobsIfMock();
            if (getDataSource() === "mock") return;
            return processOwnedEnrichmentJobs(searchId, userId);
          })
          .catch((err) => {
            console.error(
              JSON.stringify({
                event: "discovery_retry_error",
                searchId,
                error: err instanceof Error ? err.message : String(err),
              }),
            );
          }),
      );
    }
    return NextResponse.json({
      ...grid,
      rows,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Não foi possível carregar a lista" },
      { status: isPgTimeout(err) ? 504 : 500 },
    );
  }
}
