import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { isAdminSession } from "@/lib/auth/admin";
import { getRepo } from "@/lib/data";
import { sanitizeProfilePatch } from "@/lib/pilot-profile";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const repo = getRepo();
  const profile = await repo.getProfile(gated.userId);
  const isAdmin = isAdminSession({ email: gated.email });
  return NextResponse.json({
    ...profile,
    email: gated.email,
    isAdmin,
  });
}

export async function PATCH(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const body = await req.json();
  const patch = sanitizeProfilePatch(body);
  const profile = await getRepo().updateProfile(gated.userId, patch);
  return NextResponse.json({
    ...profile,
    email: gated.email,
    isAdmin: isAdminSession({ email: gated.email }),
  });
}
