import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { encryptJson, newHmacSecret } from "@/lib/integrations/crypto";
import { getCatalogItem } from "@/lib/integrations/catalog";
import { toPublicConnection } from "@/lib/integrations/records";
import { integrationKindSchema } from "@/lib/integrations/schema";
import { isAllowedWebhookUrl } from "@/lib/integrations/webhook-url";

const createSchema = z.object({
  provider: z.literal("webhook").default("webhook"),
  kind: integrationKindSchema.default("webhook"),
  catalog_id: z.string().max(40).optional(),
  display_name: z.string().max(80).optional(),
  webhook_url: z.string().min(8),
  caller_id: z.string().max(32).optional(),
});

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const rows = await getRepo().listIntegrationConnections(gated.userId);
  return NextResponse.json({
    connections: rows.map((row) => toPublicConnection(row)),
  });
}

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  if (!isAllowedWebhookUrl(parsed.data.webhook_url)) {
    return NextResponse.json(
      { error: "URL do webhook inválida. Use HTTPS (ou HTTP em localhost)." },
      { status: 400 },
    );
  }
  const catalogItem = parsed.data.catalog_id
    ? getCatalogItem(parsed.data.catalog_id)
    : undefined;
  if (parsed.data.catalog_id && !catalogItem) {
    return NextResponse.json({ error: "Ferramenta inválida" }, { status: 400 });
  }
  const secret = newHmacSecret();
  const sealed = encryptJson({
    hmac_secret: secret,
    webhook_url: parsed.data.webhook_url,
  });
  const now = new Date().toISOString();
  const row = await getRepo().createIntegrationConnection({
    id: crypto.randomUUID(),
    user_id: gated.userId,
    provider: "webhook",
    kind: catalogItem?.kind ?? parsed.data.kind,
    display_name:
      parsed.data.display_name?.trim() || catalogItem?.name || "Webhook",
    status: "active",
    credentials_ciphertext: sealed.ciphertext,
    credentials_nonce: sealed.nonce,
    oauth_expires_at: null,
    caller_id: parsed.data.caller_id?.trim() || null,
    config: {
      webhook_url: parsed.data.webhook_url,
      ...(catalogItem ? { catalog_id: catalogItem.id } : {}),
    },
    created_at: now,
    updated_at: now,
  });
  return NextResponse.json({
    connection: toPublicConnection(row),
    webhook_secret: secret,
  });
}
