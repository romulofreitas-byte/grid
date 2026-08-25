import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { encryptJson, newHmacSecret } from "@/lib/integrations/crypto";
import { getCatalogItem, isLiveVoipId } from "@/lib/integrations/catalog";
import { toPublicConnection, appOrigin, inboundWebhookPath } from "@/lib/integrations/records";
import { integrationKindSchema } from "@/lib/integrations/schema";
import { isAllowedWebhookUrl } from "@/lib/integrations/webhook-url";
import { voipSetup } from "@/lib/integrations/voip-setup";
import { probeApi4com, registerApi4comWebhook } from "@/lib/integrations/api4com-adapter";
import { probeZenvia } from "@/lib/integrations/zenvia-adapter";
import { probeTwilio } from "@/lib/integrations/twilio-adapter";
import { probeTelnyx } from "@/lib/integrations/telnyx-adapter";
import { toDialE164 } from "@/lib/integrations/voip-dial";

const createSchema = z.object({
  provider: z.literal("webhook").optional(),
  kind: integrationKindSchema.optional(),
  catalog_id: z.string().max(40).optional(),
  display_name: z.string().max(80).optional(),
  webhook_url: z.string().min(8).optional(),
  caller_id: z.string().max(32).optional(),
  from_number: z.string().max(20).optional(),
  app_id: z.string().max(80).optional(),
  credentials: z.record(z.string(), z.string()).optional(),
});

function publicHttps(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1"
    );
  } catch {
    return false;
  }
}

async function probeVoip(input: {
  catalogId: string;
  creds: Record<string, string>;
}): Promise<{ ok: true; apiBase?: string } | { ok: false; error: string }> {
  if (input.catalogId === "api4com") {
    const token = input.creds.token?.trim() ?? "";
    if (token.length < 8) return { ok: false, error: "Cole o token da API4COM" };
    const probed = await probeApi4com(token);
    return probed.ok ? { ok: true } : probed;
  }
  if (input.catalogId === "zenvia") {
    const token = input.creds.token?.trim() ?? "";
    if (token.length < 8) return { ok: false, error: "Cole o token da Zenvia Voice" };
    const probed = await probeZenvia(token);
    return probed.ok ? { ok: true, apiBase: probed.base } : probed;
  }
  if (input.catalogId === "twilio") {
    const sid = input.creds.account_sid?.trim() ?? "";
    const token = input.creds.auth_token?.trim() ?? "";
    if (sid.length < 8 || token.length < 8) {
      return { ok: false, error: "Informe Account SID e Auth Token" };
    }
    return probeTwilio(sid, token);
  }
  if (input.catalogId === "telnyx") {
    const token = input.creds.token?.trim() ?? "";
    if (token.length < 8) return { ok: false, error: "Cole a API key da Telnyx" };
    return probeTelnyx(token);
  }
  return { ok: false, error: "VoIP não suportado" };
}

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

  const catalogItem = parsed.data.catalog_id
    ? getCatalogItem(parsed.data.catalog_id)
    : undefined;
  if (parsed.data.catalog_id && !catalogItem) {
    return NextResponse.json({ error: "Ferramenta inválida" }, { status: 400 });
  }

  const catalogId = catalogItem?.id;
  const setup = catalogId ? voipSetup(catalogId) : null;

  if (setup && catalogId && isLiveVoipId(catalogId)) {
    const callerId = parsed.data.caller_id?.trim() ?? "";
    if (!callerId) {
      return NextResponse.json({ error: "Informe o ramal ou o número que toca" }, { status: 400 });
    }
    if (setup.fields.some((f) => f.id === "from_number")) {
      if (!toDialE164(parsed.data.from_number ?? "")) {
        return NextResponse.json(
          { error: "Informe o número From em E.164 (+55…)" },
          { status: 400 },
        );
      }
    }
    if (setup.fields.some((f) => f.id === "app_id") && !parsed.data.app_id?.trim()) {
      return NextResponse.json(
        { error: "Informe o Call Control App ID" },
        { status: 400 },
      );
    }
    const creds = parsed.data.credentials ?? {};
    let probed: { ok: true; apiBase?: string } | { ok: false; error: string };
    try {
      probed = await probeVoip({ catalogId, creds });
    } catch {
      return NextResponse.json(
        { error: "Não foi possível falar com o VoIP. Tente de novo." },
        { status: 400 },
      );
    }
    if (!probed.ok) {
      return NextResponse.json({ error: probed.error }, { status: 400 });
    }

    const sealed = encryptJson(creds);
    const id = crypto.randomUUID();
    const inboundUrl = `${appOrigin()}${inboundWebhookPath(id, catalogId, setup.provider)}`;
    const now = new Date().toISOString();
    let row = await getRepo().createIntegrationConnection({
      id,
      user_id: gated.userId,
      provider: setup.provider,
      kind: "voip",
      display_name: parsed.data.display_name?.trim() || catalogItem?.name || setup.provider,
      status: "active",
      credentials_ciphertext: sealed.ciphertext,
      credentials_nonce: sealed.nonce,
      oauth_expires_at: null,
      caller_id: callerId,
      config: {
        catalog_id: catalogId,
        from_number: parsed.data.from_number?.trim() || undefined,
        app_id: parsed.data.app_id?.trim() || undefined,
        api_base: probed.apiBase,
        webhook_registered: false,
      },
      created_at: now,
      updated_at: now,
    });
    if (catalogId === "api4com" && publicHttps(inboundUrl)) {
      const webhookRegistered = await registerApi4comWebhook(
        creds.token ?? "",
        inboundUrl,
      );
      if (webhookRegistered) {
        row =
          (await getRepo().updateIntegrationConnection(id, gated.userId, {
            config: { ...row.config, webhook_registered: true },
          })) ?? row;
      }
    }
    return NextResponse.json({
      connection: toPublicConnection(row),
    });
  }

  if (!parsed.data.webhook_url) {
    return NextResponse.json(
      { error: "Este VoIP ainda não conecta nativo. Escolha API4COM, Zenvia, Twilio ou Telnyx." },
      { status: 400 },
    );
  }
  if (!isAllowedWebhookUrl(parsed.data.webhook_url)) {
    return NextResponse.json(
      { error: "URL do webhook inválida. Use HTTPS (ou HTTP em localhost)." },
      { status: 400 },
    );
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
    kind: catalogItem?.kind ?? parsed.data.kind ?? "webhook",
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
