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
  highlights: string[];
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
      "CRM e export a partir do Piloto",
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
      "Importar planilha para o quadro",
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
      "Prioridade na fila de qualificação",
      "Automações: formulário, anúncio, Make",
      "Tudo do Piloto",
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
      "Um usuário nesta versão",
      "Seats extras entram na próxima etapa",
    ],
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
    highlights: ["100 créditos", "Não substitui o plano", "Não reabre o CRM"],
  },
  {
    sku: "pack_500",
    kind: "pack",
    nome: "Recarga 500",
    tagline: "Créditos extras no meio do mês.",
    priceCents: 16_700,
    credits: 500,
    highlights: ["500 créditos", "Não reabre o CRM", "Usa depois do saldo do plano"],
  },
  {
    sku: "pack_2000",
    kind: "pack",
    nome: "Recarga 2.000",
    tagline: "Campanha pesada, sem upgrade.",
    priceCents: 49_700,
    credits: 2_000,
    highlights: ["2.000 créditos", "Não reabre o CRM", "Custo por crédito maior que o da assinatura"],
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
