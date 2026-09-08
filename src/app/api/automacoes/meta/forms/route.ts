import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardAutomationsApi, jsonError } from "@/app/api/crm/_http";
import { decryptPageToken, listMetaForms } from "@/lib/crm/meta-leads";
import { getRepo } from "@/lib/data";

export async function GET(req: Request) {
  const gated = await guardAutomationsApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const url = new URL(req.url);
  const connectionId = url.searchParams.get("connection");
  if (!connectionId) return jsonError("Escolha a Página.");
  const row = await getRepo().getCrmMetaConnection(gated.userId, connectionId);
  if (!row) return jsonError("Página não encontrada.", 404);
  try {
    const token = decryptPageToken(row.credentials_ciphertext, row.credentials_nonce);
    const forms = await listMetaForms(token, row.page_id);
    return NextResponse.json({ forms });
  } catch (err) {
    console.error("meta_forms_error", err);
    return jsonError("Não foi possível ler os formulários desta Página.", 502);
  }
}
