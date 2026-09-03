import type { IntegrationKind } from "./schema";

export type IntegrationCatalogItem = {
  id: string;
  name: string;
  kind: IntegrationKind;
  accent: string;
  /** Path under /public. */
  logo: string;
  /** 1–2 letters if the image fails to load. */
  initials: string;
};

export const CATALOG_SECTIONS: Array<{
  kind: IntegrationKind;
  label: string;
}> = [
  { kind: "crm", label: "CRM" },
  { kind: "dialer", label: "Discador" },
  { kind: "voip", label: "VoIP" },
  { kind: "webhook", label: "Webhook" },
];

export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    id: "agendor",
    name: "Agendor",
    kind: "crm",
    accent: "#332DE6",
    logo: "/integrations/agendor.png",
    initials: "AG",
  },
  {
    id: "pipedrive",
    name: "Pipedrive",
    kind: "crm",
    accent: "#017737",
    logo: "/integrations/pipedrive.png",
    initials: "Pd",
  },
  {
    id: "hubspot",
    name: "HubSpot",
    kind: "crm",
    accent: "#FF7A59",
    logo: "/integrations/hubspot.svg",
    initials: "HS",
  },
  {
    id: "rdstation",
    name: "RD Station",
    kind: "crm",
    accent: "#19C1CE",
    logo: "/integrations/rdstation.svg",
    initials: "RD",
  },
  {
    id: "kommo",
    name: "Kommo",
    kind: "crm",
    accent: "#7B61FF",
    logo: "/integrations/kommo.png",
    initials: "Ko",
  },
  {
    id: "ploomes",
    name: "Ploomes",
    kind: "crm",
    accent: "#843CFF",
    logo: "/integrations/ploomes.svg",
    initials: "Pl",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    kind: "crm",
    accent: "#00A1E0",
    logo: "/integrations/salesforce.svg",
    initials: "SF",
  },
  {
    id: "zoho",
    name: "Zoho",
    kind: "crm",
    accent: "#E42527",
    logo: "/integrations/zoho.svg",
    initials: "Zo",
  },
  {
    id: "nectarcrm",
    name: "NectarCRM",
    kind: "crm",
    accent: "#FF8A33",
    logo: "/integrations/nectarcrm.svg",
    initials: "N",
  },
  {
    id: "moskit",
    name: "Moskit",
    kind: "crm",
    accent: "#2577F1",
    logo: "/integrations/moskit.svg",
    initials: "Mo",
  },
  {
    id: "3cplus",
    name: "3C Plus",
    kind: "dialer",
    accent: "#00A3E0",
    logo: "/integrations/3cplus.svg",
    initials: "3C",
  },
  {
    id: "megadialer",
    name: "Mega Dialer",
    kind: "dialer",
    accent: "#E11D48",
    logo: "/integrations/megadialer.svg",
    initials: "MD",
  },
  {
    id: "olos",
    name: "Olos",
    kind: "dialer",
    accent: "#FF5722",
    logo: "/integrations/olos.png",
    initials: "Ol",
  },
  {
    id: "callflex",
    name: "CallFlex",
    kind: "dialer",
    accent: "#2563EB",
    logo: "/integrations/callflex.svg",
    initials: "CF",
  },
  {
    id: "cloudtalk",
    name: "CloudTalk",
    kind: "dialer",
    accent: "#2F6BFF",
    logo: "/integrations/cloudtalk.png",
    initials: "CT",
  },
  {
    id: "aircall",
    name: "Aircall",
    kind: "dialer",
    accent: "#00B388",
    logo: "/integrations/aircall.svg",
    initials: "AC",
  },
  {
    id: "api4com",
    name: "API4COM",
    kind: "voip",
    accent: "#00D4FF",
    logo: "/integrations/api4com.png",
    initials: "4",
  },
  {
    id: "twilio",
    name: "Twilio",
    kind: "voip",
    accent: "#F22F46",
    logo: "/integrations/twilio.svg",
    initials: "Tw",
  },
  {
    id: "zenvia",
    name: "Zenvia",
    kind: "voip",
    accent: "#FF5000",
    logo: "/integrations/zenvia.svg",
    initials: "Zv",
  },
  {
    id: "asterisk",
    name: "Asterisk",
    kind: "voip",
    accent: "#F68F1E",
    logo: "/integrations/asterisk.svg",
    initials: "As",
  },
  {
    id: "threecx",
    name: "3CX",
    kind: "voip",
    accent: "#1AA3E8",
    logo: "/integrations/3cx.png",
    initials: "CX",
  },
  {
    id: "telnyx",
    name: "Telnyx",
    kind: "voip",
    accent: "#00C08B",
    logo: "/integrations/telnyx.png",
    initials: "Tx",
  },
  {
    id: "issabel",
    name: "Issabel",
    kind: "voip",
    accent: "#54BDC8",
    logo: "/integrations/issabel.png",
    initials: "Is",
  },
  {
    id: "zapier",
    name: "Zapier",
    kind: "webhook",
    accent: "#FF4F00",
    logo: "/integrations/zapier.svg",
    initials: "Za",
  },
  {
    id: "make",
    name: "Make",
    kind: "webhook",
    accent: "#6D00CC",
    logo: "/integrations/make.svg",
    initials: "Mk",
  },
  {
    id: "n8n",
    name: "n8n",
    kind: "webhook",
    accent: "#EA4B71",
    logo: "/integrations/n8n.svg",
    initials: "n8",
  },
  {
    id: "webhook",
    name: "Outro webhook",
    kind: "webhook",
    accent: "#E8C547",
    logo: "/integrations/webhook.svg",
    initials: "WH",
  },
];

