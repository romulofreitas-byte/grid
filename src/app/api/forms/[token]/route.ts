import { NextResponse } from "next/server";
import { clientIp, rateLimit } from "@/lib/auth/rate-limit";
import { answersFromFormBody } from "@/lib/crm/form-fields";
import { ingestInboundJson, persistInboundEvent } from "@/lib/crm/ingest-inbound";
import { hashInboundToken } from "@/lib/crm/inbound-token";
import { getRepo } from "@/lib/data";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ token: string }> },
) {
  const limited = await rateLimit(clientIp(req), "form");
  if (!limited.ok) {
    return NextResponse.json({ error: "Muitas tentativas. Tente de novo em instantes." }, { status: 429 });
  }
  const { token } = await ctx.params;
  const endpoint = await getRepo().getCrmInboundEndpointByPublicTokenHash(
    hashInboundToken(token),
  );
  if (!endpoint || endpoint.channel !== "site") {
    return NextResponse.json({ error: "Formulário não encontrado." }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    await persistInboundEvent(endpoint, {
      status: "error",
      httpStatus: 400,
      message: "JSON inválido",
    });
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  if (typeof body.empresa_website === "string" && body.empresa_website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const json = {
    kind: endpoint.lead_kind,
    name: body.name,
    phone: body.phone,
    email: body.email,
    company: body.company,
    cnpj: body.cnpj,
    answers: answersFromFormBody(endpoint.form_fields, body),
  };
  return ingestInboundJson(endpoint, json);
}
