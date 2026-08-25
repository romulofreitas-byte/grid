import { CATCHUP_TASKS } from "@/lib/catchup/registry";
import type { CatchUpRunResult } from "@/lib/catchup/types";
import { getRepo } from "@/lib/data";
import type { GridRepo } from "@/lib/data/repo";

export async function runUserCatchUp(
  userId: string,
  repo: GridRepo = getRepo(),
): Promise<CatchUpRunResult> {
  const totals: CatchUpRunResult = { created: 0, skipped: 0, hasMore: false };
  for (const task of CATCHUP_TASKS) {
    const lock = await repo.tryBeginCatchUp(userId, task.id);
    if (lock === "busy" || lock === "cooldown") {
      continue;
    }
    try {
      const result = await task.run(userId, repo);
      totals.created += result.created;
      totals.skipped += result.skipped;
      if (result.hasMore) totals.hasMore = true;
      await repo.finishCatchUp(userId, task.id, result);
    } catch (err) {
      await repo.finishCatchUp(userId, task.id, {
        created: 0,
        skipped: 0,
        hasMore: true,
      });
      throw err;
    }
  }
  return totals;
}
