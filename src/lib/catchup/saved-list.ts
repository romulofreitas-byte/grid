import { runCrmQualifyBridge } from "@/lib/catchup/tasks/crm-qualify-bridge";
import { getRepo } from "@/lib/data";
import type { GridRepo } from "@/lib/data/repo";
import type { Search } from "@/lib/types";

/** After a list is saved: put already-qualified CNPJs on that niche pista. */
export async function onSearchSaved(
  userId: string,
  search: Search,
  repo: GridRepo = getRepo(),
): Promise<void> {
  if (!search.saved) return;
  await runCrmQualifyBridge(repo, userId, { searchId: search.id });
}
