import { NextResponse } from "next/server";
import { guardSessionOrOpsApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";
import { canUseNameQuery, emptyNamePreview } from "@/lib/data/name-query";

export async function GET(req: Request) {
  const gated = await guardSessionOrOpsApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  const ufs = (searchParams.get("ufs") || "")
    .split(",")
    .map((u) => u.trim().toUpperCase())
    .filter((u) => /^[A-Z]{2}$/.test(u));
  if (!canUseNameQuery(q)) {
    return NextResponse.json(emptyNamePreview());
  }
  try {
    return NextResponse.json(await getRepo().previewNames(q, ufs));
  } catch (err) {
    return dbUnavailableResponse(err, "niches_name_preview");
  }
}
