import { cnpjValid } from "@/lib/billing/document";
import { normalizePhoneBR } from "@/lib/phone";

const FORMATTED_CNPJ = /\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/g;

const JUNK_EMAIL_HOST =
  /sentry(?:-next)?\.wixpress\.com$|\.(?:png|jpe?g|gif|webp|svg|js|css)(?:\s|$)/i;

const PLACEHOLDER_EMAIL = /^(exemplo|naoinformado|teste|foo|bar)@/i;

const LIVE_NOTE_HINT =
  /\b(atendeu|liguei|falei|falou|disse que|retornar|retorno|n[aã]o atendeu|n[aã]o tem interesse|gatekeeper|passei o|passou o|passar o e-?mail)\b/i;

const LEADING_DATE = /^\d{1,2}\/\d{2}\b/;

export function looksLikeLiveNote(value: string, isCompanyHint = false): boolean {
  const text = value.trim();
  if (!text || isCompanyHint) return false;
  if (LIVE_NOTE_HINT.test(text)) return true;
  if (LEADING_DATE.test(text) && text.length > 12) return true;
  return false;
}

export function findFormattedCnpj(cells: string[]): string | undefined {
  for (const cell of cells) {
    const matches = cell.match(FORMATTED_CNPJ) ?? [];
    for (const match of matches) {
      const digits = match.replace(/\D/g, "");
      if (cnpjValid(digits)) return digits;
    }
  }
  return undefined;
}

export function splitImportValues(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/\s*[·,;|]\s*|\n+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function cleanImportEmails(raw: string | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of splitImportValues(raw)) {
    const email = part.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const lower = email.toLowerCase();
    if (JUNK_EMAIL_HOST.test(lower)) continue;
    if (PLACEHOLDER_EMAIL.test(lower)) continue;
    if (lower.includes("@2x.")) continue;
    if (seen.has(lower)) continue;
    seen.add(lower);
    out.push(email.slice(0, 120));
  }
  return out;
}

export function cleanImportPhones(raw: string | undefined): string[] {
  const out: string[] = [];
  for (const part of splitImportValues(raw)) {
    const parsed = normalizePhoneBR(part);
    if (!parsed) continue;
    if (out.some((existing) => existing === parsed.e164)) continue;
    out.push(parsed.display.slice(0, 24));
  }
  return out;
}

function asHttpUrl(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^n[aã]o encontrado$/i.test(trimmed)) return undefined;
  if (/^none$/i.test(trimmed)) return undefined;
  let url = trimmed;
  if (!/^https?:\/\//i.test(url)) {
    if (!/^[a-z0-9][-a-z0-9.]*\.[a-z]{2,}/i.test(url)) return undefined;
    url = `https://${url}`;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    return parsed.href.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

export function cleanWebsite(raw: string | undefined): string | undefined {
  const url = asHttpUrl(raw ?? "");
  if (!url) return undefined;
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return undefined;
  return url.slice(0, 300);
}

export function cleanInstagram(raw: string | undefined): string | undefined {
  const url = asHttpUrl(raw ?? "");
  if (!url) return undefined;
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host !== "instagram.com" && !host.endsWith(".instagram.com")) return undefined;
  if (/\/(explore|p|reels|about)\b/i.test(new URL(url).pathname)) {
    const href = url.slice(0, 300);
    return href;
  }
  return url.slice(0, 300);
}

/** LinkedIn (or other site) that landed in the Instagram column. */
export function websiteFromMisfiledSocial(raw: string | undefined): string | undefined {
  const url = asHttpUrl(raw ?? "");
  if (!url) return undefined;
  const host = new URL(url).hostname.replace(/^www\./, "");
  if (host === "instagram.com" || host.endsWith(".instagram.com")) return undefined;
  return url.slice(0, 300);
}

export function parseSocioNames(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const chunk of raw.split(/\s*\/\s*|\n+/g)) {
    const name = chunk.replace(/\s+/g, " ").trim();
    if (!name) continue;
    if (/^(none|null|-)$/i.test(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name.slice(0, 80));
    if (out.length >= 12) break;
  }
  return out;
}

export function shortenMapsCompanyName(name: string): {
  name: string;
  original?: string;
} {
  const trimmed = name.trim();
  const idx = trimmed.indexOf(" - ");
  if (idx < 6) return { name: trimmed };
  const prefix = trimmed.slice(0, idx).trim();
  const suffix = trimmed.slice(idx + 3).trim();
  if (prefix.length < 6 || suffix.length < 10) return { name: trimmed };
  const tokens = prefix.split(/\s+/).filter((token) => token.length >= 2);
  if (tokens.length < 2) return { name: trimmed };
  return { name: prefix, original: trimmed };
}

export function labeledNoteLines(parts: Array<[string, string | undefined]>): string {
  return parts
    .filter(([, value]) => Boolean(value?.trim()))
    .map(([label, value]) => `${label}: ${value!.trim()}`)
    .join("\n");
}
