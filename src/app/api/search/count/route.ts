import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { countResultForClient } from "@/lib/cache/count-cache";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";
import type { CountMode, SearchFilters } from "@/lib/types";
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

const countModeSchema = z.enum(["total", "full"]).default("full");

export async function POST(req: Request) {
  const gated = await guardApi(req, "search");
  if (isGuardReject(gated)) return gated;
  const body = await req.json();
  const { mode: rawMode, ...filterBody } =
    body && typeof body === "object" && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const parsed = filtersSchema.safeParse({ ...DEFAULT_FILTERS, ...filterBody });
  if (!parsed.success) {
    return NextResponse.json({ error: "Filtros inválidos" }, { status: 400 });
  }
  const modeParsed = countModeSchema.safeParse(rawMode ?? "full");
  const mode = (modeParsed.success ? modeParsed.data : "full") as CountMode;
  const filters = parsed.data as SearchFilters;
  try {
    const result = await getRepo().count(filters, mode);
    return NextResponse.json(countResultForClient(result));
  } catch (err) {
    return dbUnavailableResponse(err, "search_count");
  }
}
