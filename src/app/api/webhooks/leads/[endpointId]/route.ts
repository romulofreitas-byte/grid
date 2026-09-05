import { guardPublicApi } from "@/lib/auth/api-guard";
import { handleInboundLeadPost } from "@/lib/crm/handle-inbound-lead";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ endpointId: string }> },
) {
  const limited = await guardPublicApi(req, "webhook");
  if (limited) return limited;
  const { endpointId } = await ctx.params;
  return handleInboundLeadPost(req, { endpointId });
}
