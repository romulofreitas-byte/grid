import { NextResponse } from "next/server";
import { ingestInboundJson, persistInboundEvent } from "@/lib/crm/ingest-inbound";
import {
  hashInboundToken,
  parseBearerToken,
} from "@/lib/crm/inbound-token";
import { getRepo } from "@/lib/data";

export async function handleInboundLeadPost(
  req: Request,
  opts?: { endpointId?: string },
): Promise<NextResponse> {
  const token = parseBearerToken(req.headers.get("authorization"));
  const repo = getRepo();
  const urlEndpoint = opts?.endpointId
    ? await repo.findCrmInboundEndpoint(opts.endpointId)
    : null;

  if (!token) {
    if (urlEndpoint) {
      await persistInboundEvent(urlEndpoint, {
        status: "error",
        httpStatus: 401,
        message: "Token ausente",
      });
    }
    return NextResponse.json({ error: "Token ausente" }, { status: 401 });
  }

  const endpoint = await repo.getCrmInboundEndpointByTokenHash(
    hashInboundToken(token),
  );
  if (!endpoint || (opts?.endpointId && endpoint.id !== opts.endpointId)) {
    if (urlEndpoint) {
      await persistInboundEvent(urlEndpoint, {
        status: "error",
        httpStatus: 401,
        message: "Token inválido",
      });
    }
    return NextResponse.json({ error: "Token inválido" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    await persistInboundEvent(endpoint, {
      status: "error",
      httpStatus: 400,
      message: "JSON inválido",
    });
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  return ingestInboundJson(endpoint, json);
}
