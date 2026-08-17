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

export const PLANS: PlanDefinition[] = [
  {
    sku: "free",
    kind: "plan",
    nome: "Treino livre",
    tagline: "Buscar e ver a lista é grátis.",
    priceCents: 0,
    credits: 25,
    enrichAllowed: false,
    billed: false,
    highlights: [
      "25 créditos / mês",
      "Exportação de cadastro + decisor",
      "Sem qualificação",
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
      "500 exportações + 200 qualificações",
      "Pix, cartão ou boleto",
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
      "2.000 exportações + 1.000 qualificações",
      "Prioridade na fila de qualificação",
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
      "Um usuário nesta versão",
      "Seats extras entram na próxima etapa",
    ],
  },
  {
    sku: "membro_plataforma",
    kind: "plan",
    nome: "Membro da Plataforma",
    tagline: "Nível Piloto incluso na assinatura Mundo Pódium.",
    priceCents: 0,
    credits: 900,
    enrichAllowed: true,
    billed: false,
    highlights: [
      "Mesmo allotment do Piloto",
      "Sem cobrança no GRID",
      "Ative com o cupom da Plataforma",
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
    highlights: ["100 créditos", "Não substitui o plano", "Não expira"],
  },
  {
    sku: "pack_500",
    kind: "pack",
    nome: "Recarga 500",
    tagline: "Boost no meio do mês.",
    priceCents: 16_700,
    credits: 500,
    highlights: ["500 créditos", "Não expira", "Usa depois do saldo do plano"],
  },
  {
    sku: "pack_2000",
    kind: "pack",
    nome: "Recarga 2.000",
    tagline: "Campanha pesada, sem upgrade.",
    priceCents: 49_700,
    credits: 2_000,
    highlights: ["2.000 créditos", "Não expira", "Pior custo que a assinatura"],
  },
];

const BY_SKU: Record<string, CatalogItem> = Object.fromEntries(
  [...PLANS, ...PACKS].map((item) => [item.sku, item]),
);

export function getCatalogItem(sku: string): CatalogItem | undefined {
  return BY_SKU[sku];
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

export const EXPORT_CREDIT_COST = 1;
export const ENRICH_CREDIT_COST = 2;
