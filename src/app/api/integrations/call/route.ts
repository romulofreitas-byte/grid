import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { testCallDestination } from "@/lib/integrations/call-target";
import { drainIntegrationJobs } from "@/lib/integrations/process-job";

const schema = z
  .object({
    connectionId: z.string().uuid(),
    cnpj: z
      .string()
      .regex(/^\d{14}$/)
      .optional(),
    searchId: z.string().uuid().nullable().optional(),
    to: z.string().max(32).optional(),
    test: z.boolean().optional(),
  })
  .refine((body) => body.test || Boolean(body.cnpj), {
    message: "cnpj or test is required",
  });

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const repo = getRepo();
  const connection = await repo.getIntegrationConnection(parsed.data.connectionId);
  if (!connection || connection.user_id !== gated.userId || connection.status !== "active") {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }
  if (connection.provider !== "webhook") {
    return NextResponse.json(
      { error: "Nesta versão só o webhook genérico dispara ligação." },
      { status: 400 },
    );
  }

  if (parsed.data.test) {
    const dest = testCallDestination(connection, parsed.data.to);
    if (!dest.ok) {
      return NextResponse.json({ error: dest.error }, { status: 400 });
    }
    const job = await repo.createIntegrationJob({
      user_id: gated.userId,
      connection_id: connection.id,
      search_id: null,
      verb: "originate_call",
      provider: connection.provider,
      payload: { test: true, to: dest.to, cnpj: parsed.data.cnpj ?? "" },
    });
    void drainIntegrationJobs(4);
    return NextResponse.json({ jobId: job.id, status: job.status, test: true });
  }

  const job = await repo.createIntegrationJob({
    user_id: gated.userId,
    connection_id: connection.id,
    search_id: parsed.data.searchId ?? null,
    verb: "originate_call",
    provider: connection.provider,
    payload: { cnpj: parsed.data.cnpj, to: parsed.data.to ?? null },
  });
  void drainIntegrationJobs(4);
  return NextResponse.json({ jobId: job.id, status: job.status });
}
