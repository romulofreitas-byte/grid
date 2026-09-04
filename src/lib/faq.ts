import { largadaNovaHref } from "@/lib/back";
import { EXPORT_CREDIT_COST } from "@/lib/billing/catalog";

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
    question: "O que é o Painel, a Nova lista e os resultados?",
    answer:
      "O Painel é a home do dia: meta, pipeline e o que fazer agora. Ligar agora abre a próxima ficha. Nova lista é onde você escolhe nicho e região. Os resultados saem na ordem de quem ligar primeiro. Na lista, marque as empresas e clique em Qualificar.",
    links: [
      { href: "/painel", label: "Abrir o Painel" },
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
    question: "O que é o perfil da ligação?",
    answer:
      "No primeiro acesso você se apresenta e monta a primeira lista. Nome, empresa, cidade e a promessa entram na ligação. O nicho que você escolhe é o mercado da lista.",
    links: [{ href: "/setup", label: "Montar a primeira lista" }],
  },
  {
    id: "minuto-de-ouro",
    category: "Começar",
    question: "Qual a diferença entre o briefing e a qualificação?",
    answer:
      "O briefing da ligação, na ficha, traz a dor do ramo, os meses de pico e o melhor horário para ligar. Qualificar é outro espaço — mostra site, redes e Google, e o que falta. Isso muda a abordagem; não monta um roteiro.",
  },
  {
    id: "anatomia-da-ligacao",
    category: "Começar",
    question: "O que é o briefing da ligação?",
    answer:
      "Na ficha, um briefing do nicho: quem atender, a dor do ramo, o calendário e uma pergunta para ter na cabeça. Não é um texto para ler na ligação.",
  },
  {
    id: "listas-salvas",
    category: "Lista e contato",
    question: "Qual a diferença entre Minhas listas e Não salvas?",
    answer:
      "Minhas listas são as que você guardou para ligar de novo — e são elas que o dia usa, pelo Ligar agora. Não salvas são rascunhos: no máximo 3, você só abre de novo. Para guardar de verdade ou excluir, salve a lista. Fazer outra tira a mais antiga. Tirar da tela não exclui a lista salva.",
    links: [{ href: "/listas", label: "Abrir listas" }],
  },
  {
    id: "qualificar",
    category: "Lista e contato",
    question: "O que é qualificar?",
    answer:
      `Qualificar busca site, redes e Google e confere com o cadastro da Receita (1 crédito). No Treino livre você tem 25 por mês. Telefone e nome saem mais confiáveis, e os cards mostram o que a empresa tem — ou falta — online. Isso muda a abordagem; não é o briefing da ligação. O resultado é da sua conta: outra conta não herda. Em lista salva, a partir do Plano Piloto, cada CNPJ que você qualificar entra sozinho no CRM do nicho — a lista inteira, não só os 10 ou 20 primeiros, e sem abrir a ficha. Na busca de uma empresa, salvar no CRM cria essa lista de um lead. Se pulou esse passo, o botão Qualificar também está na ficha da empresa.`,
    links: [{ href: "/listas", label: "Abrir listas" }],
  },
  {
    id: "crm-nativo",
    category: "Lista e contato",
    question: "Como o CRM entra no GRID?",
    answer:
      "O CRM do GRID é o quadro do nicho. Ele entra a partir do Plano Piloto. Os leads qualificados entram no CRM só depois que você salva a lista. Na busca de uma empresa, salvar no CRM cria essa lista de um lead. Qualifique e os leads entram em Entrada de Lista, no lote inteiro, sem abrir cada ficha. Se o nicho ainda não tem quadro, o GRID cria. Quem você já tinha qualificado nesta conta entra ao abrir o app, sem gastar crédito de novo. Na ficha você move o card até Reunião Agendada; o restante — R1, proposta, fechamento — fica no quadro. Descartado também sai da ficha.",
    links: [
      { href: "/crm", label: "Abrir CRM" },
      { href: "/listas", label: "Abrir listas" },
    ],
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
      "A fonte cadastral é a Receita Federal. Na qualificação o GRID busca a ficha do Google Meu Negócio pelo nome e pela cidade — o endereço fiscal da Receita muitas vezes é o do escritório, não o da operação. Cruza telefone ou nome+cidade/endereço com o cadastro e lê se o card público está completo (telefone, site, horário, foto, nota). Não usa a API do Google Places e não grava telefone, texto de avaliação nem coordenadas.",
  },
  {
    id: "quando-credito",
    category: "Créditos",
    question: "Quando gasta crédito?",
    answer:
      `Buscar e ver a lista é grátis. Qualificar custa 1 crédito — o Treino livre inclui 25 por mês. Se a lista estiver salva e você tiver o Piloto, o lead entra sozinho no CRM. Exportar CSV/Excel ou enviar para CRM externo custa ${EXPORT_CREDIT_COST}, só de quem já foi qualificado. Atualizar a qualificação cobra de novo.`,
    links: [{ href: "/planos", label: "Ver planos" }],
  },
  {
    id: "recarga",
    category: "Créditos",
    question: "Recarga substitui o plano?",
    answer:
      "Não. Pacotes não expiram e não substituem a assinatura — nem reabrem o CRM, nem a qualificação depois dos 25 do Treino livre. Servem para o meio do mês ou para exportar, com custo por crédito pior que o plano.",
    links: [{ href: "/planos", label: "Recarregar" }],
  },
  {
    id: "plano-zera",
    category: "Créditos",
    question: "O crédito que eu não usei passa para o mês seguinte?",
    answer:
      "O crédito do plano zera na renovação. Recarga não expira e fica na conta. Sem mensalidade, o CRM fecha e a qualificação do Treino livre para nos 25 do mês — recarga só soma crédito, não reabre o acesso.",
    links: [{ href: "/planos", label: "Ver planos" }],
  },
  {
    id: "membro-plataforma",
    category: "Créditos",
    question: "Já assino o Mundo Pódium — preciso pagar o GRID?",
    answer:
      "Quem já assina a plataforma entra no Piloto por 30 dias, sem pagar de novo. Cupom PILOTO — vale só para assinantes ativos da Plataforma, com o mesmo e-mail do cadastro. Recarga só soma crédito.",
    links: [{ href: "/pagar?sku=membro_plataforma", label: "Ativar com cupom" }],
  },
  {
    id: "exportar",
    category: "Export e conexões",
    question: "Como exporto a lista?",
    answer:
      `Na lista, baixe XLSX ou CSV — só CNPJs já qualificados. Cada um custa ${EXPORT_CREDIT_COST} créditos na primeira exportação. Destina-se ao uso operacional do assinante — a revenda da base bruta é proibida. No CRM nativo isso já está incluído.`,
    links: [{ href: "/listas", label: "Abrir listas" }],
  },
  {
    id: "conexoes",
    category: "Export e conexões",
    question: "Onde ligo o VoIP?",
    answer:
      "A ligação pela internet ainda não está nesta versão. O botão Ligar abre o telefone do aparelho. Quando voltar, você cola o token em Conexões e o GRID disca ao clicar (Painel, lista e ficha).",
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
      "Dados Abertos do CNPJ da Receita Federal. Prospecção B2B. A busca no site da empresa só confirma telefone, WhatsApp, redes e o que está público.",
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
