import { NextResponse } from "next/server";
import { z } from "zod";
import { getSearchForUser } from "@/lib/auth/search-access";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { onSearchSaved } from "@/lib/catchup/saved-list";
import { getRepo } from "@/lib/data";

const patchSchema = z.object({
  nome: z.string().min(1).optional(),
  saved: z.boolean().optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ searchId: string }> },
) {
  const gated = await guardApi(req, "read");
  if (isGuardReject(gated)) return gated;
  const { searchId } = await ctx.params;
  const search = await getSearchForUser(gated.userId, searchId);
  if (!search) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  return NextResponse.json(search);
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ searchId: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { searchId } = await ctx.params;
  const owned = await getSearchForUser(gated.userId, searchId);
  if (!owned) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const becameSaved = parsed.data.saved === true && !owned.saved;
  const search = await getRepo().saveSearch(searchId, parsed.data);
  if (!search) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  if (becameSaved) {
    void onSearchSaved(gated.userId, search).catch((err) => {
      console.error("crm_save_bridge_error", err);
    });
  }
  return NextResponse.json(search);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ searchId: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { searchId } = await ctx.params;
  const owned = await getSearchForUser(gated.userId, searchId);
  if (!owned) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  const ok = await getRepo().deleteSearch(searchId);
  if (!ok) {
    return NextResponse.json({ error: "Busca não encontrada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
