import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { DEFAULT_FILTERS, type SearchFilters } from "@/lib/types";

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
  const repo = getRepo();
  const userId = gated.userId;
  const filters = {
    ...DEFAULT_FILTERS,
    ...(parsed.data.filters as Partial<SearchFilters>),
  } as SearchFilters;
  const search = await repo.runSearch(userId, parsed.data.nome, filters);
  return NextResponse.json(search);
}
