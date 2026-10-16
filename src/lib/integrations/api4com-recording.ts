import { safeRecordingUrl } from "@/lib/crm/attach-recording";
import { asRecord, pickString, vendorFetch } from "./voip-dial";

const BASE = "https://api.api4com.com/api/v1";

export type Api4comCallRow = {
  id: string;
  recordUrl: string | null;
  dealId: string | null;
  startedAt: number | null;
};

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
    const startedRaw = pickString(rec, ["started_at", "startedAt"]);
    const startedAt = startedRaw ? Date.parse(startedRaw) : Number.NaN;
    rows.push({
      id,
      recordUrl: safeRecordingUrl(
        pickString(rec, ["recordUrl", "record_url", "recording_url"]),
      ),
      dealId:
        pickString(meta, ["deal_id", "dealId"]) ??
        pickString(rec, ["deal_id", "dealId"]),
      startedAt: Number.isNaN(startedAt) ? null : startedAt,
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
