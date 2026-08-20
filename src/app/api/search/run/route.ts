import { NextResponse } from "next/server";
import { checkDailyRunSearch, recordDailyRunSearch } from "@/lib/auth/abuse-limits";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";
import { DEFAULT_FILTERS, type SearchFilters } from "@/lib/types";
import { z } from "zod";

export const maxDuration = 60;

const schema = z.object({
  nome: z.string().min(1),
  filters: z.record(z.string(), z.any()).optional(),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const daily = await checkDailyRunSearch(gated.userId);
  if (!daily.ok) {
    return NextResponse.json(
      {
        error: `Limite diário de listas atingido (${daily.limit}/dia no plano ${daily.plano}).`,
        code: "daily_run_search_limit",
        used: daily.used,
        limit: daily.limit,
      },
      { status: 429 },
    );
  }
  const repo = getRepo();
  const userId = gated.userId;
  const filters = {
    ...DEFAULT_FILTERS,
    ...(parsed.data.filters as Partial<SearchFilters>),
  } as SearchFilters;
  try {
    const search = await repo.runSearch(userId, parsed.data.nome, filters);
    await recordDailyRunSearch(userId);
    return NextResponse.json(search);
  } catch (err) {
    return dbUnavailableResponse(err, "search_run");
  }
}
