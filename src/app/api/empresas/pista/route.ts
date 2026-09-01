import { NextResponse } from "next/server";
import { z } from "zod";
import { checkDailyRunSearch, recordDailyRunSearch } from "@/lib/auth/abuse-limits";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { onSearchSaved } from "@/lib/catchup/saved-list";
import { digitsCnpj } from "@/lib/crm/bridge";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";

export const maxDuration = 60;

const schema = z.object({
  cnpj: z.string().min(8),
  nome: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }
  const cnpj = digitsCnpj(parsed.data.cnpj);
  const daily = await checkDailyRunSearch(gated.userId);
  if (!daily.ok) {
    return NextResponse.json(
      {
        error: `Limite diário de listas atingido (${daily.limit}/dia no plano ${daily.plano}).`,
        code: "daily_run_search_limit",
      },
      { status: 429 },
    );
  }
  const repo = getRepo();
  try {
    const search = await repo.createSavedCnpjSearch(
      gated.userId,
      cnpj,
      parsed.data.nome,
    );
    if (!search) {
      return NextResponse.json(
        { error: "Empresa não encontrada nesta base da Receita." },
        { status: 404 },
      );
    }
    await recordDailyRunSearch(gated.userId);
    void onSearchSaved(gated.userId, search).catch((err) => {
      console.error("crm_empresas_pista_bridge_error", err);
    });
    return NextResponse.json({ searchId: search.id, search });
  } catch (err) {
    return dbUnavailableResponse(err, "empresas_pista");
  }
}
