import * as cheerio from "cheerio";
import { collectAgencyBlocks, inBlockedHtml } from "@/lib/enrichment/extract";
import { hasCorporateSuffix } from "@/lib/partner-kind";
import type { SitePerson, SitePersonPapel } from "@/lib/types";

const MAX_PEOPLE = 12;

const NAME_STOP = new Set([
  "contato",
  "sobre",
  "equipe",
  "time",
  "diretoria",
  "politica",
  "privacidade",
  "termos",
  "cookies",
  "home",
  "menu",
  "empresa",
  "inicio",
  "fale",
  "conosco",
]);

const PARTICLE = new Set(["de", "da", "do", "dos", "das", "e"]);

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyPapel(cargo: string): {
  papel: SitePersonPapel;
  portaRecomendada: boolean;
} {
  const n = normalize(cargo);
  if (/\b(comercial|vendas|sales|business development|cco)\b/.test(n)) {
    return { papel: "vendas", portaRecomendada: true };
  }
  if (/\b(financeiro|financeira|cfo|controller|tesouraria)\b/.test(n)) {
    return { papel: "financeiro", portaRecomendada: true };
  }
  if (/\b(diretor(?:a)?|ceo|presidente|cio|cto)\b/.test(n)) {
    return { papel: "diretoria", portaRecomendada: false };
  }
  return { papel: "outro", portaRecomendada: false };
}

function jsonLdTypes(obj: Record<string, unknown>): string[] {
  const t = obj["@type"];
  if (typeof t === "string") return [t];
  if (Array.isArray(t)) return t.filter((x): x is string => typeof x === "string");
  return [];
}

function walkJsonLd(node: unknown, visit: (obj: Record<string, unknown>) => void): void {
  if (Array.isArray(node)) {
    for (const item of node) walkJsonLd(item, visit);
    return;
  }
  if (!node || typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  visit(obj);
  for (const value of Object.values(obj)) walkJsonLd(value, visit);
}

const ROLE_HINT =
  /\b(diretor(?:a)?|ceo|cfo|cco|cio|cto|presidente|controller|gerente(?:\s+de)?|coordenador(?:a)?)\b/i;

function looksLikeCargo(text: string): boolean {
  return ROLE_HINT.test(text) && text.length <= 80 && !/\d{3,}/.test(text);
}

export function isPersonName(raw: string): boolean {
  const name = raw.replace(/\s+/g, " ").trim();
  if (name.length < 8 || name.length > 80) return false;
  if (/\d/.test(name)) return false;
  if (hasCorporateSuffix(name)) return false;
  const parts = name.split(" ").filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every((token, i) => {
    const n = normalize(token);
    if (NAME_STOP.has(n)) return false;
    if (PARTICLE.has(n) && i > 0 && i < parts.length - 1) return true;
    return /^[\p{L}][\p{L}'’-]*$/u.test(token) && token.length >= 2;
  });
}

function titleCaseCargo(cargo: string): string {
  return cargo.replace(/\s+/g, " ").trim();
}

export function extractPeople(
  html: string,
  opts?: { qsaNomes?: string[] },
): SitePerson[] {
  const $ = cheerio.load(html);
  const blocked = collectAgencyBlocks($);
  const qsa = new Set((opts?.qsaNomes ?? []).map((n) => normalize(n)));
  const byName = new Map<string, SitePerson>();

  function add(nome: string, cargo: string, fonte: SitePerson["fonte"]) {
    const cleanName = nome.replace(/\s+/g, " ").trim();
    const cleanCargo = titleCaseCargo(cargo);
    if (!isPersonName(cleanName) || !looksLikeCargo(cleanCargo)) return;
    const key = normalize(cleanName);
    if (qsa.has(key) || byName.has(key)) return;
    const { papel, portaRecomendada } = classifyPapel(cleanCargo);
    byName.set(key, {
      nome: cleanName,
      cargo: cleanCargo,
      papel,
      portaRecomendada,
      fonte,
    });
  }

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).html();
    if (!raw) return;
    try {
      const data: unknown = JSON.parse(raw);
      walkJsonLd(data, (obj) => {
        const types = jsonLdTypes(obj);
        if (!types.some((t) => /person/i.test(t))) return;
        const nome = typeof obj.name === "string" ? obj.name : "";
        const cargo = typeof obj.jobTitle === "string" ? obj.jobTitle : "";
        if (nome && cargo) add(nome, cargo, "schema");
      });
    } catch {
      /* invalid json-ld */
    }
  });

  $("h1,h2,h3,h4,h5,h6").each((_, el) => {
    const $el = $(el);
    const parentHtml = $.html($el.parent());
    if (inBlockedHtml(parentHtml, blocked)) return;
    const heading = $el.text().trim();
    const next = $el.next().text().replace(/\s+/g, " ").trim();
    if (isPersonName(heading) && looksLikeCargo(next)) {
      add(heading, next, "pagina");
      return;
    }
    if (looksLikeCargo(heading) && isPersonName(next)) {
      add(next, heading, "pagina");
    }
  });

  const root = $("main").first().length ? $("main").first() : $("body");
  const visible = root.text().replace(/\s+/g, " ").slice(0, 40000);

  const cargo =
    "(?:[Dd]iretor(?:a)?|[Gg]erente|[Cc]oordenador(?:a)?)(?:\\s+(?:de|da|do))?\\s+(?:[Vv]endas|[Cc]omercial|[Ff]inanceir[oa]|[Oo]pera[cç][oõ]es|[Mm]arketing)|CEO|CFO|[Cc]eo|[Cc]fo|[Pp]residente|[Cc]ontroller";
  const name =
    "[A-ZÁÉÍÓÚÂÊÔÃÕÀ][\\p{L}'’-]+(?:\\s+(?:de|da|do|dos|das|e|[A-ZÁÉÍÓÚÂÊÔÃÕÀ][\\p{L}'’-]+)){1,3}";
  const cargoThenName = new RegExp(`(${cargo})\\s*[:\\-–—]\\s*(${name})`, "gu");
  const nameThenCargo = new RegExp(`(${name})\\s*[,:\\-–—]\\s*(${cargo})`, "gu");

  for (const match of visible.matchAll(cargoThenName)) {
    const cargo = match[1] ?? "";
    const nome = match[2] ?? "";
    const snippet = match[0] ?? "";
    if (inBlockedHtml(snippet, blocked)) continue;
    add(nome, cargo, "pagina");
  }
  for (const match of visible.matchAll(nameThenCargo)) {
    const nome = match[1] ?? "";
    const cargo = match[2] ?? "";
    const snippet = match[0] ?? "";
    if (inBlockedHtml(snippet, blocked)) continue;
    add(nome, cargo, "pagina");
  }

  const people = [...byName.values()];
  people.sort((a, b) => {
    const ra = a.portaRecomendada ? 0 : a.papel === "diretoria" ? 1 : 2;
    const rb = b.portaRecomendada ? 0 : b.papel === "diretoria" ? 1 : 2;
    return ra - rb;
  });
  return people.slice(0, MAX_PEOPLE);
}
