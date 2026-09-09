import { canMoveFromFicha } from "@/lib/crm/cadence";
import type { CrmStage } from "@/lib/crm/types";

export type BookMeetingRequest = <T>(
  url: string,
  init?: RequestInit,
) => Promise<T>;

export async function bookBoxMeeting(
  input: {
    activityId: string;
    dealId: string;
    pipelineId: string;
    canonicalKey: string | null;
    dueAt: string;
  },
  request: BookMeetingRequest,
): Promise<void> {
  await request(`/api/crm/deals/${input.dealId}/schedule`, {
    method: "POST",
    body: JSON.stringify({ kind: "reuniao", dueAt: input.dueAt }),
  });
  await request(`/api/crm/deals/${input.dealId}/complete`, {
    method: "POST",
    body: JSON.stringify({ activityId: input.activityId }),
  });
  if (!canMoveFromFicha(input.canonicalKey, "reuniao_agendada")) return;
  const { stages } = await request<{ stages: CrmStage[] }>(
    `/api/crm/pipelines/${input.pipelineId}/stages`,
  );
  const target = stages.find(
    (stage) => stage.canonical_key === "reuniao_agendada",
  );
  if (!target) return;
  await request(`/api/crm/deals/${input.dealId}/move`, {
    method: "POST",
    body: JSON.stringify({ stageId: target.id, position: 0 }),
  });
}
