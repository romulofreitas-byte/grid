import { normalizeText } from "@/lib/niches";

/** Cap when listing across several UFs (or none). One UF returns the full set. */
export const MUNICIPIO_MULTI_UF_CAP = 80;

const LETTER_RE = /^[A-Z]$/;

export function municipioListLimit(ufCount: number): number | null {
  return ufCount === 1 ? null : MUNICIPIO_MULTI_UF_CAP;
}

export function municipioLetter(nome: string): string {
  const ch = normalizeText(nome).charAt(0).toUpperCase();
  return LETTER_RE.test(ch) ? ch : "#";
}

export function municipioLetters(list: Array<{ nome: string }>): string[] {
  const set = new Set<string>();
  for (const m of list) {
    const letter = municipioLetter(m.nome);
    if (letter !== "#") set.add(letter);
  }
  return [...set].sort();
}

export function filterMunicipios<T extends { nome: string }>(
  list: T[],
  opts: { letter?: string | null; q?: string } = {},
): T[] {
  const letter = opts.letter?.trim().toUpperCase() || null;
  const q = opts.q?.trim() ?? "";
  let out = list;
  if (letter && LETTER_RE.test(letter)) {
    out = out.filter((m) => municipioLetter(m.nome) === letter);
  }
  if (q.length >= 1) {
    const nq = normalizeText(q);
    out = out.filter((m) => normalizeText(m.nome).includes(nq));
  }
  return out;
}
