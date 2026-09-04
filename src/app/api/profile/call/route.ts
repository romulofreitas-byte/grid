import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getSearchForUser } from "@/lib/auth/search-access";
import { recordCompletedCall } from "@/lib/crm/record-call";
import { getRepo } from "@/lib/data";

const schema = z.object({
  cnpj: z.string().regex(/^\d{14}$/),
  savedLeadId: z.string().uuid().nullable().optional(),
  searchId: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const repo = getRepo();
  const search = parsed.data.searchId
    ? await getSearchForUser(gated.userId, parsed.data.searchId)
    : null;
  await recordCompletedCall(repo, {
    userId: gated.userId,
    cnpj: parsed.data.cnpj,
    savedLeadId: parsed.data.savedLeadId ?? null,
    search,
    source: "manual",
  });
  return NextResponse.json(await repo.getPilotStats(gated.userId));
}
