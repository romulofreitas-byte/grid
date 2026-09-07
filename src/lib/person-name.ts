const NAME_PARTICLES = new Set([
  "da",
  "das",
  "de",
  "del",
  "dela",
  "di",
  "do",
  "dos",
  "du",
  "e",
  "y",
]);

function foldParticle(token: string): string {
  return token
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function isNameParticle(token: string): boolean {
  return NAME_PARTICLES.has(foldParticle(token));
}

function titleCaseToken(token: string): string {
  const lower = token.toLocaleLowerCase("pt-BR");
  if (!lower) return token;
  return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
}

/** First two given names, skipping da/de/dos so the grid stays scannable. */
export function shortPersonName(
  name: string | null | undefined,
): string | null {
  if (!name?.trim()) return null;
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  const picked: string[] = [];
  for (const token of tokens) {
    if (picked.length >= 2) break;
    if (isNameParticle(token)) continue;
    picked.push(titleCaseToken(token));
  }
  return picked.length ? picked.join(" ") : null;
}
