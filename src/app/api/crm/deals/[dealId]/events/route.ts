import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { fromDatetimeLocal } from "@/lib/crm/activity";
import { countConfirmedCrmCall } from "@/lib/crm/record-call";
import { eventCreateSchema } from "@/lib/crm/schema";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const events = await getRepo().listCrmEvents(gated.userId, dealId);
  if (!events) return jsonError("Negócio não encontrado.", 404);
  return NextResponse.json({ events });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ dealId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId } = await ctx.params;
  const parsed = eventCreateSchema.safeParse(await readJson(req));
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
  const repo = getRepo();
  const result = await repo.createCrmEvent(gated.userId, dealId, {
    kind: parsed.data.kind,
    body: parsed.data.body,
    meta: parsed.data.phone ? { phone: parsed.data.phone } : {},
    next,
  });
  if (!result) return jsonError("Negócio não encontrado.", 404);
  await countConfirmedCrmCall(repo, gated.userId, result.deal, result.event.kind);
  return NextResponse.json(result);
}
