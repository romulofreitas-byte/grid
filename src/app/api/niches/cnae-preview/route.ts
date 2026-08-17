import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

export async function POST(req: Request) {
  const gated = await guardApi(req, "search");
  if (isGuardReject(gated)) return gated;
  const body = await req.json();
  const preview = await getRepo().previewCnaes({
    segmentIds: body.segmentIds ?? [],
    intentQuery: body.intentQuery ?? null,
    cnaes: body.cnaes ?? [],
    ufs: body.ufs ?? [],
  });
  return NextResponse.json(preview);
}
