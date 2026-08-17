import * as cheerio from "cheerio";
import { normalizePhoneBR, type NormalizedPhone } from "@/lib/phone";

const AGENCY_RE =
  /desenvolvido por|criado por|feito por|by\s|ag[eê]ncia|web\s?design|cria[cç][aã]o de sites/i;

export type ExtractedContact = {
  phones: Array<{ raw: string; source: "site_tel" | "site_schema" | "site_texto" | "site_whatsapp"; isWhatsApp: boolean }>;
  emails: string[];
  socials: {
    instagram?: string;
    facebook?: string;
    linkedin?: string;
    youtube?: string;
  };
};

export function collectAgencyBlocks($: cheerio.CheerioAPI): Set<string> {
  const blocked = new Set<string>();
  $("*").each((_, el) => {
    const $el = $(el);
    if (!AGENCY_RE.test($el.text())) return;
    const hasMatchingChild = $el
      .children()
      .toArray()
      .some((child) => AGENCY_RE.test($(child).text()));
    if (hasMatchingChild) return;
    let node = el;
    for (let i = 0; i < 2 && node.parent; i++) {
      const parent = node.parent as typeof node;
      const name = "name" in parent ? String(parent.name) : "";
      if (name === "body" || name === "html" || name === "document") break;
      node = parent;
    }
    blocked.add($.html(node));
  });
  return blocked;
}

export function inBlockedHtml(rawParent: string, blocked: Set<string>): boolean {
  for (const html of blocked) {
    if (html.includes(rawParent) || rawParent.includes(html.slice(0, 80))) return true;
  }
  return false;
}

export function extractContacts(
  html: string,
  _fallbackDdd?: string | null,
): ExtractedContact {
  const $ = cheerio.load(html);
  const blocked = collectAgencyBlocks($);
  const phones: ExtractedContact["phones"] = [];
  const emails: string[] = [];
  const socials: ExtractedContact["socials"] = {};

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as { telephone?: string; "@type"?: string | string[] };
      const types = Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]];
      if (
        data.telephone &&
        types.some((t) => t === "LocalBusiness" || t === "Organization")
      ) {
        phones.push({ raw: data.telephone, source: "site_schema", isWhatsApp: false });
      }
    } catch {
      /* ignore invalid json-ld */
    }
  });

  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const parentHtml = $.html($(el).parent());
    if (inBlockedHtml(parentHtml, blocked)) return;
    phones.push({ raw: href.replace(/^tel:/i, ""), source: "site_tel", isWhatsApp: false });
  });

  $('a[href]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const parentHtml = $.html($(el).parent());
    if (inBlockedHtml(parentHtml, blocked)) return;
    const wa = href.match(/(?:wa\.me|api\.whatsapp\.com\/send\?phone=)\/?(\+?\d+)/i);
    if (wa?.[1]) {
      phones.push({ raw: wa[1], source: "site_whatsapp", isWhatsApp: true });
    }
    if (href.startsWith("mailto:")) {
      emails.push(href.replace(/^mailto:/i, "").split("?")[0] ?? "");
    }
    const lower = href.toLowerCase();
    if (lower.includes("instagram.com/") && !socials.instagram) {
      socials.instagram = href;
    }
    if (lower.includes("facebook.com/") && !socials.facebook) {
      socials.facebook = href;
    }
    if (lower.includes("linkedin.com/") && !socials.linkedin) {
      socials.linkedin = href;
    }
    if (lower.includes("youtube.com/") && !socials.youtube) {
      socials.youtube = href;
    }
  });

  const visible = $("footer, .footer, [class*='contato'], [id*='contato'], body")
    .text()
    .slice(0, 20000);
  const footerParent = $.html($("footer").first());
  if (!inBlockedHtml(footerParent, blocked)) {
    const matches = visible.match(
      /(?:\+55\s*)?(?:\(?\d{2}\)?\s*)?(?:9?\d{4}[-\s]?\d{4})/g,
    );
    for (const m of matches ?? []) {
      phones.push({ raw: m, source: "site_texto", isWhatsApp: false });
    }
  }

  return { phones, emails: emails.filter(Boolean), socials };
}

export function extractNormalizedPhones(
  html: string,
  fallbackDdd?: string | null,
): Array<NormalizedPhone & { source: ExtractedContact["phones"][number]["source"]; isWhatsApp: boolean }> {
  const extracted = extractContacts(html, fallbackDdd);
  const out: Array<NormalizedPhone & { source: ExtractedContact["phones"][number]["source"]; isWhatsApp: boolean }> = [];
  for (const p of extracted.phones) {
    const n = normalizePhoneBR(p.raw, fallbackDdd);
    if (!n) continue;
    out.push({ ...n, source: p.source, isWhatsApp: p.isWhatsApp });
  }
  return out;
}

export function phoneInAgencyFooter(html: string, e164: string): boolean {
  const $ = cheerio.load(html);
  const blocked = collectAgencyBlocks($);
  if (!blocked.size) return false;
  const digits = e164.replace(/\D/g, "");
  for (const block of blocked) {
    if (block.replace(/\D/g, "").includes(digits.slice(-8))) return true;
  }
  return false;
}
