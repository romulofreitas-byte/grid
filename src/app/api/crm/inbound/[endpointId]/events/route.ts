import { NextResponse } from "next/server";
import { z } from "zod";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardAutomationsApi, jsonError } from "@/app/api/crm/_http";
import { toPublicInboundEvent } from "@/lib/crm/inbound-events";
import { getRepo } from "@/lib/data";

const endpointIdSchema = z.string().uuid();

export async function GET(
  req: Request,
  ctx: { params: Promise<{ endpointId: string }> },
) {
  const gated = await guardAutomationsApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { endpointId } = await ctx.params;
  if (!endpointIdSchema.safeParse(endpointId).success) {
    return jsonError("Campanha não encontrada.", 404);
  }
  const repo = getRepo();
  const endpoint = await repo.getCrmInboundEndpointById(
    gated.userId,
    endpointId,
  );
  if (!endpoint) return jsonError("Campanha não encontrada.", 404);
  const events = await repo.listCrmInboundEvents(gated.userId, endpointId);
  return NextResponse.json({ events: events.map(toPublicInboundEvent) });
}
