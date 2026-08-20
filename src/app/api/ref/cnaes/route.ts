import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { dbUnavailableResponse } from "@/lib/data/db-api";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") ?? "";
  try {
    return NextResponse.json(await getRepo().searchCnaes(q));
  } catch (err) {
    return dbUnavailableResponse(err, "ref_cnaes");
  }
}
