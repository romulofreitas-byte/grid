import { NextResponse } from "next/server";
import { guardAdminApi, guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { resolveCnaesFromKeywords } from "@/lib/niches";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  const repo = getRepo();
  const preset = await repo.getPreset(id);
  if (!preset) {
    return NextResponse.json({ error: "Preset não encontrado" }, { status: 404 });
  }
  const curated = await repo.listPresetCnaes(id);
  const refCnaes = await repo.listRefCnaes();
  const suggested = resolveCnaesFromKeywords(
    preset.keywords,
    preset.exclusoes,
    refCnaes,
  );
  const byCode = new Map(
    suggested.map((c) => [
      c.codigo,
      {
        codigo: c.codigo,
        descricao: c.descricao,
        incluido: false,
        count: 0,
      },
    ]),
  );
  // Curated rows (incl. manually added codes) always appear — expand beyond keyword hits.
  for (const cur of curated) {
    const existing = byCode.get(cur.cnae);
    if (existing) {
      existing.incluido = cur.incluido;
      continue;
    }
    const ref = refCnaes.find((r) => r.codigo === cur.cnae);
    byCode.set(cur.cnae, {
      codigo: cur.cnae,
      descricao: ref?.descricao ?? cur.cnae,
      incluido: cur.incluido,
      count: 0,
    });
  }
  const rows = [...byCode.values()].sort((a, b) =>
    a.descricao.localeCompare(b.descricao, "pt-BR"),
  );
  return NextResponse.json({ preset, rows });
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardAdminApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  const body = await req.json();
  const rows = (body.rows ?? []) as Array<{ cnae: string; incluido: boolean }>;
  await getRepo().saveNicheCuradoria(id, rows);
  return NextResponse.json({ ok: true });
}
