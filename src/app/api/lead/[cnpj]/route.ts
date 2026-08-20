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
  if (searchId) {
    const { getSearchForUser } = await import("@/lib/auth/search-access");
    const owned = await getSearchForUser(gated.userId, searchId);
    if (!owned) {
      return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
    }
  }
  const repo = getRepo();
  const dossier = await repo.getDossier(cnpj, searchId);
  if (!dossier) {
    return NextResponse.json({ error: "NÃO ENCONTRADO" }, { status: 404 });
  }
  const [profile, balance, store] = await Promise.all([
    repo.getProfile(gated.userId),
    getBalance(gated.userId),
    getBillingStore(),
  ]);
  const enriched = await store.isCnpjBilled(gated.userId, cnpj, "enrich");
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
