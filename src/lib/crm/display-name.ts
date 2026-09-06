const LEGAL_SUFFIX = new Set([
  "ltda",
  "me",
  "epp",
  "eireli",
  "mei",
  "sa",
  "s.a",
  "s/a",
  "ss",
  "cia",
]);

const SMALL_WORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "e",
  "de",
  "da",
  "do",
  "das",
  "dos",
  "em",
  "no",
  "na",
  "nos",
  "nas",
  "para",
  "com",
  "por",
]);

function lettersOf(value: string): string[] {
  return [...value].filter((ch) => /\p{L}/u.test(ch));
}

function isUpperLetter(ch: string): boolean {
  return ch === ch.toLocaleUpperCase("pt-BR") && ch !== ch.toLocaleLowerCase("pt-BR");
}

function isLowerLetter(ch: string): boolean {
  return ch === ch.toLocaleLowerCase("pt-BR") && ch !== ch.toLocaleUpperCase("pt-BR");
}

/** Receita-style names are stored in ALL CAPS; mixed-case is treated as already curated. */
export function isAllCapsName(value: string): boolean {
  const letters = lettersOf(value);
  if (letters.length === 0) return false;
  return letters.some(isUpperLetter) && !letters.some(isLowerLetter);
}

function suffixKey(word: string): string {
  return word.replace(/\.+$/g, "").toLocaleLowerCase("pt-BR");
}

function isLegalSuffix(word: string): boolean {
  return LEGAL_SUFFIX.has(suffixKey(word));
}

function titleToken(word: string): string {
  return word
    .toLocaleLowerCase("pt-BR")
    .replace(
      /(^|[-'’])(\p{L})/gu,
      (_full, sep: string, letter: string) =>
        `${sep}${letter.toLocaleUpperCase("pt-BR")}`,
    );
}

/**
 * Title-case a company or contact name when it arrived in CAIXA ALTA.
 * Legal suffixes (LTDA, ME, EIRELI, S.A.) stay uppercase. Mixed-case input is left alone.
 */
export function displayCrmName(value: string): string {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed || !isAllCapsName(trimmed)) return trimmed;
  return trimmed
    .split(" ")
    .map((word, index) => {
      if (isLegalSuffix(word)) return word.toLocaleUpperCase("pt-BR");
      const key = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && SMALL_WORDS.has(key)) return key;
      return titleToken(word);
    })
    .join(" ");
}
