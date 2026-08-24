import * as cheerio from "cheerio";
import { normalizePhoneBR, type NormalizedPhone } from "@/lib/phone";

const AGENCY_RE =
  /desenvolvido por|criado por|feito por|by\s|ag[eê]ncia|web\s?design|cria[cç][aã]o de sites/i;

/** wa.me / api.whatsapp / web.whatsapp / whatsapp:// — phone capture group 1. */
export const WHATSAPP_HREF_RE =
  /(?:https?:\/\/)?(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=|web\.whatsapp\.com\/send\/?\?(?:[^#]*&)?phone=|whatsapp:\/\/send\/?\?(?:[^#]*&)?phone=)(\+?\d{10,15})/gi;

const SPA_SHELL_VISIBLE_MAX = 500;
const MAX_SPA_SCRIPTS = 6;
const MAX_SPA_SCRIPT_BYTES = 2 * 1024 * 1024;

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

type SocialKey = keyof ExtractedContact["socials"];

const SOCIAL_HOST: Record<SocialKey, RegExp> = {
  instagram: /(?:^|\.)instagram\.com$/i,
  facebook: /(?:^|\.)(?:facebook|fb)\.com$/i,
  linkedin: /(?:^|\.)linkedin\.com$/i,
  youtube: /(?:^|\.)(?:youtube\.com|youtu\.be)$/i,
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

/** Strip tracking params and normalize social profile URLs. */
export function normalizeSocialUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const withProto = /^https?:\/\//i.test(trimmed)
      ? trimmed
      : `https://${trimmed.replace(/^\/\//, "")}`;
    const u = new URL(withProto);
    u.hash = "";
    u.search = "";
    u.hostname = u.hostname.replace(/^www\./i, "").toLowerCase();
    let path = u.pathname.replace(/\/+$/, "") || "";
    if (!path || path === "/") return null;
    return `https://${u.hostname}${path}`;
  } catch {
    return null;
  }
}

function socialKeyFromUrl(url: string): SocialKey | null {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
    for (const [key, re] of Object.entries(SOCIAL_HOST) as Array<[SocialKey, RegExp]>) {
      if (re.test(host)) return key;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function assignSocial(
  socials: ExtractedContact["socials"],
  raw: string | null | undefined,
): void {
  if (!raw) return;
  const lower = raw.toLowerCase();
  if (
    !lower.includes("instagram.com") &&
    !lower.includes("facebook.com") &&
    !lower.includes("fb.com") &&
    !lower.includes("linkedin.com") &&
    !lower.includes("youtube.com") &&
    !lower.includes("youtu.be")
  ) {
    return;
  }
  const normalized = normalizeSocialUrl(raw);
  if (!normalized) return;
  const key = socialKeyFromUrl(normalized);
  if (!key || socials[key]) return;
  socials[key] = normalized;
}

function walkJsonLd(node: unknown, socials: ExtractedContact["socials"]): void {
  if (node == null) return;
  if (typeof node === "string") {
    assignSocial(socials, node);
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, socials);
    return;
  }
  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (obj.sameAs) walkJsonLd(obj.sameAs, socials);
  if (typeof obj.url === "string") assignSocial(socials, obj.url);
  for (const value of Object.values(obj)) {
    if (value && typeof value === "object") walkJsonLd(value, socials);
  }
}

/** Brand label from og:site_name or <title> for presence queries. */
export function extractSiteBrand(html: string): string | null {
  const $ = cheerio.load(html);
  const og =
    $('meta[property="og:site_name"]').attr("content")?.trim() ||
    $('meta[name="og:site_name"]').attr("content")?.trim();
  if (og) return og;
  const title = $("title").first().text().trim();
  if (!title) return null;
  const cleaned = title.split(/[|\-–—]/)[0]?.trim() ?? title;
  return cleaned || null;
}

/** Unique WhatsApp phone strings found in arbitrary text (HTML, JS, attrs). */
export function extractWhatsAppPhonesFromText(text: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  // Fresh regex each call — module-level /g would leak lastIndex across invocations.
  const re = new RegExp(WHATSAPP_HREF_RE.source, "gi");
  for (const m of text.matchAll(re)) {
    const raw = m[1];
    if (!raw) continue;
    const key = raw.replace(/\D/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    found.push(raw);
  }
  return found;
}

/** True when the document is mostly an empty SPA shell (contacts live in JS). */
export function isSpaShell(html: string): boolean {
  const $ = cheerio.load(html);
  const visible = $("body").text().replace(/\s+/g, " ").trim();
  if (visible.length <= SPA_SHELL_VISIBLE_MAX) return true;
  const root = $("#root, #app, #__next").first();
  if (root.length && root.children().length === 0 && root.text().trim().length === 0) {
    return true;
  }
  return false;
}

/**
 * Same-origin script URLs likely to hold contact/social deep links.
 * Prefers app bundles and WhatsApp helpers; skips common analytics hosts.
 */
export function listSpaScriptUrls(html: string, origin: string): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  const seen = new Set<string>();
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  $("script[src]").each((_, el) => {
    const src = ($(el).attr("src") ?? "").trim();
    if (!src) return;
    let abs: string;
    try {
      abs = new URL(src, base).href;
    } catch {
      return;
    }
    let host: string;
    try {
      host = new URL(abs).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return;
    }
    let originHost: string;
    try {
      originHost = new URL(base).hostname.replace(/^www\./i, "").toLowerCase();
    } catch {
      return;
    }
    if (host !== originHost) return;
    if (/googletagmanager|google-analytics|gtag|facebook\.net|hotjar|clarity/i.test(abs)) {
      return;
    }
    if (seen.has(abs)) return;
    seen.add(abs);
    out.push(abs);
  });
  out.sort((a, b) => {
    const score = (u: string) => {
      let s = 0;
      if (/whatsapp/i.test(u)) s += 40;
      if (/\/assets\//i.test(u)) s += 20;
      if (/index[-.]/i.test(u)) s += 10;
      if (/main[-.]|app[-.]|bundle/i.test(u)) s += 8;
      return s;
    };
    return score(b) - score(a);
  });
  return out.slice(0, MAX_SPA_SCRIPTS);
}

export function maxSpaScriptBytes(): number {
  return MAX_SPA_SCRIPT_BYTES;
}

/**
 * Compact HTML fragment so Cheerio extractors can read contacts buried in JS.
 */
export function harvestMarkupFromAssetText(text: string): string {
  const phones = extractWhatsAppPhonesFromText(text);
  const socials: ExtractedContact["socials"] = {};
  const socialRe =
    /https?:\/\/(?:www\.)?(?:instagram\.com|facebook\.com|fb\.com|linkedin\.com|youtube\.com|youtu\.be)\/[^\s"'<>)\\]+/gi;
  for (const m of text.matchAll(socialRe)) {
    assignSocial(socials, m[0].replace(/[.,;]+$/, ""));
  }
  if (!phones.length && !Object.keys(socials).length) return "";
  const anchors: string[] = [];
  for (const phone of phones) {
    anchors.push(`<a href="https://wa.me/${phone.replace(/\D/g, "")}">wa</a>`);
  }
  for (const url of Object.values(socials)) {
    if (url) anchors.push(`<a href="${url}">social</a>`);
  }
  return `<div data-grid-spa-harvest>${anchors.join("")}</div>`;
}

function pushWhatsAppPhones(
  phones: ExtractedContact["phones"],
  rawList: string[],
): void {
  const seen = new Set(
    phones.filter((p) => p.isWhatsApp).map((p) => p.raw.replace(/\D/g, "")),
  );
  for (const raw of rawList) {
    const key = raw.replace(/\D/g, "");
    if (!key || seen.has(key)) continue;
    seen.add(key);
    phones.push({ raw, source: "site_whatsapp", isWhatsApp: true });
  }
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
      const data = JSON.parse(raw) as {
        telephone?: string;
        "@type"?: string | string[];
        sameAs?: unknown;
        url?: string;
      };
      const types = Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]];
      if (
        data.telephone &&
        types.some((t) => t === "LocalBusiness" || t === "Organization")
      ) {
        phones.push({ raw: data.telephone, source: "site_schema", isWhatsApp: false });
      }
      walkJsonLd(data, socials);
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
    pushWhatsAppPhones(phones, extractWhatsAppPhonesFromText(href));
    if (href.startsWith("mailto:")) {
      emails.push(href.replace(/^mailto:/i, "").split("?")[0] ?? "");
    }
    assignSocial(socials, href);
  });

  // onclick / data-* often hold wa.me when the visible control is a <button> or FAB.
  $("[onclick], [data-href], [data-url], [data-whatsapp], [data-phone]").each((_, el) => {
    const $el = $(el);
    const parentHtml = $.html($el.parent());
    if (inBlockedHtml(parentHtml, blocked)) return;
    for (const attr of ["onclick", "data-href", "data-url", "data-whatsapp", "data-phone"]) {
      const val = $el.attr(attr);
      if (!val) continue;
      pushWhatsAppPhones(phones, extractWhatsAppPhonesFromText(val));
      if (attr !== "onclick" && attr !== "data-phone" && attr !== "data-whatsapp") {
        assignSocial(socials, val);
      }
    }
  });

  $('link[href]').each((_, el) => {
    assignSocial(socials, $(el).attr("href"));
  });

  $('meta[content]').each((_, el) => {
    const prop = (
      $(el).attr("property") ??
      $(el).attr("name") ??
      ""
    ).toLowerCase();
    if (
      prop.includes("og:") ||
      prop.includes("twitter:") ||
      prop === "sameas" ||
      prop.includes("social")
    ) {
      assignSocial(socials, $(el).attr("content"));
    }
  });

  $("[data-href], [data-url], [data-social], [data-instagram], [data-facebook]").each(
    (_, el) => {
      const $el = $(el);
      for (const attr of [
        "data-href",
        "data-url",
        "data-social",
        "data-instagram",
        "data-facebook",
      ]) {
        assignSocial(socials, $el.attr(attr));
      }
    },
  );

  // Inline scripts / escaped strings in the raw HTML (and SPA harvest markup).
  pushWhatsAppPhones(phones, extractWhatsAppPhonesFromText(html));

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
