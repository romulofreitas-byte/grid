import { buildAuditSignals } from "@/lib/audit/signals";
import type {
  GridPresenceAsset,
  GridPresenceId,
  LeadEnrichment,
} from "@/lib/types";

export const GRID_PRESENCE_IDS = [
  "site",
  "instagram",
  "facebook",
  "linkedin",
  "youtube",
  "maps",
  "gmb",
  "whatsapp",
] as const satisfies readonly GridPresenceId[];

export const GRID_PRESENCE_MARK: Record<
  GridPresenceId,
  { name: string; logo: string; initials: string; accent: string }
> = {
  site: {
    name: "Site",
    logo: "/audit/site.svg",
    initials: "ST",
    accent: "#F5B301",
  },
  instagram: {
    name: "Instagram",
    logo: "/audit/instagram.svg",
    initials: "IG",
    accent: "#E4405F",
  },
  facebook: {
    name: "Facebook",
    logo: "/audit/facebook.svg",
    initials: "FB",
    accent: "#1877F2",
  },
  linkedin: {
    name: "LinkedIn",
    logo: "/audit/linkedin.svg",
    initials: "in",
    accent: "#0A66C2",
  },
  youtube: {
    name: "YouTube",
    logo: "/audit/youtube.svg",
    initials: "YT",
    accent: "#FF0000",
  },
  maps: {
    name: "Maps",
    logo: "/audit/maps.svg",
    initials: "MP",
    accent: "#34A853",
  },
  gmb: {
    name: "Google Meu Negócio",
    logo: "/audit/gmb.svg",
    initials: "GM",
    accent: "#EA4335",
  },
  whatsapp: {
    name: "WhatsApp",
    logo: "/audit/whatsapp.svg",
    initials: "WA",
    accent: "#25D366",
  },
};

const PRESENCE_ID_SET = new Set<string>(GRID_PRESENCE_IDS);

function isGridPresenceId(id: string): id is GridPresenceId {
  return PRESENCE_ID_SET.has(id);
}

/** Found presence assets with a URL — same verdicts as the ficha Presença tiles. */
export function gridPresenceFromEnrichment(
  enrichment: LeadEnrichment | null | undefined,
): GridPresenceAsset[] {
  if (!enrichment) return [];
  const byId = new Map<GridPresenceId, GridPresenceAsset>();
  for (const signal of buildAuditSignals(enrichment)) {
    if (!isGridPresenceId(signal.id)) continue;
    if (!signal.found || !signal.href) continue;
    byId.set(signal.id, {
      id: signal.id,
      href: signal.href,
      unverified: signal.unverified,
    });
  }
  return GRID_PRESENCE_IDS.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
}