export const LIVE_VOIP_IDS = ["api4com", "zenvia", "twilio", "telnyx"] as const;

export type CatalogAvailability = "live" | "soon";

export function isLiveVoipId(
  id: string | null | undefined,
): id is (typeof LIVE_VOIP_IDS)[number] {
  return Boolean(id && (LIVE_VOIP_IDS as readonly string[]).includes(id));
}

export function catalogAvailability(
  item: Pick<IntegrationCatalogItem, "id" | "kind">,
): CatalogAvailability {
  return item.kind === "voip" && isLiveVoipId(item.id) ? "live" : "soon";
}

const byId = new Map(INTEGRATION_CATALOG.map((item) => [item.id, item]));

export const CATALOG_IDS = INTEGRATION_CATALOG.map((item) => item.id);

export function getCatalogItem(
  id: string | null | undefined,
): IntegrationCatalogItem | undefined {
  if (!id) return undefined;
  return byId.get(id);
}

export function catalogItemsByKind(
  kind: IntegrationKind,
): IntegrationCatalogItem[] {
  return INTEGRATION_CATALOG.filter((item) => item.kind === kind);
}

export function catalogKindLabel(kind: IntegrationKind): string {
  return (
    CATALOG_SECTIONS.find((section) => section.kind === kind)?.label ?? kind
  );
}

export function parseConexoesKind(
  value: string | null | undefined,
): IntegrationKind | null {
  if (
    value === "crm" ||
    value === "dialer" ||
    value === "voip" ||
    value === "webhook"
  ) {
    return value;
  }
  return null;
}

export function firstCatalogIdForKind(kind: IntegrationKind): string {
  return catalogItemsByKind(kind)[0]?.id ?? "webhook";
}

export function resolveCatalogItem(
  catalogId: string | null | undefined,
  displayName: string | null | undefined,
): IntegrationCatalogItem | undefined {
  const fromId = getCatalogItem(catalogId);
  if (fromId) return fromId;
  const needle = displayName?.trim().toLowerCase();
  if (!needle) return undefined;
  return INTEGRATION_CATALOG.find(
    (item) => item.id !== "webhook" && item.name.toLowerCase() === needle,
  );
}
