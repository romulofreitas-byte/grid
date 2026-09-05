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

export type PlanFeature = "crm" | "import" | "automations";

const PLAN_FEATURES: Record<PlanSku, readonly PlanFeature[]> = {
  free: [],
  piloto: ["crm", "import"],
  piloto_pro: ["crm", "import", "automations"],
  escuderia: ["crm", "import", "automations"],
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
    tagline: "Buscar, ver a lista e qualificar 25\u00a0empresas.",
    priceCents: 0,
    credits: 25,
    enrichAllowed: false,
    billed: false,
    highlights: [
      "25 qualificações / mês",
      "Buscar e ver a lista grátis",
      "Telefone da empresa e nome do sócio",
      "Briefing da ligação na ficha",
    ],
    details: [
      "Sem cartão",
      "Lista na ordem de quem ligar",
      "Qualificar: site, redes e Google",
      "Ficha da empresa para ligar",
      "Salvar listas para o dia",
    ],
  },
  {
    sku: "piloto",
    kind: "plan",
    nome: "Piloto",
    tagline: "O plano de quem liga toda segunda.",
    priceCents: 9_700,
    credits: 900,
    enrichAllowed: true,
    billed: true,
    highlights: [
      "900 créditos / mês",
      "~20 fichas por dia no mês",
      "CRM nativo",
      "Meta do dia no Box",
    ],
    details: [
      "Qualificados entram no quadro",
      "Importar planilha para o quadro",
      "Pipeline do nicho até reunião",
      "Ligar agora pelo Painel",
      "Follow-up no CRM",
    ],
  },
  {
    sku: "piloto_pro",
    kind: "plan",
    nome: "Piloto Pro",
    tagline: "Volume de quem vive de lista.",
    priceCents: 19_700,
    credits: 4_000,
    enrichAllowed: true,
    billed: true,
    highlights: [
      "4.000 créditos / mês",
      "Tudo do Piloto",
      "Automações: formulário, anúncio, Make",
      "~130 fichas por dia no mês",
    ],
    details: [
      "Formulário, anúncio e Make criam negócio no CRM",
    ],
  },
  {
    sku: "escuderia",
    kind: "plan",
    nome: "Escuderia",
    tagline: "Para a operação inteira.",
    priceCents: 39_700,
    credits: 6_000,
    enrichAllowed: true,
    billed: true,
    highlights: [
      "6.000 créditos / mês",
      "Tudo do Piloto Pro",
      "~200 fichas por dia no mês",
      "Volume para a operação inteira",
    ],
    details: ["Formulário, anúncio e Make criam negócio no CRM"],
    notes: ["Seats extras em desenvolvimento"],
  },
  {
    sku: "membro_plataforma",
    kind: "plan",
    nome: "Membro da Plataforma",
    tagline: "Nível Piloto incluído por 30 dias na assinatura Mundo Pódium.",
    priceCents: 0,
    credits: 900,
    enrichAllowed: true,
    billed: false,
    highlights: [
      "900 créditos nos 30 dias",
      "~20 fichas por dia",
      "Depois: assine o Piloto",
    ],
    details: [],
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
  "membro_plataforma",
  "pack_100",
  "pack_500",
  "pack_2000",
]);

export const SKU_OFF_SALE_MESSAGE =
  "Este plano não está à venda neste momento";

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
