import { getRepo } from "@/lib/data";
import type { Search } from "@/lib/types";

/** Returns the search only when it belongs to the authenticated user. */
export async function getSearchForUser(
  userId: string,
  searchId: string,
): Promise<Search | null> {
  const search = await getRepo().getSearch(searchId);
  if (!search || search.user_id !== userId) return null;
  return search;
}
