import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { probe3cplus } from "@/lib/integrations/3cplus-adapter";

const schema = z.object({
  domain: z.string().min(3).max(120),
  api_token: z.string().min(8).max(500),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Informe domínio e token de gestor" }, { status: 400 });
  }
  const probed = await probe3cplus(parsed.data.domain, parsed.data.api_token);
  if (!probed.ok) {
    return NextResponse.json({ error: probed.error }, { status: 400 });
  }
  return NextResponse.json({ campaigns: probed.campaigns });
}
