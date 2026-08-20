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
  const suggested = resolveCnaesFromKeywords(
    preset.keywords,
    preset.exclusoes,
    await repo.listRefCnaes(),
  );
  const rows = suggested.map((c) => {
    const cur = curated.find((x) => x.cnae === c.codigo);
    return {
      codigo: c.codigo,
      descricao: c.descricao,
      incluido: cur ? cur.incluido : true,
      count: 0,
    };
  });
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
