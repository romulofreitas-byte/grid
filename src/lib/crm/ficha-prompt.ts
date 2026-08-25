export type FichaCrmPrompt = "qualify" | "save" | "entering" | null;

export function fichaCrmPrompt(input: {
  hasDeal: boolean;
  searchSaved: boolean;
  wasQualified: boolean;
}): FichaCrmPrompt {
  if (input.hasDeal) return null;
  if (!input.searchSaved) return "save";
  if (input.wasQualified) return "entering";
  return "qualify";
}
