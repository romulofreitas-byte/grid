import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardAutomationsApi, jsonError, readJson } from "@/app/api/crm/_http";
import { metaConfigured } from "@/lib/crm/meta-api";
import { decryptPageToken, subscribePageToLeadgen } from "@/lib/crm/meta-leads";
import { getRepo } from "@/lib/data";

function parsePageIds(body: unknown): string[] {
  if (!body || typeof body !== "object" || !("pageIds" in body)) return [];
  const raw = (body as { pageIds: unknown }).pageIds;
  if (!Array.isArray(raw)) return [];
  return [
    ...new Set(
      raw
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

export async function GET(req: Request) {
  const gated = await guardAutomationsApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const repo = getRepo();
  const [pages, pending] = await Promise.all([
    repo.listCrmMetaConnections(gated.userId),
    repo.listCrmMetaPendingConnections(gated.userId),
  ]);
  return NextResponse.json({ pages, pending, configured: metaConfigured() });
}

export async function POST(req: Request) {
  const gated = await guardAutomationsApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  const pageIds = parsePageIds(await readJson(req));
  if (pageIds.length === 0) {
    return jsonError("Escolha ao menos uma Página.");
  }
  const repo = getRepo();
  const selectable = await repo.listCrmMetaSelectableRecords(gated.userId);
  const selected = new Set(pageIds);
  const chosen = selectable.filter((row) => selected.has(row.page_id));
  if (chosen.length === 0) {
    return jsonError("Escolha ao menos uma Página.");
  }

  let activated = 0;
  for (const row of selectable) {
    if (selected.has(row.page_id)) {
      try {
        if (row.status !== "active") {
          const token = decryptPageToken(
            row.credentials_ciphertext,
            row.credentials_nonce,
          );
          await subscribePageToLeadgen(token, row.page_id);
        }
        const updated = await repo.updateCrmMetaConnectionStatus(
          gated.userId,
          row.page_id,
          "active",
        );
        if (updated) activated += 1;
      } catch (err) {
        console.error("meta_subscribe_failed", row.page_id, err);
      }
    } else {
      await repo.updateCrmMetaConnectionStatus(
        gated.userId,
        row.page_id,
        "revoked",
      );
    }
  }
  if (activated === 0) {
    return jsonError("Não foi possível ligar as Páginas.", 502);
  }
  const [pages, pending] = await Promise.all([
    repo.listCrmMetaConnections(gated.userId),
    repo.listCrmMetaPendingConnections(gated.userId),
  ]);
  return NextResponse.json({ pages, pending, configured: metaConfigured() });
}
