import { DEFAULT_PIPELINE_NAME } from "@/lib/crm/cadence";
import type { CrmPipelineSummary } from "@/lib/crm/types";
import { getRepo } from "@/lib/data";

export async function ensureDefaultPipeline(
  userId: string,
  listed: CrmPipelineSummary[],
): Promise<CrmPipelineSummary[]> {
  if (listed.length > 0) return listed;
  const created = await getRepo().createCrmPipeline(
    userId,
    DEFAULT_PIPELINE_NAME,
  );
  return [{ ...created, deal_count: 0 }];
}
