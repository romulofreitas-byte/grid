import { conexoesHref, largadaNovaHref } from "@/lib/back";
import { planosHref } from "@/lib/billing/href";
import { COPY } from "@/lib/copy";
import {
  pickCallConnection,
  type CallConnectionPick,
} from "@/lib/integrations/call-target";
import { CONNECTIONS_STANDBY } from "@/lib/integrations/standby";
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
  hasCrmPipeline?: boolean;
};

function filled(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

export function buildBoxEstrutura(input: BoxEstruturaInput): BoxEstrutura {
  const pistaAberta = input.savedCount > 0;
  const onboardingDone = Boolean(input.profile.onboarding_completed_at);
  const helmetReady = hasScriptIdentity(input.profile) || onboardingDone;
  const ofertaReady = filled(input.profile.promessa);
  const metaReady = onboardingDone;
  const ligarReady = pickCallConnection(input.connections) != null;
  const crmReady = Boolean(input.hasCrmPipeline);
  const creditosReady = input.billing.plano !== "free" && input.billing.total > 0;

  const slots: BoxSlot[] = [
    {
      id: "capacete",
      label: "Capacete",
      done: helmetReady,
      title: "Complete como você se apresenta",
      body: "Nome, empresa e especialidade entram no roteiro da ligação.",
      href: "/setup",
      cta: "Completar perfil",
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
      body: "Quantas ligações fecham a meta hoje. O anel só faz sentido com o perfil pronto.",
      href: "/conta#meta",
      cta: "Definir meta",
    },
    {
      id: "lista",
      label: "Lista",
      done: pistaAberta,
      title: "Salve uma lista",
      body: "O dia de ligações começa com uma lista guardada. Qualificar e ligar vêm depois.",
      href: largadaNovaHref,
      cta: input.hasUnsavedSearch ? COPY.salvarLista : COPY.novaLista,
    },
    {
      id: "crm",
      label: "CRM",
      done: crmReady,
      title: COPY.crmBoxTitle,
      body: COPY.crmBoxBody,
      href: "/crm",
      cta: COPY.crmBoxCta,
    },
    {
      id: "ligar",
      label: "Ligar",
      done: ligarReady,
      title: CONNECTIONS_STANDBY
        ? COPY.boxLigarStandbyTitle
        : "Conecte VoIP ou discador",
      body: CONNECTIONS_STANDBY
        ? COPY.boxLigarStandbyBody
        : "Ligue direto da ficha. A ligação é grátis; a assinatura cobre o restante.",
      href: conexoesHref("voip"),
      cta: CONNECTIONS_STANDBY ? COPY.boxLigarStandbyCta : "Conectar VoIP",
    },
    {
      id: "creditos",
      label: "Acesso",
      done: creditosReady,
      title: "Ative o plano",
      body: "A mensalidade abre o CRM. Crédito paga a ficha que você liga; exportar a lista custa mais.",
      href: planosHref("/box"),
      cta: "Ver planos",
    },
  ];

  return {
    slots,
    nextGap:
      slots.find(
        (slot) =>
          !slot.done && !(CONNECTIONS_STANDBY && slot.id === "ligar"),
      )?.id ?? null,
    pistaAberta,
  };
}
