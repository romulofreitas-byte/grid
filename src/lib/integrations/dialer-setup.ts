import type { IntegrationProvider } from "./schema";

export type DialerField = {
  id: "domain" | "api_token" | "campaign_id" | "agent_token" | "caller_id";
  label: string;
  placeholder: string;
  hint?: string;
  secret?: boolean;
  optional?: boolean;
};

export type DialerSetup = {
  provider: "3cplus";
  fields: DialerField[];
  inboundHint: string;
};

const THREE_C_PLUS: DialerSetup = {
  provider: "3cplus",
  fields: [
    {
      id: "domain",
      label: "Domínio da conta",
      placeholder: "empresa.3c.plus",
      hint: "O endereço que você usa para abrir o 3C Plus, sem https.",
    },
    {
      id: "api_token",
      label: "Token de gestor",
      placeholder: "Cole o token da API",
      hint: "Configurações → Usuários → gestor → opções avançadas.",
      secret: true,
    },
    {
      id: "campaign_id",
      label: "Campanha",
      placeholder: "ID da campanha",
      hint: "Busque as campanhas depois de colar domínio e token.",
    },
    {
      id: "agent_token",
      label: "Token de agente (Ligar)",
      placeholder: "Opcional — só para click-to-call",
      hint: "O token do gestor não disca em nome do agente.",
      secret: true,
      optional: true,
    },
    {
      id: "caller_id",
      label: "Ramal do agente",
      placeholder: "1001",
      hint: "Opcional. O agente precisa estar logado na campanha para Ligar na ficha.",
      optional: true,
    },
  ],
  inboundHint:
    "Cole a URL de entrada numa integração HTTP de qualificação, se a 3C Plus liberar. O Grid não conecta Socket.io.",
};

export function dialerSetup(catalogId: string): DialerSetup | null {
  return catalogId === "3cplus" ? THREE_C_PLUS : null;
}

export function isNativeDialerProvider(
  provider: IntegrationProvider,
): provider is "3cplus" {
  return provider === "3cplus";
}
