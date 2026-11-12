import { NextResponse } from "next/server";
import { z } from "zod";
import { guardApi, isGuardReject } from "@/lib/auth/api-guard";
import { getRepo } from "@/lib/data";
import { HidePhoneError } from "@/lib/hidden-phones";

const schema = z
  .object({
    phone: z.string().min(8).max(32),
    cnpj: z.string().max(20).optional(),
    dealId: z.string().uuid().optional(),
  })
  .refine((body) => Boolean(body.cnpj?.trim()) || Boolean(body.dealId), {
    message: "cnpj or dealId is required",
  });

export async function POST(req: Request) {
  const gated = await guardApi(req, "write");
  if (isGuardReject(gated)) return gated;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Payload inválido" }, { status: 400 });
  }
  try {
    const result = await getRepo().hideCompanyPhone(gated.userId, {
      phone: parsed.data.phone,
      cnpj: parsed.data.cnpj,
      dealId: parsed.data.dealId,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof HidePhoneError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("hide_phone_error", err);
    return NextResponse.json(
      { error: "Não foi possível excluir o telefone" },
      { status: 500 },
    );
  }
}
