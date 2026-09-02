import type { Search } from "@/lib/types";

export const UNSAVED_LIST_CAP = 3;
export const SAVED_LISTS_PAGE_SIZE = 6;

export type UnsavedRow = { id: string; created_at: string };

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

/**
 * Oldest unsaved ids that must go so the user stays at `cap`.
 * `incoming` reserves slots for searches about to be created.
 * `keepId` is never pruned (the list just unsaved).
 */
export function unsavedIdsToPrune(
  unsaved: readonly UnsavedRow[],
  opts?: { keepId?: string; incoming?: number; cap?: number },
): string[] {
  const cap = opts?.cap ?? UNSAVED_LIST_CAP;
  const incoming = opts?.incoming ?? 0;
  const keepId = opts?.keepId ?? null;
  const keepIdInList =
    keepId != null && unsaved.some((row) => row.id === keepId);
  const reserved =
    incoming + (keepId != null && !keepIdInList ? 1 : 0);
  const slotsForList = Math.max(0, cap - reserved);

  const newestFirst = [...unsaved].sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const keep = new Set<string>();
  if (keepIdInList && keepId) keep.add(keepId);

  for (const row of newestFirst) {
    if (keep.has(row.id)) continue;
    if (keep.size >= slotsForList) break;
    keep.add(row.id);
  }

  return newestFirst
    .filter((row) => !keep.has(row.id))
    .map((row) => row.id);
}

export function applySearchSaved(
  searches: Search[],
  searchId: string,
  saved: boolean,
): Search[] {
  const updated = setSearchSaved(searches, searchId, saved);
  const item = updated.find((row) => row.id === searchId);
  if (!item) return updated;
  const rest = updated.filter((row) => row.id !== searchId);
  const reordered = [item, ...rest];
  if (saved) return reordered;
  const { unsaved } = partitionSearches(reordered);
  return unsavedIdsToPrune(unsaved, { keepId: searchId }).reduce(
    (acc, id) => removeSearch(acc, id),
    reordered,
  );
}

export function nextSavedVisibleCount(
  shown: number,
  total: number,
  pageSize = SAVED_LISTS_PAGE_SIZE,
): number {
  return Math.min(total, shown + pageSize);
}
