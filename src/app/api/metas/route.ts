import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { sanitizeMetaCreate } from "@/lib/calculadora/meta";
import { loadMetasPayload, jsonMetasPersistError } from "@/lib/calculadora/load";
import { getRepo } from "@/lib/data";

export async function GET(req: Request) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  try {
    return NextResponse.json(await loadMetasPayload(gated.userId));
  } catch (err) {
    console.error("metas_get_error", err);
    return NextResponse.json(
      { error: "Não foi possível carregar as metas" },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const parsed = sanitizeMetaCreate(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  try {
    const meta = await getRepo().createMeta(gated.userId, parsed.value);
    const payload = await loadMetasPayload(gated.userId);
    return NextResponse.json({ ...payload, meta });
  } catch (err) {
    console.error("metas_post_error", err);
    return jsonMetasPersistError(err, "Não foi possível salvar a meta");
  }
}
