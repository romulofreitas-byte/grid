import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { sanitizeMetaUpdate } from "@/lib/calculadora/meta";
import { loadMetasPayload } from "@/lib/calculadora/load";
import { getRepo } from "@/lib/data";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }
  const patch = sanitizeMetaUpdate(body);
  try {
    const meta = await getRepo().updateMeta(gated.userId, id, patch);
    if (!meta) {
      return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
    }
    return NextResponse.json(await loadMetasPayload(gated.userId));
  } catch (err) {
    console.error("metas_patch_error", err);
    return NextResponse.json(
      { error: "Não foi possível salvar a meta" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  try {
    const deleted = await getRepo().deleteMeta(gated.userId, id);
    if (!deleted) {
      return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
    }
    return NextResponse.json(await loadMetasPayload(gated.userId));
  } catch (err) {
    console.error("metas_delete_error", err);
    return NextResponse.json(
      { error: "Não foi possível apagar a meta" },
      { status: 500 },
    );
  }
}
