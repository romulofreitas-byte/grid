import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { searchParams } = new URL(req.url);
  const ufs = (searchParams.get("ufs") || "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  const q = searchParams.get("q") ?? "";
  const capitals = searchParams.get("capitals") === "1";
  if (capitals) {
    return NextResponse.json(await getRepo().listCapitals(ufs));
  }
  return NextResponse.json(await getRepo().listMunicipios(ufs, q));
}
