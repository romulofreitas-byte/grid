import { conexoesHref, largadaNovaHref } from "@/lib/back";
import { COPY } from "@/lib/copy";
import {
  pickCallConnection,
  type CallConnectionPick,
} from "@/lib/integrations/call-target";
import { hasScriptIdentity } from "@/lib/pilot-profile";
import type { Profile } from "@/lib/types";

export const BOX_SLOT_IDS = [
  "capacete",
  "oferta",
  "meta",
  "lista",
  "crm",
  "ligar",
  "creditos",
] as const;

export type BoxSlotId = (typeof BOX_SLOT_IDS)[number];

export type BoxSlot = {
  id: BoxSlotId;
  label: string;
  done: boolean;
  title: string;
  body: string;
  href: string;
  cta: string;
};

export type BoxEstrutura = {
  slots: BoxSlot[];
  nextGap: BoxSlotId | null;
  pistaAberta: boolean;
};

export type BoxEstruturaInput = {
  savedCount: number;
  hasUnsavedSearch: boolean;
  profile: Pick<
    Profile,
    | "como_chama"
    | "nome"
    | "empresa_usuario"
    | "cidade_usuario"
    | "especialidade"
    | "area"
    | "promessa"
    | "onboarding_completed_at"
  >;
  billing: {
    total: number;
    plano: string;
  };
  connections: readonly CallConnectionPick[];
};

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function hasActiveCrm(connections: readonly CallConnectionPick[]): boolean {
  return connections.some((c) => c.kind === "crm" && c.status === "active");
}

export function buildBoxEstrutura(input: BoxEstruturaInput): BoxEstrutura {
  const pistaAberta = input.savedCount > 0;
  const onboardingDone = Boolean(input.profile.onboarding_completed_at);
  const helmetReady = hasScriptIdentity(input.profile) || onboardingDone;
  const ofertaReady = filled(input.profile.promessa);
  const metaReady = onboardingDone;
  const ligarReady = pickCallConnection(input.connections) != null;
  const crmReady = hasActiveCrm(input.connections);
  const creditosReady = input.billing.plano !== "free" && input.billing.total > 0;

  const slots: BoxSlot[] = [
    {
      id: "capacete",
      label: "Capacete",
      done: helmetReady,
      title: "Complete o capacete",
      body: "Nome, empresa e especialidade entram no roteiro da ligação.",
      href: "/setup",
      cta: "Completar capacete",
    },
    {
      id: "oferta",
      label: "Oferta",
      done: ofertaReady,
      title: "Escreva a oferta",
      body: "Uma linha do que você entrega — entra no convite da reunião.",
      href: "/conta#promessa",
      cta: "Escrever oferta",
    },
    {
      id: "meta",
      label: "Meta",
      done: metaReady,
      title: "Defina a meta",
      body: "Quantas ligações fecham a volta hoje. O anel só faz sentido com o capacete pronto.",
      href: "/conta#meta",
      cta: "Definir meta",
    },
    {
      id: "lista",
      label: "Lista",
      done: pistaAberta,
      title: "Salve uma lista",
      body: "A pista só abre com lista guardada. Qualificar e ligar vêm na volta.",
      href: largadaNovaHref,
      cta: input.hasUnsavedSearch ? COPY.salvarLista : COPY.novaLista,
    },
    {
      id: "crm",
      label: "CRM",
      done: crmReady,
      title: "Conecte o CRM",
      body: "Mande a lista ao CRM direto. Cada CNPJ usa o mesmo crédito do Excel.",
      href: conexoesHref("crm"),
      cta: "Conectar CRM",
    },
    {
      id: "ligar",
      label: "Ligar",
      done: ligarReady,
      title: "Conecte VoIP ou discador",
      body: "Ligue direto da ficha. A ligação é grátis; a assinatura cobre o resto da volta.",
      href: conexoesHref("voip"),
      cta: "Conectar VoIP",
    },
    {
      id: "creditos",
      label: "Acesso",
      done: creditosReady,
      title: "Ative o plano",
      body: "Qualificar e exportar gastam crédito. Sem saldo a volta trava no meio.",
      href: "/planos",
      cta: "Ver planos",
    },
  ];

  return {
    slots,
    nextGap: slots.find((slot) => !slot.done)?.id ?? null,
    pistaAberta,
  };
}
