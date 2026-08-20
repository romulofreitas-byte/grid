import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";

export async function POST(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const body = await req.json();
  try {
    const preview = await getRepo().previewCnaes({
      segmentIds: body.segmentIds ?? [],
      intentQuery: body.intentQuery ?? null,
      cnaes: body.cnaes ?? [],
      ufs: body.ufs ?? [],
    });
    return NextResponse.json(preview);
  } catch (err) {
    return dbUnavailableResponse(err, "niches_cnae_preview");
  }
}
