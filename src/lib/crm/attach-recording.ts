import { normalizeCallId } from "@/lib/crm/events";
import type { CrmDealCard, CrmEvent, CrmEventMeta } from "@/lib/crm/types";
import type { GridRepo } from "@/lib/data/repo";

export type AttachRecordingRepo = Pick<
  GridRepo,
  | "getCrmDeal"
  | "findCrmDealByCnpjForUser"
  | "listCrmEvents"
  | "createCrmEvent"
  | "updateCrmEvent"
>;

export function safeRecordingUrl(raw: string | null | undefined): string | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export async function attachCallRecordingToDeal(
  repo: AttachRecordingRepo,
  input: {
    userId: string;
    dealId?: string | null;
    cnpj?: string | null;
    recordingUrl?: string | null;
    phone?: string;
    callId?: string | null;
  },
): Promise<{ deal: CrmDealCard; event: CrmEvent } | null> {
  const recordUrl = safeRecordingUrl(input.recordingUrl);
  if (!recordUrl) return null;

  const deal = input.dealId
    ? await repo.getCrmDeal(input.userId, input.dealId)
    : input.cnpj
      ? await repo.findCrmDealByCnpjForUser(input.userId, input.cnpj)
      : null;
  if (!deal) return null;

  const callId = normalizeCallId(input.callId);
  const events = (await repo.listCrmEvents(input.userId, deal.id)) ?? [];
  const matched = callId
    ? events.find((row) => row.kind === "ligar" && row.meta.call_id === callId)
    : undefined;
  const latestLigar = events.find((row) => row.kind === "ligar");
  const meta: CrmEventMeta = {
    record_url: recordUrl,
    ...(input.phone ? { phone: input.phone } : {}),
    ...(callId ? { call_id: callId } : {}),
  };

  if (matched) {
    if (matched.meta.record_url === recordUrl) return { deal, event: matched };
    return repo.updateCrmEvent(
      input.userId,
      deal.id,
      matched.id,
      matched.body,
      meta,
    );
  }
  if (latestLigar && latestLigar.meta.record_url === recordUrl) {
    return { deal, event: latestLigar };
  }
  if (latestLigar && !latestLigar.meta.record_url) {
    return repo.updateCrmEvent(
      input.userId,
      deal.id,
      latestLigar.id,
      latestLigar.body,
      meta,
    );
  }
  return repo.createCrmEvent(input.userId, deal.id, {
    kind: "ligar",
    body: "",
    meta,
  });
}
