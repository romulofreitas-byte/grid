export type PlanSku =
  | "free"
  | "piloto"
  | "piloto_pro"
  | "escuderia"
  | "membro_plataforma";

export type PackSku = "pack_100" | "pack_500" | "pack_2000";
export type BillingSku = PlanSku | PackSku;

export type PaymentMethod = "pix" | "card_br" | "boleto" | "card_intl";
export type BillingProvider = "asaas" | "stripe" | "mock" | "platform" | "circle";
export type OrderKind = "subscription_cycle" | "credit_pack" | "platform";

export type PlanDefinition = {
  sku: PlanSku;
  kind: "plan";
  nome: string;
  /** One-line “para quem”, above the plan name on the card. */
  audience: string;
  tagline: string;
  priceCents: number;
  credits: number;
  enrichAllowed: boolean;
  billed: boolean;
  /** Face of the pricing card — keep exactly four on plans shown in the grid. */
  highlights: string[];
  /** Extra lines revealed by “Ver tudo”. */
  details: string[];
  /** Caveats without a check, e.g. seats still in development. */
  notes?: string[];
};

export type PackDefinition = {
  sku: PackSku;
  kind: "pack";
  nome: string;
  tagline: string;
  priceCents: number;
  credits: number;
  highlights: string[];
};

export type CatalogItem = PlanDefinition | PackDefinition;

export type PlanFeature = "crm" | "import" | "automations" | "market_munition";

const PLAN_FEATURES: Record<PlanSku, readonly PlanFeature[]> = {
  free: [],
  piloto: ["crm", "import"],
  piloto_pro: ["crm", "import", "automations", "market_munition"],
  escuderia: ["crm", "import", "automations", "market_munition"],
  membro_plataforma: ["crm", "import"],
};

export function planHasFeature(
  sku: string | null | undefined,
  feature: PlanFeature,
): boolean {
  if (!sku || !isPlanSku(sku)) return false;
  return PLAN_FEATURES[sku].includes(feature);
}

export const PLANS: PlanDefinition[] = [
  {
    sku: "free",
    kind: "plan",
    nome: "Treino livre",
    audience: "Para quem vai testar hoje",
    tagline: "Sente a lista. Liga. Decide se vale pagar.",
    priceCents: 0,
    credits: 25,
    enrichAllowed: false,
    billed: false,
    highlights: [
      "Lista na ordem de quem ligar",
      "Telefone da empresa e nome do sócio",
      "Briefing da ligação na ficha",
      "25 qualificações no mês, sem cartão",
    ],
    details: [
      "Buscar e ver a lista grátis",
      "Qualificar: site, redes e Google",
      "Salvar listas para o dia",
      "25 créditos de plano no mês",
    ],
  },
  {
    sku: "piloto",
    kind: "plan",
    nome: "Piloto",
    audience: "Para quem liga toda semana",
    tagline: "A lista vira o dia — não uma planilha.",
    priceCents: 9_700,
    credits: 900,
    enrichAllowed: true,
    billed: true,
    highlights: [
      "Qualificou: o lote cai no CRM",
      "Meta do dia no Box",
      "Importa a planilha e liga no mesmo quadro",
      "Follow-up e reunião sem planilha paralela",
    ],
    details: [
      "900 créditos / mês",
      "Pipeline do nicho até reunião",
      "Ligar agora pelo Painel",
      "Qualificar: site, redes e Google",
    ],
  },
  {
    sku: "piloto_pro",
    kind: "plan",
    nome: "Piloto Pro",
    audience: "Para quem já capta e liga",
    tagline: "O lead de fora cai no quadro. Você liga.",
    priceCents: 19_700,
    credits: 4_000,
    enrichAllowed: true,
    billed: true,
    highlights: [
      "Tudo do Piloto",
      "Formulário no site vira negócio no CRM",
      "Anúncio Meta cai no quadro sozinho",
      "Munição completa na ficha — dor, urgência, língua do ramo",
    ],
    details: [
      "4.000 créditos / mês",
      "Origem avançada: Make, Zapier ou webhook",
    ],
  },
  {
    sku: "escuderia",
    kind: "plan",
    nome: "Escuderia",
    audience: "Para a equipe — em breve",
    tagline: "Quando a operação inteira entra no GRID.",
    priceCents: 39_700,
    credits: 6_000,
    enrichAllowed: true,
    billed: true,
    highlights: [
      "Tudo do Piloto Pro",
      "Mesmo quadro para a operação",
      "Captação e munição no mesmo lugar",
      "Um GRID para o time inteiro",
    ],
    details: [
      "6.000 créditos / mês",
      "Origem avançada: Make, Zapier ou webhook",
    ],
    notes: ["Seats extras em desenvolvimento"],
  },
  {
    sku: "membro_plataforma",
    kind: "plan",
    nome: "Membro da Plataforma",
    audience: "Quem já assina o Mundo Pódium",
    tagline: "Nível Piloto incluído por 30 dias na assinatura Mundo Pódium.",
    priceCents: 0,
    credits: 900,
    enrichAllowed: true,
    billed: false,
    highlights: [
      "Qualificou: o lote cai no CRM",
      "Meta do dia no Box",
      "Importa a planilha e liga no mesmo quadro",
    ],
    details: [
      "900 créditos nos 30 dias",
      "Depois: assine o Piloto",
    ],
  },
];

