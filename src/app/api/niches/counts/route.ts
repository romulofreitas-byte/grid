import { NextResponse } from "next/server";
import { guardSessionOrOpsApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";

export const maxDuration = 60;

export async function GET(req: Request) {
  const gated = await guardSessionOrOpsApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { searchParams } = new URL(req.url);
  const ufs = (searchParams.get("ufs") || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const parentId = searchParams.get("parentId")?.trim() || null;
  const repo = getRepo();

  try {
    const ids = parentId
      ? [parentId, ...(await repo.listSegments(parentId)).map((s) => s.id)]
      : (await repo.listSegments()).map((s) => s.id);

    const counts = await repo.countPresetsInRegion(ids, ufs);
    return NextResponse.json(counts);
  } catch (err) {
    return dbUnavailableResponse(err, "niches_counts");
  }
}
