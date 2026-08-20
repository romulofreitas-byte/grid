import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getBillingStore, getBalance } from "@/lib/billing/service";
import { redactDossier } from "@/lib/billing/redact";
import { getRepo } from "@/lib/data";

function normalizeCnpj(raw: string): string {
  return raw.replace(/\D/g, "").padStart(14, "0");
}

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
  const [owned, dossier, profile, balance, enriched] = await Promise.all([
    searchId
      ? import("@/lib/auth/search-access").then(({ getSearchForUser }) =>
          getSearchForUser(gated.userId, searchId),
        )
      : Promise.resolve(true as const),
    repo.getDossier(cnpj, searchId),
    repo.getProfile(gated.userId),
    getBalance(gated.userId),
    getBillingStore().then((store) =>
      store.isCnpjBilled(gated.userId, cnpj, "enrich"),
    ),
  ]);
  if (searchId && !owned) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  if (!dossier) {
    return NextResponse.json({ error: "NÃO ENCONTRADO" }, { status: 404 });
  }
  const safe = redactDossier(dossier, {
    showEnrichment: enriched,
    showContacts: balance.enrichAllowed,
  });
  return NextResponse.json({
    ...safe,
    profile,
    enrichAllowed: balance.enrichAllowed,
  });
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
