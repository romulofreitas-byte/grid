import { largadaNovaHref } from "@/lib/back";

export const FAQ_CATEGORIES = [
  "Começar",
  "Lista e contato",
  "Créditos",
  "Export e conexões",
  "Privacidade",
] as const;

export type FaqCategory = (typeof FAQ_CATEGORIES)[number];

export type FaqLink = {
  href: string;
  label: string;
};

export type FaqItem = {
  id: string;
  category: FaqCategory;
  question: string;
  answer: string;
  links?: FaqLink[];
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "box-largada-grid",
    category: "Começar",
    question: "O que é Box, Nova lista e Grid?",
    answer:
      "Box é a home. A pista do dia só abre com uma lista salva. Nova lista é onde você escolhe nicho e região. Grid é o resultado na ordem de quem ligar primeiro. No grid, marque as empresas e clique em Qualificar.",
    links: [
      { href: "/box", label: "Abrir o Box" },
      { href: largadaNovaHref, label: "Nova lista" },
    ],
  },
  {
    id: "acesso",
    category: "Começar",
    question: "Como entro no GRID?",
    answer:
      "Crie a conta com e-mail e senha. Confirme o e-mail para acessar o GRID. Se já tem conta, entre. Se entrou pelo link antigo, use Esqueci a senha.",
    links: [{ href: "/entrar", label: "Entrar" }],
  },
  {
    id: "capacete",
    category: "Começar",
    question: "O que é o Capacete?",
    answer:
      "Nome, empresa e cidade. Entram na Anatomia como quem você é. O motivo da ligação vem do mercado do lead — não da sua especialidade.",
    links: [{ href: "/setup", label: "Completar o capacete" }],
  },
  {
    id: "minuto-de-ouro",
    category: "Começar",
    question: "O que é o Minuto de Ouro?",
    answer:
      "Na ficha, Clareza de mercado é um cockpit à parte: dor do ramo, calendário deste mês e a cidade. Qualificar é outro espaço — cruza site, redes e mapas e mostra os cards dos ativos digitais. Isso qualifica o lead; não abre a Anatomia.",
  },
  {
    id: "anatomia-da-ligacao",
    category: "Começar",
    question: "O que é a Anatomia da Ligação?",
    answer:
      "Três blocos na ordem: apresentação e motivo de mercado, espaço para ele verbalizar a dor, convite à reunião. Edite cada um antes de copiar. Ferramenta não abre a ligação.",
  },
  {
    id: "listas-salvas",
    category: "Lista e contato",
    question: "Qual a diferença entre Minhas listas e Não salvas?",
    answer:
      "Toda busca vira um grid. Minhas listas são as que você guardou para ligar de novo — e são elas que abrem a pista no Box. Não salvas são as recentes que ainda não foram. Salvar ou tirar só decide em qual seção a busca aparece — o grid, a ordem e os status continuam. Excluir apaga de vez.",
    links: [{ href: "/listas", label: "Abrir listas" }],
  },
  {
    id: "qualificar",
    category: "Lista e contato",
    question: "O que é qualificar?",
    answer:
      "Qualificar cruza o site, as redes e os mapas com o cadastro da Receita (2 créditos). Telefone e nome saem com mais veracidade, e os cards dos ativos digitais mostram o que o lead tem — ou falta — no digital. Isso é qualificação de lead, não o roteiro da Anatomia. No grid, marque as que quiser — não precisa ser a lista inteira nem só os 50 primeiros. Se pulou esse passo, o botão Qualificar também está na ficha da empresa.",
    links: [{ href: "/listas", label: "Abrir listas" }],
  },
  {
    id: "score",
    category: "Lista e contato",
    question: "O que é o score?",
    answer: "Ordem de quem ligar primeiro. Quanto maior, mais cedo na lista.",
  },
  {
    id: "selos",
    category: "Lista e contato",
    question: "O que significam os selos de telefone?",
    answer:
      "Confirmado confere com o site. Do site veio do site oficial e é mais novo que o da Receita. Contabilidade é número de escritório compartilhado. Grupo é o mesmo telefone em empresas do mesmo sócio — não em dezenas ou centenas de CNPJs. Não verificado ainda não foi checado no site.",
  },
  {
    id: "contador",
    category: "Lista e contato",
    question: "Por que o telefone de contador não serve?",
    answer:
      "É o escritório, não quem decide. O selo Contabilidade marca quando o mesmo número aparece em várias empresas sem serem do mesmo grupo.",
  },
  {
    id: "maps",
    category: "Lista e contato",
    question: "O GRID usa Google Maps?",
    answer:
      "Não. A fonte é a Receita Federal. Na ficha pode haver um link de busca no Maps — isso não extrai nem grava dado do Maps.",
  },
  {
    id: "quando-credito",
    category: "Créditos",
    question: "Quando gasta crédito?",
    answer:
      "Buscar e ver a lista é grátis. Crédito só na exportação (1) e na qualificação (2).",
    links: [{ href: "/planos", label: "Ver planos" }],
  },
  {
    id: "recarga",
    category: "Créditos",
    question: "Recarga substitui o plano?",
    answer:
      "Não. Pacotes não expiram e não substituem a assinatura. Servem para o meio do mês, com custo por crédito pior que o plano.",
    links: [{ href: "/planos", label: "Recarregar" }],
  },
  {
    id: "membro-plataforma",
    category: "Créditos",
    question: "Já assino o Mundo Pódium — preciso pagar o GRID?",
    answer:
      "Quem já assina a plataforma entra no Piloto sem pagar de novo. Use o mesmo e-mail do cadastro. No Box, ative com o cupom PILOTOPODIUM.",
    links: [{ href: "/pagar?sku=membro_plataforma", label: "Ativar com cupom" }],
  },
  {
    id: "exportar",
    category: "Export e conexões",
    question: "Como exporto a lista?",
    answer:
      "No Grid, baixe XLSX ou CSV para o CRM. Destina-se ao uso operacional do assinante — a revenda da base bruta é proibida.",
    links: [{ href: "/listas", label: "Abrir listas" }],
  },
  {
    id: "conexoes",
    category: "Export e conexões",
    question: "Onde ligo discador, VOIP e CRM?",
    answer:
      "Em Conexões. Com discador ou VoIP, o GRID disca no clique (Box, Grid e Ficha) e a tabulação volta para o lead. Sem conexão, o botão Ligar abre o telefone do aparelho.",
    links: [{ href: "/conexoes", label: "Abrir conexões" }],
  },
  {
    id: "cpf",
    category: "Export e conexões",
    question: "O GRID mostra CPF?",
    answer:
      "Nunca. CPF não entra no banco, na tela nem no export. Sócio aparece pelo nome no quadro da Receita.",
  },
  {
    id: "fonte-dados",
    category: "Privacidade",
    question: "De onde vêm os dados?",
    answer:
      "Dados Abertos do CNPJ da Receita Federal. Prospecção B2B. O crawl do site da empresa só confirma telefone, WhatsApp, redes e sinais públicos.",
    links: [{ href: "/privacidade", label: "Aviso de privacidade" }],
  },
  {
    id: "opt-out",
    category: "Privacidade",
    question: "Como pedir para uma empresa sair da base?",
    answer:
      "Pelo formulário de oposição. Processamos em até 15 dias, com blocklist permanente. Esse CNPJ não entra na fila de qualificação.",
    links: [{ href: "/opt-out", label: "Formulário de oposição" }],
  },
  {
    id: "gridbot",
    category: "Privacidade",
    question: "O que é o GridBot?",
    answer:
      "O crawler do GRID. Visita páginas públicas (home e contato), respeita robots.txt e se identifica como GridBot/1.0. Não entra em área logada.",
    links: [{ href: "/bot", label: "Política do GridBot" }],
  },
];

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function filterFaq(items: readonly FaqItem[], query: string): FaqItem[] {
  const needle = normalize(query.trim());
  if (!needle) return [...items];
  return items.filter((item) => {
    const hay = [item.question, item.answer, item.category]
      .map(normalize)
      .join(" ");
    return hay.includes(needle);
  });
}

export function faqGrouped(
  items: readonly FaqItem[],
): { category: FaqCategory; items: FaqItem[] }[] {
  return FAQ_CATEGORIES.flatMap((category) => {
    const grouped = items.filter((item) => item.category === category);
    return grouped.length ? [{ category, items: grouped }] : [];
  });
}
