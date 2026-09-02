import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { fromDatetimeLocal } from "@/lib/crm/activity";
import { logCallSchema } from "@/lib/crm/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const parsed = logCallSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Payload inválido.");
  let next = parsed.data.next ?? null;
  if (next) {
    const dueAt =
      fromDatetimeLocal(next.dueAt) ??
      (Number.isNaN(Date.parse(next.dueAt))
        ? null
        : new Date(next.dueAt).toISOString());
    if (!dueAt) return jsonError("Horário da próxima ação inválido.");
    next = { kind: next.kind, dueAt };
  }
  const result = await getRepo().logCrmCall(
    gated.userId,
    dealId,
    parsed.data.notes,
    next,
    parsed.data.phone,
  );
  if (!result) return jsonError("Negócio não encontrado.", 404);
  return NextResponse.json(result);
}
