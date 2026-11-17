import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { claimNoteImages } from "@/lib/crm/note-images";
import { eventPatchSchema } from "@/lib/crm/schema";
import type { CrmEvent } from "@/lib/crm/types";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ dealId: string; eventId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId, eventId } = await ctx.params;
  const parsed = eventPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Payload inválido.");
  let meta: CrmEvent["meta"] | undefined;
  if (parsed.data.images) {
    const images = claimNoteImages(gated.userId, dealId, parsed.data.images);
    if (!images) return jsonError("Imagem inválida.");
    meta = { images };
  }
  const result = await getRepo().updateCrmEvent(
    gated.userId,
    dealId,
    eventId,
    parsed.data.body,
    meta,
  );
  if (!result) return jsonError("Registro não encontrado.", 404);
  return NextResponse.json(result);
}
