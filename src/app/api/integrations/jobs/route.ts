import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { searchParams } = new URL(req.url);
  const searchId = searchParams.get("searchId");
  const jobs = await getRepo().listIntegrationJobs(gated.userId, searchId);
  return NextResponse.json({ jobs });
}
