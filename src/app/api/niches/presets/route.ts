import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { searchParams } = new URL(req.url);
  const ufs = (searchParams.get("ufs") || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const tree = searchParams.get("tree") === "1";
  const repo = getRepo();
  try {
    const presets = await repo.listPresets();

    if (tree) {
      const payload = presets
        .filter((n) => !n.parent_id)
        .map((n) => ({
          id: n.id,
          slug: n.slug,
          nome: n.nome,
          grupo: n.grupo,
          segments: presets
            .filter((s) => s.parent_id === n.id)
            .map((s) => ({
              id: s.id,
              slug: s.slug,
              nome: s.nome,
            })),
        }));
      return NextResponse.json(payload);
    }

    const counts = await repo.countPresetsInRegion(
      presets.map((p) => p.id),
      ufs,
    );
    const mapped = presets.map((p) => ({
      id: p.id,
      nome: p.nome,
      grupo: p.grupo,
      parent_id: p.parent_id,
      count: counts[p.id] ?? 0,
    }));
    return NextResponse.json(mapped);
  } catch (err) {
    return dbUnavailableResponse(err, "niches_presets");
  }
}
