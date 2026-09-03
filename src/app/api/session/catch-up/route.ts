import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getSearchForUser } from "@/lib/auth/search-access";
import { runUserCatchUp } from "@/lib/catchup/run";
import { runCrmQualifyBridge } from "@/lib/catchup/tasks/crm-qualify-bridge";
import { getRepo } from "@/lib/data";

export const maxDuration = 60;

const schema = z.object({
  searchId: z.string().optional(),
  cnpjs: z.array(z.string()).optional(),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  let body: unknown = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }

  const repo = getRepo();
  const searchId = parsed.data.searchId;
  const cnpjs = parsed.data.cnpjs ?? [];
  if (searchId) {
    const search = await getSearchForUser(gated.userId, searchId);
    if (!search) {
      return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
    }
    const result = await runCrmQualifyBridge(repo, gated.userId, {
      searchId,
      ...(cnpjs.length ? { cnpjs } : {}),
    });
    return NextResponse.json(result);
  }

  const result = await runUserCatchUp(gated.userId, repo);
  return NextResponse.json(result);
}
