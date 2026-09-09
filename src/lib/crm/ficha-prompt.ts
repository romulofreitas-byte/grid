export type FichaCrmPrompt = "qualify" | "save" | "entering" | "enter" | null;

export function fichaCrmPrompt(input: {
  hasDeal: boolean;
  searchSaved: boolean;
  wasQualified: boolean;
  hasSearch?: boolean;
}): FichaCrmPrompt {
  if (input.hasDeal) return null;
  if (input.searchSaved) {
    if (input.wasQualified) return "entering";
    return "qualify";
  }
  if (input.hasSearch !== false) return "save";
  return "enter";
}
