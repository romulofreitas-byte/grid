import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { sanitizeProfilePatch } from "@/lib/pilot-profile";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const repo = getRepo();
  return NextResponse.json(await repo.getProfile(gated.userId));
}

export async function PATCH(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const body = await req.json();
  const patch = sanitizeProfilePatch(body);
  return NextResponse.json(await getRepo().updateProfile(gated.userId, patch));
}
