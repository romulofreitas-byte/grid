import type { DigitalSignalId } from "@/lib/types";

/** Curated packs. Per-niche LLM prompts can replace this later — the cockpit already reads the brief. */

export type SeasonalHook = {
  months: number[];
  gancho: string;
};

export type MarketPack = {
  slug: string;
  nome: string;
  dorPrincipal: string;
  dorChip: string;
  perguntaConsideracao: string;
  sazonalidade: SeasonalHook | null;
  sazonalidadeChip: string | null;
  janelaHorario: string;
  pontePorSinal: Partial<Record<DigitalSignalId, string>>;
};

export function janelaChipFrom(janela: string): string {
  const stripped = janela.replace(/^melhor\s+/i, "").trim();
  const cut = stripped.split(/\s+[—–-]\s+|,\s+/)[0]?.trim() ?? stripped;
  if (!cut) return "De manhã";
  return cut.charAt(0).toUpperCase() + cut.slice(1);
}

const DOR_CHIP: Record<string, string> = {
  generico: "Indicação",
  "estetica-e-beleza": "Agenda oca",
  "clinicas-estetica": "Procedimento barato",
  "saloes-premium": "Cadeira vazia",
  "saude-e-clinicas": "Horário ocioso",
  odontologia: "Cadeira ociosa",
  pet: "Terça vazia",
  "clinicas-veterinarias": "Só emergência",
  "pet-shops": "Calçada",
  automotivo: "Só pane",
  "oficinas-mecanicas": "Só pane",
  concessionarias: "Showroom vazio",
  imobiliario: "Lead frio",
  imobiliarias: "Lead frio",
  varejo: "Meio do mês",
  oticas: "Calçada e médico",
  "moda-vestuario": "Só liquidação",
  "alimentacao-fora-do-lar": "Semana morta",
  hamburguerias: "Semana morta",
  restaurantes: "Meio da semana",
  pizzarias: "Meio da semana",
  educacao: "Turma ociosa",
  "escolas-particulares": "Vaga ociosa",
  "turismo-e-hotelaria": "OTA come margem",
  hoteis: "OTA na baixa",
  industria: "Três compradores",
  "construcao-civil": "Indicação de arquiteto",
  "insumos-para-construcao": "Obra parada",
  "contabilidade-e-juridico": "Só indicação",
  "escritorios-contabeis": "Carteira parada",
  "tech-e-software": "Manda proposta",
  "logistica-e-transporte": "Caminhão ocioso",
  "transportadoras-carga": "Leilão de cotação",
  "financeiro-e-seguros": "Só renovação",
};

const SEASON_CHIP: Record<string, string> = {
  "estetica-e-beleza": "Verão",
  "clinicas-estetica": "Verão",
  "saloes-premium": "Festa / fim de ano",
  "saude-e-clinicas": "Janeiro some",
  odontologia: "Janeiro some",
  pet: "Férias",
  "clinicas-veterinarias": "Férias",
  "pet-shops": "Fim de ano",
  automotivo: "Férias",
  "oficinas-mecanicas": "Viagem",
  concessionarias: "Placa nova",
  imobiliario: "Mudança",
  imobiliarias: "Mudança",
  varejo: "Dia das Mães",
  oticas: "Volta às aulas",
  "moda-vestuario": "Dia dos Namorados",
  "alimentacao-fora-do-lar": "Dia dos Namorados",
  hamburguerias: "Dia dos Namorados",
  restaurantes: "Dia dos Namorados",
  pizzarias: "Datas",
  educacao: "Volta às aulas",
  "escolas-particulares": "Volta às aulas",
  "turismo-e-hotelaria": "Alta temporada",
  hoteis: "Alta temporada",
  industria: "Fim de ano",
  "construcao-civil": "Janeiro trava",
  "insumos-para-construcao": "Obra para",
  "contabilidade-e-juridico": "IR",
  "escritorios-contabeis": "IR",
  "tech-e-software": "Orçamento trava",
  "logistica-e-transporte": "Pico e janeiro",
  "transportadoras-carga": "Pico e janeiro",
  "financeiro-e-seguros": "Virada de ano",
};

