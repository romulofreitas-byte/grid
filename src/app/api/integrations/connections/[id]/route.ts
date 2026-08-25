import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { decryptJson, encryptJson, newHmacSecret } from "@/lib/integrations/crypto";
import { toPublicConnection } from "@/lib/integrations/records";
import { isAllowedWebhookUrl } from "@/lib/integrations/webhook-url";
import { isNativeVoipProvider } from "@/lib/integrations/voip-setup";

const patchSchema = z.object({
  display_name: z.string().max(80).optional(),
  webhook_url: z.string().min(8).optional(),
  caller_id: z.string().max(32).nullable().optional(),
  rotate_secret: z.boolean().optional(),
  status: z.enum(["active", "revoked"]).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
  from_number: z.string().max(20).nullable().optional(),
  app_id: z.string().max(80).nullable().optional(),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const repo = getRepo();
  const current = await repo.getIntegrationConnection(id);
  if (!current || current.user_id !== gated.userId) {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }
  if (parsed.data.webhook_url && !isAllowedWebhookUrl(parsed.data.webhook_url)) {
    return NextResponse.json(
      { error: "URL do webhook inválida. Use HTTPS (ou HTTP em localhost)." },
      { status: 400 },
    );
  }

  const creds = decryptJson(current.credentials_ciphertext, current.credentials_nonce);
  const native = isNativeVoipProvider(current.provider);
  const nextCreds = native
    ? { ...creds, ...(parsed.data.credentials ?? {}) }
    : {
        hmac_secret: parsed.data.rotate_secret ? newHmacSecret() : creds.hmac_secret,
        webhook_url: parsed.data.webhook_url ?? creds.webhook_url,
      };
  const sealed = encryptJson(nextCreds);
  const updated = await repo.updateIntegrationConnection(id, gated.userId, {
    display_name: parsed.data.display_name ?? current.display_name,
    caller_id:
      parsed.data.caller_id === undefined ? current.caller_id : parsed.data.caller_id,
    status: parsed.data.status ?? current.status,
    config: {
      ...current.config,
      ...(parsed.data.webhook_url ? { webhook_url: parsed.data.webhook_url } : {}),
      ...(parsed.data.from_number !== undefined
        ? { from_number: parsed.data.from_number }
        : {}),
      ...(parsed.data.app_id !== undefined ? { app_id: parsed.data.app_id } : {}),
    },
    credentials_ciphertext: sealed.ciphertext,
    credentials_nonce: sealed.nonce,
  });
  if (!updated) {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }
  return NextResponse.json({
    connection: toPublicConnection(updated),
    webhook_secret:
      !native && parsed.data.rotate_secret ? nextCreds.hmac_secret : undefined,
  });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  const ok = await getRepo().deleteIntegrationConnection(id, gated.userId);
  if (!ok) {
    return NextResponse.json({ error: "Conexão não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
