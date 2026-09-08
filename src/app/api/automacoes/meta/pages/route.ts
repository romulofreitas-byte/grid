import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardAutomationsApi } from "@/app/api/crm/_http";
import { metaConfigured } from "@/lib/crm/meta-api";
import { getRepo } from "@/lib/data";

export async function GET(req: Request) {
  const gated = await guardAutomationsApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const pages = await getRepo().listCrmMetaConnections(gated.userId);
  return NextResponse.json({ pages, configured: metaConfigured() });
}
