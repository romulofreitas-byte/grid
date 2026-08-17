import { NextResponse } from "next/server";
import { guardPublicApi } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";

export async function POST(req: Request) {
  const denied = await guardPublicApi(req, "optout");
  if (denied) return denied;
  const body = await req.json();
  const documento = String(body.documento ?? "").slice(0, 80);
  const motivo =
    body.motivo == null ? null : String(body.motivo).slice(0, 500);
  if (!documento.trim()) {
    return NextResponse.json({ error: "Documento obrigatório" }, { status: 400 });
  }
  await getRepo().addOptOut(documento, motivo);
  return NextResponse.json({ ok: true });
}
