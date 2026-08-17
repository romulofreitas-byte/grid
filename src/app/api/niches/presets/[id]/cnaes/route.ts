import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  const cnaes = await getRepo().resolveCnaesForPreset(id);
  return NextResponse.json(cnaes);
}