function pontes(
  ramo: string,
  extras: Partial<Record<DigitalSignalId, string>> = {},
): Partial<Record<DigitalSignalId, string>> {
  return {
    "sem-site": `no mercado de ${ramo}, quem não aparece na busca fica refém de indicação e de quem já conhece`,
    "site-fora": `com o site fora do ar, em ${ramo} o cliente que procura agora vai pro concorrente`,
    "sem-mensuracao": `sem medir o que entra, ${ramo} não vê qual canal está pagando a conta — e a semana fraca passa batido`,
    "copyright-antigo": `presença parada no tempo; em ${ramo} a captação nova costuma ter ficado no piloto automático`,
    "sem-instagram": `sem ação visível nas redes, ${ramo} depende de quem passa na porta ou de quem já indica`,
    "sem-whatsapp": `sem um canal rápido de WhatsApp, o lead de ${ramo} pede preço no concorrente que responde agora`,
    "midia-paga": `vocês já investem em anúncio — a conversa é se isso está puxando o faturamento certo ou só enchendo a agenda de curiosos`,
    ...extras,
  };
}

function pack(
  slug: string,
  nome: string,
  fields: Omit<MarketPack, "slug" | "nome" | "pontePorSinal" | "dorChip" | "sazonalidadeChip"> & {
    pontePorSinal?: Partial<Record<DigitalSignalId, string>>;
  },
): MarketPack {
  return {
    slug,
    nome,
    ...fields,
    dorChip: DOR_CHIP[slug] ?? nome,
    sazonalidadeChip: fields.sazonalidade ? (SEASON_CHIP[slug] ?? "Janela") : null,
    pontePorSinal: pontes(nome, fields.pontePorSinal),
  };
}

export const GENERIC_PACK: MarketPack = pack("generico", "este ramo", {
  dorPrincipal:
    "em {cidade}, a maioria neste ramo vive de indicação e de quem já conhece — e não enxerga o faturamento que passa batido",
  perguntaConsideracao:
    "Como vocês estão puxando cliente novo hoje, além de quem já chega por indicação?",
  sazonalidade: null,
  janelaHorario: "melhor de manhã, antes do pico do expediente",
});

