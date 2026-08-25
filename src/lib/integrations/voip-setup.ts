import { LIVE_VOIP_IDS, isLiveVoipId } from "./catalog";
import type { IntegrationProvider, LiveVoipProvider } from "./schema";

export type VoipField = {
  id: "token" | "account_sid" | "auth_token" | "caller_id" | "from_number" | "app_id";
  label: string;
  placeholder: string;
  hint?: string;
  secret?: boolean;
};

export type VoipSetup = {
  provider: LiveVoipProvider;
  fields: VoipField[];
  inboundHint: string;
};

const SETUPS: Record<(typeof LIVE_VOIP_IDS)[number], VoipSetup> = {
  api4com: {
    provider: "api4com",
    fields: [
      {
        id: "token",
        label: "Token de acesso",
        placeholder: "Cole o token da API4COM",
        hint: "Painel → Tokens de acesso. Prefira um token que não expire.",
        secret: true,
      },
      {
        id: "caller_id",
        label: "Ramal",
        placeholder: "1001",
        hint: "O ramal do Webphone que vai tocar no clique.",
      },
    ],
    inboundHint:
      "O GRID registra o webhook sozinho quando a URL for pública. Se estiver em localhost, copie a URL e cole em Integrações → Webhook.",
  },
  zenvia: {
    provider: "zenvia",
    fields: [
      {
        id: "token",
        label: "Access token",
        placeholder: "Cole o token da Zenvia Voice",
        hint: "Painel de voz → Desenvolvedores → Configurações API.",
        secret: true,
      },
      {
        id: "caller_id",
        label: "Ramal",
        placeholder: "2000",
        hint: "O ramal do Webphone Zenvia que vai tocar no clique.",
      },
    ],
    inboundHint:
      "Copie a URL inbound e cole em Desenvolvedores → Webhook da Zenvia Voice.",
  },
  twilio: {
    provider: "twilio",
    fields: [
      {
        id: "account_sid",
        label: "Account SID",
        placeholder: "ACxxxxxxxx",
      },
      {
        id: "auth_token",
        label: "Auth Token",
        placeholder: "Cole o Auth Token",
        secret: true,
      },
      {
        id: "from_number",
        label: "Número Twilio (From)",
        placeholder: "+5511...",
        hint: "O DID Twilio. É o número que o lead vê.",
      },
      {
        id: "caller_id",
        label: "Seu número (quem toca)",
        placeholder: "+5511988887777",
        hint: "Celular ou ramal SIP da Twilio que você atende.",
      },
    ],
    inboundHint:
      "O GRID envia o status da chamada sozinho. Não precisa configurar webhook no console.",
  },
  telnyx: {
    provider: "telnyx",
    fields: [
      {
        id: "token",
        label: "API key",
        placeholder: "KEY...",
        secret: true,
      },
      {
        id: "app_id",
        label: "Call Control App ID",
        placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
        hint: "Voice → Call Control Applications no painel Telnyx.",
      },
      {
        id: "from_number",
        label: "Número Telnyx (From)",
        placeholder: "+5511...",
      },
      {
        id: "caller_id",
        label: "Seu número (quem toca)",
        placeholder: "+5511988887777",
      },
    ],
    inboundHint:
      "O GRID usa o webhook da própria originação. Confirme a URL de failover na aplicação Call Control se a Telnyx exigir.",
  },
};

export function voipSetup(catalogId: string): VoipSetup | null {
  if (!isLiveVoipId(catalogId)) return null;
  return SETUPS[catalogId];
}

export function providerForVoipCatalog(
  catalogId: string,
): LiveVoipProvider | null {
  return voipSetup(catalogId)?.provider ?? null;
}

export function isNativeVoipProvider(
  provider: IntegrationProvider,
): provider is LiveVoipProvider {
  return (
    provider === "api4com" ||
    provider === "zenvia" ||
    provider === "twilio" ||
    provider === "telnyx"
  );
}
