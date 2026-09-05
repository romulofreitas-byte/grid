import { NextResponse } from "next/server";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { loadMetasPayload } from "@/lib/calculadora/load";
import { getRepo } from "@/lib/data";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const { id } = await ctx.params;
  try {
    const applied = await getRepo().applyMeta(gated.userId, id);
    if (applied.status === "not_found") {
      return NextResponse.json({ error: "Meta não encontrada" }, { status: 404 });
    }
    if (applied.status === "not_ready") {
      return NextResponse.json(
        { error: "Preencha meta, ticket e prazo para aplicar no Box." },
        { status: 400 },
      );
    }
    return NextResponse.json(await loadMetasPayload(gated.userId));
  } catch (err) {
    console.error("metas_apply_error", err);
    return NextResponse.json(
      { error: "Não foi possível aplicar a meta no Box" },
      { status: 500 },
    );
  }
}
