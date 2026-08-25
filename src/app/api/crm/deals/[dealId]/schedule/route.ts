import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { fromDatetimeLocal } from "@/lib/crm/activity";
import { scheduleSchema } from "@/lib/crm/schema";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const parsed = scheduleSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Escolha a ação e o horário.");
  const dueAt =
    fromDatetimeLocal(parsed.data.dueAt) ??
    (Number.isNaN(Date.parse(parsed.data.dueAt))
      ? null
      : new Date(parsed.data.dueAt).toISOString());
  if (!dueAt) return jsonError("Horário inválido.");
  const deal = await getRepo().scheduleCrmActivity(
    gated.userId,
    dealId,
    parsed.data.kind,
    dueAt,
  );
  if (!deal) return jsonError("Negócio não encontrado.", 404);
  return NextResponse.json({ deal });
}
