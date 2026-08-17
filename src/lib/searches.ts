import type { Search } from "@/lib/types";

export function partitionSearches(searches: Search[]): {
  saved: Search[];
  unsaved: Search[];
} {
  const saved: Search[] = [];
  const unsaved: Search[] = [];
  for (const search of searches) {
    if (search.saved) saved.push(search);
    else unsaved.push(search);
  }
  return { saved, unsaved };
}

export function setSearchSaved(
  searches: Search[],
  searchId: string,
  saved: boolean,
): Search[] {
  return searches.map((search) =>
    search.id === searchId ? { ...search, saved } : search,
  );
}

export function removeSearch(searches: Search[], searchId: string): Search[] {
  return searches.filter((search) => search.id !== searchId);
}
