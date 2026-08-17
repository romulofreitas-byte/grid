import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import type { SearchFilters } from "@/lib/types";
import { DEFAULT_FILTERS } from "@/lib/types";

export const maxDuration = 60;

const filtersSchema = z.object({
  cnaes: z.array(z.string()).default([]),
  presetId: z.string().nullable().default(null),
  segmentIds: z.array(z.string()).default([]),
  intentQuery: z.string().nullable().default(null),
  ufs: z.array(z.string()).default([]),
  municipioIds: z.array(z.number()).default([]),
  portes: z.array(z.string()).default([]),
  capitalMin: z.number().nullable().default(null),
  capitalMax: z.number().nullable().default(null),
  idadeMinimaAnos: z.number().default(0),
  soMatriz: z.boolean().default(false),
  excluirSimples: z.boolean().default(false),
  exigirEmailProprio: z.boolean().default(false),
  exigirDecisor: z.boolean().default(false),
  ocultarTelefonesCompartilhados: z.boolean().default(true),
  ocultarEmailsGratuitos: z.boolean().default(false),
  ocultarEnderecosCompartilhados: z.boolean().default(false),
  soEnriquecidas: z.boolean().default(false),
  cnpjs: z.array(z.string()).default([]),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "search");
  if (isGuardReject(gated)) return gated;
  const body = await req.json();
  const parsed = filtersSchema.safeParse({ ...DEFAULT_FILTERS, ...body });
  if (!parsed.success) {
    return NextResponse.json({ error: "Filtros inválidos" }, { status: 400 });
  }
  const filters = parsed.data as SearchFilters;
  const result = await getRepo().count(filters);
  return NextResponse.json(result);
}
