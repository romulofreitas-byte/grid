import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { debitExport } from "@/lib/billing/service";
import { insufficientCreditsPayload } from "@/lib/billing/paywall";
import { InsufficientCreditsError } from "@/lib/billing/types";
import { getRepo } from "@/lib/data";
import { drainIntegrationJobs } from "@/lib/integrations/process-job";

const schema = z.object({
  searchId: z.string().uuid(),
  connectionId: z.string().uuid(),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "export");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const repo = getRepo();
  const search = await repo.getSearch(parsed.data.searchId);
  if (!search || search.user_id !== gated.userId) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  const connection = await repo.getIntegrationConnection(parsed.data.connectionId);
  if (!connection || connection.user_id !== gated.userId || connection.status !== "active") {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }
  if (connection.provider !== "webhook") {
    return NextResponse.json(
      { error: "Nesta versão só o webhook genérico envia lista." },
      { status: 400 },
    );
  }

  const leads = (await repo.getAllLeadsForExport(search.id)).slice(0, 1000);
  if (leads.length === 0) {
    return NextResponse.json({ error: "Lista vazia" }, { status: 400 });
  }

  let billed: { charged: number; skipped: number };
  try {
    billed = await debitExport(
      gated.userId,
      leads.map((l) => l.establishment.cnpj),
      search.id,
    );
  } catch (err) {
    if (err instanceof InsufficientCreditsError) {
      return NextResponse.json(
        insufficientCreditsPayload(err.needed, err.available),
        { status: 402 },
      );
    }
    throw err;
  }

  const job = await repo.createIntegrationJob({
    user_id: gated.userId,
    connection_id: connection.id,
    search_id: search.id,
    verb: "push_list",
    provider: connection.provider,
    payload: { charged: billed.charged, skipped: billed.skipped },
  });
  void drainIntegrationJobs(4);
  return NextResponse.json({
    jobId: job.id,
    status: job.status,
    charged: billed.charged,
    skipped: billed.skipped,
  });
}
