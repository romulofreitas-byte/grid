import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { parseDocumento } from "@/lib/billing/document";
import { BillingError } from "@/lib/billing/types";
import { createCheckout } from "@/lib/billing/service";
import { getRepo } from "@/lib/data";

const schema = z.object({
  sku: z.string(),
  method: z.enum(["pix", "card_br", "boleto", "card_intl"]),
  documento: z.string().optional(),
  coupon: z.string().optional(),
});

export async function POST(req: Request) {
  const gated = await guardApi(req, "billing");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  const session = gated;
  if (!session.email) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  const repo = getRepo();
  const profile = await repo.getProfile(session.userId);
  const doc = parseDocumento(parsed.data.documento ?? profile.documento ?? undefined);
  if (doc && (profile.documento !== doc.digits || profile.documento_tipo !== doc.tipo)) {
    await repo.updateProfile(session.userId, {
      documento: doc.digits,
      documento_tipo: doc.tipo,
    });
  }
  try {
    const order = await createCheckout({
      profileId: session.userId,
      email: session.email,
      nome: profile.nome,
      sku: parsed.data.sku,
      method: parsed.data.method,
      documento: doc?.digits ?? parsed.data.documento,
      coupon: parsed.data.coupon,
    });
    return NextResponse.json({ order });
  } catch (err) {
    if (err instanceof BillingError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : "Falha no checkout";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
