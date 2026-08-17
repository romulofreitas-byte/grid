import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ cnpj: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { cnpj } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const searchId = searchParams.get("searchId") ?? undefined;
  const repo = getRepo();
  const dossier = await repo.getDossier(cnpj, searchId);
  if (!dossier) {
    return NextResponse.json({ error: "NÃO ENCONTRADO" }, { status: 404 });
  }
  const profile = await repo.getProfile(gated.userId);
  return NextResponse.json({ ...dossier, profile });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ cnpj: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  await ctx.params;
  const body = await req.json();
  if (body.savedLeadId) {
    await getRepo().updateLead(body.savedLeadId, {
      status: body.status,
      notas: body.notas,
    });
  }
  return NextResponse.json({ ok: true });
}
