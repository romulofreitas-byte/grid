import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi } from "@/app/api/crm/_http";
import { dealCnpjsQuerySchema } from "@/lib/crm/schema";
import { getRepo } from "@/lib/data";

export async function GET(req: Request) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const parsed = dealCnpjsQuerySchema.safeParse(
    new URL(req.url).searchParams.get("cnpjs") ?? "",
  );
  const cnpjs = parsed.success ? parsed.data : [];
  if (cnpjs.length === 0) return NextResponse.json({ cnpjs: [] });
  const found = await getRepo().listCrmDealCnpjs(gated.userId, cnpjs);
  return NextResponse.json({ cnpjs: found });
}
