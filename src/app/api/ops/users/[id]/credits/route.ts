import { NextResponse } from "next/server";
import { guardOpsApi } from "@/lib/auth/api-guard";
import { BillingError } from "@/lib/billing/types";
import {
  grantManualCredits,
  revokeManualCredits,
} from "@/lib/billing/service";
import { getOpsUser, isOpsProfileId } from "@/lib/ops/metrics";

function parseCreditsBody(raw: unknown): { qty: number; action: "grant" | "revoke" } | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { qty?: unknown; action?: unknown };
  const qty = typeof body.qty === "number" ? body.qty : Number(body.qty);
  const action = body.action === "revoke" ? "revoke" : "grant";
  if (!Number.isFinite(qty)) return null;
  return { qty, action };
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const gated = await guardOpsApi(req, "write");
  if (gated instanceof NextResponse) return gated;
  const { id } = await ctx.params;
  if (!isOpsProfileId(id)) {
    return NextResponse.json({ error: "Usuário inválido" }, { status: 400 });
  }
  let parsed: ReturnType<typeof parseCreditsBody> = null;
  try {
    parsed = parseCreditsBody(await req.json());
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  if (!parsed) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }
  try {
    if (parsed.action === "revoke") {
      await revokeManualCredits(id, parsed.qty);
    } else {
      await grantManualCredits(id, parsed.qty);
    }
    const user = await getOpsUser(id);
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      {
        error:
          parsed.action === "revoke"
            ? "Não foi possível debitar"
            : "Não foi possível creditar",
      },
      { status: 400 },
    );
  }
}
