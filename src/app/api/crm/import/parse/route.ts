import { NextResponse } from "next/server";
import { isGuardReject } from "@/lib/auth/api-guard";
import { guardCrmApi, jsonError } from "@/app/api/crm/_http";
import { isSpreadsheetName } from "@/lib/crm/import-file";
import { parseSpreadsheetBuffer } from "@/lib/crm/import-xlsx";

const MAX_BYTES = 2_000_000;

export async function POST(req: Request) {
  const gated = await guardCrmApi(req, "crm");
  if (isGuardReject(gated)) return gated;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return jsonError("Arquivo inválido.");
  }
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Envie um CSV ou Excel.");
  if (!isSpreadsheetName(file.name)) {
    return jsonError("Use um arquivo CSV ou Excel (.xlsx).");
  }
  if (file.size > MAX_BYTES) {
    return jsonError("Arquivo grande demais (máximo 2 MB).");
  }
  const table = await parseSpreadsheetBuffer(await file.arrayBuffer(), file.name);
  if (table.headers.length === 0) {
    return jsonError("Não achei cabeçalho na planilha.");
  }
  return NextResponse.json(table);
}
