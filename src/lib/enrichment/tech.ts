import type { TechSignals } from "@/lib/types";

export function detectTech(html: string, finalUrl: string): TechSignals {
  const lower = html.toLowerCase();
  const chat =
    lower.includes("tawk")
      ? "Tawk"
      : lower.includes("jivochat") || lower.includes("jivosite")
        ? "JivoChat"
        : lower.includes("blip.ai")
          ? "Blip"
          : lower.includes("zendesk")
            ? "Zendesk"
            : lower.includes("movidesk")
              ? "Movidesk"
              : null;
  const plataforma = lower.includes("wp-content")
    ? "WordPress"
    : lower.includes("wix.com")
      ? "Wix"
      : lower.includes("cdn.shopify")
        ? "Shopify"
        : lower.includes("vtex")
          ? "VTEX"
          : lower.includes("nuvemshop")
            ? "Nuvemshop"
            : lower.includes("tray")
              ? "Tray"
              : null;

  const copyright = html.match(/©\s*(20\d{2})/);
  void copyright;

  return {
    metaPixel:
      /fbq\(/.test(html) || /connect\.facebook\.net\/.*fbevents\.js/.test(html),
    gtm: /googletagmanager\.com\/gtm\.js/.test(html) || /GTM-[A-Z0-9]+/.test(html),
    ga4: /gtag\(/.test(html) || /G-[A-Z0-9]+/.test(html),
    googleAds: /AW-\d+/.test(html),
    tiktokPixel: /analytics\.tiktok\.com/.test(html),
    rdStation: /d335luupugsy2\.cloudfront\.net/.test(html) || /rdstation/.test(lower),
    hotjar: /static\.hotjar\.com/.test(html),
    clarity: /clarity\.ms/.test(html),
    chat,
    plataforma,
    https: finalUrl.startsWith("https://"),
    viewport: /name=["']viewport["']/i.test(html),
  };
}

export function detectCopyrightYear(html: string): number | undefined {
  const m = html.match(/©\s*(20\d{2})/);
  if (!m?.[1]) return undefined;
  return Number(m[1]);
}

export function midiaPagaLabel(tech: TechSignals, domainConfirmed: boolean): {
  label: string;
  verificado_automaticamente: boolean;
} {
  if (!domainConfirmed) {
    return { label: "NÃO VERIFICADO", verificado_automaticamente: false };
  }
  const hasPaidSignal =
    tech.metaPixel || tech.googleAds || tech.tiktokPixel;
  if (hasPaidSignal) {
    return {
      label: "tag de anúncio no HTML (não prova verba)",
      verificado_automaticamente: true,
    };
  }
  return { label: "nenhuma tag de anúncio no HTML", verificado_automaticamente: true };
}
