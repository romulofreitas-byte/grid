import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { eventPatchSchema } from "@/lib/crm/schema";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ dealId: string; eventId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId, eventId } = await ctx.params;
  const parsed = eventPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Payload inválido.");
  const result = await getRepo().updateCrmEvent(
    gated.userId,
    dealId,
    eventId,
    parsed.data.body,
  );
  if (!result) return jsonError("Registro não encontrado.", 404);
  return NextResponse.json(result);
}
