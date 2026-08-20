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
    "sem-site": `sem site, ${ramo} só aparece para quem já conhece`,
    "site-fora": `com o site fora do ar, quem busca ${ramo} agora vai para o concorrente`,
    "sem-mensuracao": `sem medir o que entra, ${ramo} não vê qual canal está pagando`,
    "copyright-antigo": `o site de ${ramo} está desatualizado — a captação nova ficou parada`,
    "sem-instagram": `sem Instagram, ${ramo} depende de quem passa na porta ou de quem já indica`,
    "sem-whatsapp": `sem WhatsApp, o lead de ${ramo} pede preço no concorrente que responde agora`,
    "midia-paga": `já tem anúncio no ar — a pergunta é se isso está trazendo pedido certo`,
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
    "Em {cidade}, cliente novo entra sobretudo por indicação. Sem fila própria, o mês depende de quem já conhece.",
  perguntaConsideracao:
    "Como vocês estão trazendo cliente novo hoje, além de quem já chega por indicação?",
  sazonalidade: null,
  janelaHorario: "De manhã, antes do pico do expediente",
});

const PACK_LIST: MarketPack[] = [
  pack("estetica-e-beleza", "estética", {
    dorPrincipal:
      "Em {cidade}, a agenda enche de procedimento barato. Horário nobre no meio da semana fica vazio.",
    perguntaConsideracao:
      "No meio da semana, está sobrando horário nobre e enchendo de procedimento que não paga a conta?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "Novembro, dezembro e janeiro concentram a demanda. Sem fila de captação, a clínica espera quem entra pela porta.",
    },
    janelaHorario: "De manhã, antes da primeira sessão",
    pontePorSinal: {
      "sem-instagram":
        "sem Instagram, estética em {cidade} depende de quem já indica ou de quem passa na porta",
    },
  }),
  pack("clinicas-estetica", "clínica de estética", {
    dorPrincipal:
      "Em {cidade}, a agenda enche de procedimento que não paga a estrutura. Cliente novo entra por indicação.",
    perguntaConsideracao:
      "A agenda está cheia do procedimento certo, ou de horário que não paga a conta?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "Verão e festa pedem resultado agora. Quem espera indicação perde novembro a janeiro.",
    },
    janelaHorario: "De manhã, antes da primeira sessão",
  }),
  pack("saloes-premium", "salão", {
    dorPrincipal:
      "Em {cidade}, o salão vive da cliente que já volta. No meio da semana a cadeira esvazia.",
    perguntaConsideracao:
      "Como vocês estão trazendo cliente nova, além da que já volta sozinha?",
    sazonalidade: {
      months: [5, 11, 12],
      gancho: "Maio, novembro e dezembro lotam. No resto do ano a cadeira vazia paga o aluguel.",
    },
    janelaHorario: "De manhã, antes do pico da tarde",
  }),
  pack("saude-e-clinicas", "clínica", {
    dorPrincipal:
      "Em {cidade}, a clínica vive de encaminhamento e de paciente antigo. Horário ocioso no meio da semana fica parado.",
    perguntaConsideracao:
      "Além do encaminhamento que já chega, como está o preenchimento da agenda?",
    sazonalidade: {
      months: [1, 2],
      gancho: "Em janeiro e fevereiro a consulta some. Sem captação, a clínica espera o telefone.",
    },
    janelaHorario: "Fim da manhã, entre consultas",
  }),
  pack("odontologia", "odontologia", {
    dorPrincipal:
      "Em {cidade}, o consultório depende de indicação e de convênio. Particular de ticket alto não entra sozinho.",
    perguntaConsideracao:
      "A cadeira ociosa no meio da semana está sendo preenchida por particular, ou só por convênio?",
    sazonalidade: {
      months: [1, 2],
      gancho: "Em janeiro e fevereiro o paciente some. Quem espera o telefone passa o mês no vermelho.",
    },
    janelaHorario: "Fim da manhã, entre consultas",
  }),
  pack("pet", "pet", {
    dorPrincipal:
      "Em {cidade}, o movimento vem de quem já conhece e de emergência. Terça vazia vira rotina.",
    perguntaConsideracao:
      "Como vocês estão trazendo tutor novo, além de quem já entra pela porta?",
    sazonalidade: {
      months: [12, 1, 7],
      gancho: "Dezembro, janeiro e julho disparam hospedagem e banho. Quem não se antecipa perde a janela.",
    },
    janelaHorario: "De manhã, antes do movimento da loja",
  }),
  pack("clinicas-veterinarias", "clínica veterinária", {
    dorPrincipal:
      "Em {cidade}, a clínica vive de emergência e de tutor fiel. Consulta de rotina não entra sozinha.",
    perguntaConsideracao:
      "A agenda está sendo puxada por emergência, ou tem rotina previsível de tutor novo?",
    sazonalidade: {
      months: [12, 1, 7],
      gancho: "Férias aumentam hospedagem e consulta atrasada. Quem espera o telefone perde a janela.",
    },
    janelaHorario: "De manhã, antes do movimento da clínica",
  }),
  pack("pet-shops", "pet shop", {
    dorPrincipal:
      "Em {cidade}, o pet shop depende de quem passa na calçada. Margem some quando só entra ração em promoção.",
    perguntaConsideracao:
      "Como vocês estão trazendo tutor novo, além de quem já entra pela porta?",
    sazonalidade: {
      months: [12, 1],
      gancho: "Em dezembro e janeiro o tutor gasta com o pet. Quem não aparece some da escolha.",
    },
    janelaHorario: "De manhã, antes do pico da loja",
  }),
  pack("automotivo", "automotivo", {
    dorPrincipal:
      "Em {cidade}, oficina e loja vivem de indicação e de quem já quebrou. Serviço programado não entra sozinho.",
    perguntaConsideracao:
      "A oficina está sendo puxada por emergência, ou vocês têm fila de serviço programado?",
    sazonalidade: {
      months: [11, 12, 6, 7],
      gancho: "Férias e fim de ano empurram revisão de última hora. Quem espera a pane perde a janela.",
    },
    janelaHorario: "De manhã, antes da oficina encher",
  }),
  pack("oficinas-mecanicas", "oficina", {
    dorPrincipal:
      "Em {cidade}, a oficina vive de quem quebrou e de indicação. Revisão programada não entra sozinha.",
    perguntaConsideracao:
      "A oficina está sendo puxada por emergência, ou vocês têm fila de revisão programada?",
    sazonalidade: {
      months: [11, 12, 6],
      gancho: "Viagem e fim de ano disparam revisão atrasada. Quem não tem fila espera a pane.",
    },
    janelaHorario: "De manhã, antes da oficina encher",
  }),
  pack("concessionarias", "concessionária", {
    dorPrincipal:
      "Em {cidade}, o showroom depende de quem já ia comprar. Lead frio some no meio do mês.",
    perguntaConsideracao:
      "Como está o fluxo de gente nova no showroom, além de quem já chega decidido?",
    sazonalidade: {
      months: [12, 1, 3],
      gancho: "Virada de ano e placa nova empurram a decisão. Quem espera o walk-in perde a janela.",
    },
    janelaHorario: "Fim da manhã, antes do pico da loja",
  }),
  pack("imobiliario", "imobiliário", {
    dorPrincipal:
      "Em {cidade}, a imobiliária vive de indicação e de placa na calçada. Lead que chega sozinho costuma ser o desqualificado.",
    perguntaConsideracao:
      "Como vocês estão trazendo comprador e locatário além da placa e da indicação?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "Começo de ano e julho mexem com mudança. Sem captação, a imobiliária espera o telefone.",
    },
    janelaHorario: "Fim da manhã, depois da visita",
  }),
  pack("imobiliarias", "imobiliária", {
    dorPrincipal:
      "Em {cidade}, a imobiliária vive de indicação e de placa. Chega lead que só quer olhar, sem condição de fechar.",
    perguntaConsideracao:
      "O lead que chega hoje é quem compra, ou é curiosidade que queima a equipe?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "Virada de ano e julho mexem com mudança. Quem espera a placa perde a janela.",
    },
    janelaHorario: "Fim da manhã, depois da visita",
  }),
  pack("varejo", "varejo", {
    dorPrincipal:
      "Em {cidade}, a loja vive de quem passa na calçada e de data comemorativa. No meio do mês o movimento some.",
    perguntaConsideracao:
      "Como vocês estão trazendo movimento além de quem já entra pela porta?",
    sazonalidade: {
      months: [5, 11, 12],
      gancho: "Dia das Mães e fim de ano concentram a venda. No resto do ano a loja espera a calçada.",
    },
    janelaHorario: "De manhã, antes de abrir ao público",
  }),
  pack("oticas", "ótica", {
    dorPrincipal:
      "Em {cidade}, a ótica depende de quem passa na calçada ou do encaminhamento do oftalmo.",
    perguntaConsideracao:
      "Vocês estão trazendo cliente, ou esperando quem entra pela porta e o encaminhamento do oftalmo?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "Volta às aulas e férias empurram lentes. Quem espera a calçada perde a janela.",
    },
    janelaHorario: "De manhã, antes do movimento da loja",
    pontePorSinal: {
      "sem-instagram":
        "sem rede e sem anúncio, a ótica em {cidade} fica na calçada e na indicação do médico",
      "midia-paga":
        "já tem anúncio no ar — a pergunta é se isso está trazendo quem compra, ou só quem passa na loja",
    },
  }),
  pack("moda-vestuario", "moda", {
    dorPrincipal:
      "Em {cidade}, a loja vive de data e de quem já entra. No meio do mês o movimento some e a coleção vira saldo.",
    perguntaConsideracao:
      "O movimento está vindo da calçada, ou tem gente nova chegando fora da liquidação?",
    sazonalidade: {
      months: [5, 6, 11, 12],
      gancho: "Dia das Mães, Dia dos Namorados e fim de ano concentram a venda. O resto vira saldo.",
    },
    janelaHorario: "De manhã, antes de abrir",
  }),
  pack("alimentacao-fora-do-lar", "alimentação", {
    dorPrincipal:
      "Em {cidade}, a operação vive de pico. No meio da semana a equipe fica ociosa.",
    perguntaConsideracao:
      "Como vocês estão preenchendo o meio da semana, além do pico de sexta e sábado?",
    sazonalidade: {
      months: [6, 12],
      gancho: "Dia dos Namorados e fim de ano enchem. Promoção em cima da hora corta margem.",
    },
    janelaHorario: "De manhã até as 14h — à noite é pico da cozinha",
  }),
  pack("hamburguerias", "hamburgueria", {
    dorPrincipal:
      "Em {cidade}, a semana morta deixa a equipe ociosa. O pico do fim de semana não cobre o vazio do meio.",
    perguntaConsideracao:
      "Como vocês estão lidando com as semanas mortas? A equipe fica ociosa no meio da semana?",
    sazonalidade: {
      months: [6, 12],
      gancho: "Dia dos Namorados e fim de ano enchem. Promoção em cima da hora corta margem.",
    },
    janelaHorario: "De manhã até as 14h — à noite é pico da cozinha",
    pontePorSinal: {
      "sem-mensuracao":
        "sem medir o que entra, a hamburgueria não vê se a semana morta está piorando — só sente no caixa",
      "sem-instagram":
        "sem Instagram, hamburgueria em {cidade} depende de quem já conhece e de delivery que come a margem",
    },
  }),
  pack("restaurantes", "restaurante", {
    dorPrincipal:
      "Em {cidade}, o restaurante enche no fim de semana. No meio da semana a mesa vazia come a margem.",
    perguntaConsideracao:
      "O meio da semana está sendo puxado, ou a equipe fica olhando mesa vazia até sexta?",
    sazonalidade: {
      months: [6, 12],
      gancho: "Dia dos Namorados e fim de ano enchem. No resto do ano a mesa ociosa fica parada.",
    },
    janelaHorario: "De manhã até as 14h, antes do serviço",
  }),
  pack("pizzarias", "pizzaria", {
    dorPrincipal:
      "Em {cidade}, a pizzaria vive de sexta e sábado. De segunda a quarta a equipe sobra.",
    perguntaConsideracao:
      "Como está o meio da semana? Só o fim de semana está pagando a operação?",
    sazonalidade: {
      months: [6, 12],
      gancho: "Datas comemorativas enchem o forno. Quem espera o telefone perde a janela.",
    },
    janelaHorario: "De manhã até as 14h",
  }),
  pack("educacao", "educação", {
    dorPrincipal:
      "Em {cidade}, escola e curso vivem de matrícula em janela curta. Fora disso a turma ociosa come custo.",
    perguntaConsideracao:
      "A matrícula está sendo puxada, ou depende de quem já indica e de quem aparece na porta?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "Volta às aulas é a janela. Quem espera indicação perde a turma.",
    },
    janelaHorario: "Fim da manhã, fora do horário de aula",
  }),
  pack("escolas-particulares", "escola particular", {
    dorPrincipal:
      "Em {cidade}, a escola vive da família que já indica. Vaga ociosa no meio do ano vira desconto.",
    perguntaConsideracao:
      "A matrícula nova está vindo, ou vocês dependem da família que já está dentro?",
    sazonalidade: {
      months: [1, 2, 7],
      gancho: "Volta às aulas e meio do ano são a janela. Depois vira desconto para preencher turma.",
    },
    janelaHorario: "Fim da manhã, fora do horário de aula",
  }),
  pack("turismo-e-hotelaria", "turismo", {
    dorPrincipal:
      "Em {cidade}, a ocupação depende de sazonalidade e de OTA. Na baixa, a comissão come a margem.",
    perguntaConsideracao:
      "A ocupação está vindo direto, ou a OTA está ditando o preço na baixa?",
    sazonalidade: {
      months: [12, 1, 7],
      gancho: "Alta temporada enche. Sem canal próprio na baixa, o hotel fica refém de comissão.",
    },
    janelaHorario: "De manhã, depois do check-out",
  }),
  pack("hoteis", "hotel", {
    dorPrincipal:
      "Em {cidade}, o hotel vive de OTA e de alta temporada. Na baixa a diária cai e a comissão come o que sobra.",
    perguntaConsideracao:
      "A ocupação está vindo direto, ou a OTA está ditando o preço na baixa?",
    sazonalidade: {
      months: [12, 1, 7],
      gancho: "Alta enche. Sem canal próprio na baixa, o hotel fica refém de comissão.",
    },
    janelaHorario: "De manhã, depois do check-out",
  }),
  pack("industria", "indústria", {
    dorPrincipal:
      "Em {cidade}, a carteira depende de poucos compradores. Pedido novo não entra no ritmo da fábrica.",
    perguntaConsideracao:
      "A carteira está pulverizada, ou um cliente parado ainda derruba o mês?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "No fim do ano o comprador trava o pedido. Sem fila de oportunidade, janeiro fica ocioso.",
    },
    janelaHorario: "Fim da manhã, depois da reunião de chão de fábrica",
  }),
  pack("construcao-civil", "construção", {
    dorPrincipal:
      "Em {cidade}, a obra entra por indicação de arquiteto. Cliente que chega sozinho costuma querer o mais barato.",
    perguntaConsideracao:
      "A fila de obra boa está sendo puxada, ou ainda depende de indicação e de quem só quer o menor preço?",
    sazonalidade: {
      months: [1, 2, 8],
      gancho: "Começo de ano trava obra. Sem fila de projeto, o trimestre fica ocioso.",
    },
    janelaHorario: "À tarde, quando saiu da obra e sentou no escritório",
  }),
  pack("insumos-para-construcao", "insumos de construção", {
    dorPrincipal:
      "O pedido some quando a obra para. Sem fila própria, o caixa sente.",
    perguntaConsideracao:
      "Os pedidos de vocês vêm de obra certa todo mês, ou dependem de um construtor ligar?",
    sazonalidade: {
      months: [1, 2, 12],
      gancho: "Em janeiro, fevereiro e dezembro a obra para.",
    },
    janelaHorario: "Fim da manhã, antes do pico da loja",
  }),
  pack("contabilidade-e-juridico", "serviço profissional", {
    dorPrincipal:
      "Em {cidade}, o escritório vive de indicação e de cliente que já está dentro. Carteira nova não entra no ritmo da entrega.",
    perguntaConsideracao:
      "A carteira nova está sendo puxada, ou o escritório vive de quem já indica?",
    sazonalidade: {
      months: [1, 3, 4],
      gancho: "Imposto de renda e começo de ano mexem com a demanda. Quem espera indicação perde a janela.",
    },
    janelaHorario: "Fim da manhã, fora do prazo do cliente",
  }),
  pack("escritorios-contabeis", "escritório contábil", {
    dorPrincipal:
      "Em {cidade}, o escritório vive de indicação e de cliente na carteira. O novo não entra no ritmo da obrigação.",
    perguntaConsideracao:
      "A carteira nova está vindo, ou o escritório vive de quem já indica e de quem já está dentro?",
    sazonalidade: {
      months: [3, 4],
      gancho: "Imposto de renda é a janela. Quem espera indicação perde o empresário que está escolhendo agora.",
    },
    janelaHorario: "Fim da manhã, fora do prazo",
  }),
  pack("tech-e-software", "tecnologia", {
    dorPrincipal:
      "Em {cidade}, o pipeline depende de indicação. O ciclo trava em “manda proposta”.",
    perguntaConsideracao:
      "O pipeline está sendo puxado, ou cada contrato novo ainda depende de quem já indica?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "Fim de ano trava orçamento. Sem fila de conversa, janeiro fica ocioso.",
    },
    janelaHorario: "Fim da manhã, antes das dailies da tarde",
  }),
  pack("logistica-e-transporte", "logística", {
    dorPrincipal:
      "Em {cidade}, o transporte vive de poucos embarcadores e de cotação que vira leilão. Caminhão ocioso come o mês.",
    perguntaConsideracao:
      "A carga está pulverizada, ou um embarcador parado ainda derruba a semana?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "Fim de ano dispara volume e janeiro some. Sem fila de cliente, os dois lados doem.",
    },
    janelaHorario: "De manhã, antes da janela de coleta",
  }),
  pack("transportadoras-carga", "transportadora", {
    dorPrincipal:
      "Em {cidade}, a cotação vira leilão. Um embarcador concentra a malha.",
    perguntaConsideracao:
      "A malha está pulverizada, ou um embarcador parado ainda derruba a semana?",
    sazonalidade: {
      months: [11, 12, 1],
      gancho: "Fim de ano dispara volume e janeiro some. Sem fila, os dois lados doem.",
    },
    janelaHorario: "De manhã, antes da coleta",
  }),
  pack("financeiro-e-seguros", "seguros e crédito", {
    dorPrincipal:
      "Em {cidade}, a corretora vive de renovação e de indicação. Apólice nova não entra no ritmo da carteira que vence.",
    perguntaConsideracao:
      "A carteira nova está sendo puxada, ou o mês ainda depende de quem já renova e de quem indica?",
    sazonalidade: {
      months: [1, 2, 12],
      gancho: "Na virada de ano a pessoa revisa seguro e crédito. Quem espera indicação perde a janela.",
    },
    janelaHorario: "Fim da manhã, fora da visita ao cliente",
  }),
];

export const MARKET_PACKS: Record<string, MarketPack> = Object.fromEntries(
  PACK_LIST.map((p) => [p.slug, p]),
);

export function getMarketPack(slug: string | null | undefined): MarketPack | null {
  if (!slug) return null;
  return MARKET_PACKS[slug] ?? null;
}