export const PACKS: PackDefinition[] = [
  {
    sku: "pack_100",
    kind: "pack",
    nome: "Recarga 100",
    tagline: "Créditos que não expiram.",
    priceCents: 4_700,
    credits: 100,
    highlights: ["100 créditos", "Não expiram", "Extra no meio do mês"],
  },
  {
    sku: "pack_500",
    kind: "pack",
    nome: "Recarga 500",
    tagline: "Créditos extras no meio do mês.",
    priceCents: 16_700,
    credits: 500,
    highlights: ["500 créditos", "Não expiram", "Somam no saldo da conta"],
  },
  {
    sku: "pack_2000",
    kind: "pack",
    nome: "Recarga 2.000",
    tagline: "Volume extra para campanha pesada.",
    priceCents: 49_700,
    credits: 2_000,
    highlights: ["2.000 créditos", "Não expiram", "Volume para campanha pesada"],
  },
];

const BY_SKU: Record<string, CatalogItem> = Object.fromEntries(
  [...PLANS, ...PACKS].map((item) => [item.sku, item]),
);

/** SKUs currently for sale. Treino livre is free and never goes through checkout. */
export const SKUS_ON_SALE: ReadonlySet<string> = new Set([
  "piloto",
  "piloto_pro",
  "membro_plataforma",
  "pack_100",
  "pack_500",
  "pack_2000",
]);

export const SKU_OFF_SALE_MESSAGE =
  "Este plano não está à venda neste momento";

export const ALREADY_ON_PLAN_MESSAGE = "Você já está neste plano";

export const PLAN_DOWNGRADE_MESSAGE =
  "Este plano é menor que o seu atual. Fale com a gente para mudar.";

/** Paid ladder. `membro_plataforma` sits with Piloto for upgrade checks. */
export function billedPlanRank(sku: string): number {
  if (sku === "escuderia") return 3;
  if (sku === "piloto_pro") return 2;
  if (sku === "piloto" || sku === "membro_plataforma") return 1;
  return 0;
}

export function isSkuOnSale(sku: string): boolean {
  return SKUS_ON_SALE.has(sku);
}

export function getCatalogItem(sku: string): CatalogItem | undefined {
  return BY_SKU[sku];
}

/** Full benefit list for checkout and expanded cards. Packs have no details. */
export function catalogBenefitLines(item: CatalogItem): string[] {
  if (item.kind === "pack") return item.highlights;
  return [...item.highlights, ...item.details];
}

export function isBilledPlanSku(sku: string | null | undefined): boolean {
  if (!sku) return false;
  const item = getCatalogItem(sku);
  return item?.kind === "plan" && item.billed;
}

export function isPlanSku(sku: string): sku is PlanSku {
  return PLANS.some((p) => p.sku === sku);
}

export function isPackSku(sku: string): sku is PackSku {
  return PACKS.some((p) => p.sku === sku);
}

export function orderKindFor(sku: BillingSku): OrderKind {
  if (sku === "membro_plataforma") return "platform";
  if (isPackSku(sku)) return "credit_pack";
  return "subscription_cycle";
}

export function formatBrl(cents: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export const EXPORT_CREDIT_COST = 50;
export const ENRICH_CREDIT_COST = 1;

export function creditsPhrase(n: number): string {
  return Math.abs(n) === 1 ? `${n} crédito` : `${n} créditos`;
}

export function creditsEach(n: number): string {
  return `${creditsPhrase(n)} cada`;
}
