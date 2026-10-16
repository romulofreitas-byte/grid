import { CRM_RECORDING_MATCH_WINDOW_MS, recordingSyncDue } from "@/lib/crm/events";
import type { CrmEvent } from "@/lib/crm/types";
import type { Api4comCallRow } from "@/lib/integrations/api4com-recording";
import { decryptJson } from "@/lib/integrations/crypto";
import { loadApi4comRecordings } from "@/lib/integrations/api4com-recording";
import type { GridRepo } from "@/lib/data/repo";

type SyncRepo = Pick<
  GridRepo,
  "listIntegrationConnections" | "updateCrmEvent" | "listCrmEvents"
>;

export function pickRecordingForEvent(
  event: CrmEvent,
  dealId: string,
  calls: Api4comCallRow[],
  used: Set<string>,
): { recordUrl: string; callId: string } | null {
  const ownId = event.meta.call_id;
  if (ownId) {
    const exact = calls.find((row) => row.id === ownId);
    if (exact?.recordUrl && !used.has(exact.recordUrl)) {
      return { recordUrl: exact.recordUrl, callId: ownId };
    }
    if (exact) return null;
  }

  const created = new Date(event.created_at).getTime();
  let best: { row: Api4comCallRow; delta: number } | null = null;
  for (const row of calls) {
    if (!row.recordUrl || used.has(row.recordUrl) || row.dealId !== dealId) continue;
    if (row.startedAt == null || Number.isNaN(created)) continue;
    const delta = Math.abs(row.startedAt - created);
    if (delta > CRM_RECORDING_MATCH_WINDOW_MS) continue;
    if (!best || delta < best.delta) best = { row, delta };
  }
  if (!best) {
    const near = calls.filter((row) => {
      if (!row.recordUrl || used.has(row.recordUrl) || row.startedAt == null) return false;
      if (row.dealId && row.dealId !== dealId) return false;
      if (Number.isNaN(created)) return false;
      return Math.abs(row.startedAt - created) <= CRM_RECORDING_MATCH_WINDOW_MS;
    });
    if (near.length === 1 && near[0]?.recordUrl) {
      best = { row: near[0], delta: 0 };
    }
  }
  if (!best?.row.recordUrl) return null;
  return {
    recordUrl: best.row.recordUrl,
    callId: event.meta.call_id ?? best.row.id,
  };
}

export async function syncDealCallRecordings(
  repo: SyncRepo,
  userId: string,
  dealId: string,
  events: CrmEvent[],
  now = Date.now(),
): Promise<CrmEvent[]> {
  const due = events.filter((event) => recordingSyncDue(event, now));
  if (due.length === 0) return events;

  const connections = await repo.listIntegrationConnections(userId);
  const connection = connections.find(
    (row) => row.provider === "api4com" && row.status === "active",
  );
  if (!connection) return events;

  let calls: Api4comCallRow[] = [];
  try {
    const creds = await decryptJson(
      connection.credentials_ciphertext,
      connection.credentials_nonce,
    );
    const token = creds.token?.trim() ?? "";
    if (!token) return events;
    calls = await loadApi4comRecordings(
      token,
      due.map((event) => event.meta.call_id!).filter(Boolean),
    );
  } catch {
    return events;
  }

  const used = new Set(
    events
      .map((event) => event.meta.record_url)
      .filter((url): url is string => Boolean(url)),
  );
  const checkedAt = new Date(now).toISOString();
  let changed = false;
  for (const event of due) {
    const picked = pickRecordingForEvent(event, dealId, calls, used);
    if (picked) {
      used.add(picked.recordUrl);
      const updated = await repo.updateCrmEvent(
        userId,
        dealId,
        event.id,
        event.body,
        { record_url: picked.recordUrl, call_id: picked.callId },
      );
      if (updated) changed = true;
      continue;
    }
    const marked = await repo.updateCrmEvent(userId, dealId, event.id, event.body, {
      recording_checked_at: checkedAt,
    });
    if (marked) changed = true;
  }
  if (!changed) return events;
  return (await repo.listCrmEvents(userId, dealId)) ?? events;
}