const PACK_LIST: MarketPack[] = [
  pack("estetica-e-beleza", "estética", {
    dorPrincipal:
      "em {cidade}, clínica de estética vive de agenda cheia de procedimento barato e de indicação — e a agenda nobre fica oca no meio da semana",
    perguntaConsideracao:
      "Como está a agenda de vocês no meio da semana? Tá sobrando horário nobre e enchendo de procedimento que não paga a conta?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho:
        "fim de ano e verão empurram demanda de última hora — quem não tem fila de captação vira refém do walk-in",
    },
    janelaHorario: "melhor de manhã, antes da primeira sessão",
    pontePorSinal: {
      "sem-instagram":
        "sem Instagram ativo, estética em {cidade} depende de quem já indica ou de quem passa na porta",
    },
  }),
  pack("clinicas-estetica", "clínica de estética", {
    dorPrincipal:
      "em {cidade}, clínica de estética enche a agenda de procedimento que não paga a estrutura e fica refém de indicação",
    perguntaConsideracao:
      "A agenda de vocês está cheia do procedimento certo — ou cheia de horário que não paga a conta?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "verão e festa pedem resultado agora; quem espera indicação perde a janela",
    },
    janelaHorario: "melhor de manhã, antes da primeira sessão",
  }),
  pack("saloes-premium", "salão", {
    dorPrincipal:
      "em {cidade}, salão premium vive da cliente fiel e sofre quando ela some no meio da semana",
    perguntaConsideracao:
      "Como vocês estão puxando cliente nova, além da que já volta sozinha?",
    sazonalidade: {
      months: [5, 11, 12],
      gancho: "festa e fim de ano lotam; o resto do ano a cadeira vazia come aluguel",
    },
    janelaHorario: "melhor de manhã, antes do pico da tarde",
  }),
  pack("saude-e-clinicas", "clínica", {
    dorPrincipal:
      "em {cidade}, clínica vive de encaminhamento e de quem já é paciente — o horário ocioso no meio da semana vira paisagem",
    perguntaConsideracao:
      "Como está o preenchimento da agenda além do encaminhamento que já chega?",
    sazonalidade: {
      months: [1, 2],
      gancho: "começo de ano a pessoa some da consulta; quem não tem captação ativa espera o telefone tocar",
    },
    janelaHorario: "melhor no fim da manhã, entre consultas",
  }),
  pack("odontologia", "odontologia", {
    dorPrincipal:
      "em {cidade}, consultório odontológico depende de indicação e de convênio — e o particular de ticket alto não entra sozinho",
    perguntaConsideracao:
      "Como está a cadeira ociosa no meio da semana? O particular está vindo, ou só o convênio que não paga o que deveria?",
    sazonalidade: {
      months: [1, 2],
      gancho: "janeiro o paciente some; quem espera o telefone tocar passa o mês no vermelho",
    },
    janelaHorario: "melhor no fim da manhã, entre consultas",
  }),
  pack("pet", "pet", {
    dorPrincipal:
      "em {cidade}, pet vive de quem já conhece a loja e de emergência — e a terça vazia vira 'é assim mesmo'",
    perguntaConsideracao:
      "Como vocês estão puxando tutor novo, além de quem já entra pela porta?",
    sazonalidade: {
      months: [12, 1, 7],
      gancho: "férias e fim de ano disparam hospedagem e banho; quem não se antecipa perde a janela",
    },
    janelaHorario: "melhor de manhã, antes do movimento da loja",
  }),
  pack("clinicas-veterinarias", "clínica veterinária", {
    dorPrincipal:
      "em {cidade}, clínica veterinária vive de emergência e de tutor fiel — consulta de rotina não entra sozinha",
    perguntaConsideracao:
      "A agenda de vocês está sendo puxada por emergência, ou tem rotina previsível de tutor novo?",
    sazonalidade: {
      months: [12, 1, 7],
      gancho: "férias aumentam hospedagem e consulta atrasada; quem espera o telefone tocar perde a janela",
    },
    janelaHorario: "melhor de manhã, antes do movimento da clínica",
  }),
  pack("pet-shops", "pet shop", {
    dorPrincipal:
      "em {cidade}, pet shop depende de quem passa na calçada e de tutor da vizinhança — margem some quando só entra ração em promoção",
    perguntaConsideracao:
      "Como vocês estão puxando tutor novo, além de quem já entra pela porta?",
    sazonalidade: {
      months: [12, 1],
      gancho: "fim de ano o tutor gasta com o pet; quem não aparece some da escolha",
    },
    janelaHorario: "melhor de manhã, antes do pico da loja",
  }),
  pack("automotivo", "automotivo", {
    dorPrincipal:
      "em {cidade}, oficina e loja automotiva vivem de indicação e de quem já quebrou — o serviço programado não entra sozinho",
    perguntaConsideracao:
      "A oficina está sendo puxada por emergência, ou vocês têm fila de serviço programado?",
    sazonalidade: {
      months: [11, 12, 6, 7],
      gancho: "férias e fim de ano empurram revisão de última hora; quem espera a pane perde a janela",
    },
    janelaHorario: "melhor de manhã, antes da oficina encher",
  }),
  pack("oficinas-mecanicas", "oficina", {
    dorPrincipal:
      "em {cidade}, oficina vive de quem quebrou e de indicação — o serviço programado não entra sozinho",
    perguntaConsideracao:
      "A oficina está sendo puxada por emergência, ou vocês têm fila de revisão programada?",
    sazonalidade: {
      months: [11, 12, 6],
      gancho: "viagem e fim de ano disparam revisão atrasada; quem não tem fila espera a pane",
    },
    janelaHorario: "melhor de manhã, antes da oficina encher",
  }),
  pack("concessionarias", "concessionária", {
    dorPrincipal:
      "em {cidade}, concessionária sofre quando o showroom depende de quem já ia comprar — e o lead frio some no meio do mês",
    perguntaConsideracao:
      "Como está o fluxo de gente nova no showroom, além de quem já chega decidido?",
    sazonalidade: {
      months: [12, 1, 3],
      gancho: "virada de ano e placa nova empurram decisão; quem espera o walk-in perde a janela",
    },
    janelaHorario: "melhor no fim da manhã, antes do pico da loja",
  }),
  pack("imobiliario", "imobiliário", {
    dorPrincipal:
      "em {cidade}, imobiliária vive de indicação e de placa na calçada — o lead que chega sozinho costuma ser o desqualificado",
    perguntaConsideracao:
      "Como vocês estão puxando comprador e locatário além da placa e da indicação?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "começo de ano e férias de julho mexem com mudança; quem não tem captação ativa espera o telefone",
    },
    janelaHorario: "melhor no fim da manhã, depois da visita",
  }),
  pack("imobiliarias", "imobiliária", {
    dorPrincipal:
      "em {cidade}, imobiliária vive de indicação e de placa — e recebe lead que só quer olhar sem condição de fechar",
    perguntaConsideracao:
      "O lead que chega hoje é quem compra, ou é curiosidade que queima a equipe?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "virada de ano e julho mexem com mudança; quem espera a placa perde a janela",
    },
    janelaHorario: "melhor no fim da manhã, depois da visita",
  }),
  pack("varejo", "varejo", {
    dorPrincipal:
      "em {cidade}, loja vive de quem passa na calçada e de data comemorativa — o meio do mês some e vira paisagem",
    perguntaConsideracao:
      "Como vocês estão puxando movimento além de quem já entra pela porta?",
    sazonalidade: {
      months: [5, 11, 12],
      gancho: "Dia das Mães e fim de ano concentram a venda; o resto do ano a loja espera a calçada",
    },
    janelaHorario: "melhor de manhã, antes de abrir ao público",
  }),
  pack("oticas", "ótica", {
    dorPrincipal:
      "as óticas em {cidade} dependem quase 100% de quem passa na calçada ou de indicação de médico",
    perguntaConsideracao:
      "Como está isso aí — vocês estão puxando cliente, ou esperando quem entra pela porta e o encaminhamento do oftalmo?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "volta às aulas e férias empurram lentes; quem espera a calçada perde a janela",
    },
    janelaHorario: "melhor de manhã, antes do movimento da loja",
    pontePorSinal: {
      "sem-instagram":
        "sem ação ativa de anúncio e de rede, a ótica em {cidade} fica na calçada e na indicação do médico",
      "midia-paga":
        "vi que vocês já têm ação de anúncio — a conversa é se isso está puxando quem compra, ou só quem passa na loja",
    },
  }),
  pack("moda-vestuario", "moda", {
    dorPrincipal:
      "em {cidade}, loja de moda vive de data e de quem já entra — o meio do mês some e a coleção vira saldo",
    perguntaConsideracao:
      "O movimento de vocês está vindo da calçada, ou tem gente nova chegando fora da liquidação?",
    sazonalidade: {
      months: [5, 6, 11, 12],
      gancho: "Dia dos Namorados, Dia das Mães e fim de ano concentram a venda; o resto vira saldo",
    },
    janelaHorario: "melhor de manhã, antes de abrir",
  }),
  pack("alimentacao-fora-do-lar", "alimentação", {
    dorPrincipal:
      "em {cidade}, operação de comida vive de pico e de semana morta — a equipe fica de braço cruzado no meio da semana",
    perguntaConsideracao:
      "Como você tá lidando com as semanas mortas? Sua equipe fica de braço cruzado no meio da semana?",
    sazonalidade: {
      months: [6, 12],
      gancho: "Dia dos Namorados e fim de ano enchem; quem monta promoção em cima da hora perde margem",
    },
    janelaHorario: "melhor de manhã até as 14h — à noite é pico da cozinha",
  }),
  pack("hamburguerias", "hamburgueria", {
    dorPrincipal:
      "em {cidade}, hamburgueria sofre com a semana morta: equipe de braço cruzado no meio da semana e pico que não paga o ocioso",
    perguntaConsideracao:
      "Como você tá lidando com as semanas mortas? Sua equipe fica de braço cruzado no meio da semana?",
    sazonalidade: {
      months: [6, 12],
      gancho:
        "Dia dos Namorados e fim de ano enchem; quem faz promoção em cima da hora igual ano passado perde margem",
    },
    janelaHorario: "melhor de manhã até as 14h — à noite ele está no pico da cozinha",
    pontePorSinal: {
      "sem-mensuracao":
        "sem medir o que entra, a hamburgueria não vê se a semana morta está piorando — só sente no caixa",
      "sem-instagram":
        "sem ação visível, hamburgueria em {cidade} depende de quem já conhece e de delivery que come a margem",
    },
  }),
  pack("restaurantes", "restaurante", {
    dorPrincipal:
      "em {cidade}, restaurante vive de mesa cheia no fim de semana e de almoço ocioso — o meio da semana come a margem",
    perguntaConsideracao:
      "O meio da semana de vocês está sendo puxado, ou a equipe fica olhando mesa vazia até sexta?",
    sazonalidade: {
      months: [6, 12],
      gancho: "Dia dos Namorados e fim de ano enchem; o resto do ano a mesa ociosa vira paisagem",
    },
    janelaHorario: "melhor de manhã até as 14h, antes do serviço",
  }),
  pack("pizzarias", "pizzaria", {
    dorPrincipal:
      "em {cidade}, pizzaria vive de sexta e sábado — segunda a quarta a fornalha esfria e a equipe sobra",
    perguntaConsideracao:
      "Como está o meio da semana de vocês? Só o fim de semana está pagando a operação?",
    sazonalidade: {
      months: [6, 12],
      gancho: "datas comemorativas enchem o forno; quem espera o telefone tocar perde a janela",
    },
    janelaHorario: "melhor de manhã até as 14h",
  }),
  pack("educacao", "educação", {
    dorPrincipal:
      "em {cidade}, escola e curso vivem de matrícula em janela curta — o resto do ano a turma ociosa come custo",
    perguntaConsideracao:
      "A matrícula de vocês está sendo puxada, ou depende de quem já indica e de quem aparece na porta?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "volta às aulas é a janela; quem espera indicação perde a turma",
    },
    janelaHorario: "melhor no fim da manhã, fora do horário de aula",
  }),
  pack("escolas-particulares", "escola particular", {
    dorPrincipal:
      "em {cidade}, escola particular vive da família que já indica — vaga ociosa no meio do ano vira desconto",
    perguntaConsideracao:
      "A matrícula nova está vindo, ou vocês dependem da família que já está dentro?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "volta às aulas e meio do ano são a janela; depois vira desconto pra preencher turma",
    },
    janelaHorario: "melhor no fim da manhã, fora do horário de aula",
  }),
  pack("turismo-e-hotelaria", "turismo", {
    dorPrincipal:
      "em {cidade}, hotelaria vive de sazonalidade e de OTA que come margem — a baixa temporada vira paisagem",
    perguntaConsideracao:
      "A ocupação de vocês está sendo puxada direto, ou a OTA está ditando o preço na baixa?",
    sazonalidade: {
      months: [12, 1, 7],
      gancho: "alta temporada enche; quem não tem captação própria na baixa vira refém de comissão",
    },
    janelaHorario: "melhor de manhã, depois do check-out",
  }),
  pack("hoteis", "hotel", {
    dorPrincipal:
      "em {cidade}, hotel vive de OTA e de alta temporada — na baixa a diária cai e a comissão come o que sobra",
    perguntaConsideracao:
      "A ocupação de vocês está vindo direto, ou a OTA está ditando o preço na baixa?",
    sazonalidade: {
      months: [12, 1, 7],
      gancho: "alta enche; quem não tem canal próprio na baixa vira refém de comissão",
    },
    janelaHorario: "melhor de manhã, depois do check-out",
  }),
  pack("industria", "indústria", {
    dorPrincipal:
      "em {cidade}, indústria sofre quando a carteira depende de três compradores e o pedido novo não entra no ritmo da fábrica",
    perguntaConsideracao:
      "A carteira de vocês está pulverizada, ou um cliente parado ainda derruba o mês?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "fim de ano o comprador trava pedido; quem não tem fila de oportunidade passa janeiro ocioso",
    },
    janelaHorario: "melhor no fim da manhã, depois da reunião de chão de fábrica",
  }),
  pack("construcao-civil", "construção", {
    dorPrincipal:
      "em {cidade}, obra vive de indicação de arquiteto e de cliente que chega desqualificado — a fila de obra boa não entra sozinha",
    perguntaConsideracao:
      "A maioria no seu ramo fica refém de indicação e recebe cliente que só quer o mais barato. Como tá isso aí?",
    sazonalidade: {
      months: [1, 2, 8],
      gancho: "começo de ano trava obra; quem não tem fila de projeto passa o trimestre ocioso",
    },
    janelaHorario: "melhor à tarde, quando saiu da obra e sentou no escritório",
  }),
  pack("insumos-para-construcao", "insumos de construção", {
    dorPrincipal:
      "em {cidade}, marmoraria e material de construção vivem da indicação da obra — o pedido some quando o construtor para",
    perguntaConsideracao:
      "O pedido de vocês está vindo de obra recorrente, ou cada mês depende de um construtor ligar?",
    sazonalidade: {
      months: [1, 2, 12],
      gancho: "fim de ano e janeiro a obra para; quem não tem fila de pedido sente no caixa",
    },
    janelaHorario: "melhor no fim da manhã, antes do pico da loja/oficina",
  }),
  pack("contabilidade-e-juridico", "serviço profissional", {
    dorPrincipal:
      "em {cidade}, escritório vive de indicação e de cliente que já está dentro — a carteira nova não entra no ritmo da entrega",
    perguntaConsideracao:
      "A carteira nova de vocês está sendo puxada, ou o escritório vive de quem já indica?",
    sazonalidade: {
      months: [1, 3, 4],
      gancho: "imposto de renda e começo de ano mexem com demanda; quem espera indicação perde a janela",
    },
    janelaHorario: "melhor no fim da manhã, fora do prazo do cliente",
  }),
  pack("escritorios-contabeis", "escritório contábil", {
    dorPrincipal:
      "em {cidade}, escritório contábil vive de indicação e de cliente que já está na carteira — o novo não entra no ritmo da obrigação",
    perguntaConsideracao:
      "A carteira nova está vindo, ou o escritório vive de quem já indica e de quem já está dentro?",
    sazonalidade: {
      months: [3, 4],
      gancho: "imposto de renda é a janela; quem espera indicação perde o empresário que está escolhendo agora",
    },
    janelaHorario: "melhor no fim da manhã, fora do prazo",
  }),
  pack("tech-e-software", "tecnologia", {
    dorPrincipal:
      "em {cidade}, operação de tech sofre quando o pipeline depende de indicação e o ciclo trava no 'manda proposta'",
    perguntaConsideracao:
      "O pipeline de vocês está sendo puxado, ou cada contrato novo ainda depende de quem já indica?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "fim de ano trava orçamento; quem não tem fila de conversa passa janeiro ocioso",
    },
    janelaHorario: "melhor no fim da manhã, antes das dailies da tarde",
  }),
  pack("logistica-e-transporte", "logística", {
    dorPrincipal:
      "em {cidade}, transporte vive de três embarcadores e de cotação que vira leilão — o caminhão ocioso come o mês",
    perguntaConsideracao:
      "A carga de vocês está pulverizada, ou um embarcador parado ainda derruba a semana?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "fim de ano dispara volume e janeiro some; quem não tem fila de cliente sente os dois lados",
    },
    janelaHorario: "melhor de manhã, antes da janela de coleta",
  }),
  pack("transportadoras-carga", "transportadora", {
    dorPrincipal:
      "em {cidade}, transportadora vive de cotação virando leilão e de embarcador que concentra a malha",
    perguntaConsideracao:
      "A malha de vocês está pulverizada, ou um embarcador parado ainda derruba a semana?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "fim de ano dispara volume e janeiro some; quem não tem fila sente os dois lados",
    },
    janelaHorario: "melhor de manhã, antes da coleta",
  }),
  pack("financeiro-e-seguros", "seguros e crédito", {
    dorPrincipal:
      "em {cidade}, corretora vive de renovação e de indicação — a apólice nova não entra no ritmo da carteira que vence",
    perguntaConsideracao:
      "A carteira nova está sendo puxada, ou o mês ainda depende de quem já renova e de quem indica?",
    sazonalidade: {
      months: [1, 2, 12],
      gancho: "virada de ano a pessoa revisa seguro e crédito; quem espera indicação perde a janela",
    },
    janelaHorario: "melhor no fim da manhã, fora da visita ao cliente",
  }),
];

export const MARKET_PACKS: Record<string, MarketPack> = Object.fromEntries(
  PACK_LIST.map((p) => [p.slug, p]),
);

export function getMarketPack(slug: string | null | undefined): MarketPack | null {
  if (!slug) return null;
  return MARKET_PACKS[slug] ?? null;
}
