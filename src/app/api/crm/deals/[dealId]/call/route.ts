import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { fromDatetimeLocal } from "@/lib/crm/activity";
import { logCallSchema } from "@/lib/crm/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardApi(req, "crm");
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
    if (!dueAt) return jsonError("Horário da próxima volta inválido.");
    next = { kind: next.kind, dueAt };
  }
  const deal = await getRepo().logCrmCall(
    gated.userId,
    dealId,
    parsed.data.notes,
    next,
  );
  if (!deal) return jsonError("Negócio não encontrado.", 404);
  return NextResponse.json({ deal });
}
