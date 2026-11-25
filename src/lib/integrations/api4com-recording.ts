import { safeRecordingUrl } from "@/lib/crm/attach-recording";
import { asRecord, pickString, vendorFetch } from "./voip-dial";

const BASE = "https://api.api4com.com/api/v1";

export type Api4comCallRow = {
  id: string;
  recordUrl: string | null;
  dealId: string | null;
  startedAt: number | null;
  endedAt?: number | null;
  hangupCause?: string | null;
  callRef?: string | null;
};

/** API4COM sends `2025-01-01 00:00:00` (space, no zone). */
export function parseApi4comInstant(raw: string | null | undefined): number | null {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(trimmed)
    ? trimmed.replace(" ", "T")
    : trimmed;
  const parsed = Date.parse(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}

export function parseApi4comCallList(json: unknown): Api4comCallRow[] {
  const root = asRecord(json);
  const rawRows = Array.isArray(json)
    ? json
    : Array.isArray(root?.data)
      ? root.data
      : [];
  const rows: Api4comCallRow[] = [];
  for (const item of rawRows) {
    const rec = asRecord(item);
    if (!rec) continue;
    const id = pickString(rec, ["id"]);
    if (!id) continue;
    const meta = asRecord(rec.metadata);
    rows.push({
      id,
      recordUrl: safeRecordingUrl(
        pickString(rec, ["recordUrl", "record_url", "recording_url"]),
      ),
      dealId:
        pickString(meta, ["deal_id", "dealId"]) ??
        pickString(rec, ["deal_id", "dealId"]) ??
        null,
      startedAt: parseApi4comInstant(
        pickString(rec, ["started_at", "startedAt"]),
      ),
      endedAt: parseApi4comInstant(pickString(rec, ["ended_at", "endedAt"])),
      hangupCause:
        pickString(rec, ["hangup_cause", "hangupCause"]) ?? null,
      callRef:
        pickString(meta, ["call_ref", "callRef"]) ??
        pickString(rec, ["call_ref", "callRef"]) ??
        null,
    });
  }
  return rows;
}

async function getCalls(
  token: string,
  filter: Record<string, unknown>,
): Promise<Api4comCallRow[]> {
  const res = await vendorFetch(
    `${BASE}/calls?page=1&filter=${encodeURIComponent(JSON.stringify(filter))}`,
    {
      headers: {
        Authorization: token,
        "Content-Type": "application/json",
      },
    },
  );
  if (!res.ok) return [];
  return parseApi4comCallList(res.json);
}

/** Recent calls plus a direct lookup, so a late file can still be found by id. */
export async function loadApi4comRecordings(
  token: string,
  callIds: string[],
): Promise<Api4comCallRow[]> {
  const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
  let recent = await getCalls(token, {
    where: { started_at: { gte: since } },
    order: "started_at DESC",
    limit: 50,
  });
  if (recent.length === 0) {
    recent = await getCalls(token, { order: "started_at DESC", limit: 50 });
  }
  const have = new Set(recent.map((row) => row.id));
  const extra: Api4comCallRow[] = [];
  for (const id of callIds.filter((row) => !have.has(row)).slice(0, 3)) {
    extra.push(...(await getCalls(token, { where: { id }, limit: 1 })));
  }
  return [...recent, ...extra];
}

/** Dial id and webhook id differ. `call_ref` is the id we put on the call. */
export function api4comRowEnded(row: Api4comCallRow): boolean {
  if (row.hangupCause?.trim()) return true;
  return typeof row.endedAt === "number" && !Number.isNaN(row.endedAt);
}

export function matchApi4comCallEnded(
  rows: readonly Api4comCallRow[],
  query: { vendorId: string; callRef?: string | null },
): boolean {
  const ref = query.callRef?.trim() || null;
  const row = rows.find(
    (item) => item.id === query.vendorId || (ref != null && item.callRef === ref),
  );
  return row ? api4comRowEnded(row) : false;
}

/** True when the call list already shows this dial as finished. */
export async function lookupApi4comCallEnded(
  token: string,
  query: { vendorId: string; callRef?: string | null },
): Promise<boolean> {
  const since = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  let rows = await getCalls(token, {
    where: { started_at: { gte: since } },
    order: "started_at DESC",
    limit: 30,
  });
  if (rows.length === 0) {
    rows = await getCalls(token, { order: "started_at DESC", limit: 30 });
  }
  return matchApi4comCallEnded(rows, query);
}
