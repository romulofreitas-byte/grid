import { NextResponse } from "next/server";
import { guardSessionOrOpsApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardSessionOrOpsApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  try {
    const cnaes = await getRepo().resolveCnaesForPreset(id);
    return NextResponse.json(cnaes);
  } catch (err) {
    return dbUnavailableResponse(err, "niches_preset_cnaes");
  }
}
