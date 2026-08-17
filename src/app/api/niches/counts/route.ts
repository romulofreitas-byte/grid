import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

export const maxDuration = 60;

export async function GET(req: Request) {
  const gated = await guardApi(req, "search");
  if (isGuardReject(gated)) return gated;
  const { searchParams } = new URL(req.url);
  const ufs = (searchParams.get("ufs") || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const parentId = searchParams.get("parentId")?.trim() || null;
  const repo = getRepo();

  const ids = parentId
    ? [parentId, ...(await repo.listSegments(parentId)).map((s) => s.id)]
    : (await repo.listSegments()).map((s) => s.id);

  const counts = await repo.countPresetsInRegion(ids, ufs);
  return NextResponse.json(counts);
}
