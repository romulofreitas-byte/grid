import { INTEGRACOES_TELEFONIA } from "@/lib/back";
import {
  catalogAvailability,
  INTEGRATION_CATALOG,
  type CatalogAvailability,
  type IntegrationCatalogItem,
} from "./catalog";

export type HubSectionId = "captacao" | "automacoes" | "telefonia";

export type HubItem = {
  id: string;
  name: string;
  section: HubSectionId;
  accent: string;
  logo: string;
  initials: string;
  href: string | null;
  availability: CatalogAvailability;
};

export const HUB_SECTIONS: Array<{ id: HubSectionId; label: string }> = [
  { id: "captacao", label: "Captação" },
  { id: "automacoes", label: "Automações" },
  { id: "telefonia", label: "Telefonia" },
];

const CAPTURE_ITEMS: HubItem[] = [
  {
    id: "meta",
    name: "Meta Lead Ads",
    section: "captacao",
    accent: "#0081FB",
    logo: "/integrations/meta.svg",
    initials: "Me",
    href: "/integracoes/meta",
    availability: "live",
  },
  {
    id: "site",
    name: "Formulário no site",
    section: "captacao",
    accent: "#F5B301",
    logo: "/integrations/site.svg",
    initials: "Fs",
    href: "/automacoes",
    availability: "live",
  },
  {
    id: "planilha",
    name: "Planilha",
    section: "captacao",
    accent: "#0F9D58",
    logo: "/integrations/sheets.svg",
    initials: "Pl",
    href: "/importacoes",
    availability: "live",
  },
];

const WEBHOOK_HREF = "/automacoes/avancado";

function fromCatalog(
  item: IntegrationCatalogItem,
  section: HubSectionId,
  href: string | null,
  availability: CatalogAvailability,
): HubItem {
  return {
    id: item.id,
    name: item.name,
    section,
    accent: item.accent,
    logo: item.logo,
    initials: item.initials,
    href,
    availability,
  };
}

function telefoniaHref(item: IntegrationCatalogItem): string {
  const tab = item.kind === "dialer" ? "discador" : "voip";
  return `${INTEGRACOES_TELEFONIA}?tab=${tab}&provider=${encodeURIComponent(item.id)}`;
}

function buildHubItems(): HubItem[] {
  const automacoes = INTEGRATION_CATALOG.filter((item) => item.kind === "webhook").map(
    (item) => fromCatalog(item, "automacoes", WEBHOOK_HREF, "live"),
  );
  const telefonia = INTEGRATION_CATALOG.filter(
    (item) => item.kind === "voip" || item.kind === "dialer",
  ).map((item) => {
    const availability = catalogAvailability(item);
    return fromCatalog(
      item,
      "telefonia",
      availability === "live" ? telefoniaHref(item) : null,
      availability,
    );
  });
  return [...CAPTURE_ITEMS, ...automacoes, ...telefonia];
}

export const HUB_ITEMS: HubItem[] = buildHubItems();

const byId = new Map(HUB_ITEMS.map((item) => [item.id, item]));

export function getHubItem(id: string | null | undefined): HubItem | undefined {
  if (!id) return undefined;
  return byId.get(id);
}

export function hubItemsBySection(section: HubSectionId): HubItem[] {
  return HUB_ITEMS.filter((item) => item.section === section);
}

export function filterHubItems(query: string): HubItem[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return HUB_ITEMS;
  return HUB_ITEMS.filter((item) => item.name.toLowerCase().includes(needle));
}
