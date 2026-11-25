import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError, readJson } from "@/app/api/crm/_http";
import { getRepo } from "@/lib/data";
import { claimNoteImages, isOwnedNoteImagePath } from "@/lib/crm/note-images";
import { removeNoteImages } from "@/lib/crm/note-storage";
import { reclassifyCrmCall } from "@/lib/crm/record-call";
import { eventPatchSchema } from "@/lib/crm/schema";
import type { CrmEvent } from "@/lib/crm/types";

async function removeEventImages(
  userId: string,
  dealId: string,
  event: CrmEvent,
): Promise<void> {
  const paths = (event.meta.images ?? [])
    .map((image) => image.path)
    .filter((path) => isOwnedNoteImagePath(userId, dealId, path));
  await removeNoteImages(paths);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ dealId: string; eventId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId, eventId } = await ctx.params;
  const parsed = eventPatchSchema.safeParse(await readJson(req));
  if (!parsed.success) return jsonError("Payload inválido.");
  if (parsed.data.callOutcome && parsed.data.body === undefined) {
    const marked = await reclassifyCrmCall(getRepo(), {
      userId: gated.userId,
      dealId,
      eventId,
      outcome: parsed.data.callOutcome,
    });
    if (!marked) return jsonError("Não foi possível marcar a ligação.", 404);
    return NextResponse.json(marked);
  }
  if (parsed.data.body === undefined) return jsonError("Payload inválido.");
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

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ dealId: string; eventId: string }> },
) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const { dealId, eventId } = await ctx.params;
  const result = await getRepo().deleteCrmEvent(gated.userId, dealId, eventId);
  if (!result) return jsonError("Não foi possível excluir o registro.", 404);
  await removeEventImages(gated.userId, dealId, result.event);
  return NextResponse.json({ deal: result.deal });
}
