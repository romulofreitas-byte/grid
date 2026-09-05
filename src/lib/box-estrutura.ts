import { conexoesHref, largadaNovaHref } from "@/lib/back";
import { planosHref } from "@/lib/billing/href";
import { COPY } from "@/lib/copy";
import {
  pickCallConnection,
  type CallConnectionPick,
} from "@/lib/integrations/call-target";
import { CONNECTIONS_STANDBY } from "@/lib/integrations/standby";
import { hasPresentationIdentity } from "@/lib/pilot-profile";
import type { Profile } from "@/lib/types";

export const BOX_SLOT_IDS = [
  "capacete",
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
    | "onboarding_completed_at"
    | "active_meta_id"
  >;
  billing: {
    total: number;
    plano: string;
  };
  connections: readonly CallConnectionPick[];
  hasCrmPipeline?: boolean;
};

export function buildBoxEstrutura(input: BoxEstruturaInput): BoxEstrutura {
  const pistaAberta = input.savedCount > 0;
  const onboardingDone = Boolean(input.profile.onboarding_completed_at);
  const helmetReady =
    hasPresentationIdentity(input.profile) || onboardingDone;
  const metaReady = Boolean(input.profile.active_meta_id);
  const ligarReady = pickCallConnection(input.connections) != null;
  const crmReady = Boolean(input.hasCrmPipeline);
  const creditosReady = input.billing.plano !== "free" && input.billing.total > 0;

  const slots: BoxSlot[] = [
    {
      id: "capacete",
      label: "Perfil",
      done: helmetReady,
      title: "Complete os dados da conta",
      body: "Nome, empresa e cidade ficam no perfil da conta.",
      href: onboardingDone ? "/conta/perfil" : "/setup",
      cta: "Completar perfil",
    },
    {
      id: "meta",
      label: "Meta",
      done: metaReady,
      title: COPY.boxMetaTitle,
      body: COPY.boxMetaBody,
      href: "/metas",
      cta: COPY.boxMetaCta,
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
      body: "No Treino livre você qualifica 25\u00a0empresas. A mensalidade libera o CRM e o volume do mês. Qualificar custa 1 crédito. Ligar pela ficha é grátis. Exportar a planilha custa mais.",
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
