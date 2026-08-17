import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

const schema = z.object({
  cnpj: z.string().regex(/^\d{14}$/),
  savedLeadId: z.string().uuid().nullable().optional(),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const repo = getRepo();
  await repo.recordCallEvent(gated.userId, {
    cnpj: parsed.data.cnpj,
    savedLeadId: parsed.data.savedLeadId ?? null,
    source: "manual",
  });
  if (parsed.data.savedLeadId) {
    await repo.updateLead(parsed.data.savedLeadId, { status: "ligando" });
  }
  return NextResponse.json(await repo.getPilotStats(gated.userId));
}
